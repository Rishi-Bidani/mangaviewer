// the pages of a manga epub: the images its spine shows, in reading order. Text isn't shown, so
// novels have no pages
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { type IZipEntry, readZipEntries, readZipEntry } from "./zip.ts";

export interface IEpubPage {
    entry: IZipEntry;
    mediaType: string;
}

interface IManifestItem {
    href: string;
    mediaType: string;
}

interface ICachedEpub {
    mtimeMs: number;
    size: number;
    pages: IEpubPage[];
}

const IMAGE_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
};
// opening the same volume again doesn't parse it again, as long as the file is unchanged
const MAX_CACHED_EPUBS = 20;
const cache = new Map<string, ICachedEpub>();

// ---- reading the xml ----

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, name: string) => {
        const lower = name.toLowerCase();
        if (lower.startsWith("#x"))
            return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
        if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
        return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[lower] ?? whole;
    });
}

/**
 * @returns the attributes of every <tag ...> (with or without a namespace prefix), by name
 */
function findTags(xml: string, tag: string): Record<string, string>[] {
    const tags = new RegExp(`<(?:[\\w-]+:)?${tag}\\b([^>]*)>`, "gi");
    return [...xml.matchAll(tags)].map(([, attributes]) =>
        Object.fromEntries(
            [...attributes.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(
                ([, name, double, single]) => [name, decodeEntities(double ?? single)]
            )
        )
    );
}

/**
 * @returns the path inside the archive a link in the file `from` points to, or undefined for links
 * to other places (http:, data:, ...)
 */
function resolveHref(from: string, href: string | undefined): string | undefined {
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
        return undefined;
    }
    const [withoutFragment] = href.split(/[?#]/);
    let decoded = withoutFragment;
    try {
        decoded = decodeURIComponent(withoutFragment);
    } catch {
        // not percent-encoded after all
    }
    const joined = path.posix.join(path.posix.dirname(from), decoded);
    return path.posix.normalize(joined).replace(/^\/+/, "");
}

// ---- finding the pages ----

async function findPages(file: string): Promise<IEpubPage[]> {
    const entries = await readZipEntries(file);
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    // some epubs link to "Image.JPG" when the file is "image.jpg"
    const byLowerName = new Map(entries.map((entry) => [entry.name.toLowerCase(), entry]));
    const find = (name: string) => byName.get(name) ?? byLowerName.get(name.toLowerCase());
    const readText = async (name: string) => {
        const entry = find(name);
        return entry && (await readZipEntry(file, entry)).toString("utf8");
    };

    const container = await readText("META-INF/container.xml");
    const packagePath = container && findTags(container, "rootfile")[0]?.["full-path"];
    const packageXml = packagePath && (await readText(packagePath));
    if (!packagePath || !packageXml) {
        throw new Error("not an epub, it has no package file");
    }

    const manifest = new Map<string, IManifestItem>();
    for (const item of findTags(packageXml, "item")) {
        const href = resolveHref(packagePath, item.href);
        if (item.id && href) {
            manifest.set(item.id, { href, mediaType: item["media-type"] ?? "" });
        }
    }
    const mediaTypes = new Map([...manifest.values()].map((item) => [item.href, item.mediaType]));
    const imageType = (name: string) => {
        const type = mediaTypes.get(name);
        return type?.startsWith("image/")
            ? type
            : IMAGE_TYPES[path.posix.extname(name).toLowerCase()];
    };

    const pages: IEpubPage[] = [];
    const addPage = (name: string) => {
        const entry = find(name);
        const mediaType = imageType(name);
        // a page that shows the same image as the one before it adds nothing
        if (entry && mediaType && pages.at(-1)?.entry !== entry) {
            pages.push({ entry, mediaType });
        }
    };

    for (const { idref } of findTags(packageXml, "itemref")) {
        const item = manifest.get(idref);
        if (!item) continue;
        if (item.mediaType.startsWith("image/") && item.mediaType !== "image/svg+xml") {
            addPage(item.href);
            continue;
        }
        const document = await readText(item.href);
        if (!document) continue;
        // <img src> in html, <image href> or <image xlink:href> in svg
        for (const tag of [...findTags(document, "img"), ...findTags(document, "image")]) {
            const image = resolveHref(item.href, tag.src ?? tag.href ?? tag["xlink:href"]);
            if (image) addPage(image);
        }
    }

    // no spine to go by, so the images in the order they're listed
    if (pages.length === 0) {
        for (const { href, mediaType } of manifest.values()) {
            if (mediaType.startsWith("image/")) addPage(href);
        }
    }
    return pages;
}

/**
 * @returns the epub's page images in reading order, none for one without images or one that can't
 * be read (which is warned about once)
 */
export async function getEpubPages(file: string): Promise<IEpubPage[]> {
    const { mtimeMs, size } = await fs.stat(file);
    const cached = cache.get(file);
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
        // the most recently used ones are the last to be dropped
        cache.delete(file);
        cache.set(file, cached);
        return cached.pages;
    }

    let pages: IEpubPage[] = [];
    try {
        pages = await findPages(file);
        if (pages.length === 0) {
            console.warn(`"${file}" has no images, only epubs with image pages can be read`);
        }
    } catch (error) {
        console.warn(`Couldn't read "${file}": ${(error as Error).message}`);
    }
    cache.delete(file);
    cache.set(file, { mtimeMs, size, pages });
    if (cache.size > MAX_CACHED_EPUBS) {
        cache.delete(cache.keys().next().value as string);
    }
    return pages;
}

export async function readEpubPage(file: string, page: IEpubPage): Promise<Buffer> {
    return readZipEntry(file, page.entry);
}
