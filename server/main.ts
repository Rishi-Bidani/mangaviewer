import express from "express";
import path from "path";

// require for modules
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const app = express();
const http = require("http").Server(app);
const PORT: number = 5000;

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
    const chapterList = await FileHandler.getChapterList(mangaName);
    res.send(chapterList);
});

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
