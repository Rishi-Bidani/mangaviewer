import { fetchJson } from "./utility";

// mirrors IMangaMetadata in server/src/system/metadata.ts

/**
 * @brief found / not-found: result of the AniList lookup, skipped: folder name too short to
 * search for, pending: lookup still running, error: lookup failed, disabled: FETCH_METADATA is off
 */
export type LookupState = "found" | "not-found" | "skipped" | "pending" | "error" | "disabled";

export interface IMangaMetadata {
    lookup: LookupState;
    anilistId?: number;
    malId?: number;
    title?: string;
    alternativeTitles?: string[];
    description?: string;
    format?: string;
    genres?: string[];
    tags?: string[];
    authors?: string[];
    status?: string;
    chapters?: number;
    volumes?: number;
    year?: number;
    endYear?: number;
    /**
     * @brief average AniList score out of 100
     */
    score?: number;
    popularity?: number;
    isAdult?: boolean;
    url?: string;
    malUrl?: string;
    /**
     * @brief when the details were fetched, changes every time they're fetched again
     */
    fetchedAt?: string;
    /**
     * @brief the manga's metadata.json sets the anilistId, so one set on the settings page is
     * ignored
     */
    anilistIdFromFile?: boolean;
}

/**
 * @brief the cover url, which changes whenever new details (and so maybe a new cover) arrive
 */
export function coverUrl(mangaName: string, metadata?: IMangaMetadata): string {
    const version = metadata?.fetchedAt ?? metadata?.lookup ?? "";
    return `/api/mangas/${encodeURIComponent(mangaName)}/cover?v=${encodeURIComponent(version)}`;
}

/**
 * @param mangaName refetch just this one, otherwise every manga
 * @returns the new metadata of the refetched manga(s), keyed by manga name
 */
export async function refreshMetadata(mangaName?: string): Promise<Record<string, IMangaMetadata>> {
    if (mangaName === undefined) {
        return fetchJson("/api/metadata/refresh", { method: "POST" });
    }
    const url = `/api/mangas/${encodeURIComponent(mangaName)}/metadata/refresh`;
    return { [mangaName]: await fetchJson<IMangaMetadata>(url, { method: "POST" }) };
}
