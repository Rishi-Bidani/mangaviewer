// per-manga display preferences set from the client's settings page
import { eq } from "drizzle-orm";
import { db } from "./database.ts";
import FileHandler from "./filesystem.ts";
import { mangaPreferences } from "./schema.ts";

export interface IMangaPreferences {
    /**
     * @brief false shows a plain placeholder instead of the cover, defaults to true
     */
    showCover?: boolean;

    /**
     * @brief the entry to use instead of searching by folder name; a match in the manga's
     * metadata.json takes priority over this
     */
    match?: IMetadataMatch;
}

/**
 * @brief a specific entry on a metadata source
 */
export interface IMetadataMatch {
    /**
     * @brief the id of the extension that provides the metadata
     */
    source: string;
    id: string;
}

/**
 * @brief a change to IMangaPreferences, null removes that preference
 */
export type IPreferencesChange = { [K in keyof IMangaPreferences]?: IMangaPreferences[K] | null };

/**
 * @brief keyed by manga name, mangas without changed preferences aren't listed
 */
export type IPreferences = Record<string, IMangaPreferences>;

function toPreferences(row: typeof mangaPreferences.$inferSelect): IMangaPreferences {
    return {
        ...(row.showCover === null ? {} : { showCover: row.showCover }),
        ...(row.matchSource === null || row.matchId === null
            ? {}
            : { match: { source: row.matchSource, id: row.matchId } }),
    };
}

export function getPreferences(): IPreferences {
    const rows = db().select().from(mangaPreferences).all();
    return Object.fromEntries(rows.map((row) => [row.manga, toPreferences(row)]));
}

export function getMangaPreferences(manga: string): IMangaPreferences {
    const row = db().select().from(mangaPreferences).where(eq(mangaPreferences.manga, manga)).get();
    return row ? toPreferences(row) : {};
}

export async function setMangaPreferences(
    manga: string,
    changes: IPreferencesChange
): Promise<IMangaPreferences> {
    // 404s for mangas that don't exist
    await FileHandler.getMangaFolder(manga);
    // undefined leaves a preference as it is, null removes it
    const values = {
        showCover: changes.showCover,
        matchSource: changes.match === null ? null : changes.match?.source,
        matchId: changes.match === null ? null : changes.match?.id,
    };
    const row = db()
        .insert(mangaPreferences)
        .values({ manga, ...values })
        .onConflictDoUpdate({ target: mangaPreferences.manga, set: values })
        .returning()
        .get();
    return toPreferences(row);
}
