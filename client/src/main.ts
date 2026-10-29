import { createApp } from "vue";
// createWebHistory
import { createRouter, createWebHashHistory } from "vue-router";

import "./style.css";

import HomeView from "./views/HomeView.vue";
import ReadView from "./views/ReadView.vue";
import App from "./App.vue";

const app = createApp(App);

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/", component: HomeView },
        { path: "/read/:mangaName", component: ReadView },
    ],
});

import "vuetify/styles";
import { createVuetify } from "vuetify";
import "@mdi/font/css/materialdesignicons.css";
import "@fontsource-variable/inter";
import { storage } from "./assets/storage";
import { themes, themeKey, type ThemeName } from "./assets/themes";

// components and directives are imported on demand by vite-plugin-vuetify
const vuetify = createVuetify({
    theme: {
        defaultTheme: storage.get<ThemeName>(themeKey, "dark"),
        themes,
    },
});

app.use(router);
app.use(vuetify);
app.mount("#app");
