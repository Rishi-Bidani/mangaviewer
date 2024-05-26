import express from "express";
import FileHandler from "./system/filesystem.js";
import path from "path";

// require for modules
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const app = express();
const http = require("http").Server(app);
const PORT: number = (process.env.PORT as unknown as number) || 8080;

const BASE_FOLDER = await FileHandler.baseFolder;
app.use("/images", express.static(BASE_FOLDER));

// make built files available
const builtWebpageBinaries = path.join("dist", "client");
app.use(express.static(builtWebpageBinaries));

const cors = require("cors");
app.use(cors());

app.get("/", async (req: express.Request, res: express.Response) => {
    // res.send("Hello world!");
    res.sendFile(path.join(builtWebpageBinaries, "index.html"));
});

import apiRoutes from "./api.js";
app.use("/api", apiRoutes);

// mangaclash stuff
// app.get("/mangaclash/hot", async (req: express.Request, res: express.Response) => {
//     const hotMangas = await mangaclash.getHotMangas();
//     res.send(hotMangas);
// });

// app.get("/mangaclash/search", async (req, res) => {
//     const mangaName = req.query.manga;
//     console.log(mangaName);
//     if (typeof mangaName !== "string") {
//         res.status(400).send("invalid manga name");
//     } else {
//         const searchResults = await mangaclash.searchManga(mangaName);
//         res.send(searchResults);
//     }
// });

// app.get("/mangaclash/manga/:manga", async (req: express.Request, res: express.Response) => {
//     const mangaName: string = req.params.manga;
//     const mangaLink: string = req.query.link as string;
//     const manga = await mangaclash.getMangaDetails(mangaName, mangaLink);
//     res.send(manga);
// });

http.listen(PORT, "0.0.0.0", () => {
    console.log("Website live on: " + `http://localhost:${PORT}`);
});
