<template>
    <div class="navigation__mobile flex">
        <div class="back-btn">↩</div>
        <div class="current-chapter">
            <select @change="loadChapter">
                <option
                    v-for="chapter in chapterList"
                    :key="chapter"
                    :value="chapter"
                    :selected="chapter == chapterName"
                >
                    {{ chapter }}
                </option>
            </select>
        </div>
        <div class="fwd-btn">↪</div>
    </div>
</template>
<script lang="ts" setup>
import { defineProps } from "vue";

const props = defineProps<{
    mangaName: string;
    chapterList: string[];
    chapterName: string;
}>();

// function showCahpterList() {
//     const chapterListSection = document.querySelector(".chapter-list") as HTMLElement;
//     chapterListSection.classList.toggle("hidden");
//     console.log(chapterListSection);
//     console.log("show chapter list");
// }

function loadChapter(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const chapterName = selectElement.value;
    window.location.href = `#/read/${props.mangaName}/${chapterName}`;
}
</script>
<style scoped>
@import url("~@/assets/css/colors.css");
@import url("~@/assets/css/utility.css");

.navigation__mobile {
    height: 100%;
    position: sticky;
    top: 0;
}

.navigation__mobile > * {
    flex: 1;
    display: grid;
    place-content: center;
    font-size: 2rem;
}

.current-chapter {
    font-size: 1.2rem;
    overflow: hidden;
    cursor: pointer;
}

.current-chapter:hover {
    background-color: var(--sidebar-active-clr);
}

.chapter-list {
    position: absolute;
    top: 0;
    background-color: var(--secondary-clr);
    backdrop-filter: blur(10px);
}
</style>
