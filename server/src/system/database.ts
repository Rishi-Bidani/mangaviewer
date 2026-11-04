// the server's own data lives in one SQLite file in the metadata folder, images stay plain files.
// It uses the SQLite built into Node.js, since a native module like better-sqlite3 can't go inside
// the standalone executables
import { mkdirSync } from "node:fs";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { getEnv } from "./env.ts";
import { type IMigration, readMigrations } from "./migrations.ts";

export const DATABASE_FILE = "mangaviewer.db";

// server/drizzle, from both src/system and dist/system
const MIGRATIONS_FOLDER = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "drizzle"
);

let database: NodeSQLiteDatabase | undefined;

/**
 * @brief runs the migrations this database hasn't had yet; user_version is how many it has had
 */
function migrate(client: DatabaseSync, migrations: IMigration[]) {
    const { user_version: applied } = client.prepare("PRAGMA user_version").get() as {
        user_version: number;
    };
    if (applied > migrations.length) {
        throw new Error(
            `it was last used by a newer version of mangaviewer (${applied} migrations, this version has ${migrations.length})`
        );
    }
    migrations.slice(applied).forEach((migration, index) => {
        client.exec("BEGIN IMMEDIATE");
        try {
            client.exec(migration.sql);
            client.exec(`PRAGMA user_version = ${applied + index + 1}`);
            client.exec("COMMIT");
        } catch (error) {
            client.exec("ROLLBACK");
            throw new Error(`migration ${migration.name} failed: ${(error as Error).message}`);
        }
    });
}

/**
 * @brief opens the database and brings it up to date, call this once at startup
 * @param migrations what to run instead of server/drizzle, for the standalone bundle where that
 * folder doesn't exist
 */
export function openDatabase(migrations: IMigration[] = readMigrations(MIGRATIONS_FOLDER)) {
    const folder = getEnv().METADATA_FOLDER;
    mkdirSync(folder, { recursive: true });
    // SQLite's default journal rather than WAL, which breaks when the metadata folder is on a network
    // drive (the standalone executables keep it in the manga folder) and gains little here: there's
    // one connection and few writes
    const client = new DatabaseSync(path.join(folder, DATABASE_FILE), { timeout: 5000 });
    migrate(client, migrations);
    database = drizzle({ client });
}

export function db(): NodeSQLiteDatabase {
    if (!database) {
        throw new Error("The database isn't open yet");
    }
    return database;
}
