// entry point of the standalone executables (`pnpm bundle` -> release/mangaviewer-*)
import * as path from "node:path";
import { parseArgs } from "node:util";
// the built client, embedded at bundle time by the plugin in tsdown.config.ts
import clientAssets from "virtual:client-assets";
// likewise, there's no server/drizzle next to the executable
import migrations from "virtual:migrations";
import { startServer } from "./app.ts";
import { getEnv, InvalidEnvError, loadEnvFile } from "./system/env.ts";

const HELP = `Usage: mangaviewer [options]

Options:
  -d, --dir <folder>      folder containing one sub-folder per manga (default: current folder)
  -p, --port <port>       port to open the site on (default: 8080)
  -i, --ignore <names>    comma separated folder names to hide
  -m, --metadata          look up covers and details (sends folder names to the metadata source,
                          AniList by default), cached in <folder>/.mangaviewer/metadata
  -e, --extensions <ids>  comma separated extensions to run from <folder>/.mangaviewer/extensions;
                          these run with full access to your computer, only use ones you trust
  -h, --help              show this help

The BASE_MANGA_FOLDER, PORT, IGNORE_LIST, FETCH_METADATA, METADATA_FOLDER, EXTENSIONS_FOLDER,
ENABLED_EXTENSIONS and ALLOWED_HOSTS environment variables work too, also from a .env file next to
the executable.`;

function parseFlags() {
    try {
        return parseArgs({
            options: {
                dir: { type: "string", short: "d" },
                port: { type: "string", short: "p" },
                ignore: { type: "string", short: "i" },
                metadata: { type: "boolean", short: "m" },
                extensions: { type: "string", short: "e" },
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

const flags = {
    BASE_MANGA_FOLDER: values.dir,
    PORT: values.port,
    IGNORE_LIST: values.ignore,
    FETCH_METADATA: values.metadata ? "true" : undefined,
    ENABLED_EXTENSIONS: values.extensions,
};
// flags win over env vars and the .env file
for (const [name, value] of Object.entries(flags)) {
    if (value !== undefined) process.env[name] = value;
}
loadEnvFile(path.join(path.dirname(process.execPath), ".env"));

const baseFolder = process.env.BASE_MANGA_FOLDER || process.cwd();
process.env.BASE_MANGA_FOLDER = baseFolder;
// there's no server/data next to the executable, so cache inside the manga folder (hidden, so it
// isn't listed as a manga)
process.env.METADATA_FOLDER ||= path.join(baseFolder, ".mangaviewer", "metadata");
process.env.EXTENSIONS_FOLDER ||= path.join(baseFolder, ".mangaviewer", "extensions");

try {
    getEnv();
} catch (error) {
    if (!(error instanceof InvalidEnvError)) throw error;
    console.error(`${error.message}\n\n${HELP}`);
    process.exit(2);
}

await startServer({ clientAssets, migrations, configHint: "Pass the folder with --dir." });
