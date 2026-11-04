// looks up covers and details for mangas on MyAnimeList, and saves reading progress to the signed
// in account's list; both need a client id from https://myanimelist.net/apiconfig
import { randomBytes, randomUUID } from "node:crypto";
import type { IExtension, ISourceMetadata } from "./api.ts";

const API_URL = "https://api.myanimelist.net/v2";
const OAUTH_URL = "https://myanimelist.net/v1/oauth2";
// mal doesn't publish a limit, but bursts of requests are known to get an ip blocked for a while
const REQUEST_INTERVAL_MS = 1000;
const SEARCH_RESULTS = 10;
// longer search terms are refused
const MAX_SEARCH_LENGTH = 64;
// refreshed this long before it runs out, so it can't expire halfway through a request
const TOKEN_MARGIN_MS = 60 * 60 * 1000;
const TOKEN_KEY = "token";
const DETAIL_FIELDS =
    "alternative_titles,start_date,synopsis,mean,num_list_users,nsfw,media_type,status,genres,num_volumes,num_chapters,authors{first_name,last_name}";
const SEARCH_FIELDS = "start_date,media_type";

interface IMalManga {
    id: number;
    title: string;
    main_picture?: { medium?: string; large?: string };
    alternative_titles?: { synonyms?: string[]; en?: string; ja?: string };
    start_date?: string;
    synopsis?: string;
    mean?: number;
    num_list_users?: number;
    nsfw?: string;
    media_type?: string;
    status?: string;
    genres?: { name: string }[];
    num_volumes?: number;
    num_chapters?: number;
    authors?: { node: { first_name?: string; last_name?: string } }[];
    my_list_status?: { status?: string; num_chapters_read?: number };
}

interface IToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: string;
}

class MalError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`MyAnimeList responded ${status}`);
        this.status = status;
    }
}

