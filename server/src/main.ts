import { startServer } from "./app.ts";
import { loadEnvFile } from "./system/env.ts";

loadEnvFile();
await startServer();
