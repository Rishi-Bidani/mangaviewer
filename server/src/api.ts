import express from "express";
import { orderBy } from "natural-orderby";
import FileHandler, { PathOutsideBaseError } from "./system/filesystem.ts";
import { getAllMetadata, getCoverPath, getMetadata } from "./system/metadata.ts";
import { getPreferences, setMangaPreferences } from "./system/preferences.ts";

const router = express.Router();
router.use(express.json());

// express 5 forwards rejected promises from async handlers to the error handler below

router.get("/mangas", async (_req: express.Request, res: express.Response) => {
    // Return the list of all mangas
    res.json(await FileHandler.getMangaList());
});

router.get("/metadata", async (_req: express.Request, res: express.Response) => {
    // Return the metadata of all mangas, keyed by manga name
    res.json(await getAllMetadata());
});

router.post("/metadata/refresh", async (_req: express.Request, res: express.Response) => {
    // Look every manga up again, returns the same as GET /metadata
    res.json(await getAllMetadata(true));
});

router.post(
    "/mangas/:mangaName/metadata/refresh",
    async (req: express.Request<{ mangaName: string }>, res: express.Response) => {
        // Look the manga up again, ignoring what's cached; the result has lookup "pending"
        // unless lookups are off ("disabled") or the name is too short ("skipped")
        res.json(await getMetadata(req.params.mangaName, true));
    }
);

router.get("/preferences", async (_req: express.Request, res: express.Response) => {
    // Return the display preferences of every manga that has any, keyed by manga name
    res.json(await getPreferences());
});

router.patch(
    "/mangas/:mangaName/preferences",
    async (req: express.Request<{ mangaName: string }>, res: express.Response) => {
        // only the given preferences change, anilistId: null removes it
        const { showCover, anilistId } = req.body ?? {};
        if (showCover !== undefined && typeof showCover !== "boolean") {
            res.status(400).json({ error: "showCover must be true or false" });
            return;
        }
        if (
            anilistId !== undefined &&
            anilistId !== null &&
            !(Number.isInteger(anilistId) && anilistId > 0)
        ) {
            res.status(400).json({ error: "anilistId must be a positive whole number or null" });
            return;
        }
        if (showCover === undefined && anilistId === undefined) {
            res.status(400).json({ error: "Nothing to change, set showCover and/or anilistId" });
            return;
        }
        res.json(await setMangaPreferences(req.params.mangaName, { showCover, anilistId }));
    }
);

router.get(
    "/mangas/:mangaName/metadata",
    async (req: express.Request<{ mangaName: string }>, res: express.Response) => {
        res.json(await getMetadata(req.params.mangaName));
    }
);

router.get(
    "/mangas/:mangaName/cover",
    async (req: express.Request<{ mangaName: string }>, res: express.Response) => {
        const cover = await getCoverPath(req.params.mangaName);
        if (!cover) {
            res.status(404).json({ error: "No cover" });
            return;
        }
        // the cache folder can be a hidden one (.mangaviewer in the standalone executables)
        res.sendFile(cover, { dotfiles: "allow" });
    }
);

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
        } else if ((error as { type?: string }).type === "entity.parse.failed") {
            // malformed json body, from express.json()
            res.status(400).json({ error: "Invalid JSON" });
        } else if (error.code === "ENOENT" || error.code === "ENOTDIR") {
            res.status(404).json({ error: "Not found" });
        } else {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

export default router;
