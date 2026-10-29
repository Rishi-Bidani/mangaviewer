import { fetchJson } from "./utility";

// mirrors IMangaPreferences in server/src/system/preferences.ts
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

/**
 * @returns the AniList id in an AniList url (e.g. https://anilist.co/manga/30013/One-Piece) or
 * a plain id, undefined if there isn't one
 */
export function parseAniListId(input: string): number | undefined {
    const text = input.trim();
    const id = /^\d+$/.test(text) ? text : /anilist\.co\/manga\/(\d+)/i.exec(text)?.[1];
    return id && Number(id) > 0 ? Number(id) : undefined;
}

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
