// looks up covers and details for mangas on AniList and caches them on disk; a metadata.json
// and/or cover image in the manga's own folder always override what was fetched
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { orderBy } from "natural-orderby";
import FileHandler, { readJson, writeFileAtomic } from "./filesystem.ts";
import { getPreferences } from "./preferences.ts";

const ANILIST_URL = "https://graphql.anilist.co";
// anilist allows up to 90 requests a minute (lowered to 30 at times), so stay well under that
const REQUEST_INTERVAL_MS = 2500;
// a lookup that failed (network down, anilist erroring) is retried after this long
const RETRY_AFTER_MS = 10 * 60 * 1000;
// shorter folder names (e.g. "OP") are too ambiguous to search for
const MIN_SEARCH_LENGTH = 5;

const LOCAL_METADATA_FILE = "metadata.json";
const LOCAL_COVER_FILES = new Set([
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "cover.webp",
    "cover.avif",
]);

export interface IMetadata {
    anilistId?: number;
    /**
     * @brief the MyAnimeList id, when AniList has it linked
     */
    malId?: number;
    title?: string;
    alternativeTitles?: string[];
    description?: string;
    /**
     * @brief e.g. "Manga", "One shot", "Novel"
     */
    format?: string;
    genres?: string[];
    /**
     * @brief the most relevant non-spoiler AniList tags, e.g. "Pirates", "Time Skip"
     */
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
    /**
     * @brief how many AniList users have it on their list
     */
    popularity?: number;
    isAdult?: boolean;
    url?: string;
    malUrl?: string;
}

/**
 * @brief found / not-found: result of the AniList lookup, skipped: folder name too short to
 * search for, pending: lookup queued or running, error: lookup failed and will be retried later,
 * disabled: FETCH_METADATA is off
 */
export type LookupState = "found" | "not-found" | "skipped" | "pending" | "error" | "disabled";

export interface IMangaMetadata extends IMetadata {
    lookup: LookupState;
    /**
     * @brief when the shown details were fetched, changes every time they're fetched again
     */
    fetchedAt?: string;
    /**
     * @brief the manga's metadata.json sets the anilistId, so one set on the settings page is
     * ignored
     */
    anilistIdFromFile: boolean;
}

/**
 * @brief contents of a metadata.json in a manga's folder, any field set here wins over AniList
 */
interface ILocalMetadata extends IMetadata {
    /**
     * @brief fetch this AniList entry instead of searching by folder name, for wrong matches
     */
    anilistId?: number;
}

// bump when IMetadata gains fields, so entries cached before that are fetched again
const CACHE_VERSION = 2;

interface ICacheEntry {
    version?: number;
    manga: string;
    fetchedAt: string;
    /**
     * @brief the anilistId from metadata.json it was fetched with, so changing that refetches
     */
    anilistId?: number;
    found: boolean;
    metadata?: IMetadata;
    /**
     * @brief file name of the downloaded cover in the metadata folder
     */
    cover?: string;
}

interface IAniListMedia {
    id: number;
    idMal: number | null;
    siteUrl: string;
    format: string | null;
    genres: string[];
    tags: { name: string; rank: number; isMediaSpoiler: boolean; isGeneralSpoiler: boolean }[];
    status: string | null;
    chapters: number | null;
    volumes: number | null;
    averageScore: number | null;
    popularity: number | null;
    isAdult: boolean;
    title: { romaji: string | null; english: string | null; native: string | null };
    synonyms: string[];
    description: string | null;
    startDate: { year: number | null };
    endDate: { year: number | null };
    coverImage: { extraLarge: string | null; large: string | null };
    staff: { edges: { role: string; node: { name: { full: string } } }[] };
}

const MEDIA_QUERY = `query ($id: Int, $search: String) {
    Media(id: $id, search: $search, type: MANGA) {
        id idMal siteUrl format genres status chapters volumes averageScore popularity isAdult
        synonyms
        tags { name rank isMediaSpoiler isGeneralSpoiler }
        title { romaji english native }
        description(asHtml: false)
        startDate { year }
        endDate { year }
        coverImage { extraLarge large }
        staff(sort: [RELEVANCE], perPage: 8) { edges { role node { name { full } } } }
    }
}`;

// lookups that are queued or running, and when lookups last failed
const inFlight = new Map<string, Promise<void>>();
const failedAt = new Map<string, number>();

