<template>
    <section class="main flex">
        <SideBar
            :mangaName="mangaName"
            :chapterList="chapterList"
            :activeChapter="activeChapter"
            @show-settings="showSettings"
        />
        <section class="container__images">
            <div class="images" :style="'--image-width: ' + imageWidth + '%'">
                <img
                    class="image"
                    v-for="image in chapterImages"
                    :key="image"
                    :src="image"
                    :alt="image"
                />
            </div>
        </section>
        <section class="settings hidden">
            <datalist id="imageWidthList">
                <option value="0" label="0"></option>
                <option value="25" label="25"></option>
                <option value="50" label="50"></option>
                <option value="75" label="75"></option>
                <option value="80" label="80"></option>
                <option value="100" label="100"></option>
            </datalist>
            <input type="range" :value="imageWidth" @change="changeWidth" list="imageWidthList" />
            <output id="outputWidth">{{ imageWidth }}%</output>
        </section>
    </section>
</template>
<script lang="ts" setup>
import SideBar from "@/components/read/SideBar.vue";

import Requests from "@/assets/js/requests";
import { ref, onMounted, watch } from "vue";

// types
import { Ref } from "vue";

// Reactive data
const chapterList: Ref<string[]> = ref([]);
const activeChapter: Ref<string> = ref("");
const chapterImages: Ref<string[]> = ref([]);
const imageWidth: Ref<number> = ref(80);

// Constants and computed
const fullURL: string = decodeURIComponent(window.location.hash);
// splitting the URL to get the manga name
const mangaName: string = fullURL.split("#/read/")[1].split("/")[0];

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

function showSettings(): void {
    const sectionSettings: HTMLElement = document.querySelector("section.settings") as HTMLElement;
    sectionSettings?.classList.toggle("hidden");
}

function changeWidth(event: Event): void {
    // const newWidth: number = Number((event.target as HTMLElement).value);
    const inputTag = event.target as HTMLInputElement;
    const newWidth = Number(inputTag.value);
    imageWidth.value = newWidth;
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
    padding-inline: 1rem;
    display: flex;
    flex-flow: column;
    /* filter: brightness(0.5); */
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
