import express from "express";
import { orderBy } from "natural-orderby";
import FileHandler, { PathOutsideBaseError } from "./system/filesystem.ts";

const router = express.Router();

// express 5 forwards rejected promises from async handlers to the error handler below

router.get("/mangas", async (_req: express.Request, res: express.Response) => {
    // Return the list of all mangas
    res.json(await FileHandler.getMangaList());
});

router.get(
    "/mangas/:mangaName/chapters",
    async (req: express.Request<{ mangaName: string }>, res: express.Response) => {
        // Return the list of all the chapters of the manga
        const chapterList = orderBy(await FileHandler.getChapterList(req.params.mangaName));
        res.json(chapterList);
    }
);

router.get(
    "/mangas/:manga/chapters/:chapter/images",
    async (req: express.Request<{ manga: string; chapter: string }>, res: express.Response) => {
        // Return the urls of all the images of the chapter
        const { manga, chapter } = req.params;
        const images = orderBy(await FileHandler.getChapterImages(manga, chapter)).map(
            (image) => `/images/${[manga, chapter, image].map(encodeURIComponent).join("/")}`
        );
        res.json(images);
    }
);

router.use(
    (
        error: NodeJS.ErrnoException,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
    ) => {
        if (error instanceof PathOutsideBaseError) {
            res.status(400).json({ error: error.message });
        } else if (error.code === "ENOENT" || error.code === "ENOTDIR") {
            res.status(404).json({ error: "Not found" });
        } else {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

export default router;
