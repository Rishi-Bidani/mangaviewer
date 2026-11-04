// sends finished chapters to the sync targets that are switched on. What's still to be sent is kept
// in the database and tried again later, so an outage or a restart doesn't lose progress, and a
// target is only ever sent a higher chapter than it already has
import { and, eq, isNotNull } from "drizzle-orm";
import { orderBy } from "natural-orderby";
import type { IProgress } from "../extensions/api.ts";
import { db } from "./database.ts";
import { NotFoundError } from "./errors.ts";
import { callExtension } from "./extensionCalls.ts";
import { getEnabledSyncTargets, getExtensionName, getSyncTarget } from "./extensions.ts";
import FileHandler from "./filesystem.ts";
import { getMetadata, onLookupFinished, searchTitle } from "./metadata.ts";
import { syncProgress } from "./schema.ts";

const RETRY_INTERVAL_MS = 5 * 60 * 1000;

interface IFinishedChapter {
    chapter: string;
    chapterNumber: number;
    finishedAt: string;
}

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

function entryKey(targetId: string, manga: string) {
    return and(eq(syncProgress.targetId, targetId), eq(syncProgress.manga, manga));
}

function readEntry(targetId: string, manga: string) {
    return db().select().from(syncProgress).where(entryKey(targetId, manga)).get();
}

function updateEntry(
    targetId: string,
    manga: string,
    changes: Partial<typeof syncProgress.$inferInsert>
) {
    db().update(syncProgress).set(changes).where(entryKey(targetId, manga)).run();
}

// ---- chapter numbers ----

const MARKED_CHAPTER = /(?:^|[^a-z])(?:chapter|chap|ch|c)[\s._-]*(\d+(?:\.\d+)?)/i;
const VOLUME = /(?:^|[^a-z])(?:volume|vol|v)[\s._-]*\d+/gi;
const TAGS = /\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g;

/**
 * @returns the chapter's number going by its folder name, e.g. "Vol.3 Ch.25.5 - Title" is 25.5
 */
export function parseChapterNumber(manga: string, chapter: string): number | undefined {
    // a number in the manga's own name isn't the chapter's, like the 100 in "Mob Psycho 100 12"
    const title = searchTitle(manga).toLowerCase();
    const start = title ? chapter.toLowerCase().indexOf(title) : -1;
    const name = (
        start === -1 ? chapter : chapter.slice(0, start) + chapter.slice(start + title.length)
    ).replace(TAGS, " ");
    const marked = MARKED_CHAPTER.exec(name);
    if (marked) {
        return Number(marked[1]);
    }
    const first = /\d+(?:\.\d+)?/.exec(name.replace(VOLUME, " "));
    return first ? Number(first[0]) : undefined;
}

/**
 * @returns the chapter's number, otherwise its position when no chapter of the manga has a number;
 * undefined for one without a number among ones that do, like an extra, which is left out so that
 * its position can't be mistaken for how far someone got
 */
function chapterNumberOf(manga: string, chapter: string, chapters: string[]): number | undefined {
    const number = parseChapterNumber(manga, chapter);
    if (number !== undefined) {
        return number;
    }
    return chapters.some((other) => parseChapterNumber(manga, other) !== undefined)
        ? undefined
        : chapters.indexOf(chapter) + 1;
}

// ---- sending progress ----

// target and manga of what's being sent right now, which also picks up newer progress when it's done
const delivering = new Set<string>();

async function saveProgress(targetId: string, manga: string, chapter: IFinishedChapter) {
    const target = getSyncTarget(targetId);
    if (!target) {
        throw new Error(`there is no sync target "${targetId}"`);
    }
    const metadata = await getMetadata(manga);
    const progress: IProgress = {
        manga,
        title: metadata.title ?? manga,
        ids: metadata.ids ?? {},
        matchConfirmed: metadata.matchConfirmed,
        ...chapter,
    };
    return callExtension(targetId, target.minRequestIntervalMs, "interactive", (signal) =>
        target.save(progress, signal)
    );
}

async function deliver(targetId: string, manga: string): Promise<void> {
    const key = JSON.stringify([targetId, manga]);
    if (delivering.has(key)) {
        return;
    }
    delivering.add(key);
    try {
        for (;;) {
            const entry = readEntry(targetId, manga);
            if (
                !entry ||
                entry.pendingChapter === null ||
                entry.pendingChapterNumber === null ||
                entry.pendingAt === null
            ) {
                return;
            }
            const sending: IFinishedChapter = {
                chapter: entry.pendingChapter,
                chapterNumber: entry.pendingChapterNumber,
                finishedAt: entry.pendingAt,
            };
            let problem: { kind: "skipped" | "error"; message: string } | undefined;
            try {
                const result = await saveProgress(targetId, manga, sending);
                if (typeof result?.skipped === "string") {
                    problem = { kind: "skipped", message: result.skipped };
                }
            } catch (error) {
                problem = { kind: "error", message: (error as Error).message };
            }
            if (problem) {
                // the same reason over and over isn't worth repeating every few minutes
                if (entry.problemMessage !== problem.message) {
                    if (problem.kind === "error") {
                        console.warn(
                            `Couldn't sync "${manga}" to "${targetId}": ${problem.message}, trying again later`
                        );
                    } else {
                        console.log(
                            `Sync: "${manga}" "${sending.chapter}" is waiting for "${targetId}": ${problem.message}`
                        );
                    }
                }
                updateEntry(targetId, manga, {
                    problemKind: problem.kind,
                    problemMessage: problem.message,
                });
                return;
            }
            // something newer may have come in meanwhile, which goes round again
            const newer =
                readEntry(targetId, manga)?.pendingChapterNumber !== sending.chapterNumber;
            updateEntry(targetId, manga, {
                syncedChapter: sending.chapter,
                syncedChapterNumber: sending.chapterNumber,
                syncedAt: sending.finishedAt,
                problemKind: null,
                problemMessage: null,
                ...(newer
                    ? {}
                    : { pendingChapter: null, pendingChapterNumber: null, pendingAt: null }),
            });
            console.log(`Sync: "${manga}" "${sending.chapter}" saved to "${targetId}"`);
        }
    } finally {
        delivering.delete(key);
    }
}