// every anilist request waits for the previous one plus REQUEST_INTERVAL_MS
let requestQueue: Promise<unknown> = Promise.resolve();
function throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = requestQueue.then(task);
    requestQueue = run.catch(() => {}).then(() => sleep(REQUEST_INTERVAL_MS));
    return run;
}

/**
 * @brief the folder name without tags like "[Colored]" or "(2019)", used as the search term
 */
export function searchTitle(folderName: string): string {
    return folderName
        .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, " ")
        .replace(/_+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function plainText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function toMetadata(media: IAniListMedia): IMetadata {
    const { english, romaji, native } = media.title;
    const title = english ?? romaji ?? native ?? undefined;
    const alternativeTitles = [
        ...new Set([romaji, english, native, ...media.synonyms].filter((name) => !!name)),
    ].filter((name) => name !== title) as string[];
    const authors = [
        ...new Set(
            media.staff.edges
                .filter((edge) => /story|art|original creator/i.test(edge.role))
                .map((edge) => edge.node.name.full)
        ),
    ];
    const tags = media.tags
        .filter((tag) => !tag.isMediaSpoiler && !tag.isGeneralSpoiler && tag.rank >= 60)
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 10)
        .map((tag) => tag.name);
    return {
        anilistId: media.id,
        malId: media.idMal ?? undefined,
        title,
        alternativeTitles,
        description: media.description ? plainText(media.description) : undefined,
        format: media.format ? readableEnum(media.format) : undefined,
        genres: media.genres,
        tags,
        authors,
        status: media.status ? readableEnum(media.status) : undefined,
        chapters: media.chapters ?? undefined,
        volumes: media.volumes ?? undefined,
        year: media.startDate.year ?? undefined,
        endYear: media.endDate.year ?? undefined,
        score: media.averageScore ?? undefined,
        popularity: media.popularity ?? undefined,
        isAdult: media.isAdult,
        url: media.siteUrl,
        malUrl: media.idMal ? `https://myanimelist.net/manga/${media.idMal}` : undefined,
    };
}

// e.g. NOT_YET_RELEASED -> "Not yet released", ONE_SHOT -> "One shot"
function readableEnum(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
}

/**
 * @returns the best matching manga, or null if AniList has none
 */
async function queryAniList(variables: { id?: number; search?: string }) {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(ANILIST_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query: MEDIA_QUERY, variables }),
            signal: AbortSignal.timeout(15_000),
        });
        if (response.status === 429 && attempt < 2) {
            await sleep((Number(response.headers.get("Retry-After")) || 60) * 1000);
            continue;
        }
        // anilist answers "no match" with a 404
        if (response.status === 404) {
            return null;
        }
        const body = (await response.json().catch(() => ({}))) as {
            data?: { Media: IAniListMedia | null };
            errors?: { message: string }[];
        };
        if (!response.ok || !body.data) {
            const reason = body.errors?.[0]?.message ?? response.statusText;
            throw new Error(`AniList responded ${response.status}: ${reason}`);
        }
        return body.data.Media;
    }
}

async function downloadCover(url: string, folder: string, name: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
        throw new Error(`cover download responded ${response.status}`);
    }
    const file = `${name}${path.extname(new URL(url).pathname) || ".jpg"}`;
    await writeFileAtomic(path.join(folder, file), Buffer.from(await response.arrayBuffer()));
    return file;
}

// cache files are named by a hash, since manga names can contain anything
function cacheName(manga: string): string {
    return createHash("sha1").update(manga).digest("hex");
}

async function readCache(manga: string): Promise<ICacheEntry | undefined> {
    const folder = await FileHandler.metadataFolder;
    return readJson<ICacheEntry>(path.join(folder, `${cacheName(manga)}.json`));
}

async function fetchAndCache(manga: string, anilistId: number | undefined): Promise<void> {
    const folder = await FileHandler.metadataFolder;
    await fs.mkdir(folder, { recursive: true });
    const name = cacheName(manga);

    const media = await throttled(() =>
        queryAniList(anilistId !== undefined ? { id: anilistId } : { search: searchTitle(manga) })
    );
    const entry: ICacheEntry = {
        version: CACHE_VERSION,
        manga,
        fetchedAt: new Date().toISOString(),
        anilistId,
        found: media !== null,
    };
    if (media) {
        entry.metadata = toMetadata(media);
        const coverUrl = media.coverImage.extraLarge ?? media.coverImage.large;
        if (coverUrl) {
            // the details are still worth caching without a cover
            entry.cover = await downloadCover(coverUrl, folder, name).catch((error) => {
                console.warn(`Couldn't download the cover of "${manga}": ${error.message}`);
                return undefined;
            });
        }
    }
    await writeFileAtomic(path.join(folder, `${name}.json`), JSON.stringify(entry, null, 4));
}

