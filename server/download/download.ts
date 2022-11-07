import { JSDOM } from "jsdom";
import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";
import { Response } from "node-fetch";

import { ImageFetchError, DownloadImageError } from "./downloaderrors.js";

interface IChapterLink {
    name: string | null;
    link: string;
}

const BASE_MANGA_FOLDER = path.resolve("test");

async function getChapterLinks(mangaLink: string): Promise<IChapterLink[]> {
    const mangaClashChapterLink = ".wp-manga-chapter a";
    const chapterLinks: IChapterLink[] = [];
    let response: Response;
    try {
        response = await fetch(mangaLink);
    } catch (error) {}

    const dom = new JSDOM(await response.text());
    const domChapterLinks: HTMLAnchorElement[] = Array.from(
        dom.window.document.querySelectorAll(mangaClashChapterLink)
    );
    domChapterLinks.forEach((a) => {
        const linkObject: IChapterLink = {
            name: a!.textContent!.trim(),
            link: a.href,
        };
        chapterLinks.push(linkObject);
    });

    return chapterLinks;
}

async function getChapterImages(chapterLink: string): Promise<(string | undefined)[]> {
    const mangaClashImgTag = ".reading-content img";

    const response = await fetch(chapterLink);
    const dom = new JSDOM(await response.text());
    const chapterImages: HTMLImageElement[] = Array.from(
        dom.window.document.querySelectorAll(mangaClashImgTag)
    );
    const chapterImageLinks: (string | undefined)[] = chapterImages.map((img: HTMLImageElement) => {
        if (img) {
            return img.dataset.src?.trim();
        } else {
            throw new ImageFetchError(img);
        }
    });

    return chapterImageLinks;
}

async function downloadImageFromURL(url: string, path: string): Promise<void> {
    const response = await fetch(url);
    const buffer: NodeJS.ReadableStream | null = await response.body;

    if (buffer === null) {
        console.error('Could not download image from url: "' + url + '"');
        throw new DownloadImageError(url);
    }

    fs.writeFile(path, buffer);
    console.log("Downloaded: " + url);
}

async function downloadChapter(chapter: IChapterLink, pathname: string): Promise<void> {
    try {
        const chapterImages = getChapterImages(chapter.link);
        // create chapter folder
        const chapterFolder = path.join(pathname, chapter.name ?? "Chapter");
        await fs.mkdir(chapterFolder);

        // download images
        const images = await chapterImages;
        // create log file for the chapter
        try {
            /**
             * {
             *  chapterName: string,
             *  chapterLink: string,
             *  images: string[],
             *  numberOfImages: number,
             * }
             */
            const logObject = {
                chapterName: chapter.name,
                chapterLink: chapter.link,
                images: images,
                numberOfImages: images.length,
            };
            await fs.writeFile(path.join(chapterFolder, "log.json"), JSON.stringify(logObject));
        } catch (error) {}

        const downloadPromises: Promise<void>[] = images.map((image, index) => {
            if (image) {
                const imageExtension = path.extname(image);
                const imageName = `${index + 1}${imageExtension}`;
                const downloadPath = path.join(chapterFolder, imageName);
                return downloadImageFromURL(image, downloadPath);
            } else {
                throw Error("Image is undefined");
            }
        });
        Promise.all(downloadPromises);
    } catch (error) {
        if (error instanceof ImageFetchError) {
            console.error("Error in getChapterImages");
            console.log(error.message);
        } else if (error instanceof DownloadImageError) {
            console.error("Error in downloadImageFromURL");
            console.log(error);
        }
    }
}

async function downloadManga(link: string) {
    const chapterLinks = await getChapterLinks(link);
    const downloadPromises: Promise<void>[] = chapterLinks.map((chapter) => {
        return downloadChapter(chapter, BASE_MANGA_FOLDER);
    });
    Promise.all(downloadPromises);
}

// getChapterLinks(mangaLink).then(async (items) => {
//     const firstLink = items[0].link;
//     console.log(firstLink);
//     try {
//         const chapterImages = await getChapterImages(firstLink);
//         console.log(await chapterImages);
//     } catch (error) {
//         if (error instanceof ImageFetchError) {
//             console.log(error.message);
//         }
//     }
// });

async function main() {
    // const mangaLink = "https://mangaclash.com/manga/the-descent-of-the-demonic-master/";
    const chapterLink =
        "https://mangaclash.com/manga/the-descent-of-the-demonic-master/chapter-141/";
    const downloadPath = path.join(BASE_MANGA_FOLDER);
    const chapter: IChapterLink = {
        name: "Chapter 141",
        link: chapterLink,
    };
    await downloadChapter(chapter, downloadPath);

    // await downloadManga(mangaLink);
}

await main();
