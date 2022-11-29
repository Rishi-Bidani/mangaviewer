<template>
    <aside :key="Number(isMobile)">
        <sidebar.PC
            v-if="!isMobile"
            :mangaName="mangaName"
            :chapterList="chapterList"
            :chapterName="chapterName"
            @show-settings="$emit('showSettings')"
        />
        <sidebar.Mobile
            v-if="isMobile"
            :mangaName="mangaName"
            :chapterList="chapterList"
            :chapterName="chapterName"
        />
    </aside>
</template>
<script lang="ts" setup>
// import SidedBarMobile from "@/components/read/sidebar/SideBarMobile.vue";
// import SideBarPC from "./sidebar/SideBarPC.vue";
import { sidebar } from "./sidebar/index";

import { defineProps, ref, onMounted } from "vue";
import { Ref } from "vue";

// import Requests from "@/assets/js/requests";

const props = defineProps<{
    mangaName: string;
    chapterList: string[];
    activeChapter: string;
}>();

// const chapterList: Ref<any> = ref();

const viewportWidth: Ref<number> = ref(1000);
const isMobile: Ref<boolean> = ref(false);
const chapterName: Ref<string> = ref(
    decodeURIComponent(window.location.hash).split("/").at(-1) as string
);
// const chapterName: string = decodeURIComponent(window.location.hash).split("/").at(-1) as string;

window.addEventListener("hashchange", () => {
    chapterName.value = decodeURIComponent(window.location.hash).split("/").at(-1) as string;
});

viewportWidth.value = document.documentElement.clientWidth;
isMobile.value = viewportWidth.value < 500;

window.addEventListener("resize", () => {
    viewportWidth.value = document.documentElement.clientWidth;
    isMobile.value = viewportWidth.value < 500;
});

// onMounted(async () => {
//     chapterList.value = await Requests.getChapterList(props.mangaName);
// });

// function showSettings() {
//     console.log("show settings");
// }
</script>
<style scoped>
@import url("~@/assets/css/colors.css");
@import url("~@/assets/css/utility.css");

aside {
    width: 18rem;
    height: 100vh;
    background-color: var(--secondary-clr);
    overflow-y: auto;
}
/*
.navigation__mobile {
    display: none;
} */

@media screen and (max-width: 500px) {
    aside {
        width: 100%;
        height: 3rem;
    }

    /* .navigation__pc {
        display: none;
    }

    /* .navigation__mobile {
        display: block;
    } */
}
</style>
