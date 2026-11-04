// looks up covers and details for mangas through the metadata sources extensions provide and
// caches them in the database, with the covers as files next to it; a metadata.json and/or cover
// image in the manga's own folder always override what was fetched
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import { orderBy } from "natural-orderby";
import type {
    ILink,
    IMetadataFields,
    IMetadataSource,
    ISearchResult,
    ISourceMetadata,
} from "../extensions/api.ts";
import { db } from "./database.ts";
import { getEnv } from "./env.ts";
import { NotFoundError } from "./errors.ts";
import { type CallPriority, callExtension, guarded } from "./extensionCalls.ts";
import { getActiveMetadataSource, getMetadataSource } from "./extensions.ts";
import FileHandler, { readJson, writeFileAtomic } from "./filesystem.ts";
import { getMangaPreferences, getPreferences, type IMetadataMatch } from "./preferences.ts";
import { mangaMetadata } from "./schema.ts";

// a lookup that failed (network down, a source erroring) is retried after this long
const RETRY_AFTER_MS = 10 * 60 * 1000;
// shorter folder names (e.g. "OP") are too ambiguous to search for
const MIN_SEARCH_LENGTH = 5;
// bump when IMetadata gains fields, so entries cached before that are fetched again
const CACHE_VERSION = 3;

const LOCAL_METADATA_FILE = "metadata.json";
const LOCAL_COVER_FILES = new Set([
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "cover.webp",
    "cover.avif",
]);
// the name of a downloaded cover in the metadata folder, see coverName
const DOWNLOADED_COVER_FILE = /^[0-9a-f]{40}\.[^.]+$/;

export interface IMetadata extends IMetadataFields {
    /**
     * @brief the id of the extension the details came from
     */
    source?: string;
    /**
     * @brief what that source calls this manga
     */
    sourceId?: string;
    /**
     * @brief what each site calls this manga, keyed by site, including the source itself
     */
    ids?: Record<string, string>;
    links?: ILink[];
}

/**
 * @brief found / not-found: result of the lookup, skipped: folder name too short to search for,
 * pending: lookup queued or running, error: lookup failed and will be retried later, disabled:
 * FETCH_METADATA is off or there are no metadata sources
 */
export type LookupState = "found" | "not-found" | "skipped" | "pending" | "error" | "disabled";

export interface IMangaMetadata extends IMetadata {
    lookup: LookupState;
    /**
     * @brief when the shown details were fetched, changes every time they're fetched again
     */
    fetchedAt?: string;
    /**
     * @brief the manga's metadata.json sets the match, so one set on the settings page is ignored
     */
    matchFromFile: boolean;
    /**
     * @brief someone chose the match or ids, rather than them coming from a search by folder name
     */
    matchConfirmed: boolean;
    /**
     * @brief what the folder name is searched for as
     */
    searchTitle: string;
}

/**
 * @brief contents of a metadata.json in a manga's folder, any field set here wins over the source
 */
interface ILocalMetadata extends IMetadata {
    /**
     * @brief fetch this entry instead of searching by folder name, for wrong matches
     */
    match?: IMetadataMatch;

    // what older versions used in place of match, ids and links
    anilistId?: number;
    malId?: number;
    url?: string;
    malUrl?: string;
}

type CacheRow = typeof mangaMetadata.$inferSelect;

/**
 * @brief what getMetadata needs about one manga, read in bulk when it's for all of them
 */
interface IMangaState {
    folder: string;
    preferredMatch: IMetadataMatch | undefined;
    cached: CacheRow | undefined;
}

/**
 * @brief one lookup of a manga; everything it depends on is decided before it starts, since the
 * settings can change while it waits for its turn
 */
interface ILookup {
    manga: string;
    match: IMetadataMatch | undefined;
    sourceId: string | undefined;
    priority: CallPriority;
}

