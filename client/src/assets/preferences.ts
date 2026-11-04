import { fetchJson } from "./utility";

// mirrors IMangaPreferences in server/src/system/preferences.ts
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
    source: string;
    /**
     * @brief when saving this can also be what was pasted in, usually a link to the manga
     */
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

export function fetchPreferences(): Promise<IPreferences> {
    return fetchJson<IPreferences>("/api/preferences");
}

export function saveMangaPreferences(
    manga: string,
    changes: IPreferencesChange
): Promise<IMangaPreferences> {
    return fetchJson<IMangaPreferences>(`/api/mangas/${encodeURIComponent(manga)}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
    });
}
