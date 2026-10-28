import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import FileHandler from "./system/filesystem.ts";
import getIPAddresses from "./system/getip.ts";

// process.title = "manga-viewer";

// require for modules
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const app = express();
const http = require("node:http").Server(app);
const PORT: number = (process.env.PORT as unknown as number) || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_FOLDER = await FileHandler.baseFolder;
app.use("/images", express.static(BASE_FOLDER));

// make built files available
const builtWebpageBinaries = path.join(__dirname, "..", "client");
app.use(express.static(builtWebpageBinaries));

const cors = require("cors");
app.use(cors());

app.get("/", async (_req: express.Request, res: express.Response) => {
    // res.send("Hello world!");
    res.sendFile(path.resolve(path.join(builtWebpageBinaries, "index.html")));
});

import apiRoutes from "./api.ts";

app.use("/api", apiRoutes);

http.listen(PORT, "0.0.0.0", () => {
    const ipAddress = getIPAddresses();

    console.log("Website live on: ");
    ipAddress.forEach((ip) => {
        console.log(`   - http://${ip}:${PORT}`);
    });
    console.log("Generally on the address starting with 192.X.X.X");
});
