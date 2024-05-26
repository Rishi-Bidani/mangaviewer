import { createApp } from "vue";
// createWebHistory
import { createRouter, createWebHashHistory } from "vue-router";

import "./style.css";

import Home from "./views/Home.vue";
import Read from "./views/Read.vue";
import App from "./App.vue";

const app = createApp(App);

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/", component: Home },
        { path: "/read/:mangaName", component: Read },
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
