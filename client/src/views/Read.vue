<template>
    <section class="main flex">
        <SideBar
            :mangaName="mangaName"
            :chapterList="chapterList"
            :activeChapter="activeChapter"
            @show-settings="showSettings"
        />
        <section class="container__images">
            <div
                class="images"
                :data-brighntess="imageBrightness"
                :style="{
                    '--image-width': imageWidth + '%',
                    '--image-brightness': imageBrightness,
                }"
            >
                <img
                    class="image"
                    v-for="image in chapterImages"
                    :key="image"
                    :src="image"
                    :alt="image"
                />
            </div>
        </section>
        <SettingsModal
            :imageWidth="imageWidth"
            :imageBrightness="imageBrightness"
            :change-brightness="changeBrightness"
            :change-width="changeWidth"
            ref="settingsModalRef"
        />
    </section>
</template>
<script lang="ts" setup>
import SideBar from "@/components/read/SideBar.vue";
import SettingsModal from "@/components/read/SettingsModal.vue";

import Requests from "@/assets/js/requests";
import { ref, onMounted, watch } from "vue";

// types
import { Ref } from "vue";

// Reactive data
const chapterList: Ref<string[]> = ref([]);
const activeChapter: Ref<string> = ref("");
const chapterImages: Ref<string[]> = ref([]);

// Settings
const imageWidth: Ref<number> = ref(80);
const imageBrightness: Ref<number> = ref(100);

// Constants and computed
const fullURL: string = decodeURIComponent(window.location.hash);
// splitting the URL to get the manga name
const mangaName: string = fullURL.split("#/read/")[1].split("/")[0];

// Refs
const settingsModalRef = ref<InstanceType<typeof SettingsModal>>();

onMounted(async () => {
    chapterList.value = await Requests.getChapterList(mangaName);
    // activeChapter.value = chapterList.value[0] as string;
    activeChapter.value = decodeURIComponent(window.location.hash).split("/").at(-1) as string;
});

window.addEventListener("hashchange", () => {
    const hash: string = decodeURIComponent(window.location.hash);
    activeChapter.value = hash.split("/").at(-1) as string;
    // activeChapter.value = decodeURIComponent(window.location.hash).split("/").at(-1) as string;
});

watch(activeChapter, async (newValue: string) => {
    // get the images of the chapter
    chapterImages.value = await Requests.getChapterImages(mangaName, newValue);
});

// function setImageStyleVariables() {
//     // return `--image-brightness: ${imageBrightness.value}; --image-width: ${imageWidth.value}%;`;
//     return {
//         "--image-brightness": `${imageBrightness.value}%`,
//         "--image-width": `${imageWidth.value}%`,
//     }
// }

function showSettings(): void {
    settingsModalRef.value?.showSettings();
}

function changeWidth(event: Event): void {
    const inputTag = event.target as HTMLInputElement;
    const newWidth = Number(inputTag.value);
    imageWidth.value = newWidth;
}

function changeBrightness(event: Event): void {
    const inputTag = event.target as HTMLInputElement;
    const newBrightness = Number(inputTag.value);
    imageBrightness.value = newBrightness;
}
</script>
<style scoped>
@import url("../assets/css/colors.css");
@import url("../assets/css/utility.css");

.main {
    display: flex;
    height: 100vh;
    overflow: hidden;
}

.container__images {
    flex: 1;
    overflow: auto;
}

.images {
    /* --image-width: attr(data-width); */
    padding-inline: 1rem;
    display: flex;
    flex-flow: column;
    filter: brightness(calc(var(--image-brightness) / 100));
}

.image {
    width: var(--image-width);
}

.settings {
    position: fixed;
    bottom: 10px;
    left: 50%;
    transform: translate(-50%, 0);
    width: 50%;
    background-color: var(--secondary-clr);
    padding-block: 1rem;
    padding-inline: 2rem;
    border: 2px solid var(--sidebar-active-clr);
    border-radius: 0.5rem;
}

.settings input[type="range"] {
    width: 100%;
    color: var(--primary-text-clr);
}

@media screen and (max-width: 500px) {
    .main {
        flex-flow: column;
    }

    .images {
        --image-width: 100% !important;
        align-items: center;
    }
}
</style>
