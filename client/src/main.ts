import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import "./style.css";

import Home from "./views/Home.vue";

const app = createApp(Home);

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/", component: Home },
        { path: "/read", component: Home },
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
