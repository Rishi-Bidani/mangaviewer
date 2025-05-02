<template>
    <v-app>
        <SideBottomBar
            :chapter-list="chapterList"
            :active-chapter="activeChapter"
            @chapter-click="changeChapter"
            @settings-click="showSettings"
            @previous-chapter="previousChapter"
            @next-chapter="nextChapter"
        />
        <v-main>
            <div ref="mainContainer" class="d-flex image-container">
                <div class="image-container d-flex flex-column" ref="imageContainer">
                    <img
                        v-for="(image, index) in chapterImages"
                        class="mx-5"
                        :src="image"
                        :key="image"
                        alt=""
                        :loading="index > 10 ? 'lazy' : 'eager'"
                    />
                </div>
            </div>
        </v-main>
        <Settings
            ref="settingsModal"
            :activeChapter="activeChapter"
            @updateImageWidth="changeImageWidth"
            @updateImageBrightness="changeImageBrightness"
            @updateAlignment="changeImageAlignment"
            @updateImageSpacing="changeImageSpacing"
        />
    </v-app>
</template>
<script setup lang="ts">
import SideBottomBar from "@components/navigation/SideBottomBar.vue";
import Settings from "@components/modals/Settings.vue";

import { ref, onMounted } from "vue";
import { storage } from "@/assets/storage";

const mangaName = ref("");
const chapterList = ref([]);
const activeChapter = ref("");

const chapterImages = ref([]);

onMounted(async () => {
    // get manga name from url
    mangaName.value = window.location.href.split("/")[5];
    // get chapter list from server
    const chapterListURL = `/api/mangas/${mangaName.value}/chapters`;

    const response = await fetch(chapterListURL);
    const data = await response.json();
    chapterList.value = data;

    // set first chapter as default
    const bookmarkedChapter = chapterNameToIndex(
        chapterList.value,
        storage.get("bookmarkedChapter", "")
    );
    const firstChapter = chapterList.value[bookmarkedChapter];
    activeChapter.value = firstChapter;
    await changeChapter(firstChapter);
});

async function changeChapter(chapter: string) {
    const chapterURL = `/api/mangas/${mangaName.value}/chapters/${chapter}/images`;
    const response = await fetch(chapterURL);
    const data = await response.json();
    chapterImages.value = data;
    activeChapter.value = chapter;
}

function chapterNameToIndex(chapterList: string[], chapter: string) {
    if (!chapterList || !chapter) {
        return 0;
    }
    const index = chapterList.indexOf(chapter);
    return index > -1 ? index : 0;
}

async function previousChapter() {
    const index = chapterList.value.indexOf(activeChapter.value as never);
    if (index === 0) {
        return;
    }
    const previousChapter = chapterList.value[index - 1];
    await changeChapter(previousChapter);
}

async function nextChapter() {
    const index = chapterList.value.indexOf(activeChapter.value as never);
    if (index === chapterList.value.length - 1) {
        return;
    }
    const nextChapter = chapterList.value[index + 1];
    await changeChapter(nextChapter);
}

const imageContainer = ref<HTMLElement | null>(null);
const mainContainer = ref<HTMLElement | null>(null);
const settingsModal = ref<InstanceType<typeof Settings>>();

function showSettings() {
    settingsModal.value?.showModal();
}

// watch imageWidth and imageBrightness and alignment and update imageContainer

function changeImageWidth(width: number) {
    imageContainer.value!.style.width = `${width}%`;
}

function changeImageBrightness(brightness: number) {
    imageContainer.value!.style.filter = `brightness(${brightness}%)`;
}

function changeImageAlignment(alignment: string) {
    mainContainer.value!.style.justifyContent = alignment;
}

function changeImageSpacing(spacing: number) {
    imageContainer.value!.style.gap = `${spacing}px`;
}

// const chapterList = [
//     "Chapter 1",
//     "Chapter 2",
//     "Chapter 3",
//     "Chapter 4",
//     "Chapter 5",
//     "Chapter 6",
//     "Chapter 7",
//     "Chapter 8",
//     "Chapter 9",
//     "Chapter 10",
//     "Chapter 11",
//     "Chapter 12",
//     "Chapter 13",
//     "Chapter 14",
//     "Chapter 15",
//     "Chapter 16",
//     "Chapter 17",
//     "Chapter 18",
//     "Chapter 19",
//     "Chapter 20",
//     "Chapter 21",
//     "Chapter 22",
//     "Chapter 23",
//     "Chapter 24",
//     "Chapter 25",
//     "Chapter 26",
//     "Chapter 27",
//     "Chapter 28",
//     "Chapter 29",
//     "Chapter 30",
//     "Chapter 31",
//     "Chapter 32",
//     "Chapter 33",
//     "Chapter 34",
//     "Chapter 35",
//     "Chapter 36",
//     "Chapter 37",
//     "Chapter 38",
//     "Chapter 39",
//     "Chapter 40",
//     "Chapter 41",
//     "Chapter 42",
//     "Chapter 43",
//     "Chapter 44",
//     "Chapter 45",
//     "Chapter 46",
//     "Chapter 47",
//     "Chapter 48",
//     "Chapter 49",
//     "Chapter 50",
// ];
</script>

<style scoped>
.image-container {
    width: 100%;
}
</style>
