// loads the built-in extensions and the ones named in ENABLED_EXTENSIONS, and keeps track of what
// they provide and which of that is in use; extensions are ordinary code with full access to the
// server, so one only ever runs when it's been listed in that setting
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import anilist from "../extensions/anilist.ts";
import type {
    IExtension,
    IExtensionSetting,
    IExtensionStore,
    IMetadataSource,
    ISyncAccount,
    ISyncTarget,
} from "../extensions/api.ts";
import excel from "../extensions/excel.ts";
import myanimelist from "../extensions/myanimelist.ts";
import { db } from "./database.ts";
import { getEnv } from "./env.ts";
import { BadRequestError, NotFoundError } from "./errors.ts";
import { callExtension, guarded, withTimeout } from "./extensionCalls.ts";
import { removeLeftoverTemporaryFiles, writeFileAtomic } from "./filesystem.ts";
import { appSettings, extensionData, extensionSettings, syncTargets } from "./schema.ts";

const BUILT_IN_EXTENSIONS: IExtension[] = [anilist, myanimelist, excel];
const EXTENSION_ID = /^[a-z0-9][a-z0-9-]*$/;
const API_VERSION = 1;
const SETUP_TIMEOUT_MS = 30_000;
// in app_settings: the source titles are looked up on, unless one is matched to an entry on another
const METADATA_SOURCE_KEY = "metadataSource";

// import() is refused inside a standalone executable (only built-in modules can be imported
// there), while require() works everywhere and also strips the types of .ts files
const requireExtension = createRequire(process.execPath);

interface ILoadedExtension {
    extension: IExtension;
    builtIn: boolean;
    source?: IMetadataSource;
    sync?: ISyncTarget;
}

/**
 * @brief a setting as the browser sees it, the value of a secret one is left out
 */
export interface IExtensionSettingInfo extends IExtensionSetting {
    value?: string;
    isSet: boolean;
}

