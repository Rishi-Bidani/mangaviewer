import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { getSettings } from "./settings.ts";

interface IFilesAndFolders {
    files: string[];
    folders: string[];
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp"]);

/**
 * @brief thrown when a requested path would resolve outside the base manga folder
 */
export class PathOutsideBaseError extends Error {
    constructor() {
        super("Path is outside the manga folder");
    }
}

/**
 * @returns the parsed file, or undefined if it's missing or unreadable (which is warned about)
 */
export async function readJson<T>(file: string): Promise<T | undefined> {
    try {
        return JSON.parse(await fs.readFile(file, "utf8")) as T;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            console.warn(`Ignoring unreadable "${file}": ${(error as Error).message}`);
        }
        return undefined;
    }
}

/**
 * @brief writes the file without ever leaving it half written: the data goes to a temporary file
 * next to it, which then replaces it in one step, so a crash keeps either the old or the new file
 */
export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
        const handle = await fs.open(temporary, "w");
        try {
            await handle.writeFile(data);
            // on disk before the rename, or a power cut could still leave an empty file behind
            await handle.sync();
        } finally {
            await handle.close();
        }
        await renameWithRetry(temporary, file);
    } catch (error) {
        await fs.rm(temporary, { force: true });
        throw error;
    }
}

/**
 * @brief deletes temporary files writeFileAtomic left in the folder when the server was killed
 * mid-write; only call this when nothing is writing there yet, e.g. at startup
 */
export async function removeLeftoverTemporaryFiles(folder: string): Promise<void> {
    const files = await fs.readdir(folder).catch(() => []);
    const leftovers = files.filter((file) => TEMPORARY_FILE.test(file));
    await Promise.all(leftovers.map((file) => fs.rm(path.join(folder, file), { force: true })));
}

// <file>.<uuid>.tmp, as named by writeFileAtomic
const TEMPORARY_FILE = /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/;

// windows refuses to replace a file that another program (e.g. a virus scanner) briefly has open
async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
        try {
            await fs.rename(from, to);
            return;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (attempt >= 5 || !(code === "EPERM" || code === "EBUSY" || code === "EACCES")) {
                throw error;
            }
            await sleep(50 * attempt);
        }
    }
}

async function getFilesAndFolders(dir: string): Promise<IFilesAndFolders> {
    const filesAndFolders = (await fs.readdir(dir, { withFileTypes: true })).filter(
        (entry) => !entry.name.startsWith(".")
    );
    const files = filesAndFolders.filter((file) => file.isFile()).map((file) => file.name);
    const folders = filesAndFolders.filter((file) => file.isDirectory()).map((file) => file.name);
    return { files, folders };
}

/**
 * @brief joins segments onto the base folder, refusing anything that escapes it (e.g. "../")
 */
async function resolveInBase(...segments: string[]): Promise<string> {
    const baseFolder = path.resolve(await FileHandler.baseFolder);
    const target = path.resolve(baseFolder, ...segments);
    const relative = path.relative(baseFolder, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new PathOutsideBaseError();
    }
    return target;
}

/**
 * @returns the parsed file, or undefined if it is missing or unreadable (warning about the latter)
 */

export default class FileHandler {
    static get port(): Promise<number> {
        return getSettings().then((settings) => settings.PORT);
    }

    static get baseFolder(): Promise<string> {
        return getSettings().then((settings) => settings.BASE_MANGA_FOLDER);
    }

    static get ignoreList(): Promise<string[]> {
        return getSettings().then((settings) => settings.IGNORE_LIST);
    }

    static get fetchMetadata(): Promise<boolean> {
        return getSettings().then((settings) => settings.FETCH_METADATA);
    }

    static get metadataFolder(): Promise<string> {
        return getSettings().then((settings) => settings.METADATA_FOLDER);
    }

    /**
     * @returns the absolute path of the manga's folder, throwing ENOENT/ENOTDIR if it isn't one
     */
    static async getMangaFolder(manga: string): Promise<string> {
        const folder = await resolveInBase(manga);
        if (!(await fs.stat(folder)).isDirectory()) {
            throw Object.assign(new Error(`${manga} is not a folder`), { code: "ENOTDIR" });
        }
        return folder;
    }

    static async getMangaList(): Promise<string[]> {
        const { folders } = await getFilesAndFolders(await FileHandler.baseFolder);
        const ignoreList = await FileHandler.ignoreList;
        return folders.filter((folder: string) => !ignoreList.includes(folder));
    }

    static async getChapterList(manga: string): Promise<string[]> {
        const { folders } = await getFilesAndFolders(await resolveInBase(manga));
        return folders;
    }

    /**
     * @returns the image file names inside the chapter folder
     */
    static async getChapterImages(manga: string, chapter: string): Promise<string[]> {
        const { files } = await getFilesAndFolders(await resolveInBase(manga, chapter));
        return files.filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
    }
}
