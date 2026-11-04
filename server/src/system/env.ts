// validates the settings in process.env, with command line flags (standalone executable only) and a
// .env file merged into it first, so the order of priority is: flags, environment, .env, defaults
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { z } from "zod";

// server, from both src/system and dist/system
const SERVER_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_FOLDER = path.join(SERVER_FOLDER, "data");

const INVALID_PORT = "must be a whole number from 1 to 65535";

// names containing a comma can't be listed
const list = z
    .string()
    .default("")
    .transform((value) =>
        value
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
    );

const envSchema = z.object({
    /**
     * @brief The port the server listens on
     */
    PORT: z.coerce
        .number({ error: INVALID_PORT })
        .int({ error: INVALID_PORT })
        .min(1, { error: INVALID_PORT })
        .max(65535, { error: INVALID_PORT })
        .default(8080),

    /**
     * @brief The folder where the mangas are downloaded and stored, no sensible default so
     * startServer reports it missing
     * @example "C:\applications\my mangas"
     */
    BASE_MANGA_FOLDER: z.string().default(""),

    /**
     * @brief the mangas or other folders that should be ignored
     * @example "bleach,naruto"
     */
    IGNORE_LIST: list,

    /**
     * @brief look up covers and details, off by default since it sends the manga folder names to
     * the metadata source, which is AniList unless another is picked on the settings page
     */
    FETCH_METADATA: z.stringbool({ error: "must be true or false" }).default(false),

    /**
     * @brief where the database and downloaded covers are kept
     */
    METADATA_FOLDER: z.string().default(path.join(DATA_FOLDER, "metadata")),

    /**
     * @brief where extensions are kept
     */
    EXTENSIONS_FOLDER: z.string().default(path.join(DATA_FOLDER, "extensions")),

    /**
     * @brief the extensions in EXTENSIONS_FOLDER to run, nothing there runs unless it's listed
     * @example "mangadex"
     */
    ENABLED_EXTENSIONS: list,

    /**
     * @brief domain names the site is opened on; ip addresses, names without a dot and .local names
     * always work
     * @example "manga.example.com"
     */
    ALLOWED_HOSTS: list,
});

export type IEnv = z.output<typeof envSchema>;

export class InvalidEnvError extends Error {}

let env: IEnv | undefined;

/**
 * @brief adds the variables in the file to process.env, without replacing any that are already set;
 * the file is optional
 */
export function loadEnvFile(file = path.join(SERVER_FOLDER, ".env")) {
    if (!existsSync(file)) return;
    // editors on windows can save files with a byte order mark, which would end up in the name
    const variables = parseEnv(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    for (const [name, value] of Object.entries(variables)) {
        process.env[name] ??= value;
    }
}

/**
 * @returns the settings, read once on first use, so restart the server to pick up changes
 * @throws InvalidEnvError listing everything wrong with them
 */
export function getEnv(): IEnv {
    if (env) return env;

    // a variable set to nothing means the default, so it can clear a list set in the .env file
    const raw: Record<string, string | undefined> = Object.fromEntries(
        Object.keys(envSchema.shape).map((name) => [name, process.env[name] || undefined])
    );
    const result = envSchema.safeParse(raw);
    if (!result.success) {
        const problems = result.error.issues.map((issue) => {
            const name = String(issue.path[0]);
            return `${name} ${issue.message}, got "${raw[name]}"`;
        });
        throw new InvalidEnvError(problems.join("\n"));
    }
    env = result.data;
    return env;
}

/**
 * @returns a table of every setting and its value, for the console
 */
export function formatEnv(): string {
    const rows = Object.entries(getEnv()).map(([name, value]) => {
        const text = Array.isArray(value)
            ? value.map((item) => JSON.stringify(item)).join(", ") || "(none)"
            : String(value) || "(not set)";
        return [name, text];
    });
    const nameWidth = Math.max(...rows.map(([name]) => name.length));
    return [
        "Settings:",
        ...rows.map(([name, value]) => `   ${name.padEnd(nameWidth)}  ${value}`),
    ].join("\n");
}
