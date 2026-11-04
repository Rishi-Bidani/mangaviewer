// keeps reading progress in an Excel file with one row per manga; the file is written from scratch
// each time, so changes made to it by hand don't last
import * as path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import type { IExtension } from "./api.ts";

const FILE_NAME = "progress.xlsx";
const HEADERS = ["Manga", "Chapter", "Chapter name", "Updated"];
const COLUMN_WIDTHS = [48, 10, 40, 20];

interface IRow {
    manga: string;
    chapterNumber: number;
    chapter: string;
    updated: string;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Progress" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const WORKBOOK_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// style 0 is the default, style 1 is the bold header
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function escapeXml(text: string): string {
    return (
        text
            // these can't appear in an xml file at all, not even escaped
            // biome-ignore lint/suspicious/noControlCharactersInRegex: that's the point
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
    );
}

function textCell(reference: string, text: string, style = 0): string {
    const content = escapeXml(text);
    return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${content}</t></is></c>`;
}

function sheet(rows: IRow[]): string {
    const header = HEADERS.map((text, column) => textCell(`${"ABCD"[column]}1`, text, 1)).join("");
    const body = rows.map((row, index) => {
        const line = index + 2;
        return (
            `<row r="${line}">${textCell(`A${line}`, row.manga)}` +
            `<c r="B${line}"><v>${row.chapterNumber}</v></c>` +
            `${textCell(`C${line}`, row.chapter)}${textCell(`D${line}`, row.updated)}</row>`
        );
    });
    const columns = COLUMN_WIDTHS.map(
        (width, index) =>
            `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
    ).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData><row r="1">${header}</row>${body.join("")}</sheetData><autoFilter ref="A1:D${rows.length + 1}"/></worksheet>`;
}

/**
 * @returns a zip file, which is what an xlsx file is, without file dates
 */
function zip(files: Record<string, string>): Buffer {
    const parts: Buffer[] = [];
    const directory: Buffer[] = [];
    let offset = 0;
    for (const [name, text] of Object.entries(files)) {
        const content = Buffer.from(text);
        const compressed = deflateRawSync(content);
        const fileName = Buffer.from(name);
        // the fields the local header and the central directory entry have in common
        const common = Buffer.alloc(26);
        common.writeUInt16LE(20, 0); // version needed
        common.writeUInt16LE(0x0800, 2); // names are utf-8
        common.writeUInt16LE(8, 4); // deflate
        common.writeUInt16LE(0, 6); // time
        common.writeUInt16LE(0x0021, 8); // date, 1 january 1980 is the earliest there is
        common.writeUInt32LE(crc32(content), 10);
        common.writeUInt32LE(compressed.length, 14);
        common.writeUInt32LE(content.length, 18);
        common.writeUInt16LE(fileName.length, 22);

        const signature = Buffer.alloc(4);
        signature.writeUInt32LE(0x04034b50);
        parts.push(signature, common, fileName, compressed);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4); // version made by
        common.copy(entry, 6);
        entry.writeUInt32LE(offset, 42);
        directory.push(entry, fileName);

        offset += signature.length + common.length + fileName.length + compressed.length;
    }
    const directorySize = directory.reduce((size, part) => size + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(directory.length / 2, 8);
    end.writeUInt16LE(directory.length / 2, 10);
    end.writeUInt32LE(directorySize, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, ...directory, end]);
}

function workbook(rows: IRow[]): Buffer {
    return zip({
        "[Content_Types].xml": CONTENT_TYPES,
        "_rels/.rels": ROOT_RELATIONSHIPS,
        "xl/workbook.xml": WORKBOOK,
        "xl/_rels/workbook.xml.rels": WORKBOOK_RELATIONSHIPS,
        "xl/styles.xml": STYLES,
        "xl/worksheets/sheet1.xml": sheet(rows),
    });
}

export default {
    id: "excel",
    name: "Excel spreadsheet",
    apiVersion: 1,
    async setup(context) {
        const file = path.join(context.storageFolder, FILE_NAME);
        const rows = new Map(Object.entries(context.store.all<IRow>()));

        context.provideSync({
            getFile: () => (rows.size > 0 ? file : undefined),
            async save(progress) {
                const row: IRow = {
                    manga: progress.manga,
                    chapterNumber: progress.chapterNumber,
                    chapter: progress.chapter,
                    // the server's local time, as year-month-day hour:minute:second
                    updated: new Date(progress.finishedAt).toLocaleString("sv"),
                };
                rows.set(progress.manga, row);
                context.store.set(progress.manga, row);
                const sorted = [...rows.values()].sort((a, b) => a.manga.localeCompare(b.manga));
                try {
                    await context.writeFile(FILE_NAME, workbook(sorted));
                } catch (error) {
                    const code = (error as NodeJS.ErrnoException).code;
                    if (code === "EPERM" || code === "EBUSY" || code === "EACCES") {
                        throw new Error(`${FILE_NAME} is open in another program, close it`);
                    }
                    throw error;
                }
            },
        });
    },
} satisfies IExtension;
