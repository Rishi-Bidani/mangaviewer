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
                    <template v-for="image in chapterImages" :key="image">
                        <!-- takes up room, so the end of the chapter is still only reached by scrolling -->
                        <div
                            v-if="settledImages.get(image) === false"
                            class="mx-5 missing-page d-flex align-center justify-center text-medium-emphasis"
                        >
                            This page couldn't be loaded
                        </div>
                        <img
                            v-else
                            class="mx-5"
                            :src="image"
                            alt=""
                            @load="imageSettled(image, true)"
                            @error="imageSettled(image, false)"
                        />
                    </template>
                    <!-- only there once every image has its height, it's on screen until then -->
                    <div v-if="chapterLoaded" ref="chapterEnd" class="chapter-end" />
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

import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { reportChapterFinished } from "@/assets/extensions";
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

// whether each image loaded or failed to; a broken one shouldn't stop the chapter from ever
// finishing, but a chapter where none loaded wasn't read
const settledImages = ref(new Map<string, boolean>());
const chapterLoaded = computed(
    () =>
        chapterImages.value.length > 0 &&
        settledImages.value.size === chapterImages.value.length &&
        [...settledImages.value.values()].some(Boolean)
);

function imageSettled(image: string, loaded: boolean) {
    // one from the previous chapter can still finish loading after it's been replaced
    if (chapterImages.value.includes(image)) {
        settledImages.value.set(image, loaded);
    }
}
const chapterEnd = ref<HTMLElement | null>(null);
let chapterEndObserver: IntersectionObserver | undefined;

// scrolling to the end of a chapter counts as having read it, once per time it's opened
watch(chapterEnd, (element) => {
    chapterEndObserver?.disconnect();
    if (!element) {
        return;
    }
    const chapter = activeChapter.value;
    chapterEndObserver = new IntersectionObserver(async ([entry]) => {
        if (!entry.isIntersecting) {
            return;
        }
        chapterEndObserver?.disconnect();
        const result = await attempt(reportChapterFinished(mangaName, chapter));
        if ("error" in result) {
            console.error("Error reporting progress:", result.error);
        }
    });
    chapterEndObserver.observe(element);
});

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
    chapterEndObserver?.disconnect();
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
    settledImages.value = new Map();
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

.chapter-end {
    height: 1px;
    flex-shrink: 0;
}

.missing-page {
    min-height: 60vh;
    border: 1px dashed currentColor;
}
</style>
