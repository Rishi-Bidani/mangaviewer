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
            <v-alert
                v-if="errorMessage"
                type="error"
                variant="tonal"
                class="ma-4"
                :text="errorMessage"
            />
            <div ref="mainContainer" class="d-flex image-container">
                <div class="image-container d-flex flex-column" ref="imageContainer">
                    <img
                        v-for="image in chapterImages"
                        class="mx-5"
                        :src="image"
                        :key="image"
                        alt=""
                    />
                </div>
            </div>
        </v-main>
        <SettingsModal
            ref="settingsModal"
            :mangaName="mangaName"
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
import SettingsModal from "@components/modals/SettingsModal.vue";

import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { storage, bookmarkKey } from "@/assets/storage";
import { attempt, fetchJson } from "@/assets/utility";

// router params are already decoded, so encode them again when building api urls
const route = useRoute();
const mangaName = route.params.mangaName as string;
const chapterList = ref<string[]>([]);
const activeChapter = ref("");

const chapterImages = ref<string[]>([]);
const errorMessage = ref("");

// in-flight chapter request, aborted when a newer chapter is requested
let chapterRequest: AbortController | null = null;

onMounted(async () => {
    // get chapter list from server
    const chapterListURL = `/api/mangas/${encodeURIComponent(mangaName)}/chapters`;

    const result = await attempt(fetchJson<string[]>(chapterListURL));
    if ("error" in result) {
        console.error("Error fetching chapter list:", result.error);
        errorMessage.value = `Could not load chapters for "${mangaName}".`;
        return;
    }
    if (result.data.length === 0) {
        errorMessage.value = `"${mangaName}" has no chapters.`;
        return;
    }
    chapterList.value = result.data;

    // start at the chapter in the url (from the info page), else the bookmark, else the first
    const requestedChapter = typeof route.query.chapter === "string" ? route.query.chapter : "";
    const startIndex = chapterNameToIndex(
        chapterList.value,
        requestedChapter || storage.get(bookmarkKey(mangaName), "")
    );
    const firstChapter = chapterList.value[startIndex];
    activeChapter.value = firstChapter;
    await changeChapter(firstChapter);
});

onUnmounted(() => {
    chapterRequest?.abort();
});

async function changeChapter(chapter: string) {
    chapterRequest?.abort();
    const controller = new AbortController();
    chapterRequest = controller;

    const chapterURL = `/api/mangas/${encodeURIComponent(mangaName)}/chapters/${encodeURIComponent(
        chapter
    )}/images`;
    const result = await attempt(fetchJson<string[]>(chapterURL, { signal: controller.signal }));
    // a newer chapter was requested while this one was loading
    if (controller.signal.aborted) {
        return;
    }
    if ("error" in result) {
        console.error("Error fetching chapter images:", result.error);
        errorMessage.value = `Could not load "${chapter}".`;
        return;
    }
    errorMessage.value = "";
    window.scrollTo(0, 0);
    chapterImages.value = result.data;
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
    const index = chapterList.value.indexOf(activeChapter.value);
    if (index <= 0) {
        return;
    }
    const previousChapter = chapterList.value[index - 1];
    await changeChapter(previousChapter);
}

async function nextChapter() {
    const index = chapterList.value.indexOf(activeChapter.value);
    if (index === chapterList.value.length - 1) {
        return;
    }
    const nextChapter = chapterList.value[index + 1];
    await changeChapter(nextChapter);
}

const imageContainer = ref<HTMLElement | null>(null);
const mainContainer = ref<HTMLElement | null>(null);
const settingsModal = ref<InstanceType<typeof SettingsModal>>();

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
</script>

<style scoped>
.image-container {
    width: 100%;
}
</style>