export interface IExtensionInfo {
    id: string;
    name: string;
    builtIn: boolean;
    /**
     * @brief disabled: found in the extensions folder but not listed in ENABLED_EXTENSIONS
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
    settings: IExtensionSettingInfo[];
}

const loaded = new Map<string, ILoadedExtension>();
const failed = new Map<string, string>();
let disabled: string[] = [];
let defaultSource: string | undefined;

// ---- what extensions keep in the database ----

/**
 * @returns the settings of an extension that have a value
 */
function readSettings(id: string): Record<string, string> {
    const rows = db()
        .select()
        .from(extensionSettings)
        .where(eq(extensionSettings.extensionId, id))
        .all();
    return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
}

function storeOf(extensionId: string): IExtensionStore {
    const entry = (key: string) =>
        and(eq(extensionData.extensionId, extensionId), eq(extensionData.key, key));
    return {
        get: <T>(key: string) =>
            db().select().from(extensionData).where(entry(key)).get()?.value as T | undefined,
        set(key, value) {
            db()
                .insert(extensionData)
                .values({ extensionId, key, value })
                .onConflictDoUpdate({
                    target: [extensionData.extensionId, extensionData.key],
                    set: { value },
                })
                .run();
        },
        delete(key) {
            db().delete(extensionData).where(entry(key)).run();
        },
        all<T>() {
            const rows = db()
                .select()
                .from(extensionData)
                .where(eq(extensionData.extensionId, extensionId))
                .all();
            return Object.fromEntries(rows.map(({ key, value }) => [key, value as T]));
        },
    };
}

// ---- loading ----

/**
 * @returns the extension's <id>.ts or <id>/index.ts, undefined if it has neither
 */
async function findExtensionFile(folder: string, id: string): Promise<string | undefined> {
    for (const file of [path.join(folder, `${id}.ts`), path.join(folder, id, "index.ts")]) {
        if (await fs.stat(file).catch(() => null)) {
            return file;
        }
    }
    return undefined;
}

/**
 * @returns the ids of everything in the extensions folder that looks like an extension
 */
async function findAvailable(folder: string): Promise<string[]> {
    const names = await fs.readdir(folder).catch(() => []);
    const ids = names
        .filter((name) => !name.endsWith(".d.ts"))
        .map((name) => path.basename(name, ".ts"))
        // api.ts is the copy of the types that docs/extensions.md suggests keeping here
        .filter((id) => EXTENSION_ID.test(id) && id !== "api");
    const available = await Promise.all(
        ids.map(async (id) => ((await findExtensionFile(folder, id)) ? id : undefined))
    );
    return available.filter((id) => id !== undefined);
}

function requireFromFile(file: string, id: string): IExtension {
    const extension = (requireExtension(file) as { default?: IExtension }).default;
    if (!extension || typeof extension.setup !== "function") {
        throw new Error("it has to `export default` an object with a setup function");
    }
    if (extension.id !== id) {
        throw new Error(`its id is "${extension.id}" but its file is named "${id}"`);
    }
    if (extension.apiVersion !== API_VERSION) {
        throw new Error(
            `it needs extension API version ${extension.apiVersion}, this server has ${API_VERSION}`
        );
    }
    return extension;
}

async function setUp(extension: IExtension, builtIn: boolean, metadataFolder: string) {
    const storageFolder = path.join(metadataFolder, "extensions", extension.id);
    const entry: ILoadedExtension = { extension, builtIn };
    // built-in extensions make theirs when they first write to it, so a server that doesn't use
    // them stays clean
    if (!builtIn) {
        await fs.mkdir(storageFolder, { recursive: true });
    }
    await removeLeftoverTemporaryFiles(storageFolder);
    const setup = extension.setup({
        storageFolder,
        async writeFile(name, data) {
            await fs.mkdir(storageFolder, { recursive: true });
            await writeFileAtomic(path.join(storageFolder, name), data);
        },
        store: storeOf(extension.id),
        getSetting: (key) => readSettings(extension.id)[key],
        provideMetadata(source) {
            entry.source = source;
        },
        provideSync(target) {
            entry.sync = target;
        },
    });
    await withTimeout(Promise.resolve(setup), SETUP_TIMEOUT_MS, "setup");
    loaded.set(extension.id, entry);
}

/**
 * @brief runs what loads an extension, one that can't be loaded is skipped with a warning
 */
async function tryLoading(id: string, load: () => Promise<void>) {
    try {
        await load();
    } catch (error) {
        failed.set(id, (error as Error).message);
        console.warn(`Skipping extension "${id}": ${(error as Error).message}`);
    }
}

/**
 * @brief loads every extension, call this once at startup; one that can't be loaded doesn't stop
 * the server
 */
export async function loadExtensions(): Promise<void> {
    const { EXTENSIONS_FOLDER, ENABLED_EXTENSIONS, METADATA_FOLDER } = getEnv();

    for (const extension of BUILT_IN_EXTENSIONS) {
        await tryLoading(extension.id, () => setUp(extension, true, METADATA_FOLDER));
    }

    for (const id of new Set(ENABLED_EXTENSIONS)) {
        await tryLoading(id, async () => {
            if (!EXTENSION_ID.test(id)) {
                throw new Error("ids can only have lowercase letters, digits and dashes");
            }
            if (BUILT_IN_EXTENSIONS.some((extension) => extension.id === id)) {
                throw new Error("a built-in extension already has this id");
            }
            const file = await findExtensionFile(EXTENSIONS_FOLDER, id);
            if (!file) {
                throw new Error(`neither ${id}.ts nor ${id}/index.ts is in ${EXTENSIONS_FOLDER}`);
            }
            await setUp(requireFromFile(file, id), false, METADATA_FOLDER);
        });
    }

    disabled = (await findAvailable(EXTENSIONS_FOLDER)).filter(
        (id) => !loaded.has(id) && !failed.has(id)
    );

    // extensions someone added on purpose come before the built-in sources
    defaultSource = [
        ...new Set([...ENABLED_EXTENSIONS, ...BUILT_IN_EXTENSIONS.map(({ id }) => id)]),
    ].find((id) => loaded.get(id)?.source);
    const chosen = readChosenSource();
    if (chosen && !loaded.get(chosen)?.source) {
        console.warn(
            `The chosen metadata source "${chosen}" isn't loaded, using ${defaultSource ?? "none"}`
        );
    }
}

/**
 * @returns a summary of what was loaded, for the console
 */
export function formatExtensions(): string {
    const lines = [...loaded.values()]
        .filter(({ builtIn }) => !builtIn)
        .map(({ extension }) => `   ${extension.id}  loaded (runs with full access to the server)`);
    for (const id of failed.keys()) {
        lines.push(`   ${id}  failed to load`);
    }
    for (const id of disabled) {
        lines.push(`   ${id}  not enabled, add it to ENABLED_EXTENSIONS to run it`);
    }
    return [
        "Extensions:",
        ...lines,
        `   metadata source: ${getActiveMetadataSource() ?? "(none)"}`,
        `   syncing progress to: ${getEnabledSyncTargets().join(", ") || "(nothing)"}`,
    ].join("\n");
}

// ---- metadata sources ----

function readChosenSource(): string | undefined {
    return db().select().from(appSettings).where(eq(appSettings.key, METADATA_SOURCE_KEY)).get()
        ?.value;
}

export function getMetadataSource(id: string): IMetadataSource | undefined {
    return loaded.get(id)?.source;
}

/**
 * @returns the source titles are looked up on: the one chosen on the settings page, or else a
 * default
 */
export function getActiveMetadataSource(): string | undefined {
    const chosen = readChosenSource();
    return chosen && loaded.get(chosen)?.source ? chosen : defaultSource;
}

/**
 * @throws NotFoundError if there is no such source
 */
export function setActiveMetadataSource(id: string) {
    if (!loaded.get(id)?.source) {
        throw new NotFoundError(`No metadata source "${id}"`);
    }
    db()
        .insert(appSettings)
        .values({ key: METADATA_SOURCE_KEY, value: id })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: id } })
        .run();
}