function startLookup(manga: string, anilistId: number | undefined) {
    const lookup = fetchAndCache(manga, anilistId)
        .then(
            () => {
                failedAt.delete(manga);
            },
            (error) => {
                failedAt.set(manga, Date.now());
                console.warn(`Metadata lookup for "${manga}" failed: ${error.message}`);
            }
        )
        .finally(() => inFlight.delete(manga));
    inFlight.set(manga, lookup);
}

/**
 * @brief the manga's cached details merged with its metadata.json, starting a lookup in the
 * background when there is nothing cached yet (the result then has lookup "pending")
 * @param refresh look it up again even if it's cached, or failed a moment ago
 */
export async function getMetadata(manga: string, refresh = false): Promise<IMangaMetadata> {
    const mangaFolder = await FileHandler.getMangaFolder(manga);
    const { anilistId: fileAnilistId, ...localFields } =
        (await readJson<ILocalMetadata>(path.join(mangaFolder, LOCAL_METADATA_FILE))) ?? {};
    // set in metadata.json, or else on the settings page
    const anilistId = fileAnilistId ?? (await getPreferences())[manga]?.anilistId;

    const fetchEnabled = await FileHandler.fetchMetadata;
    const cached = await readCache(manga);
    // what's cached for this anilistId, possibly from an older version missing newer fields
    const matching = cached?.anilistId === anilistId ? cached : undefined;
    // while a lookup runs, or when it can't, whatever is cached keeps being shown
    const merged = (lookup: LookupState): IMangaMetadata => ({
        ...matching?.metadata,
        ...localFields,
        lookup,
        fetchedAt: matching?.fetchedAt,
        anilistIdFromFile: fileAnilistId !== undefined,
    });

    if (inFlight.has(manga)) {
        return merged("pending");
    }
    // already fetched details are shown even with FETCH_METADATA off, only new lookups stop
    if (matching && !refresh && (matching.version === CACHE_VERSION || !fetchEnabled)) {
        return merged(matching.found ? "found" : "not-found");
    }
    if (!fetchEnabled) {
        return merged("disabled");
    }
    // an explicit anilistId doesn't need a usable folder name
    if (anilistId === undefined && searchTitle(manga).length < MIN_SEARCH_LENGTH) {
        return merged("skipped");
    }
    const failed = failedAt.get(manga);
    if (!refresh && failed !== undefined && Date.now() - failed < RETRY_AFTER_MS) {
        return merged("error");
    }
    startLookup(manga, anilistId);
    return merged("pending");
}

/**
 * @brief getMetadata for every manga, keyed by manga name
 */
export async function getAllMetadata(refresh = false): Promise<Record<string, IMangaMetadata>> {
    const mangas = await FileHandler.getMangaList();
    const entries = await Promise.all(
        mangas.map(async (manga) => [manga, await getMetadata(manga, refresh)] as const)
    );
    return Object.fromEntries(entries);
}

/**
 * @returns the cover image to show for the manga: a cover.* file in its folder, else the
 * downloaded AniList cover, else the first page of the first chapter
 */
export async function getCoverPath(manga: string): Promise<string | undefined> {
    const mangaFolder = await FileHandler.getMangaFolder(manga);

    const localCover = (await fs.readdir(mangaFolder)).find((file) =>
        LOCAL_COVER_FILES.has(file.toLowerCase())
    );
    if (localCover) {
        return path.join(mangaFolder, localCover);
    }

    const cached = await readCache(manga);
    if (cached?.cover) {
        const downloaded = path.join(await FileHandler.metadataFolder, cached.cover);
        if (await fs.stat(downloaded).catch(() => null)) {
            return downloaded;
        }
    }

    const [firstChapter] = orderBy(await FileHandler.getChapterList(manga));
    if (!firstChapter) {
        return undefined;
    }
    const [firstPage] = orderBy(await FileHandler.getChapterImages(manga, firstChapter));
    return firstPage && path.join(mangaFolder, firstChapter, firstPage);
}
