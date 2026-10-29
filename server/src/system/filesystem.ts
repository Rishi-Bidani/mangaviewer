import { promises as fs } from "node:fs";
import * as path from "node:path";

interface IFilesAndFolders {
    files: string[];
    folders: string[];
}

interface ISettings {
    /**
     * @brief The port the server listens on, defaults to 8080
     */
    PORT?: number;

    /**
     * @brief The folder where the mangas are downloaded and stored, either as a path or as
     * path segments
     * @example "C:\applications\my mangas" or ["C:", "applications", "my mangas"]
     */
    BASE_MANGA_FOLDER: string | string[];

    /**
     * @brief the mangas or other folders that should be ignored
     * @example ["bleach", "naruto"]
     */
    IGNORE_LIST: string[];
}

import { dirname } from "node:path";
// defining __dirname
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// server/data, from both src/system and dist/system
const SETTINGS_PATH = path.join(__dirname, "..", "..", "data", "settings.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp"]);

/**
 * @brief thrown when a requested path would resolve outside the base manga folder
 */
export class PathOutsideBaseError extends Error {
    constructor() {
        super("Path is outside the manga folder");
    }
}

async function readSettings(): Promise<ISettings> {
    // a missing settings.json is fine, e.g. in the standalone bundle
    const rawSettings = await fs.readFile(SETTINGS_PATH, "utf8").catch((error) => {
        if (error.code === "ENOENT") return "";
        throw error;
    });
    const settings: ISettings = rawSettings
        ? JSON.parse(rawSettings)
        : { BASE_MANGA_FOLDER: [], IGNORE_LIST: [] };

    // env vars override settings.json (the docker image sets these)
    const { PORT, BASE_MANGA_FOLDER, IGNORE_LIST } = process.env;
    if (PORT) {
        settings.PORT = Number(PORT);
    }
    if (BASE_MANGA_FOLDER) {
        settings.BASE_MANGA_FOLDER = BASE_MANGA_FOLDER;
    }
    // an empty IGNORE_LIST still overrides, so docker users can clear the baked-in list
    if (IGNORE_LIST !== undefined) {
        settings.IGNORE_LIST = IGNORE_LIST.split(",")
            .map((name) => name.trim())
            .filter(Boolean);
    }

    return settings;
}

// settings are read once, on first use (so env vars can still be set before that); restart the
// server to pick up changes
let settingsPromise: Promise<ISettings> | undefined;
function getSettings(): Promise<ISettings> {
    settingsPromise ??= readSettings();
    return settingsPromise;
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

export default class FileHandler {
    static get port(): Promise<number> {
        return getSettings().then((settings) => settings.PORT || 8080);
    }

    static get baseFolder(): Promise<string> {
        return getSettings().then((settings) => path.join(...[settings.BASE_MANGA_FOLDER].flat()));
    }

    static get ignoreList(): Promise<string[]> {
        return getSettings().then((settings) => settings.IGNORE_LIST);
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