/**
 * @returns every source a title can be matched to, the active one first
 */
export function getMetadataSourceIds(): string[] {
    const active = getActiveMetadataSource();
    const others = [...loaded.values()]
        .filter(({ source, extension }) => source && extension.id !== active)
        .map(({ extension }) => extension.id);
    return active ? [active, ...others] : others;
}

// ---- sync targets ----

export function getSyncTarget(id: string): ISyncTarget | undefined {
    return loaded.get(id)?.sync;
}

/**
 * @returns the sync targets that are switched on and loaded, in the order they were switched on
 */
export function getEnabledSyncTargets(): string[] {
    const rows = db().select().from(syncTargets).orderBy(sql`rowid`).all();
    return rows.map(({ id }) => id).filter((id) => loaded.get(id)?.sync);
}

/**
 * @throws NotFoundError if there is no such sync target
 */
export function setSyncEnabled(id: string, enabled: boolean): IExtensionInfo | undefined {
    if (!getSyncTarget(id)) {
        throw new NotFoundError(`No sync target "${id}"`);
    }
    if (enabled) {
        db().insert(syncTargets).values({ id }).onConflictDoNothing().run();
    } else {
        db().delete(syncTargets).where(eq(syncTargets.id, id)).run();
    }
    return getExtensionInfo(id);
}

/**
 * @returns the file the sync target offers for download, undefined if it has none yet
 */
export function getExtensionFile(id: string): string | undefined {
    const target = getSyncTarget(id);
    return target?.getFile && guarded(id, () => target.getFile?.());
}

function requireAccount(id: string): { target: ISyncTarget; account: ISyncAccount } {
    const target = getSyncTarget(id);
    if (!target?.account) {
        throw new NotFoundError(`"${id}" has no account to sign in to`);
    }
    return { target, account: target.account };
}

