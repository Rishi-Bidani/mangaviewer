import { JSDOM } from "jsdom";
import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";

import { MangaClash } from "./classnames.js";
import { IMetaDataChapter, MetaData } from "./logwriter.js";
import { DownloadImageError } from "./downloaderrors.js";
const BASE_MANGA_FOLDER = path.resolve("test");

interface IChapterLink {
    name: string | null;
    link: URL;
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
            const link: string = img.getAttribute("data-src") as string;
            const name: string = path.basename(link);
            return { link, name };
        });
        return images;
    }

    public async download(): Promise<void> {}
}

class Download {
    link: URL;
    dom!: Document;
    private baseFolder: string = BASE_MANGA_FOLDER;

    /* --------------------------- Construction ---------------------------------- */

    constructor(link: URL) {
        this.link = link;
    }

    private getDom = async () => {
        try {
            const response = await fetch(this.link.toString());
            this.dom = new JSDOM(await response.text()).window.document;
        } catch (error) {
            throw new Error("Unable to fetch the main page");
        }
    };

    // static factory constructor
    static async create(link: URL): Promise<Download> {
        const downloader = new Download(link);
        await downloader.getDom();
        return downloader;
    }

    /* --------------------------- Getters ---------------------------------- */

    get chapterList(): IChapterLink[] {
        // Function to get the list of chapters
        const chapterList: HTMLAnchorElement[] = Array.from(
            this.dom.querySelectorAll(MangaClash.chapterList)
        );
        const chapterLinks: IChapterLink[] = chapterList.map((a) => {
            const linkObject: IChapterLink = {
                name: a.textContent!.trim(),
                link: new URL(a.href),
            };
            return linkObject;
        });

        return chapterLinks;
    }

    /* --------------------------- Image download methods ---------------------------------- */

    private async downloadImage(url: URL, path: string): Promise<void> {
        // Function to download a single image
        try {
            const response = await fetch(url.toString());
            const buffer: NodeJS.ReadableStream = (await response.body) as NodeJS.ReadableStream;
            fs.writeFile(path, buffer);
            console.log("Downloaded image: " + url);
        } catch (error) {
            throw new DownloadImageError("Unable to download image: ", url);
        }
    }

    public async downloadCoverImage() {
        // Function to download the cover image
        try {
            const coverImage: string = this.dom
                .querySelector(MangaClash.coverImage)
                ?.getAttribute("data-src") as string;

            const imageName = await path.basename(coverImage);
            const coverImagePath = path.resolve(this.baseFolder, imageName);
            this.downloadImage(new URL(coverImage), coverImagePath);
        } catch (error) {
            console.error(error);
            throw new Error("Unable to download cover image");
        }
    }

    private async createChapterMetaData(
        chapterName: string,
        chapterLink: string,
        folderpath: string
    ) {
        // Function to create the meta data file for a chapter
        try {
            const metaData: IMetaDataChapter = {
                chapterName,
                chapterLink,
            };
            const meta = MetaData.chapter(folderpath);
            await meta.write();
        } catch (error) {
            console.error(error);
            throw new Error("Unable to create chapter meta data file");
        }
    }

    /**============================================================================= */
    // Complete download methods
    /**============================================================================= */

    async chapter(chapter: IChapterLink, pathname: string) {
        // Function to download a single chapter
        /**
         * 1. Get the list of images
         * 2. Create the meta data log file
         * 3. Download the images
         */
        try {
            const chapterDOM = new JSDOM(await (await fetch(chapter.link.toString())).text()).window
                .document;

            const chapterFolder: string = path.join(
                this.baseFolder,
                pathname,
                chapter.name as string
            );
            const imageList: HTMLImageElement[] = Array.from(
                chapterDOM.querySelectorAll(MangaClash.mangaImage)
            );

            // Create folder and meta data file
            fs.mkdir(chapterFolder, { recursive: true });

            const downloadPromises = imageList.map((image, index) => {
                const imageLink: string = image.getAttribute("data-src") as string;
                const imageName = path.basename(imageLink);
                const imagePath = path.join(chapterFolder, imageName);
                return this.downloadImage(new URL(imageLink), imagePath);
            });

            return Promise.all(downloadPromises);
        } catch (error) {
            console.error(error);
            if (error instanceof DownloadImageError) {
                const { url } = error;
                const;
                // Add url to meta data under erroredDownloads
            }
            // throw new Error("Unable to download chapter");
        }
    }

    async manga() {
        // Function to download entire manga
        /**
         * 1. Get the list of chapters
         * 2. Create the main meta data file
         * 2. Download the cover image
         * 3. For each chapter
         *    3.1 Create a folder for the chapter
         *    3.2 Create the meta data log file
         *    3.3 Download the chapter images
         */
        try {
            const chapterList = this.chapterList;
            this.downloadCoverImage();
        } catch (error) {
            console.error(error);
            throw new Error("Unable to download manga");
        }
    }
}

// Tests
async function testDownloadCoverImage() {
    const mangaLink = "https://mangaclash.com/manga/the-descent-of-the-demonic-master/";
    const download = await Download.create(new URL(mangaLink));
    await download.downloadCoverImage();
}

async function testDownloadChapter() {
    const chapterLink = "https://mangaclash.com/manga/martial-peak/chapter-2826/";
    const download = await Download.create(new URL(chapterLink));
    const pathname = path.join("martial-peak", "chapter-2826");
    await download.chapter({ name: "Chapter 2826", link: new URL(chapterLink) }, pathname);
}

testDownloadChapter();

// testDownloadCoverImage();

// export { downloadManga };
