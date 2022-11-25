import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import { Router } from "vue-router";
import Home from "../views/Download.vue";
import HomePage from "../views/HomePage.vue";
import Read from "../views/Read.vue";

const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        name: "Home",
        component: HomePage,
    },
    {
        path: "/download",
        name: "Download",
        component: Home,
    },
    {
        path: "/read/:mangaName/:chapter?",
        name: "Read",
        component: Read,
    },
    {
        path: "/about",
        name: "About",
        // route level code-splitting
        // this generates a separate chunk (about.[hash].js) for this route
        // which is lazy-loaded when the route is visited.
        component: () => import(/* webpackChunkName: "about" */ "../views/About.vue"),
    },
];

const router: Router = createRouter({
    history: createWebHashHistory(),
    routes,
});

export default router;
