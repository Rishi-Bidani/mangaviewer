import express from "express";
import path from "path";

import { orderBy } from "natural-orderby";

// require for modules
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const app = express();
const http = require("http").Server(app);
const PORT: number = 5000;

const localIpV4Address = require("local-ipv4-address");

const BASE_FOLDER = await FileHandler.baseFolder;
app.use(express.static(BASE_FOLDER));

const cors = require("cors");
app.use(cors());

import FileHandler from "./system/filesystem.js";
import mangaclash from "./download/mangaclash.js";

app.get("/", async (req: express.Request, res: express.Response) => {
    res.send("Hello world!");
});

app.get("/mangas", async (req: express.Request, res: express.Response) => {
    // Return the list of all mangas
    const mangas = FileHandler.getMangaList();
    res.json(await mangas);
});

app.get("/mangas/:mangaName/chapters", async (req: express.Request, res: express.Response) => {
    // Return the list of all the chapters of the manga
    const mangaName = req.params.mangaName;
    const chapterList = orderBy(await FileHandler.getChapterList(mangaName));
    res.send(chapterList);
});

app.get(
    "/mangas/:manga/chapters/:chapter/images",
    async (req: express.Request, res: express.Response) => {
        try {
            // Return the list of all the images of the chapter
            const manga = req.params.manga;
            const chapter = req.params.chapter;
            const ipAddress = await localIpV4Address();
            const images = orderBy(await FileHandler.getChapterImages(manga, chapter)).map(
                (image) => {
                    // return `http://localhost:${PORT}/${image}`;
                    return `http://${ipAddress}:${PORT}/${image}`;
                }
            );
            res.send(images);
        } catch (error: any) {
            console.log(error);
            res.status(400).send(error.code);
        }
    }
);

// mangaclash stuff
app.get("/mangaclash/hot", async (req: express.Request, res: express.Response) => {
    const hotMangas = await mangaclash.getHotMangas();
    res.send(hotMangas);
});

app.get("/mangaclash/search", async (req, res) => {
    const mangaName = req.query.manga;
    console.log(mangaName);
    if (typeof mangaName !== "string") {
        res.status(400).send("invalid manga name");
    } else {
        const searchResults = await mangaclash.searchManga(mangaName);
        res.send(searchResults);
    }
});

http.listen(PORT, "0.0.0.0", () => {
    console.log("Website live on: " + `http://localhost:${PORT}`);
});
