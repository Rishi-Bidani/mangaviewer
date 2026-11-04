// starts the server: checks the settings, gets the stored data and extensions ready, then listens
import { stat } from "node:fs/promises";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import apiRoutes from "./routes.ts";
import { openDatabase } from "./system/database.ts";
import { formatEnv, getEnv, InvalidEnvError } from "./system/env.ts";
import { formatExtensions, loadExtensions } from "./system/extensions.ts";
import FileHandler, { removeLeftoverTemporaryFiles } from "./system/filesystem.ts";
import { removeUnusedCovers } from "./system/metadata.ts";
import type { IMigration } from "./system/migrations.ts";
import { startSync } from "./system/sync.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface IServerOptions {
    /**
     * @brief the built client files keyed by url path (e.g. "/index.html"), served from memory
     * instead of from client/dist; used by the standalone bundle
     */
    clientAssets?: Map<string, Buffer>;

    /**
     * @brief the database migrations, instead of reading them from server/drizzle; used by the
     * standalone bundle
     */
    migrations?: IMigration[];

    /**
     * @brief how to fix a missing manga folder, shown in the error message
     */
    configHint?: string;
}

// ---- getting ready ----

function printSettings() {
    // printed before anything can fail, so a wrong value is visible
    try {
        console.log(formatEnv());
    } catch (error) {
        if (!(error instanceof InvalidEnvError)) throw error;
        console.error(`Invalid settings:\n${error.message}`);
        process.exit(1);
    }
}

async function requireMangaFolder(configHint: string) {
    const baseFolder = FileHandler.baseFolder;
    if (!(await stat(baseFolder).catch(() => null))?.isDirectory()) {
        const problem = baseFolder
            ? `Manga folder "${baseFolder}" does not exist.`
            : "No manga folder is set.";
        console.error(`${problem} ${configHint}`);
        process.exit(1);
    }
}

/**
 * @brief what v0.0.2 kept in files is in the database now, and isn't brought over
 */
async function warnAboutOldFiles() {
    const { METADATA_FOLDER } = getEnv();
    const oldFiles = [
        path.join(METADATA_FOLDER, "preferences.json"),
        path.join(METADATA_FOLDER, "..", "settings.json"),
    ];
    for (const file of oldFiles) {
        if (await stat(file).catch(() => null)) {
            console.warn(
                `"${file}" is from an older version and isn't used any more, set what's in it again`
            );
        }
    }
}

function openDatabaseOrExit(migrations?: IMigration[]) {
    const { METADATA_FOLDER } = getEnv();
    try {
        openDatabase(migrations);
    } catch (error) {
        console.error(
            `Couldn't open the database in "${METADATA_FOLDER}": ${(error as Error).message}`
        );
        process.exit(1);
    }
}

// ---- who can use the api ----

function hostNameOf(host: string): string | undefined {
    try {
        return new URL(`http://${host}`).hostname;
    } catch {
        return undefined;
    }
}

// a website can point a name of its own at this server (dns rebinding), so that the browser takes
// the api for part of that website. It can't do that with an ip address or a name only the local
// network knows
function isLocalHostName(hostName: string): boolean {
    return (
        isIP(hostName.replace(/^\[|\]$/g, "")) !== 0 ||
        !hostName.includes(".") ||
        hostName.endsWith(".local")
    );
}

/**
 * @brief the api has no login and can change what's on someone's accounts, so other websites open in
 * the same browser mustn't be able to use it. Leaving out cors headers isn't enough for that: those
 * only stop them from reading the answers, and from some of the requests
 */
function onlyThisSite(req: express.Request, res: express.Response, next: express.NextFunction) {
    const allowed = new Set(getEnv().ALLOWED_HOSTS.map((h) => h.toLowerCase()));
    const host = (req.headers.host ?? "").toLowerCase();
    const hostName = hostNameOf(host);
    if (!hostName || !(isLocalHostName(hostName) || allowed.has(hostName))) {
        console.warn(`Refused a request for "${host}", add it to ALLOWED_HOSTS if it's yours`);
        res.status(403).json({ error: `"${host}" isn't in ALLOWED_HOSTS` });
        return;
    }
    const { origin } = req.headers;
    if (origin !== undefined) {
        const originUrl = URL.canParse(origin) ? new URL(origin) : undefined;
        // behind a reverse proxy the host can differ from the address the browser sees
        if (!originUrl || !(originUrl.host === host || allowed.has(originUrl.hostname))) {
            console.warn(
                `Refused a request from "${origin}", add it to ALLOWED_HOSTS if it's yours`
            );
            res.status(403).json({ error: "Requests from other websites aren't allowed" });
            return;
        }
    }
    next();
}

// ---- the web server ----

/**
 * @brief IGNORE_LIST hides a folder completely, also from someone who knows its name
 */
async function hideIgnoredImages(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const [, manga] = req.path.split("/");
    let name = manga;
    try {
        name = decodeURIComponent(manga);
    } catch {
        // not a valid name, express.static refuses it
    }
    if (!(await FileHandler.isListed(name))) {
        res.status(404).end();
        return;
    }
    next();
}

function createApp(clientAssets?: Map<string, Buffer>) {
    const app = express();
    app.use("/images", hideIgnoredImages, express.static(FileHandler.baseFolder));

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

    app.use("/api", onlyThisSite, apiRoutes);
    return app;
}

function getIPAddresses(): string[] {
    return Object.values(networkInterfaces())
        .flat()
        .filter((alias) => alias?.family === "IPv4" && !alias.internal)
        .map((alias) => alias?.address as string);
}

function listen(app: express.Express) {
    const { PORT } = getEnv();
    // express also calls this when the server couldn't start
    app.listen(PORT, "0.0.0.0", (error) => {
        if (error) {
            console.error(`Couldn't open the site on port ${PORT}: ${error.message}`);
            process.exit(1);
        }
        console.log("Website live on: ");
        for (const ip of getIPAddresses()) {
            console.log(`   - http://${ip}:${PORT}`);
        }
        console.log("Generally on the address starting with 192.X.X.X");
    });
}

export async function startServer({
    clientAssets,
    migrations,
    configHint = "Set BASE_MANGA_FOLDER in server/.env or as an environment variable.",
}: IServerOptions = {}) {
    printSettings();
    await requireMangaFolder(configHint);

    await removeLeftoverTemporaryFiles(getEnv().METADATA_FOLDER);
    await warnAboutOldFiles();
    openDatabaseOrExit(migrations);
    await removeUnusedCovers();

    await loadExtensions();
    console.log(formatExtensions());
    startSync();

    listen(createApp(clientAssets));

    // node running as a container's main process wouldn't stop on these otherwise; nothing has to
    // finish first, since file and database writes can't be left half done
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => process.exit(0));
    }
}
