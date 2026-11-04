// shared by the server and tsdown.config.ts, which embeds the migrations in the standalone bundle;
// both have to read them in the same order, since a database records how many it has had
import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";

export interface IMigration {
    name: string;
    sql: string;
}

/**
 * @returns the migrations drizzle-kit wrote to the folder, oldest first; their folder names start
 * with the date
 */
export function readMigrations(folder: string): IMigration[] {
    return readdirSync(folder)
        .sort()
        .filter((name) => existsSync(path.join(folder, name, "migration.sql")))
        .map((name) => ({
            name,
            sql: readFileSync(path.join(folder, name, "migration.sql"), "utf8"),
        }));
}
