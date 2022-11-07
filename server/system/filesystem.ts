import * as path from "path";
import { promises as fs } from "fs";

interface IFilesAndFolders {
    files: string[];
    folders: string[];
}

interface ISettings {
    /**
     * @brief The base path to the folder where the mangas are downloaded and stored
     * @example ["C:", "applications", "my mangas"]
     */
    BASE_MANGA_FOLDER: string[];

    /**
     * @brief the mangas or other folders that should be ignored
     * @example ["bleach", "naruto"]
     */
    IGNORE_LIST: string[];
}

// defining __dirname
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SETTINGS_PATH = path.join(__dirname, "..", "data", "settings.json");

// TYPES
// typedef pathstring

async function getSettings(): Promise<ISettings> {
    const settings = await fs.readFile(SETTINGS_PATH, "utf8");
    return JSON.parse(settings);
}

async function getFilesAndFolders(dir: string): Promise<IFilesAndFolders> {
    const filesAndFolders = await fs.readdir(dir, { withFileTypes: true });
    const files = filesAndFolders.filter((file) => file.isFile()).map((file) => file.name);
    const folders = filesAndFolders.filter((file) => file.isDirectory()).map((file) => file.name);
    return { files, folders };
}

export default class FileHandler {
    static get baseFolder(): Promise<string> {
        return (async (): Promise<string> => {
            const settings: ISettings = await getSettings();
            return path.join(...settings["BASE_MANGA_FOLDER"]);
        })();
    }

    static get ignoreList(): Promise<string[]> {
        return (async (): Promise<string[]> => {
            const settings: ISettings = await getSettings();
            const ignoreList: string[] = settings.IGNORE_LIST;
            const baseFolder: string[] = settings.BASE_MANGA_FOLDER;
            (await ignoreList).map(async (item: string) => path.join(...(await baseFolder), item));
            return ignoreList;
        })();
    }

    static async getMangaList(): Promise<string[]> {
        const baseFolder = await FileHandler.baseFolder;
        const _ignoreList: Promise<string[]> = FileHandler.ignoreList;
        const { folders } = await getFilesAndFolders(baseFolder);
        // resolve ignoreList promise
        const ignoreList = await _ignoreList;
        return folders.filter((folder: string) => !ignoreList.includes(folder));
    }

    static async getChapterList(manga: string): Promise<string[]> {
        const baseFolder = FileHandler.baseFolder;
        const { folders } = await getFilesAndFolders(path.join(await baseFolder, manga));
        return folders;
    }
    // static async getChapterImages(manga: string, chapter: string): Promise<string[]> {}

    // get data
    // static async getMangaListData(): Promise<> {}
    // static async getChapterListData(manga: string): Promise<> {}
    // static async getChapterImagesData(manga: string, chapter: string): Promise<> {}
}

// getFilesAndFolders(testDir).then((result) => console.log(result));
// FileHandler.getChapterList("claymore").then((result) => console.log(result));
