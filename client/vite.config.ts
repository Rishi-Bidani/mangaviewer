import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        vuetify({ autoImport: true, styles: { configFile: "src/styles/settings.scss" } }),
    ],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
        },
    },
    server: {
        proxy: {
            // keeps the browser's host, which the server compares with where a request came from
            "/api": {
                target: "http://127.0.0.1:8080",
            },
            "/images": {
                target: "http://127.0.0.1:8080",
                changeOrigin: true,
            },
        },
    },
});