// lookups that are queued or running, and when lookups last failed
const inFlight = new Map<string, Promise<void>>();
const failedAt = new Map<string, number>();
const lookupListeners: ((manga: string) => void)[] = [];

// ---- keeping only well formed values, from sources and metadata.json files alike ----

function asText(value: unknown): string | undefined {
    return typeof value === "string" && value !== "" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asTexts(value: unknown): string[] | undefined {
    return Array.isArray(value) ? value.filter((item) => asText(item)) : undefined;
}

// links end up as href attributes, so something like javascript: can't be let through
function asWebUrl(value: unknown): string | undefined {
    return typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;
}

function asLinks(value: unknown): ILink[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    return value.flatMap((link) => {
        const label = asText(link?.label);
        const url = asWebUrl(link?.url);
        return label && url ? [{ label, url }] : [];
    });
}

function asIds(value: unknown): Record<string, string> | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return undefined;
    }
    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => !!asText(entry[1]))
    );
}

// ids are strings here, a number in a metadata.json means the same
function asId(value: unknown): string | undefined {
    return asNumber(value) === undefined ? asText(value) : String(value);
}

function asFields(raw: IMetadataFields): IMetadataFields {
    return {
        title: asText(raw.title),
        alternativeTitles: asTexts(raw.alternativeTitles),
        description: asText(raw.description),
        format: asText(raw.format),
        genres: asTexts(raw.genres),
        tags: asTexts(raw.tags),
        authors: asTexts(raw.authors),
        status: asText(raw.status),
        chapters: asNumber(raw.chapters),
        volumes: asNumber(raw.volumes),
        year: asNumber(raw.year),
        endYear: asNumber(raw.endYear),
        score: asNumber(raw.score),
        popularity: asNumber(raw.popularity),
        isAdult: typeof raw.isAdult === "boolean" ? raw.isAdult : undefined,
    };
}

function toMetadata(sourceId: string, found: ISourceMetadata): IMetadata {
    const id = asText(found.id);
    if (!id) {
        throw new Error(`the "${sourceId}" source returned details without an id`);
    }
    return {
        ...asFields(found),
        source: sourceId,
        sourceId: id,
        ids: { ...asIds(found.ids), [sourceId]: id },
        links: asLinks(found.links),
    };
}

// ---- metadata.json ----

/**
 * @brief splits a metadata.json into the match it sets and the fields that override the source,
 * converting what older versions used
 */
function parseLocalMetadata(local: ILocalMetadata) {
    const { match, url, malUrl } = local;
    const malId = asId(local.malId);
    const anilistId = asId(local.anilistId);
    const ids = malId ? { myanimelist: malId, ...asIds(local.ids) } : asIds(local.ids);
    const legacyLinks = [
        ...(asWebUrl(url) ? [{ label: "AniList", url: url as string }] : []),
        ...(asWebUrl(malUrl) ? [{ label: "MyAnimeList", url: malUrl as string }] : []),
    ];
    const fields: IMetadata = {
        ...asFields(local),
        source: asText(local.source),
        sourceId: asText(local.sourceId),
        ids,
        links: asLinks(local.links) ?? (legacyLinks.length > 0 ? legacyLinks : undefined),
    };
    const matchSource = asText(match?.source);
    const matchId = asId(match?.id);
    const legacyMatch: IMetadataMatch | undefined = anilistId
        ? { source: "anilist", id: anilistId }
        : undefined;
    return {
        match: matchSource && matchId ? { source: matchSource, id: matchId } : legacyMatch,
        // what's left out mustn't hide what the source found
        fields: Object.fromEntries(
            Object.entries(fields).filter(([, value]) => value !== undefined)
        ) as IMetadata,
    };
}

/**
 * @param preferredMatch the match set on the settings page
 * @returns what's set for the manga by hand: fileMatch from its metadata.json, match is that or else
 * preferredMatch
 */
