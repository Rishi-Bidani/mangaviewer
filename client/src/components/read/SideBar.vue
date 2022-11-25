<template>
    <aside :key="Number(isMobile)">
        <SideBarPC v-if="!isMobile" :mangaName="mangaName" :chapterList="chapterList" />
        <SidedBarMobile v-if="isMobile" />
    </aside>
</template>
<script lang="ts" setup>
import SidedBarMobile from "@/components/read/SideBarMobile.vue";
import SideBarPC from "./SideBarPC.vue";

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

viewportWidth.value = document.documentElement.clientWidth;
isMobile.value = viewportWidth.value < 500;

window.addEventListener("resize", () => {
    viewportWidth.value = document.documentElement.clientWidth;
    isMobile.value = viewportWidth.value < 500;
});

// onMounted(async () => {
//     chapterList.value = await Requests.getChapterList(props.mangaName);
// });
</script>
<style scoped>
@import url("../../assets/css/colors.css");
@import url("../../assets/css/utility.css");

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
        width: 100vw;
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
