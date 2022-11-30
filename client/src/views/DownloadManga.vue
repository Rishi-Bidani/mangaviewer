<template>
    <div>
        <header>{{ mangaName }}</header>
    </div>
</template>
<script lang="ts" setup>
import { ref, Ref, onMounted } from "vue";

import Requests from "@/assets/js/requests";
import { IChapterDetails } from "@/assets/js/requeststypes";

const link: URL = new URL(document.location.href);

const mangaName = decodeURIComponent(link.pathname.split("/").at(-1) as string);
const mangaClashLink: string = decodeURIComponent(link.searchParams.get("link") as string);

// refs
const summary: Ref<string> = ref("summary");
const score: Ref<number> = ref(-1);
const genres: Ref<string[]> = ref([]);
const chapters: Ref<IChapterDetails[]> = ref([]);
const cover: Ref<string> = ref("");

onMounted(async () => {
    const details = await Requests.MangaClash().mangaDetails(mangaName, new URL(mangaClashLink));
    summary.value = details.summary;
    score.value = details.score;
    genres.value = details.genres;
    chapters.value = details.chapters;
    cover.value = details.image;
});
</script>
<style></style>