// e.g. currently_publishing -> "Currently publishing", one_shot -> "One shot"
function readableEnum(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function pageOf(id: number | string): string {
    return `https://myanimelist.net/manga/${id}`;
}

function yearOf(date?: string): number | undefined {
    return date ? Number(date.slice(0, 4)) || undefined : undefined;
}

function toMetadata(manga: IMalManga): ISourceMetadata {
    const { synonyms = [], en, ja } = manga.alternative_titles ?? {};
    return {
        id: String(manga.id),
        title: en || manga.title,
        alternativeTitles: [manga.title, ja, ...synonyms].filter(
            (name): name is string => !!name && name !== (en || manga.title)
        ),
        description: manga.synopsis,
        format: manga.media_type ? readableEnum(manga.media_type) : undefined,
        genres: manga.genres?.map(({ name }) => name),
        authors: manga.authors?.map(({ node }) =>
            [node.first_name, node.last_name].filter(Boolean).join(" ")
        ),
        status: manga.status ? readableEnum(manga.status) : undefined,
        // 0 means it isn't known
        chapters: manga.num_chapters || undefined,
        volumes: manga.num_volumes || undefined,
        year: yearOf(manga.start_date),
        score: manga.mean === undefined ? undefined : Math.round(manga.mean * 10),
        popularity: manga.num_list_users,
        isAdult: manga.nsfw === undefined ? undefined : manga.nsfw === "black",
        links: [{ label: "MyAnimeList", url: pageOf(manga.id) }],
        coverUrl: manga.main_picture?.large ?? manga.main_picture?.medium,
    };
}

export default {
    id: "myanimelist",
    name: "MyAnimeList",
    apiVersion: 1,
    settings: [
        {
            key: "clientId",
            label: "Client ID",
            description: "Create an API client at myanimelist.net/apiconfig, with app type Other",
        },
        {
            key: "clientSecret",
            label: "Client secret",
            description: "Only for an API client with app type Web",
            secret: true,
        },
    ],
    async setup(context) {
        let token = context.store.get<IToken>(TOKEN_KEY);
        // the sign in that's in progress, kept until the browser comes back
        let signIn: { state: string; verifier: string } | undefined;

        function clientId(): string {
            const id = context.getSetting("clientId");
            if (!id) {
                throw new Error("Set the Client ID of MyAnimeList on the settings page first");
            }
            return id;
        }

        async function requestToken(fields: Record<string, string>) {
            const secret = context.getSetting("clientSecret");
            const response = await fetch(`${OAUTH_URL}/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: clientId(),
                    ...(secret ? { client_secret: secret } : {}),
                    ...fields,
                }),
                signal: AbortSignal.timeout(15_000),
            });
            if (!response.ok) {
                throw new MalError(response.status);
            }
            return (await response.json()) as {
                access_token: string;
                refresh_token: string;
                expires_in: number;
            };
        }

        async function saveToken(newToken: IToken | undefined) {
            token = newToken;
            if (newToken) {
                context.store.set(TOKEN_KEY, newToken);
            } else {
                context.store.delete(TOKEN_KEY);
            }
        }

        async function refreshAccess(current: IToken): Promise<string> {
            let tokens: Awaited<ReturnType<typeof requestToken>>;
            try {
                tokens = await requestToken({
                    grant_type: "refresh_token",
                    refresh_token: current.refreshToken,
                });
            } catch (error) {
                // only an answer saying the refresh token is no good needs a new sign in
                if (error instanceof MalError && error.status >= 400 && error.status < 500) {
                    await saveToken(undefined);
                    throw new Error("The sign in to MyAnimeList expired, please sign in again");
                }
                throw error;
            }
            await saveToken({
                ...current,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: Date.now() + tokens.expires_in * 1000,
            });
            return tokens.access_token;
        }

        async function send(url: string, headers: Record<string, string>, init?: RequestInit) {
            return fetch(url, {
                ...init,
                headers: { ...headers, ...init?.headers },
                signal: AbortSignal.any([
                    AbortSignal.timeout(15_000),
                    ...(init?.signal ? [init.signal] : []),
                ]),
            });
        }

        /**
         * @brief a request made as the signed in account, signing in again once if it's refused
         */
        async function accountRequest<T>(route: string, init?: RequestInit): Promise<T> {
            if (!token) {
                throw new Error("Not signed in to MyAnimeList, sign in on the settings page");
            }
            const access =
                token.expiresAt - Date.now() < TOKEN_MARGIN_MS
                    ? await refreshAccess(token)
                    : token.accessToken;
            const url = `${API_URL}${route}`;
            let response = await send(url, { Authorization: `Bearer ${access}` }, init);
            if (response.status === 401) {
                const refreshed = await refreshAccess(token);
                response = await send(url, { Authorization: `Bearer ${refreshed}` }, init);
            }
            if (!response.ok) {
                throw new MalError(response.status);
            }
            return (await response.json()) as T;
        }

        /**
         * @returns the response, or null if there's no such manga
         */
        async function publicRequest<T>(route: string, signal: AbortSignal): Promise<T | null> {
            const response = await send(
                `${API_URL}${route}`,
                { "X-MAL-CLIENT-ID": clientId() },
                { signal }
            );
            if (response.status === 404) {
                return null;
            }
            if (!response.ok) {
                throw new MalError(response.status);
            }
            return (await response.json()) as T;
        }

        context.provideMetadata({
            minRequestIntervalMs: REQUEST_INTERVAL_MS,
            async search(title, signal) {
                const query = new URLSearchParams({
                    q: title.slice(0, MAX_SEARCH_LENGTH),
                    limit: String(SEARCH_RESULTS),
                    fields: SEARCH_FIELDS,
                });
                const found = await publicRequest<{ data: { node: IMalManga }[] }>(
                    `/manga?${query}`,
                    signal
                );
                return (found?.data ?? []).map(({ node }) => ({
                    id: String(node.id),
                    title: node.title,
                    year: yearOf(node.start_date),
                    format: node.media_type ? readableEnum(node.media_type) : undefined,
                    url: pageOf(node.id),
                    coverUrl: node.main_picture?.medium,
                }));
            },
            async fetch(id, signal) {
                const manga = await publicRequest<IMalManga>(
                    `/manga/${encodeURIComponent(id)}?fields=${DETAIL_FIELDS}`,
                    signal
                );
                return manga && toMetadata(manga);
            },
            // a link like https://myanimelist.net/manga/13/One_Piece, or a plain id
            parseId(input) {
                const text = input.trim();
                const id = /^\d+$/.test(text)
                    ? text
                    : /myanimelist\.net\/manga\/(\d+)/i.exec(text)?.[1];
                return id && Number(id) > 0 ? String(Number(id)) : undefined;
            },
        });

        context.provideSync({
            minRequestIntervalMs: REQUEST_INTERVAL_MS,
            account: {
                getUser: () => token?.user,
                getSignInUrl() {
                    // mal only supports the plain method, so the challenge is the verifier itself;
                    // redirect_uri is left out, mal then uses the one registered for the client
                    signIn = {
                        state: randomUUID(),
                        verifier: randomBytes(48).toString("base64url"),
                    };
                    const query = new URLSearchParams({
                        response_type: "code",
                        client_id: clientId(),
                        state: signIn.state,
                        code_challenge: signIn.verifier,
                        code_challenge_method: "plain",
                    });
                    return `${OAUTH_URL}/authorize?${query}`;
                },
                async finishSignIn(query) {
                    const started = signIn;
                    signIn = undefined;
                    if (!started || query.state !== started.state) {
                        throw new Error("This sign in wasn't started here, please try again");
                    }
                    if (!query.code) {
                        throw new Error(query.error ?? "MyAnimeList didn't allow the sign in");
                    }
                    const tokens = await requestToken({
                        grant_type: "authorization_code",
                        code: query.code,
                        code_verifier: started.verifier,
                    });
                    const response = await send(`${API_URL}/users/@me`, {
                        Authorization: `Bearer ${tokens.access_token}`,
                    });
                    if (!response.ok) {
                        throw new MalError(response.status);
                    }
                    const me = (await response.json()) as { name?: string };
                    await saveToken({
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        expiresAt: Date.now() + tokens.expires_in * 1000,
                        user: me.name ?? "your account",
                    });
                },
                signOut: () => saveToken(undefined),
            },
            async save(progress, signal) {
                const id = progress.ids.myanimelist;
                if (!id) {
                    return { skipped: "Its entry here isn't known, link this title to one" };
                }
                // a search by folder name can find the wrong manga, and this changes a real list
                if (!progress.matchConfirmed) {
                    return { skipped: "Confirm its match first, so the wrong entry isn't changed" };
                }
                const route = `/manga/${encodeURIComponent(id)}`;
                const manga = await accountRequest<IMalManga>(
                    `${route}?fields=num_chapters,status,my_list_status`,
                    { signal }
                );
                const total = manga.num_chapters ?? 0;
                const listed = manga.my_list_status;
                const chapters = Math.min(
                    Math.floor(progress.chapterNumber),
                    total || Number.POSITIVE_INFINITY
                );
                // it may have been read further elsewhere, this must never lower it
                if (listed && chapters <= (listed.num_chapters_read ?? 0)) {
                    return;
                }
                const body = new URLSearchParams({ num_chapters_read: String(chapters) });
                if (manga.status === "finished" && total > 0 && chapters >= total) {
                    body.set("status", "completed");
                } else if (!listed || listed.status === "plan_to_read") {
                    body.set("status", "reading");
                }
                await accountRequest(`${route}/my_list_status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body,
                    signal,
                });
            },
        });
    },
} satisfies IExtension;
