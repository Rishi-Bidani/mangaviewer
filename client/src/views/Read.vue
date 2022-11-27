<template>
    <section class="main">
        <side-bar
            :mangaName="mangaName"
            :chapterList="chapterList"
            :activeChapter="activeChapter"
        />
        <section class="container__images"></section>
    </section>
</template>
<script lang="ts" setup>
import SideBar from "@/components/read/SideBar.vue";

import Requests from "@/assets/js/requests";
import { ref, onMounted, watch } from "vue";

// types
import { Ref } from "vue";

const chapterList: Ref<string[]> = ref([]);
const activeChapter: Ref<string> = ref("");
const chapterImages: Ref<string[]> = ref([]);

const fullURL: string = decodeURIComponent(window.location.hash);
// splitting the URL to get the manga name
const mangaName: string = fullURL.split("#/read/")[1].split("/")[0];

onMounted(async () => {
    chapterList.value = await Requests.getChapterList(mangaName);
    // activeChapter.value = chapterList.value[0] as string;
    activeChapter.value = decodeURIComponent(window.location.hash).split("/").at(-1) as string;
});

window.addEventListener("hashchange", () => {
    activeChapter.value = decodeURIComponent(window.location.hash).split("/").at(-1) as string;
});

watch(activeChapter, async (newValue: string) => {
    // get the images of the chapter
    chapterImages.value = await Requests.getChapterImages(mangaName, newValue);
    console.log(chapterImages.value);
});
</script>
<style scoped>
@import url("../assets/css/colors.css");
@import url("../assets/css/utility.css");

.main {
    overflow: hidden;
}
</style>
