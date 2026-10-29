// per-manga display preferences set from the client's settings page; stored next to the metadata
// cache, since that's the one folder the server can always write to (/manga is read-only in docker)
import { promises as fs } from "node:fs";
import * as path from "node:path";
import FileHandler, { writeFileAtomic } from "./filesystem.ts";

export interface IMangaPreferences {
    /**
     * @brief false shows a plain placeholder instead of the cover, defaults to true
     */
    showCover?: boolean;

    /**
     * @brief the AniList entry to use instead of searching by folder name; an anilistId in the
     * manga's metadata.json takes priority over this
     */
    anilistId?: number;
}

/**
 * @brief a change to IMangaPreferences, null removes that preference
 */
export type IPreferencesChange = { [K in keyof IMangaPreferences]?: IMangaPreferences[K] | null };

/**
 * @brief keyed by manga name, mangas without changed preferences aren't listed
 */
export type IPreferences = Record<string, IMangaPreferences>;

async function preferencesFile(): Promise<string> {
    return path.join(await FileHandler.metadataFolder, "preferences.json");
}

async function readPreferences(): Promise<IPreferences> {
    const file = await preferencesFile();
    const raw = await fs.readFile(file, "utf8").catch((error) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
    });
    if (raw === undefined) {
        return {};
    }
    try {
        return JSON.parse(raw) as IPreferences;
    } catch (error) {
        // e.g. a typo from editing it by hand; moved aside so the next change can't overwrite it
        const broken = `${file}.broken-${Date.now()}`;
        await fs.rename(file, broken);
        console.warn(
            `"${file}" isn't valid JSON (${(error as Error).message}), moved it to "${broken}" and started with no preferences`
        );
        return {};
    }
}

// read once and kept in memory, every change is written straight back
let preferences: Promise<IPreferences> | undefined;
function loadPreferences(): Promise<IPreferences> {
    preferences ??= readPreferences();
    return preferences;
}

// writes run one after another so two quick changes can't interleave
let writeQueue: Promise<void> = Promise.resolve();

export function getPreferences(): Promise<IPreferences> {
    return loadPreferences();
}

export async function setMangaPreferences(
    manga: string,
    changes: IPreferencesChange
): Promise<IMangaPreferences> {
    // 404s for mangas that don't exist
    await FileHandler.getMangaFolder(manga);
    const all = await loadPreferences();
    // undefined leaves a preference as it is, null removes it
    const updated: Record<string, unknown> = { ...all[manga] };
    for (const [key, value] of Object.entries(changes)) {
        if (value === null) {
            delete updated[key];
        } else if (value !== undefined) {
            updated[key] = value;
        }
    }
    all[manga] = updated as IMangaPreferences;

    const write = writeQueue.then(async () => {
        const file = await preferencesFile();
        await fs.mkdir(path.dirname(file), { recursive: true });
        await writeFileAtomic(file, JSON.stringify(all, null, 4));
    });
    writeQueue = write.catch(() => {});
    await write;
    return all[manga];
}
