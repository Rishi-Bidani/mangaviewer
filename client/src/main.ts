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
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "@mdi/font/css/materialdesignicons.css";

const vuetify = createVuetify({
    components,
    directives,
    theme: {
        defaultTheme: "dark",
    },
});

app.use(router);
app.use(vuetify);
app.mount("#app");
