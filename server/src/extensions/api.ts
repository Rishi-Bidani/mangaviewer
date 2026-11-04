// the types extensions are written against, see docs/extensions.md; this file has no imports, so
// an extension author can copy it next to their extension and `import type` from it

/**
 * @brief the details a source can know about a manga, every one of them optional
 */
export interface IMetadataFields {
    title?: string;
    alternativeTitles?: string[];
    description?: string;
    /**
     * @brief e.g. "Manga", "One shot", "Novel"
     */
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
     * @brief average score out of 100
     */
    score?: number;
    /**
     * @brief how many users have it on their list
     */
    popularity?: number;
    isAdult?: boolean;
}

/**
 * @brief a page about the manga, shown as a button on its info page
 */
export interface ILink {
    label: string;
    /**
     * @brief only http and https urls are kept
     */
    url: string;
}

export interface ISourceMetadata extends IMetadataFields {
    /**
     * @brief what this source calls the manga, handed back to fetch() when it's looked up again
     */
    id: string;

    /**
     * @brief what other sites call the manga, if the source knows
     * @example { "anilist": "105398", "myanimelist": "121496" }
     */
    ids?: Record<string, string>;

    links?: ILink[];

    /**
     * @brief downloaded once and cached by the server
     */
    coverUrl?: string;
}

/**
 * @brief a candidate shown when someone picks the right entry for a manga by hand
 */
export interface ISearchResult {
    id: string;
    title: string;
    year?: number;
    format?: string;
    /**
     * @brief the candidate's own page, so it can be checked before picking it
     */
    url?: string;
    coverUrl?: string;
}

export interface IMetadataSource {
    /**
     * @brief the shortest time between two calls to this source, which the server keeps to
     */
    minRequestIntervalMs?: number;

    /**
     * @param title the manga's folder name without tags like "[Colored]" or "(2019)"
     * @param signal aborted when the call runs out of time, pass it on to fetch()
     * @returns the candidates, best match first
     */
    search(title: string, signal: AbortSignal): Promise<ISearchResult[]>;

    /**
     * @param id the id from search(), or one pasted in by hand
     * @returns the details, or null if the source doesn't have this id
     */
    fetch(id: string, signal: AbortSignal): Promise<ISourceMetadata | null>;

    /**
     * @brief finds the best match in one call; without it the first search() result is fetched,
     * which takes two calls
     * @returns the details, or null if nothing matches
     */
    match?(title: string, signal: AbortSignal): Promise<ISourceMetadata | null>;

    /**
     * @brief turns what someone pasted (usually a link to the manga) into an id; without it the
     * pasted text is used as it is
     * @returns the id, or undefined if the text isn't valid
     */
    parseId?(input: string): string | undefined;
}

/**
 * @brief a chapter someone finished reading
 */
export interface IProgress {
    /**
     * @brief the manga's folder name
     */
    manga: string;

    /**
     * @brief the title from its metadata, otherwise the folder name
     */
    title: string;

    /**
     * @brief the chapter's folder name
     */
    chapter: string;

    /**
     * @brief from the folder name, which can make it a fraction like 12.5; when none of a manga's
     * chapters have a number it's the chapter's position in the library
     */
    chapterNumber: number;

    /**
     * @brief what each site calls this manga, as far as its metadata knows
     * @example { "anilist": "105398", "myanimelist": "121496" }
     */
    ids: Record<string, string>;

    /**
     * @brief whether someone chose these ids (a match set on the settings page, or in metadata.json)
     * rather than them coming from a search by folder name, which can find the wrong manga
     */
    matchConfirmed: boolean;

    finishedAt: string;
}

/**
 * @brief an account the user signs in to in their browser, e.g. with OAuth; the server gives them
 * a button for it and hands back what the site answers
 */
export interface ISyncAccount {
    /**
     * @returns the name to show for the signed in account, undefined if signed out
     */
    getUser(): string | undefined;

    /**
     * @returns the page to send the browser to
     * @throws with a readable message if it can't start yet, e.g. a setting is missing
     */
    getSignInUrl(): string;

    /**
     * @brief called when the site sends the browser back to the extension's callback url,
     * /api/extensions/<id>/callback
     * @param query that request's query parameters
     */
    finishSignIn(query: Record<string, string>): Promise<void>;

    signOut(): Promise<void>;
}

/**
 * @brief somewhere reading progress is saved to
 */
export interface ISyncTarget {
    /**
     * @brief the shortest time between two calls to this extension, which the server keeps to
     */
    minRequestIntervalMs?: number;

    /**
     * @brief saves the progress; only called with a higher chapter than what it last saved
     * @returns nothing once it's saved, or why it can't be saved for now (shown to the user). Either
     * that or a thrown error has it tried again later, with whatever the latest progress is by then
     * @param signal aborted when the call runs out of time, pass it on to fetch()
     */
    // biome-ignore lint/suspicious/noConfusingVoidType: so an async save() can simply end
    save(progress: IProgress, signal: AbortSignal): Promise<void | { skipped: string }>;

    account?: ISyncAccount;

    /**
     * @returns the file to offer as a download on the settings page, if there is one yet
     */
    getFile?(): string | undefined;
}

/**
 * @brief a value set on the settings page, such as an API key
 */
export interface IExtensionSetting {
    key: string;
    label: string;
    description?: string;
    /**
     * @brief never sent back to the browser once saved
     */
    secret?: boolean;
}

/**
 * @brief small values kept in the server's database, separate for every extension; the values can
 * be anything JSON can hold
 */
export interface IExtensionStore {
    get<T>(key: string): T | undefined;
    set(key: string, value: unknown): void;
    delete(key: string): void;
    /**
     * @returns everything this extension has stored, keyed by key
     */
    all<T>(): Record<string, T>;
}

export interface IExtensionContext {
    /**
     * @brief a folder that belongs to this extension and survives updates and restarts, for files;
     * smaller things can go in the store
     */
    storageFolder: string;

    /**
     * @brief writes a file in storageFolder, creating the folder if needed; the old file is replaced
     * in one step, so a crash never leaves half a file behind
     * @param name the file's name inside storageFolder
     */
    writeFile(name: string, data: string | Uint8Array): Promise<void>;

    /**
     * @brief where to keep things like a sign in or what was synced
     */
    store: IExtensionStore;

    /**
     * @returns the current value of a setting declared in IExtension.settings; read it when it's
     * needed instead of keeping it, since it can change while the server runs
     */
    getSetting(key: string): string | undefined;

    /**
     * @brief makes this extension a metadata source
     */
    provideMetadata(source: IMetadataSource): void;

    /**
     * @brief makes this extension a sync target, which can then be switched on on the settings page
     */
    provideSync(target: ISyncTarget): void;
}

export interface IExtension {
    /**
     * @brief lowercase letters, digits and dashes; has to match the file or folder name
     */
    id: string;

    /**
     * @brief shown on the settings page
     */
    name: string;

    /**
     * @brief the version of this file the extension was written against
     */
    apiVersion: 1;

    settings?: IExtensionSetting[];

    /**
     * @brief called once at startup; use this rather than a top-level await for anything that
     * has to be awaited, which can't be loaded
     */
    setup(context: IExtensionContext): void | Promise<void>;
}
