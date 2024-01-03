import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
        },
    },
    server: {
        proxy: {
            "/mangas": {
                target: "http://127.0.0.1:5000",
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: "../dist/client",
    },
});
