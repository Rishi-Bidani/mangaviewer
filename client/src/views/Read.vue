<template>
    <v-app>
        <SideBottomBar :chapter-list="chapterList" @settings-click="showSettings" />
        <v-main>
            <div ref="mainContainer" class="d-flex image-container">
                <div class="image-container d-flex flex-column" ref="imageContainer">
                    <img
                        v-for="i in 100"
                        class="mx-5 my-2"
                        src="https://loremflickr.com/640/360"
                        :key="i"
                        alt=""
                    />
                </div>
            </div>
        </v-main>
        <Settings
            ref="settingsModal"
            @updateImageWidth="changeImageWidth"
            @updateImageBrightness="changeImageBrightness"
            @updateAlignment="changeImageAlignment"
        />
    </v-app>
</template>
<script setup lang="ts">
import SideBottomBar from "@components/navigation/SideBottomBar.vue";
import Settings from "@components/modals/Settings.vue";

import { ref } from "vue";

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

const chapterList = [
    "Chapter 1",
    "Chapter 2",
    "Chapter 3",
    "Chapter 4",
    "Chapter 5",
    "Chapter 6",
    "Chapter 7",
    "Chapter 8",
    "Chapter 9",
    "Chapter 10",
    "Chapter 11",
    "Chapter 12",
    "Chapter 13",
    "Chapter 14",
    "Chapter 15",
    "Chapter 16",
    "Chapter 17",
    "Chapter 18",
    "Chapter 19",
    "Chapter 20",
    "Chapter 21",
    "Chapter 22",
    "Chapter 23",
    "Chapter 24",
    "Chapter 25",
    "Chapter 26",
    "Chapter 27",
    "Chapter 28",
    "Chapter 29",
    "Chapter 30",
    "Chapter 31",
    "Chapter 32",
    "Chapter 33",
    "Chapter 34",
    "Chapter 35",
    "Chapter 36",
    "Chapter 37",
    "Chapter 38",
    "Chapter 39",
    "Chapter 40",
    "Chapter 41",
    "Chapter 42",
    "Chapter 43",
    "Chapter 44",
    "Chapter 45",
    "Chapter 46",
    "Chapter 47",
    "Chapter 48",
    "Chapter 49",
    "Chapter 50",
];
</script>

<style scoped>
.image-container {
    width: 100%;
}
</style>
