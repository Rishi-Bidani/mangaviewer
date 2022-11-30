import { MangaClash } from "./classnames.js";
import { promises as fs } from "fs";
import path from "path";
import { JSDOM } from "jsdom";

interface IMetaDataRoot {
    mangaName: string | undefined | null;
    mangaLink: string | undefined | null;
    availableChapters: number;
    downloadedChapters: number;
}

interface IMetaDataChapter {
    chapterName: string | undefined | null;
    chapterLink: URL | undefined | null;
    images: (string | undefined)[];
    numberOfImages: number;
    erroredImages: string[];
}

const BASE_MANGA_FOLDER = path.resolve("test");

class MetaData {
    // Create a log file for the root folder
    static async root(rootDom: JSDOM): Promise<void> {
        // The file will follow IMetaDataRoot structure
        const mangaName = rootDom.window.document.querySelector(MangaClash.title)?.textContent;
        const mangaLink = rootDom.window.document
            .querySelector(MangaClash.selfLink)
            ?.getAttribute("href");
        const availableChapters = rootDom.window.document.querySelectorAll(
            MangaClash.chapterList
        ).length;
        const downloadedChapters = 0;
        const metaData: IMetaDataRoot = {
            mangaName: mangaName?.trim(),
            mangaLink: mangaLink,
            availableChapters: availableChapters,
            downloadedChapters: downloadedChapters,
        };
        const metaDataPath = path.resolve(BASE_MANGA_FOLDER, "meta.json");
        await fs.writeFile(metaDataPath, JSON.stringify(metaData));
    }

    // Create a log file for the chapter folder
    static async chapter(logObject: IMetaDataChapter, chapterFolder: string): Promise<void> {
        await fs.writeFile(
            path.join(chapterFolder, "log.json"),
            JSON.stringify(logObject, null, 4)
        );
    }
}

export { MetaData, IMetaDataChapter, IMetaDataRoot };
