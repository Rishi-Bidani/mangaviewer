// looks up covers and details for mangas on AniList
import { setTimeout as sleep } from "node:timers/promises";
import type { IExtension, ISearchResult, ISourceMetadata } from "./api.ts";

const ANILIST_URL = "https://graphql.anilist.co";
// anilist allows up to 90 requests a minute (lowered to 30 at times), so stay well under that
const REQUEST_INTERVAL_MS = 2500;
const SEARCH_RESULTS = 10;

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

type IAniListCandidate = Pick<IAniListMedia, "id" | "siteUrl" | "format" | "title"> & {
    startDate: { year: number | null };
    coverImage: { large: string | null };
};

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

const SEARCH_QUERY = `query ($search: String, $perPage: Int) {
    Page(perPage: $perPage) {
        media(search: $search, type: MANGA) {
            id siteUrl format
            title { romaji english native }
            startDate { year }
            coverImage { large }
        }
    }
}`;

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

// e.g. NOT_YET_RELEASED -> "Not yet released", ONE_SHOT -> "One shot"
function readableEnum(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
}

function toMetadata(media: IAniListMedia): ISourceMetadata {
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
    const links = [{ label: "AniList", url: media.siteUrl }];
    if (media.idMal) {
        links.push({
            label: "MyAnimeList",
            url: `https://myanimelist.net/manga/${media.idMal}`,
        });
    }
    return {
        id: String(media.id),
        ids: media.idMal ? { myanimelist: String(media.idMal) } : undefined,
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
        links,
        coverUrl: media.coverImage.extraLarge ?? media.coverImage.large ?? undefined,
    };
}

function toSearchResult(media: IAniListCandidate): ISearchResult {
    const { english, romaji, native } = media.title;
    return {
        id: String(media.id),
        title: english ?? romaji ?? native ?? String(media.id),
        year: media.startDate.year ?? undefined,
        format: media.format ? readableEnum(media.format) : undefined,
        url: media.siteUrl,
        coverUrl: media.coverImage.large ?? undefined,
    };
}

/**
 * @returns the response's data, or null if AniList answered that it has no match
 */
async function queryAniList<T>(
    query: string,
    variables: Record<string, unknown>,
    signal: AbortSignal
) {
    for (let attempt = 0; ; attempt++) {
        const response = await fetch(ANILIST_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query, variables }),
            signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        });
        if (response.status === 429 && attempt < 2) {
            const waitMs = (Number(response.headers.get("Retry-After")) || 60) * 1000;
            await sleep(waitMs, undefined, { signal });
            continue;
        }
        // anilist answers "no match" with a 404
        if (response.status === 404) {
            return null;
        }
        const body = (await response.json().catch(() => ({}))) as {
            data?: T;
            errors?: { message: string }[];
        };
        if (!response.ok || !body.data) {
            const reason = body.errors?.[0]?.message ?? response.statusText;
            throw new Error(`AniList responded ${response.status}: ${reason}`);
        }
        return body.data;
    }
}

async function queryMedia(variables: { id?: number; search?: string }, signal: AbortSignal) {
    const data = await queryAniList<{ Media: IAniListMedia | null }>(
        MEDIA_QUERY,
        variables,
        signal
    );
    return data?.Media ? toMetadata(data.Media) : null;
}

export default {
    id: "anilist",
    name: "AniList",
    apiVersion: 1,
    setup(context) {
        context.provideMetadata({
            minRequestIntervalMs: REQUEST_INTERVAL_MS,
            match: (title, signal) => queryMedia({ search: title }, signal),
            fetch: (id, signal) => queryMedia({ id: Number(id) }, signal),
            async search(title, signal) {
                const data = await queryAniList<{ Page: { media: IAniListCandidate[] } }>(
                    SEARCH_QUERY,
                    { search: title, perPage: SEARCH_RESULTS },
                    signal
                );
                return data?.Page.media.map(toSearchResult) ?? [];
            },
            // a link like https://anilist.co/manga/30013/One-Piece, or a plain id
            parseId(input) {
                const text = input.trim();
                const id = /^\d+$/.test(text) ? text : /anilist\.co\/manga\/(\d+)/i.exec(text)?.[1];
                return id && Number(id) > 0 ? String(Number(id)) : undefined;
            },
        });
    },
} satisfies IExtension;
