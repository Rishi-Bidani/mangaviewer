// the tables of the database; after changing them run `pnpm --filter @mangaviewer/server db:generate`
// and commit what it adds to server/drizzle, which updates existing databases at startup
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { IMetadata } from "./metadata.ts";

/**
 * @brief what metadata sources returned, by manga folder name
 */
export const mangaMetadata = sqliteTable("manga_metadata", {
    manga: text("manga").primaryKey(),
    /**
     * @brief CACHE_VERSION when it was fetched
     */
    version: integer("version").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    /**
     * @brief what it was looked up with, so changing the match or the sources refetches it
     */
    lookupKey: text("lookup_key").notNull(),
    found: integer("found", { mode: "boolean" }).notNull(),
    // whatever a source can return, which changes with CACHE_VERSION rather than with a migration
    details: text("details", { mode: "json" }).$type<IMetadata>(),
    /**
     * @brief file name of the downloaded cover in the metadata folder
     */
    cover: text("cover"),
});

export const mangaPreferences = sqliteTable("manga_preferences", {
    manga: text("manga").primaryKey(),
    showCover: integer("show_cover", { mode: "boolean" }),
    matchSource: text("match_source"),
    matchId: text("match_id"),
});

/**
 * @brief how far each manga got on each sync target
 */
export const syncProgress = sqliteTable(
    "sync_progress",
    {
        targetId: text("target_id").notNull(),
        manga: text("manga").notNull(),
        // the highest chapter the target has saved
        syncedChapter: text("synced_chapter"),
        syncedChapterNumber: real("synced_chapter_number"),
        syncedAt: text("synced_at"),
        // the highest chapter it still has to save
        pendingChapter: text("pending_chapter"),
        pendingChapterNumber: real("pending_chapter_number"),
        pendingAt: text("pending_at"),
        // why the last try didn't save it
        problemKind: text("problem_kind").$type<"skipped" | "error">(),
        problemMessage: text("problem_message"),
    },
    (table) => [primaryKey({ columns: [table.targetId, table.manga] })]
);

/**
 * @brief what's set on the settings page for each extension; the secret ones are plain text too
 */
export const extensionSettings = sqliteTable(
    "extension_settings",
    {
        extensionId: text("extension_id").notNull(),
        key: text("key").notNull(),
        value: text("value").notNull(),
    },
    (table) => [primaryKey({ columns: [table.extensionId, table.key] })]
);

/**
 * @brief what extensions keep through context.store
 */
export const extensionData = sqliteTable(
    "extension_data",
    {
        extensionId: text("extension_id").notNull(),
        key: text("key").notNull(),
        value: text("value", { mode: "json" }).notNull(),
    },
    (table) => [primaryKey({ columns: [table.extensionId, table.key] })]
);

/**
 * @brief the sync targets that are switched on
 */
export const syncTargets = sqliteTable("sync_targets", {
    id: text("id").primaryKey(),
});

/**
 * @brief single choices from the settings page
 */
export const appSettings = sqliteTable("app_settings", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});
