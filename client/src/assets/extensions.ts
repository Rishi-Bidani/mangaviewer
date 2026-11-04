import { fetchJson } from "./utility";

// mirrors IExtensionInfo in server/src/system/extensions.ts
export interface IExtensionSetting {
    key: string;
    label: string;
    description?: string;
    secret?: boolean;
    /**
     * @brief left out for secret settings, which the server never sends back
     */
    value?: string;
    isSet: boolean;
}

export interface IExtension {
    id: string;
    name: string;
    builtIn: boolean;
    /**
     * @brief disabled: in the extensions folder but not listed in ENABLED_EXTENSIONS
     */
    status: "loaded" | "failed" | "disabled";
    error?: string;
    isMetadataSource: boolean;
    /**
     * @brief the metadata source titles are looked up on
     */
    isActiveMetadataSource: boolean;
    /**
     * @brief only for sync targets
     */
    sync?: {
        enabled: boolean;
        /**
         * @brief only for targets that need a sign in; user is who's signed in, if anyone
         */
        account?: { user?: string };
        hasFile: boolean;
    };
    settings: IExtensionSetting[];
}

// mirrors ISyncStatus in server/src/system/sync.ts
export interface ISyncStatus {
    id: string;
    name: string;
    /**
     * @brief idle: nothing was finished yet since it was switched on, waiting: can't be saved until
     * something changes (the message says what), failed: will be tried again
     */
    state: "idle" | "synced" | "sending" | "waiting" | "failed";
    /**
     * @brief the highest chapter it has saved
     */
    chapter?: string;
    message?: string;
}

export interface IMetadataSource {
    id: string;
    name: string;
}

// mirrors ISearchResult in server/src/extensions/api.ts
export interface ISearchResult {
    id: string;
    title: string;
    year?: number;
    format?: string;
    url?: string;
    coverUrl?: string;
}

export function fetchExtensions(): Promise<IExtension[]> {
    return fetchJson<IExtension[]>("/api/extensions");
}

/**
 * @param changes the settings to change, null removes one
 */
export function saveExtensionSettings(
    id: string,
    changes: Record<string, string | null>
): Promise<IExtension> {
    return fetchJson<IExtension>(`/api/extensions/${encodeURIComponent(id)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
    });
}

/**
 * @brief chooses the source titles are looked up on
 * @returns every extension, which now shows the new choice
 */
export function setActiveMetadataSource(id: string): Promise<IExtension[]> {
    return fetchJson<IExtension[]>("/api/metadata-source", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
    });
}

export function setSyncEnabled(id: string, enabled: boolean): Promise<IExtension> {
    return fetchJson<IExtension>(`/api/extensions/${encodeURIComponent(id)}/sync`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
    });
}

/**
 * @returns the page to send the browser to
 */
export async function startSignIn(id: string): Promise<string> {
    const url = `/api/extensions/${encodeURIComponent(id)}/sign-in`;
    return (await fetchJson<{ url: string }>(url, { method: "POST" })).url;
}

export function signOut(id: string): Promise<IExtension> {
    return fetchJson<IExtension>(`/api/extensions/${encodeURIComponent(id)}/sign-in`, {
        method: "DELETE",
    });
}

/**
 * @brief the address a site has to send the browser back to after signing in
 */
export function signInCallbackUrl(id: string): string {
    return `${window.location.origin}/api/extensions/${encodeURIComponent(id)}/callback`;
}

export function extensionFileUrl(id: string): string {
    return `/api/extensions/${encodeURIComponent(id)}/file`;
}

export function fetchSyncStatus(manga: string): Promise<ISyncStatus[]> {
    return fetchJson<ISyncStatus[]>(`/api/mangas/${encodeURIComponent(manga)}/sync`);
}

/**
 * @brief tells the server a chapter was read to its end, which sends it to the sync targets
 */
export function reportChapterFinished(manga: string, chapter: string): Promise<ISyncStatus[]> {
    return fetchJson<ISyncStatus[]>(`/api/mangas/${encodeURIComponent(manga)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter }),
    });
}

/**
 * @returns every source a title can be matched to, the one titles are looked up on first
 */
export function fetchMetadataSources(): Promise<IMetadataSource[]> {
    return fetchJson<IMetadataSource[]>("/api/metadata-sources");
}

export function searchMetadataSource(source: string, term: string): Promise<ISearchResult[]> {
    const url = `/api/metadata-sources/${encodeURIComponent(source)}/search`;
    return fetchJson<ISearchResult[]>(`${url}?q=${encodeURIComponent(term)}`);
}
