// bundles the server, its dependencies and the built client into one file, then turns it into
// standalone executables (Node.js SEA) in release/, one per platform
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ExeTarget } from "@tsdown/exe";
import { defineConfig } from "tsdown";

// the Node.js runtime embedded in every executable (25.7+ needed for ESM support)
const NODE_VERSION = "26.12.0";
const TARGETS: ExeTarget[] = [
    { platform: "win", arch: "x64", nodeVersion: NODE_VERSION },
    { platform: "linux", arch: "x64", nodeVersion: NODE_VERSION },
    { platform: "linux", arch: "arm64", nodeVersion: NODE_VERSION },
    { platform: "darwin", arch: "x64", nodeVersion: NODE_VERSION },
    { platform: "darwin", arch: "arm64", nodeVersion: NODE_VERSION },
];

const CLIENT_DIST = path.join(import.meta.dirname, "..", "client", "dist");
// fallback font formats only very old browsers request, current ones use the .woff2
const SKIPPED_EXTENSIONS = new Set([".eot", ".ttf"]);

/**
 * @brief provides "virtual:client-assets", a Map of every built client file keyed by url path
 */
function clientAssets() {
    const id = "\0virtual:client-assets";
    return {
        name: "client-assets",
        resolveId(source: string) {
            return source === "virtual:client-assets" ? id : null;
        },
        load(loadId: string) {
            if (loadId !== id) return null;
            if (!existsSync(path.join(CLIENT_DIST, "index.html"))) {
                throw new Error(`${CLIENT_DIST} is missing, build the client first`);
            }
            const entries = readdirSync(CLIENT_DIST, { recursive: true, encoding: "utf8" })
                .filter((file) => statSync(path.join(CLIENT_DIST, file)).isFile())
                .filter((file) => !SKIPPED_EXTENSIONS.has(path.extname(file)))
                .map((file) => {
                    const urlPath = `/${file.split(path.sep).join("/")}`;
                    const base64 = readFileSync(path.join(CLIENT_DIST, file)).toString("base64");
                    return `[${JSON.stringify(urlPath)}, Buffer.from("${base64}", "base64")]`;
                });
            return `export default new Map([\n${entries.join(",\n")}\n]);`;
        },
    };
}

export default defineConfig({
    entry: { mangaviewer: "src/standalone.ts" },
    format: "esm",
    platform: "node",
    target: `node${NODE_VERSION}`,
    // intermediate bundle, embedded in the executables
    outDir: "dist/bundle",
    fixedExtension: true,
    clean: true,
    dts: false,
    minify: true,
    // bundle express & co. too, so the output has no node_modules to ship
    deps: { alwaysBundle: [/.*/], onlyBundle: false },
    plugins: [clientAssets()],
    exe: { outDir: "../release", targets: TARGETS },
});
