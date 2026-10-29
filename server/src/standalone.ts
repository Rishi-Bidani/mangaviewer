// entry point of the standalone executables (`pnpm bundle` -> release/mangaviewer-*)
import * as path from "node:path";
import { parseArgs } from "node:util";
// the built client, embedded at bundle time by the plugin in tsdown.config.ts
import clientAssets from "virtual:client-assets";
import { startServer } from "./app.ts";
import { configureSettings, InvalidSettingError, parseList, parsePort } from "./system/settings.ts";

const HELP = `Usage: mangaviewer [options]

Options:
  -d, --dir <folder>      folder containing one sub-folder per manga (default: current folder)
  -p, --port <port>       port to open the site on (default: 8080)
  -i, --ignore <names>    comma separated folder names to hide
  -m, --metadata          look up covers and details on AniList (sends folder names to AniList),
                          cached in <folder>/.mangaviewer/metadata
  -h, --help              show this help

The BASE_MANGA_FOLDER, PORT, IGNORE_LIST, FETCH_METADATA and METADATA_FOLDER environment
variables work too.`;

function parseFlags() {
    try {
        return parseArgs({
            options: {
                dir: { type: "string", short: "d" },
                port: { type: "string", short: "p" },
                ignore: { type: "string", short: "i" },
                metadata: { type: "boolean", short: "m" },
                help: { type: "boolean", short: "h" },
            },
        }).values;
    } catch (error) {
        console.error(`${(error as Error).message}\n\n${HELP}`);
        process.exit(2);
    }
}

const values = parseFlags();

if (values.help) {
    console.log(HELP);
    process.exit(0);
}

try {
    configureSettings({
        // flags win over env vars and settings.json
        commandLine: {
            BASE_MANGA_FOLDER: values.dir,
            PORT: values.port === undefined ? undefined : parsePort(values.port, "--port"),
            IGNORE_LIST: values.ignore === undefined ? undefined : parseList(values.ignore),
            FETCH_METADATA: values.metadata || undefined,
        },
        defaults: (explicit) => {
            const baseFolder = explicit.BASE_MANGA_FOLDER ?? process.cwd();
            return {
                BASE_MANGA_FOLDER: baseFolder,
                // there's no server/data next to the executable, so cache inside the manga
                // folder (hidden, so it isn't listed as a manga)
                METADATA_FOLDER: path.join(baseFolder, ".mangaviewer", "metadata"),
            };
        },
    });
} catch (error) {
    if (!(error instanceof InvalidSettingError)) throw error;
    console.error(`${error.message}\n\n${HELP}`);
    process.exit(2);
}

await startServer({ clientAssets, configHint: "Pass the folder with --dir." });
