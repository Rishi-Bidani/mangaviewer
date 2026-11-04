// for `pnpm db:generate`, which writes the migration for what changed in the schema
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    schema: "./src/system/schema.ts",
    out: "./drizzle",
});
