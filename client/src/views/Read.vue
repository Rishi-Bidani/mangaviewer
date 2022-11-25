<template>
    <section class="main">
        <side-bar
            :mangaName="mangaName"
            :chapterList="chapterList"
            :activeChapter="activeChapter"
        />
    </section>
</template>
<script lang="ts" setup>
import SideBar from "@/components/read/SideBar.vue";

import Requests from "@/assets/js/requests";
import { ref, onMounted } from "vue";

// types
import { Ref } from "vue";

const chapterList: Ref<string[]> = ref([]);
const activeChapter: Ref<string> = ref("");

const mangaName: string = decodeURIComponent(window.location.hash.split("#/read/")[1]);
onMounted(async () => {
    chapterList.value = await Requests.getChapterList(mangaName);
    activeChapter.value = chapterList.value[0] as string;
});
</script>
<style scoped>
@import url("../assets/css/colors.css");
@import url("../assets/css/utility.css");

.main {
    overflow: hidden;
}
</style>
