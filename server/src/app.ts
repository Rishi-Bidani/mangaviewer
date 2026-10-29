import { stat } from "node:fs/promises";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import apiRoutes from "./api.ts";
import FileHandler, { removeLeftoverTemporaryFiles } from "./system/filesystem.ts";
import getIPAddresses from "./system/getip.ts";
import { formatSettings, getResolvedSettings, InvalidSettingError } from "./system/settings.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface IServerOptions {
    /**
     * @brief the built client files keyed by url path (e.g. "/index.html"), served from memory
     * instead of from client/dist; used by the standalone bundle
     */
    clientAssets?: Map<string, Buffer>;

    /**
     * @brief how to fix a missing manga folder, shown in the error message
     */
    configHint?: string;
}

export async function startServer({
    clientAssets,
    configHint = "Set BASE_MANGA_FOLDER in server/data/settings.json or as an environment variable.",
}: IServerOptions = {}) {
    const app = express();

    // printed before anything can fail, so a wrong value and where it came from are visible
    const settings = await getResolvedSettings().catch((error) => {
        if (!(error instanceof InvalidSettingError)) throw error;
        console.error(`Invalid setting: ${error.message}`);
        process.exit(1);
    });
    console.log(formatSettings(settings));

    const PORT = await FileHandler.port;
    const BASE_FOLDER = await FileHandler.baseFolder;
    if (!(await stat(BASE_FOLDER).catch(() => null))?.isDirectory()) {
        const problem = BASE_FOLDER
            ? `Manga folder "${BASE_FOLDER}" does not exist.`
            : "No manga folder is set.";
        console.error(`${problem} ${configHint}`);
        process.exit(1);
    }
    await removeLeftoverTemporaryFiles(await FileHandler.metadataFolder);
    app.use("/images", express.static(BASE_FOLDER));

    // make built files available
    if (clientAssets) {
        app.get(/.*/, (req, res, next) => {
            const assetPath = req.path === "/" ? "/index.html" : req.path;
            const asset = clientAssets.get(assetPath);
            if (!asset) return next();
            res.type(path.extname(assetPath)).send(asset);
        });
    } else {
        // relative to server/src/app.ts and server/dist/app.js
        const builtWebpageBinaries = path.join(__dirname, "..", "..", "client", "dist");
        app.use(express.static(builtWebpageBinaries));
        app.get("/", (_req: express.Request, res: express.Response) => {
            res.sendFile(path.resolve(path.join(builtWebpageBinaries, "index.html")));
        });
    }

    app.use(cors());
    app.use("/api", apiRoutes);

    app.listen(PORT, "0.0.0.0", () => {
        const ipAddress = getIPAddresses();

        console.log("Website live on: ");
        ipAddress.forEach((ip) => {
            console.log(`   - http://${ip}:${PORT}`);
        });
        console.log("Generally on the address starting with 192.X.X.X");
    });
}
