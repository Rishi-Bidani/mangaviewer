import express from "express";
import { orderBy } from "natural-orderby";
import FileHandler from "./system/filesystem.js";
// const require = createRequire(import.meta.url);
// const localIpV4Address = require("local-ipv4-address");
const router = express.Router();

router.get("/mangas", async (req: express.Request, res: express.Response) => {
    // Return the list of all mangas
    const mangas = FileHandler.getMangaList();
    res.json(await mangas);
});

router.get("/mangas/:mangaName/chapters", async (req: express.Request, res: express.Response) => {
    // Return the list of all the chapters of the manga
    const mangaName = req.params.mangaName;
    const chapterList = orderBy(await FileHandler.getChapterList(mangaName));
    res.send(chapterList);
});

router.get(
    "/mangas/:manga/chapters/:chapter/images",
    async (req: express.Request, res: express.Response) => {
        try {
            // Return the list of all the images of the chapter
            const manga = req.params.manga;
            const chapter = req.params.chapter;
            // const ipAddress = await localIpV4Address();
            const images = orderBy(await FileHandler.getChapterImages(manga, chapter)).map(
                (image) => {
                    // return `http://localhost:${PORT}/${image}`;
                    return `/images/${image}`;
                }
            );
            res.send(images);
        } catch (error: any) {
            console.log(error);
            res.status(400).send(error.code);
        }
    }
);

export default router;
