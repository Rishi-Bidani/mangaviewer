// an example metadata source, see docs/extensions.md; copy it into your extensions folder as
// mangadex.ts to try it. The import below is only types, so it's fine if the path doesn't exist
// where you put this: it's only used by your editor, and removed when the file is loaded
import type { IExtension, ISearchResult, ISourceMetadata } from "../../server/src/extensions/api.ts";

const API_URL = "https://api.mangadex.org";
const COVERS_URL = "https://uploads.mangadex.org/covers";

interface IMangaDexManga {
    id: string;
    attributes: {
        title: Record<string, string>;
        altTitles: Record<string, string>[];
        description: Record<string, string>;
        status: string | null;
        year: number | null;
        contentRating: string;
        tags: { attributes: { name: Record<string, string>; group: string } }[];
        links: Record<string, string> | null;
    };
    relationships: {
        type: string;
        attributes?: { name?: string; fileName?: string };
    }[];
}

async function request<T>(url: string): Promise<T> {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
        throw new Error(`MangaDex responded ${response.status}`);
    }
    return (await response.json()) as T;
}

function titleOf(manga: IMangaDexManga): string {
    const { title } = manga.attributes;
    return title.en ?? Object.values(title)[0] ?? manga.id;
}

function coverOf(manga: IMangaDexManga): string | undefined {
    const file = manga.relationships.find(({ type }) => type === "cover_art")?.attributes?.fileName;
    return file && `${COVERS_URL}/${manga.id}/${file}`;
}

function toMetadata(manga: IMangaDexManga): ISourceMetadata {
    const { attributes, relationships, id } = manga;
    const ids: Record<string, string> = {};
    const links = [{ label: "MangaDex", url: `https://mangadex.org/title/${id}` }];
    // ids on other sites, which is how this source tells list sync what the manga is on AniList
    if (attributes.links?.al) {
        ids.anilist = attributes.links.al;
        links.push({ label: "AniList", url: `https://anilist.co/manga/${attributes.links.al}` });
    }
    if (attributes.links?.mal) {
        ids.myanimelist = attributes.links.mal;
        links.push({
            label: "MyAnimeList",
            url: `https://myanimelist.net/manga/${attributes.links.mal}`,
        });
    }
    const tagNames = (group: string) =>
        attributes.tags
            .filter((tag) => tag.attributes.group === group)
            .map((tag) => tag.attributes.name.en)
            .filter(Boolean);
    return {
        id,
        ids,
        links,
        title: titleOf(manga),
        alternativeTitles: attributes.altTitles.flatMap((names) => Object.values(names)),
        description: attributes.description.en,
        status: attributes.status ?? undefined,
        year: attributes.year ?? undefined,
        genres: tagNames("genre"),
        tags: tagNames("theme"),
        authors: [
            ...new Set(
                relationships
                    .filter(({ type }) => type === "author" || type === "artist")
                    .flatMap(({ attributes: person }) => person?.name ?? [])
            ),
        ],
        isAdult: attributes.contentRating === "pornographic",
        coverUrl: coverOf(manga),
    };
}

function toSearchResult(manga: IMangaDexManga): ISearchResult {
    return {
        id: manga.id,
        title: titleOf(manga),
        year: manga.attributes.year ?? undefined,
        url: `https://mangadex.org/title/${manga.id}`,
    };
}

const INCLUDES = "includes[]=cover_art&includes[]=author&includes[]=artist";

export default {
    id: "mangadex",
    name: "MangaDex",
    apiVersion: 1,
    setup(context) {
        context.provideMetadata({
            minRequestIntervalMs: 500,
            async search(title) {
                const url = `${API_URL}/manga?limit=10&title=${encodeURIComponent(title)}&order[relevance]=desc`;
                const { data } = await request<{ data: IMangaDexManga[] }>(url);
                return data.map(toSearchResult);
            },
            async match(title) {
                const url = `${API_URL}/manga?limit=1&title=${encodeURIComponent(title)}&order[relevance]=desc&${INCLUDES}`;
                const { data } = await request<{ data: IMangaDexManga[] }>(url);
                return data[0] ? toMetadata(data[0]) : null;
            },
            async fetch(id) {
                const url = `${API_URL}/manga/${encodeURIComponent(id)}?${INCLUDES}`;
                const { data } = await request<{ data: IMangaDexManga }>(url);
                return toMetadata(data);
            },
            // a link like https://mangadex.org/title/<uuid>/some-name, or a plain id
            parseId(input) {
                return /[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/i.exec(input)?.[0];
            },
        });
    },
} satisfies IExtension;
