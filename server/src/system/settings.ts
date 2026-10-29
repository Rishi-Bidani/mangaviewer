// resolves the settings from, in order of priority: command line flags (standalone executable
// only), environment variables, server/data/settings.json and defaults, remembering where each
// value came from so the server can print them at startup
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// server/data, from both src/system and dist/system
export const SETTINGS_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "data",
    "settings.json"
);

export interface ISettings {
    /**
     * @brief The port the server listens on, defaults to 8080
     */
    PORT: number;

    /**
     * @brief The folder where the mangas are downloaded and stored
     * @example "C:\applications\my mangas"
     */
    BASE_MANGA_FOLDER: string;

    /**
     * @brief the mangas or other folders that should be ignored
     * @example ["bleach", "naruto"]
     */
    IGNORE_LIST: string[];

    /**
     * @brief look up covers and details on AniList, off by default since it sends the manga
     * folder names to AniList
     */
    FETCH_METADATA: boolean;

    /**
     * @brief where fetched metadata and covers are cached, defaults to server/data/metadata
     */
    METADATA_FOLDER: string;
}

/**
 * @brief settings.json, where every setting is optional and BASE_MANGA_FOLDER can also be given
 * as path segments, e.g. ["C:", "applications", "my mangas"]
 */
type ISettingsFile = Partial<Omit<ISettings, "BASE_MANGA_FOLDER">> & {
    BASE_MANGA_FOLDER?: string | string[];
};

export type SettingName = keyof ISettings;
export type SettingSource = "command line" | "environment" | "settings.json" | "default";

// also the order they're printed in
const SETTING_NAMES: SettingName[] = [
    "PORT",
    "BASE_MANGA_FOLDER",
    "IGNORE_LIST",
    "FETCH_METADATA",
    "METADATA_FOLDER",
];

export interface IResolvedSettings {
    values: ISettings;
    sources: Record<SettingName, SettingSource>;
    settingsFileFound: boolean;
}

export interface ISettingsOptions {
    /**
     * @brief values from command line flags, which win over everything else
     */
    commandLine?: Partial<ISettings>;

    /**
     * @brief defaults replacing the built-in ones, given everything that was set explicitly (so
     * a default can depend on another setting)
     */
    defaults?: (explicit: Partial<ISettings>) => Partial<ISettings>;
}

const BUILT_IN_DEFAULTS: ISettings = {
    PORT: 8080,
    // no sensible default, startServer reports it missing
    BASE_MANGA_FOLDER: "",
    IGNORE_LIST: [],
    FETCH_METADATA: false,
    METADATA_FOLDER: path.join(path.dirname(SETTINGS_PATH), "metadata"),
};

export class InvalidSettingError extends Error {}

export function parsePort(value: string | number, source: string): number {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new InvalidSettingError(`PORT from ${source} must be 1-65535, got "${value}"`);
    }
    return port;
}

export function parseBoolean(value: string, name: string, source: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
    throw new InvalidSettingError(`${name} from ${source} must be true or false, got "${value}"`);
}

/**
 * @brief "a, b,c" -> ["a", "b", "c"]; names containing a comma can't be listed this way
 */
export function parseList(value: string): string[] {
    return value
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
}

async function fromSettingsFile(): Promise<Partial<ISettings> | undefined> {
    // a missing settings.json is fine, e.g. in the standalone executable
    const raw = await fs.readFile(SETTINGS_PATH, "utf8").catch((error) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
    });
    if (raw === undefined) {
        return undefined;
    }
    let file: ISettingsFile;
    try {
        file = JSON.parse(raw);
    } catch (error) {
        throw new InvalidSettingError(
            `${SETTINGS_PATH} isn't valid JSON: ${(error as Error).message}`
        );
    }
    return {
        ...file,
        PORT: file.PORT === undefined ? undefined : parsePort(file.PORT, "settings.json"),
        BASE_MANGA_FOLDER:
            file.BASE_MANGA_FOLDER === undefined
                ? undefined
                : path.join(...[file.BASE_MANGA_FOLDER].flat()),
    };
}

function fromEnvironment(): Partial<ISettings> {
    const env = process.env;
    return {
        PORT: env.PORT ? parsePort(env.PORT, "the environment") : undefined,
        BASE_MANGA_FOLDER: env.BASE_MANGA_FOLDER || undefined,
        // an empty IGNORE_LIST still counts, so docker users can clear the list in settings.json
        IGNORE_LIST: env.IGNORE_LIST === undefined ? undefined : parseList(env.IGNORE_LIST),
        FETCH_METADATA: env.FETCH_METADATA
            ? parseBoolean(env.FETCH_METADATA, "FETCH_METADATA", "the environment")
            : undefined,
        METADATA_FOLDER: env.METADATA_FOLDER || undefined,
    };
}

let options: ISettingsOptions = {};
let resolved: Promise<IResolvedSettings> | undefined;

/**
 * @brief sets command line values and defaults; call it before the settings are first used
 */
export function configureSettings(newOptions: ISettingsOptions) {
    if (resolved) {
        throw new Error("configureSettings must be called before the settings are first used");
    }
    options = newOptions;
}

async function resolveSettings(): Promise<IResolvedSettings> {
    const settingsFile = await fromSettingsFile();
    const layers: [SettingSource, Partial<ISettings>][] = [
        ["command line", options.commandLine ?? {}],
        ["environment", fromEnvironment()],
        ["settings.json", settingsFile ?? {}],
    ];

    const explicit: Partial<Record<SettingName, unknown>> = {};
    const sources = {} as Record<SettingName, SettingSource>;
    for (const name of SETTING_NAMES) {
        const layer = layers.find(([, values]) => values[name] !== undefined);
        if (layer) {
            explicit[name] = layer[1][name];
            sources[name] = layer[0];
        } else {
            sources[name] = "default";
        }
    }

    const defaults = {
        ...BUILT_IN_DEFAULTS,
        ...options.defaults?.(explicit as Partial<ISettings>),
    };
    const values = { ...defaults, ...explicit } as ISettings;
    return { values, sources, settingsFileFound: settingsFile !== undefined };
}

/**
 * @brief the settings with where each came from; read once, on first use, so restart the server
 * to pick up changes
 */
export function getResolvedSettings(): Promise<IResolvedSettings> {
    resolved ??= resolveSettings();
    return resolved;
}

export async function getSettings(): Promise<ISettings> {
    return (await getResolvedSettings()).values;
}

function formatValue(value: ISettings[SettingName]): string {
    if (Array.isArray(value)) {
        return value.length > 0 ? value.map((item) => JSON.stringify(item)).join(", ") : "(none)";
    }
    return value === "" ? "(not set)" : String(value);
}

/**
 * @returns a table of every setting, its value and where it came from, for the console
 */
export function formatSettings({ values, sources, settingsFileFound }: IResolvedSettings): string {
    const rows = SETTING_NAMES.map((name) => [name, formatValue(values[name]), sources[name]]);
    const nameWidth = Math.max(...rows.map(([name]) => name.length));
    const valueWidth = Math.max(...rows.map(([, value]) => value.length));
    return [
        "Settings (command line > environment > settings.json > default):",
        ...rows.map(
            ([name, value, source]) =>
                `   ${name.padEnd(nameWidth)}  ${value.padEnd(valueWidth)}  (${source})`
        ),
        `   settings.json: ${SETTINGS_PATH}${settingsFileFound ? "" : " (not found)"}`,
    ].join("\n");
}
