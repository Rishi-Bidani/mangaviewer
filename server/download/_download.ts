import { JSDOM } from "jsdom";
import { promises as fs } from "fs";
import path from "path";
import fetch from "node-fetch";

import { MangaClash } from "./classnames.js";
import { MetaData, IMetaDataChapter } from "./logwriter.js";
import { ImageFetchError, DownloadImageError, MainFetchError } from "./downloaderrors.js";

interface IChapterLink {
    name: string | null;
    link: URL;
}

const BASE_MANGA_FOLDER = path.resolve("test");

async function getDom(link: URL): Promise<JSDOM> {
    try {
        const response = await fetch(link.toString());
        const dom = new JSDOM(await response.text());
        return dom;
    } catch (error) {
        throw new MainFetchError();
    }
}

async function downloadCoverImage(dom: JSDOM): Promise<void> {
    const coverImage = dom.window.document
        .querySelector(MangaClash.coverImage)
        ?.getAttribute("data-src");
    console.log(coverImage);
    if (coverImage) {
        const extension = path.extname(coverImage);
        const coverImagePath = path.resolve(BASE_MANGA_FOLDER, `cover${extension}`);
        await downloadImageFromURL(coverImage, coverImagePath);
    }
}

async function getChapterLinks(mangaLink: URL): Promise<IChapterLink[]> {
    const chapterLinks: IChapterLink[] = [];

    const dom = await getDom(mangaLink);

    const domChapterLinks: HTMLAnchorElement[] = Array.from(
        dom.window.document.querySelectorAll(MangaClash.chapterList)
    );
    domChapterLinks.forEach((a) => {
        const linkObject: IChapterLink = {
            name: a!.textContent!.trim(),
            link: new URL(a.href),
        };
        chapterLinks.push(linkObject);
    });

    MetaData.root(dom);
    downloadCoverImage(dom);
    return chapterLinks;
}

async function getChapterImages(chapterLink: URL): Promise<(string | undefined)[]> {
    const response = await fetch(chapterLink.toString());
    const dom = new JSDOM(await response.text());
    const chapterImages: HTMLImageElement[] = Array.from(
        dom.window.document.querySelectorAll(MangaClash.mangaImage)
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
            const logObject: IMetaDataChapter = {
                chapterName: chapter.name,
                chapterLink: chapter.link,
                images: images,
                numberOfImages: images.length,
            };
            MetaData.chapter(logObject, chapterFolder);
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

async function downloadManga(link: URL) {
    const chapterLinks = await getChapterLinks(link);
    const downloadPromises: Promise<void>[] = chapterLinks.map((chapter) => {
        return downloadChapter(chapter, BASE_MANGA_FOLDER);
    });
    Promise.all(downloadPromises);
}

export { downloadManga };

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

// async function main() {
//     // const mangaLink = "https://mangaclash.com/manga/the-descent-of-the-demonic-master/";
//     const chapterLink =
//         "https://mangaclash.com/manga/the-descent-of-the-demonic-master/chapter-141/";
//     const downloadPath = path.join(BASE_MANGA_FOLDER);
//     const chapter: IChapterLink = {
//         name: "Chapter 141",
//         link: chapterLink,
//     };
//     await downloadChapter(chapter, downloadPath);

//     // await downloadManga(mangaLink);
// }

// await main();

function testgetChapterLinks() {
    const mangaLink = new URL("https://mangaclash.com/manga/the-descent-of-the-demonic-master/");
    getChapterLinks(mangaLink).then((items) => {
        // console.log(items);
    });
}

function testDownloadManga() {
    const mangaLink = new URL("https://mangaclash.com/manga/the-descent-of-the-demonic-master/");
    downloadManga(mangaLink);
}

// testgetChapterLinks();
// testDownloadManga();
