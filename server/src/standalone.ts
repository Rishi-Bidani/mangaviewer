// entry point of the standalone executables (`pnpm bundle` -> release/mangaviewer-*)
import { parseArgs } from "node:util";
// the built client, embedded at bundle time by the plugin in tsdown.config.ts
import clientAssets from "virtual:client-assets";
import { startServer } from "./app.ts";

const HELP = `Usage: mangaviewer [options]

Options:
  -d, --dir <folder>      folder containing one sub-folder per manga (default: current folder)
  -p, --port <port>       port to open the site on (default: 8080)
  -i, --ignore <names>    comma separated folder names to hide
  -h, --help              show this help

The BASE_MANGA_FOLDER, PORT and IGNORE_LIST environment variables work too.`;

function parseFlags() {
    try {
        return parseArgs({
            options: {
                dir: { type: "string", short: "d" },
                port: { type: "string", short: "p" },
                ignore: { type: "string", short: "i" },
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

// flags win over env vars, which are read when the settings are first used
process.env.BASE_MANGA_FOLDER = values.dir ?? process.env.BASE_MANGA_FOLDER ?? process.cwd();
if (values.port) process.env.PORT = values.port;
if (values.ignore !== undefined) process.env.IGNORE_LIST = values.ignore;

await startServer({ clientAssets, configHint: "Pass the folder with --dir." });
