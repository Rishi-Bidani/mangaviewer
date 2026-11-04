// the manga library on disk, and reading and writing files safely
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { getEnv } from "./env.ts";
import { NotFoundError } from "./errors.ts";

interface IFilesAndFolders {
    files: string[];
    folders: string[];
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp"]);
// <file>.<uuid>.tmp, as named by writeFileAtomic
const TEMPORARY_FILE = /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/;

// ---- reading and writing files ----

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

// ---- the manga library ----

async function getFilesAndFolders(dir: string): Promise<IFilesAndFolders> {
    const filesAndFolders = (await fs.readdir(dir, { withFileTypes: true })).filter(
        (entry) => !entry.name.startsWith(".")
    );
    const files = filesAndFolders.filter((file) => file.isFile()).map((file) => file.name);
    const folders = filesAndFolders.filter((file) => file.isDirectory()).map((file) => file.name);
    return { files, folders };
}

/**
 * @returns the folder's contents
 * @throws NotFoundError if it doesn't exist
 */
async function getLibraryFolder(dir: string, name: string): Promise<IFilesAndFolders> {
    try {
        return await getFilesAndFolders(dir);
    } catch (error) {
        const { code } = error as NodeJS.ErrnoException;
        if (code === "ENOENT" || code === "ENOTDIR") {
            throw new NotFoundError(`${name} doesn't exist`);
        }
        throw error;
    }
}

// one folder in the library: "." or "a/b" are paths, and hidden folders aren't part of it
function isFolderName(name: string): boolean {
    return name !== "" && !name.startsWith(".") && !/[/\\]/.test(name);
}

/**
 * @returns the path of a manga or something in it
 * @throws NotFoundError if that isn't part of the library
 */
async function resolveInLibrary(manga: string, ...rest: string[]): Promise<string> {
    const segments = [manga, ...rest];
    const baseFolder = path.resolve(FileHandler.baseFolder);
    const target = path.resolve(baseFolder, ...segments);
    const relative = path.relative(baseFolder, target);
    // the path check is for what's still a path on windows, like "C:folder"
    const isOutside = relative.startsWith("..") || path.isAbsolute(relative);
    if (!segments.every(isFolderName) || isOutside || !(await FileHandler.isListed(manga))) {
        throw new NotFoundError(`${segments.join("/")} isn't in the library`);
    }
    return target;
}

export default class FileHandler {
    static get baseFolder(): string {
        return getEnv().BASE_MANGA_FOLDER;
    }

    /**
     * @brief whether it's the exact name of a manga in the list; comparing with IGNORE_LIST isn't
     * enough, since on windows and macos other spellings like "NARUTO", "naruto." or the short name
     * "NARUTO~1" open the same folder
     */
    static async isListed(manga: string): Promise<boolean> {
        return (await FileHandler.getMangaList()).includes(manga);
    }

    /**
     * @returns the absolute path of the manga's folder
     * @throws NotFoundError if it isn't one
     */
    static async getMangaFolder(manga: string): Promise<string> {
        return resolveInLibrary(manga);
    }

    static async getMangaList(): Promise<string[]> {
        const { folders } = await getFilesAndFolders(FileHandler.baseFolder);
        const ignored = getEnv().IGNORE_LIST;
        return folders.filter((folder) => !ignored.includes(folder));
    }

    static async getChapterList(manga: string): Promise<string[]> {
        const { folders } = await getLibraryFolder(await resolveInLibrary(manga), manga);
        return folders;
    }

    /**
     * @returns the image file names inside the chapter folder
     */
    static async getChapterImages(manga: string, chapter: string): Promise<string[]> {
        const { files } = await getLibraryFolder(
            await resolveInLibrary(manga, chapter),
            `${manga}/${chapter}`
        );
        return files.filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
    }
}