/**
 * @returns where to send the browser to sign in
 * @throws NotFoundError if it has no account, BadRequestError if it can't start yet
 */
export function getSignInUrl(id: string): string {
    const { account } = requireAccount(id);
    try {
        return account.getSignInUrl();
    } catch (error) {
        throw new BadRequestError((error as Error).message);
    }
}

export function finishSignIn(id: string, query: Record<string, string>): Promise<void> {
    const { target, account } = requireAccount(id);
    return callExtension(id, target.minRequestIntervalMs, "interactive", () =>
        account.finishSignIn(query)
    );
}

export function signOut(id: string): Promise<void> {
    const { target, account } = requireAccount(id);
    return callExtension(id, target.minRequestIntervalMs, "interactive", () => account.signOut());
}

// ---- what the settings page shows and changes ----

export function getExtensionName(id: string): string {
    return loaded.get(id)?.extension.name ?? id;
}

function settingInfo(setting: IExtensionSetting, value?: string): IExtensionSettingInfo {
    return {
        ...setting,
        value: setting.secret ? undefined : value,
        isSet: value !== undefined,
    };
}

function loadedInfo(
    { extension, builtIn, source, sync }: ILoadedExtension,
    activeSource: string | undefined,
    enabledTargets: string[]
): IExtensionInfo {
    const { id, name } = extension;
    const settings = readSettings(id);
    return {
        id,
        name,
        builtIn,
        status: "loaded",
        isMetadataSource: source !== undefined,
        isActiveMetadataSource: id === activeSource,
        sync: sync && {
            enabled: enabledTargets.includes(id),
            account: sync.account && { user: guarded(id, () => sync.account?.getUser()) },
            hasFile: getExtensionFile(id) !== undefined,
        },
        settings: (extension.settings ?? []).map((setting) =>
            settingInfo(setting, settings[setting.key])
        ),
    };
}

function notLoadedInfo(id: string, status: "failed" | "disabled", error?: string): IExtensionInfo {
    return {
        id,
        name: id,
        builtIn: false,
        status,
        error,
        isMetadataSource: false,
        isActiveMetadataSource: false,
        settings: [],
    };
}

export function listExtensions(): IExtensionInfo[] {
    const activeSource = getActiveMetadataSource();
    const enabledTargets = getEnabledSyncTargets();
    return [
        ...[...loaded.values()].map((entry) => loadedInfo(entry, activeSource, enabledTargets)),
        ...[...failed].map(([id, error]) => notLoadedInfo(id, "failed", error)),
        ...disabled.map((id) => notLoadedInfo(id, "disabled")),
    ];
}

export function getExtensionInfo(id: string): IExtensionInfo | undefined {
    return listExtensions().find((extension) => extension.id === id);
}

/**
 * @param changes the settings to change, null removes one; ones not listed stay as they are
 * @throws NotFoundError if no such extension is loaded, BadRequestError if it has no such setting
 */
export function setExtensionSettings(
    id: string,
    changes: Record<string, string | null>
): IExtensionInfo | undefined {
    const entry = loaded.get(id);
    if (!entry) {
        throw new NotFoundError(`Extension ${id} isn't loaded`);
    }
    const known = new Set(entry.extension.settings?.map(({ key }) => key));
    const unknown = Object.keys(changes).find((key) => !known.has(key));
    if (unknown !== undefined) {
        throw new BadRequestError(`"${id}" has no setting "${unknown}"`);
    }
    db().transaction((tx) => {
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) {
                tx.delete(extensionSettings)
                    .where(
                        and(eq(extensionSettings.extensionId, id), eq(extensionSettings.key, key))
                    )
                    .run();
            } else {
                tx.insert(extensionSettings)
                    .values({ extensionId: id, key, value })
                    .onConflictDoUpdate({
                        target: [extensionSettings.extensionId, extensionSettings.key],
                        set: { value },
                    })
                    .run();
            }
        }
    });
    return getExtensionInfo(id);
}
