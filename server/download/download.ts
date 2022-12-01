import { JSDOM } from "jsdom";
import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";

import { MangaClash } from "./classnames.js";
import { JSONWriter } from "../system/jsonwriter.js";
import { ImageDownloadError } from "./errors.js";

const BASE_MANGA_FOLDER = path.resolve("test");

interface IMetaDataChapter {
    chapterName: string | undefined | null;
    chapterLink: URL | undefined | null;
    images: (string | undefined)[];
    numberOfImages: number;
    erroredImages: string[];
}

class Download {
    public static async image(url: string, filepath: string, logFile: string) {
        try {
            const response = await fetch(url);
            const buffer: NodeJS.ReadableStream = (await response.body) as NodeJS.ReadableStream;
            fs.writeFile(filepath, buffer);
            console.log("Downloaded image: " + filepath);
        } catch (error) {
            console.error(error);
            JSONWriter.writeToErroredImages(logFile, url);
            // throw new ImageDownloadError("Error while downloading image", url, filepath);
        }
    }
}

class Chapter {
    public link: URL;
    public name: string;
    private folderPath: string;
    private dom!: Document;

    // =====================================================================
    constructor(link: URL, name: string) {
        this.link = link;
        this.name = name;
        this.folderPath = path.join(BASE_MANGA_FOLDER, this.name);
    }

    public static async init(link: URL, name: string): Promise<Chapter> {
        const chapter = new Chapter(link, name);
        chapter.dom = await chapter.getDOM();
        return chapter;
    }

    private async getDOM(): Promise<Document> {
        try {
            const response = await fetch(this.link.toString());
            const dom: JSDOM = new JSDOM(await response.text());
            return dom.window.document;
        } catch (error) {
            throw new Error("Error while fetching chapter");
        }
    }
    // =====================================================================
    private generateMetaDataObject() {
        const metaDataObject: IMetaDataChapter = {
            chapterName: this.name,
            chapterLink: this.link,
            images: this.images().map((img) => img.link),
            numberOfImages: this.images().length,
            erroredImages: [],
        };
        return metaDataObject;
    }

    private images(): { link: string; name: string }[] {
        const images = Array.from(this.dom.querySelectorAll(MangaClash.mangaImage), (img) => {
            const link: string = img.getAttribute("data-src")?.trim() as string;
            const name: string = path.basename(link);
            return { link, name };
        });
        return images;
    }

    public async download(): Promise<void> {
        try {
            await fs.mkdir(this.folderPath);
            console.log("Created folder: " + this.folderPath);
            // create log folder
            const logFile = path.join(this.folderPath, "log.json");
            const MDObj = this.generateMetaDataObject();
            await JSONWriter.write(MDObj, logFile);

            const downloadPromises = this.images().map((img) => {
                const filepath = path.join(this.folderPath, img.name);
                return Download.image(img.link, filepath, logFile);
            });

            Promise.all(downloadPromises);
        } catch (error) {
            const logFile = path.join(this.folderPath, "log.json");
            const MDObj: IMetaDataChapter = this.generateMetaDataObject();
            if (error instanceof ImageDownloadError) {
                MDObj.erroredImages.push(error.url);
                JSONWriter.write(MDObj, logFile);
            }
        }
    }
}

class Manga {
    public link: string;
    public name: string;
    private dom!: Document;

    constructor(link: string, name: string) {
        this.link = link;
        this.name = name;
    }

    public static async init(link: string, name: string): Promise<Manga> {
        const manga = new Manga(link, name);
        manga.dom = await manga.getDOM();
        return manga;
    }

    private async getDOM(): Promise<Document> {
        try {
            const response = await fetch(this.link);
            const dom: JSDOM = new JSDOM(await response.text());
            return dom.window.document;
        } catch (error) {
            throw new Error("Error while fetching manga");
        }
    }

    public chapters(): { link: string; name: string }[] {
        const chapters = Array.from(
            this.dom.querySelectorAll(MangaClash.chapterList),
            (chapter) => {
                const link: string = chapter.getAttribute("href")?.trim() as string;
                const name: string = chapter.textContent?.trim() as string;
                return { link, name };
            }
        );
        return chapters;
    }

    public async download(start: number, chaptersToDownload: number): Promise<boolean> {
        const chapters = this.chapters();
        console.log(chapters.slice(start, start + chaptersToDownload));
        const chapterPromises = chapters
            .slice(start, start + chaptersToDownload)
            .map(async (chapter) => {
                const chapterObj = await Chapter.init(new URL(chapter.link), chapter.name);
                chapterObj.download();
            });
        await Promise.all(chapterPromises);
        return true;
    }
}

// Tests
async function testDownloadChapter() {
    const chapterLink = "https://mangaclash.com/manga/martial-peak/chapter-2826/";
    const chapterName = "Chapter 2826";
    const chapter = await Chapter.init(new URL(chapterLink), chapterName);
    await chapter.download();
}

async function testDownloadManga() {
    const mangaLink = "https://mangaclash.com/manga/one-punch-man/";
    const mangaName = "One Punch Man";
    const manga = await Manga.init(mangaLink, mangaName);
    const chapters = manga.chapters();
    const start = chapters.length - 10;
    const chapterToDownload = 10;
    if (await manga.download(start, chapterToDownload)) {
        console.log("Downloaded");
    }
}

// testDownloadChapter();
testDownloadManga();
