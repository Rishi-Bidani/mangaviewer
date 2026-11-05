// reading single files out of a zip archive (e.g. an epub) without loading all of it
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { inflateRaw } from "node:zlib";

const inflateRawAsync = promisify(inflateRaw);

export interface IZipEntry {
    name: string;
    method: number;
    flags: number;
    compressedSize: number;
    size: number;
    localHeaderOffset: number;
}

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
// the end record is 22 bytes, followed by a comment of up to 65535
const MAX_END_RECORD = 22 + 0xffff;
const STORED = 0;
const DEFLATED = 8;

async function readAt(handle: fs.FileHandle, position: number, length: number): Promise<Buffer> {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, position);
    if (bytesRead < length) {
        throw new Error("the zip file is cut off");
    }
    return buffer;
}

/**
 * @returns every file in the archive, in the order of its central directory
 * @throws Error if it isn't a zip file, or one this can't read (zip64, i.e. over 4 GB)
 */
export async function readZipEntries(file: string): Promise<IZipEntry[]> {
    const handle = await fs.open(file, "r");
    try {
        const { size } = await handle.stat();
        const tailLength = Math.min(size, MAX_END_RECORD);
        const tail = await readAt(handle, size - tailLength, tailLength);
        let end = -1;
        for (let i = tail.length - 22; i >= 0; i--) {
            if (tail.readUInt32LE(i) === END_OF_CENTRAL_DIRECTORY) {
                end = i;
                break;
            }
        }
        if (end < 0) {
            throw new Error("not a zip file");
        }
        const count = tail.readUInt16LE(end + 10);
        const directorySize = tail.readUInt32LE(end + 12);
        const directoryOffset = tail.readUInt32LE(end + 16);
        if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
            throw new Error("zip64 files aren't supported");
        }

        const directory = await readAt(handle, directoryOffset, directorySize);
        const entries: IZipEntry[] = [];
        let offset = 0;
        for (let i = 0; i < count; i++) {
            if (directory.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) {
                throw new Error("the zip file's directory is broken");
            }
            const nameLength = directory.readUInt16LE(offset + 28);
            const extraLength = directory.readUInt16LE(offset + 30);
            const commentLength = directory.readUInt16LE(offset + 32);
            entries.push({
                name: directory.toString("utf8", offset + 46, offset + 46 + nameLength),
                flags: directory.readUInt16LE(offset + 8),
                method: directory.readUInt16LE(offset + 10),
                compressedSize: directory.readUInt32LE(offset + 20),
                size: directory.readUInt32LE(offset + 24),
                localHeaderOffset: directory.readUInt32LE(offset + 42),
            });
            offset += 46 + nameLength + extraLength + commentLength;
        }
        return entries;
    } finally {
        await handle.close();
    }
}

/**
 * @returns the uncompressed contents of the entry
 * @throws Error if it's encrypted or compressed in a way other than deflate
 */
export async function readZipEntry(file: string, entry: IZipEntry): Promise<Buffer> {
    if (entry.flags & 1) {
        throw new Error(`"${entry.name}" is encrypted`);
    }
    if (entry.method !== STORED && entry.method !== DEFLATED) {
        throw new Error(`"${entry.name}" uses an unsupported compression method`);
    }
    const handle = await fs.open(file, "r");
    let data: Buffer;
    try {
        const header = await readAt(handle, entry.localHeaderOffset, 30);
        if (header.readUInt32LE(0) !== LOCAL_FILE_HEADER) {
            throw new Error(`"${entry.name}" is broken`);
        }
        // the name and extra field here can differ in length from the central directory's
        const dataOffset =
            entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
        data = await readAt(handle, dataOffset, entry.compressedSize);
    } finally {
        await handle.close();
    }
    if (entry.method === STORED) {
        return data;
    }
    // the stated size caps the output, so a zip bomb can't use up the memory
    return inflateRawAsync(data, { maxOutputLength: Math.max(entry.size, 1) });
}