async function readMangaSettings(mangaFolder: string, preferredMatch: IMetadataMatch | undefined) {
    const local = await readJson<ILocalMetadata>(path.join(mangaFolder, LOCAL_METADATA_FILE));
    const { match: fileMatch, fields } = parseLocalMetadata(
        typeof local === "object" && local !== null ? local : {}
    );
    return { fileMatch, fields, match: fileMatch ?? preferredMatch };
}

// ---- asking the sources ----

function callSource<T>(
    id: string,
    source: IMetadataSource,
    priority: CallPriority,
    call: (signal: AbortSignal) => Promise<T>
): Promise<T> {
    return callExtension(id, source.minRequestIntervalMs, priority, call);
}

function requireSource(sourceId: string): IMetadataSource {
    const source = getMetadataSource(sourceId);
    if (!source) {
        throw new Error(`there is no metadata source "${sourceId}"`);
    }
    return source;
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

/**
 * @returns the source's candidates for the search term
 * @throws NotFoundError if there is no such source
 */
export async function searchMetadataSource(
    sourceId: string,
    term: string,
    priority: CallPriority = "interactive"
): Promise<ISearchResult[]> {
    const source = getMetadataSource(sourceId);
    if (!source) {
        throw new NotFoundError(`No metadata source "${sourceId}"`);
    }
    const results = await callSource(sourceId, source, priority, (signal) =>
        source.search(term, signal)
    );
    return (Array.isArray(results) ? results : []).flatMap((result) => {
        const id = asText(result?.id);
        const title = asText(result?.title);
        if (!id || !title) {
            return [];
        }
        return [
            {
                id,
                title,
                year: asNumber(result.year),
                format: asText(result.format),
                url: asWebUrl(result.url),
                coverUrl: asWebUrl(result.coverUrl),
            },
        ];
    });
}

/**
 * @returns the id for what was pasted in (usually a link to the manga), undefined if the source
 * doesn't exist or doesn't accept it
 */
export function parseMatchId(sourceId: string, input: string): string | undefined {
    const source = getMetadataSource(sourceId);
    if (!source) {
        return undefined;
    }
    return asText(guarded(sourceId, () => (source.parseId ? source.parseId(input) : input.trim())));
}

async function bestMatch(
    sourceId: string,
    source: IMetadataSource,
    title: string,
    priority: CallPriority
): Promise<ISourceMetadata | null> {
    const { match } = source;
    if (match) {
        return callSource(sourceId, source, priority, (signal) =>
            match.call(source, title, signal)
        );
    }
    const [first] = await searchMetadataSource(sourceId, title, priority);
    return first
        ? callSource(sourceId, source, priority, (signal) => source.fetch(first.id, signal))
        : null;
}

/**
 * @returns the entry it's matched to, otherwise the source's best match for its name
 */
async function findMetadata({
    manga,
    match,
    sourceId,
    priority,
}: ILookup): Promise<{ sourceId: string; found: ISourceMetadata } | undefined> {
    if (match) {
        const source = requireSource(match.source);
        const found = await callSource(match.source, source, priority, (signal) =>
            source.fetch(match.id, signal)
        );
        return found ? { sourceId: match.source, found } : undefined;
    }
    if (!sourceId) {
        return undefined;
    }
    const found = await bestMatch(sourceId, requireSource(sourceId), searchTitle(manga), priority);
    return found ? { sourceId, found } : undefined;
}

// ---- the cache and downloaded covers ----

function readCache(manga: string) {
    return db().select().from(mangaMetadata).where(eq(mangaMetadata.manga, manga)).get();
}

/**
 * @brief identifies what a lookup used, so a cache entry is only used for the same thing
 */
function lookupKey(match: IMetadataMatch | undefined, sourceId: string | undefined): string {
    return match ? `${match.source}:${match.id}` : `search:${sourceId ?? ""}`;
}

function isCachedFor(
    cached: CacheRow | undefined,
    match: IMetadataMatch | undefined,
    sourceId: string | undefined
): cached is CacheRow {
    if (!cached) {
        return false;
    }
    // a match that confirms the entry a search already found
    const sameEntry =
        match !== undefined &&
        cached.details?.source === match.source &&
        cached.details.sourceId === match.id;
    return sameEntry || cached.lookupKey === lookupKey(match, sourceId);
}

// covers are named by a hash, since manga names can contain anything
function coverName(manga: string): string {
    return createHash("sha1").update(manga).digest("hex");
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

async function removeCover(folder: string, file: string) {
    await fs.rm(path.join(folder, file), { force: true }).catch((error) => {
        console.warn(`Couldn't delete the old cover "${file}": ${error.message}`);
    });
}

/**
 * @brief deletes downloaded covers nothing refers to any more, call this once at startup
 */
export async function removeUnusedCovers(): Promise<void> {
    const folder = getEnv().METADATA_FOLDER;
    const rows = db().select({ cover: mangaMetadata.cover }).from(mangaMetadata).all();
    const used = new Set(rows.map(({ cover }) => cover));
    const files = await fs.readdir(folder).catch(() => []);
    await Promise.all(
        files
            .filter((file) => DOWNLOADED_COVER_FILE.test(file) && !used.has(file))
            .map((file) => removeCover(folder, file))
    );
}

async function fetchAndCache(lookup: ILookup): Promise<void> {
    const { manga, match, sourceId } = lookup;
    const folder = getEnv().METADATA_FOLDER;
    await fs.mkdir(folder, { recursive: true });

    const key = lookupKey(match, sourceId);
    const previous = readCache(manga);
    const result = await findMetadata(lookup);
    const details = result ? toMetadata(result.sourceId, result.found) : null;

    const coverUrl = result && asWebUrl(result.found.coverUrl);
    // the details are still worth caching without a cover
    const downloaded = coverUrl
        ? await downloadCover(coverUrl, folder, coverName(manga)).catch((error) => {
              console.warn(`Couldn't download the cover of "${manga}": ${error.message}`);
              return null;
          })
        : null;
    // a failed download keeps the cover of the same entry, but not one of another entry
    const cover =
        downloaded ?? (coverUrl && isCachedFor(previous, match, sourceId) ? previous.cover : null);

    // nulls rather than undefined, so an update clears what an earlier lookup found
    const values = {
        version: CACHE_VERSION,
        fetchedAt: new Date().toISOString(),
        lookupKey: key,
        found: result !== undefined,
        details,
        cover,
    };
    db()
        .insert(mangaMetadata)
        .values({ manga, ...values })
        .onConflictDoUpdate({ target: mangaMetadata.manga, set: values })
        .run();

    // the extension can differ between entries, so it wasn't simply overwritten
    if (previous?.cover && previous.cover !== cover) {
        await removeCover(folder, previous.cover);
    }
}

function startLookup(lookup: ILookup) {
    const { manga } = lookup;
    const running = fetchAndCache(lookup)
        .then(
            () => {
                failedAt.delete(manga);
                inFlight.delete(manga);
                for (const listener of lookupListeners) {
                    listener(manga);
                }
            },
            (error) => {
                failedAt.set(manga, Date.now());
                console.warn(`Metadata lookup for "${manga}" failed: ${error.message}`);
            }
        )
        .finally(() => inFlight.delete(manga));
    inFlight.set(manga, running);
}

// ---- what the rest of the server uses ----

/**
 * @param listener called with the manga's name whenever a lookup succeeded
 */
export function onLookupFinished(listener: (manga: string) => void) {
    lookupListeners.push(listener);
}

/**
 * @brief the manga's cached details merged with its metadata.json, starting a lookup in the
 * background when there is nothing cached yet (the result then has lookup "pending")
 * @param refresh look it up again even if it's cached, or failed a moment ago
 * @param priority of the lookup if it starts one; choosing a match always goes first, since someone
 * is waiting to see the result
 */
export async function getMetadata(
    manga: string,
    refresh = false,
    priority: CallPriority = "background"
): Promise<IMangaMetadata> {
    const state: IMangaState = {
        folder: await FileHandler.getMangaFolder(manga),
        preferredMatch: getMangaPreferences(manga).match,
        cached: readCache(manga),
    };
    return resolveMetadata(manga, state, getActiveMetadataSource(), refresh, priority);
}

async function resolveMetadata(
    manga: string,
    { folder, preferredMatch, cached }: IMangaState,
    sourceId: string | undefined,
    refresh: boolean,
    priority: CallPriority
): Promise<IMangaMetadata> {
    const { fileMatch, fields, match } = await readMangaSettings(folder, preferredMatch);
    const fetchEnabled = getEnv().FETCH_METADATA;
    // possibly from an older version missing newer fields
    const matching = isCachedFor(cached, match, sourceId) ? cached : undefined;
    // while a lookup runs, or when it can't, whatever is cached keeps being shown
    const merged = (lookup: LookupState): IMangaMetadata => ({
        ...matching?.details,
        ...fields,
        lookup,
        fetchedAt: matching?.fetchedAt,
        matchFromFile: fileMatch !== undefined,
        matchConfirmed: match !== undefined || fields.ids !== undefined,
        searchTitle: searchTitle(manga),
    });

    if (inFlight.has(manga)) {
        return merged("pending");
    }
    // already fetched details are shown even with FETCH_METADATA off, only new lookups stop
    if (matching && !refresh && (matching.version === CACHE_VERSION || !fetchEnabled)) {
        return merged(matching.found ? "found" : "not-found");
    }
    if (!fetchEnabled || (!match && !sourceId)) {
        return merged("disabled");
    }
    // an explicit match doesn't need a usable folder name
    if (match === undefined && searchTitle(manga).length < MIN_SEARCH_LENGTH) {
        return merged("skipped");
    }
    const failed = failedAt.get(manga);
    if (!refresh && failed !== undefined && Date.now() - failed < RETRY_AFTER_MS) {
        return merged("error");
    }
    startLookup({ manga, match, sourceId, priority: match ? "interactive" : priority });
    return merged("pending");
}

/**
 * @brief getMetadata for every manga, keyed by manga name
 */
export async function getAllMetadata(refresh = false): Promise<Record<string, IMangaMetadata>> {
    const mangas = await FileHandler.getMangaList();
    const sourceId = getActiveMetadataSource();
    const preferences = getPreferences();
    const cache = new Map(
        db()
            .select()
            .from(mangaMetadata)
            .all()
            .map((row) => [row.manga, row])
    );
    const entries = await Promise.all(
        mangas.map(async (manga) => {
            const state: IMangaState = {
                folder: path.join(FileHandler.baseFolder, manga),
                preferredMatch: preferences[manga]?.match,
                cached: cache.get(manga),
            };
            const metadata = await resolveMetadata(manga, state, sourceId, refresh, "background");
            return [manga, metadata] as const;
        })
    );
    return Object.fromEntries(entries);
}

/**
 * @returns the cover image to show for the manga: a cover.* file in its folder, else the downloaded
 * cover of the entry it's currently matched to, else the first page of the first chapter
 */
export async function getCoverPath(manga: string): Promise<string | undefined> {
    const mangaFolder = await FileHandler.getMangaFolder(manga);

    const localCover = (await fs.readdir(mangaFolder)).find((file) =>
        LOCAL_COVER_FILES.has(file.toLowerCase())
    );
    if (localCover) {
        return path.join(mangaFolder, localCover);
    }

    const { match } = await readMangaSettings(mangaFolder, getMangaPreferences(manga).match);
    const cached = readCache(manga);
    if (isCachedFor(cached, match, getActiveMetadataSource()) && cached.cover) {
        const downloaded = path.join(getEnv().METADATA_FOLDER, cached.cover);
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