function startDelivery(targetId: string, manga: string) {
    deliver(targetId, manga).catch((error) => {
        console.warn(`Couldn't save the sync state: ${error.message}`);
    });
}

/**
 * @brief tries everything that's still to be sent again
 * @param manga only for this manga, otherwise for all of them
 */
export function retrySync(manga?: string) {
    const targets = new Set(getEnabledSyncTargets());
    const pending = db()
        .select({ targetId: syncProgress.targetId, manga: syncProgress.manga })
        .from(syncProgress)
        .where(
            and(
                isNotNull(syncProgress.pendingChapter),
                manga === undefined ? undefined : eq(syncProgress.manga, manga)
            )
        )
        .all();
    for (const entry of pending) {
        if (targets.has(entry.targetId)) {
            startDelivery(entry.targetId, entry.manga);
        }
    }
}

/**
 * @brief retrySync for where nothing is waiting on the result, so a problem can't stop the server
 */
function retryInBackground(manga?: string) {
    try {
        retrySync(manga);
    } catch (error) {
        console.warn(`Couldn't read the sync state: ${(error as Error).message}`);
    }
}

/**
 * @brief call this once at startup, after the extensions are loaded
 */
export function startSync() {
    // a title's ids may only just have become known
    onLookupFinished(retryInBackground);
    retryInBackground();
    setInterval(retryInBackground, RETRY_INTERVAL_MS).unref();
}

// ---- what the rest of the server uses ----

export function getSyncStatus(manga: string): ISyncStatus[] {
    return getEnabledSyncTargets().map((id): ISyncStatus => {
        const entry = readEntry(id, manga);
        const isPending = entry?.pendingChapter != null;
        const stateOf = (): ISyncStatus["state"] => {
            if (isPending) {
                if (entry?.problemKind === "skipped") return "waiting";
                return entry?.problemKind ? "failed" : "sending";
            }
            return entry?.syncedChapter != null ? "synced" : "idle";
        };
        return {
            id,
            name: getExtensionName(id),
            state: stateOf(),
            chapter: entry?.syncedChapter ?? undefined,
            message: isPending ? (entry?.problemMessage ?? undefined) : undefined,
        };
    });
}

/**
 * @brief records that the chapter was read to its end and starts sending it
 * @throws NotFoundError if there's no such manga or chapter
 */
export async function reportChapterFinished(
    manga: string,
    chapter: string
): Promise<ISyncStatus[]> {
    const chapters = orderBy(await FileHandler.getChapterList(manga));
    if (!chapters.includes(chapter)) {
        throw new NotFoundError(`${manga} has no chapter ${chapter}`);
    }
    const targets = getEnabledSyncTargets();
    const chapterNumber = chapterNumberOf(manga, chapter, chapters);
    if (chapterNumber === undefined) {
        if (targets.length > 0) {
            console.log(`Sync: "${manga}" "${chapter}" has no chapter number, not sending it`);
        }
        return getSyncStatus(manga);
    }

    const pending = {
        pendingChapter: chapter,
        pendingChapterNumber: chapterNumber,
        pendingAt: new Date().toISOString(),
    };
    for (const id of targets) {
        const entry = readEntry(id, manga);
        const highest = Math.max(
            entry?.syncedChapterNumber ?? Number.NEGATIVE_INFINITY,
            entry?.pendingChapterNumber ?? Number.NEGATIVE_INFINITY
        );
        if (chapterNumber > highest) {
            db()
                .insert(syncProgress)
                .values({ targetId: id, manga, ...pending })
                .onConflictDoUpdate({
                    target: [syncProgress.targetId, syncProgress.manga],
                    set: pending,
                })
                .run();
            console.log(`Sync: "${manga}" "${chapter}" queued for "${id}"`);
        } else {
            console.log(
                `Sync: "${manga}" "${chapter}" not sent to "${id}", it's already at chapter ${highest}`
            );
        }
    }
    for (const id of targets) {
        startDelivery(id, manga);
    }
    return getSyncStatus(manga);
}
