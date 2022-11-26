<template>
    <article class="manga-card">
        <span class="manga-name">
            {{ name }}
        </span>
        <div class="buttons">
            <button class="btn read" @click="read">read</button>
        </div>
    </article>
</template>
<script lang="ts" setup>
import { ref, defineProps, defineEmits } from "vue";

import Requests from "@/assets/js/requests";

const props = defineProps<{
    name: string;
}>();

const emits = defineEmits(["data:mangaName"]);

async function read() {
    const mangaName = props.name;
    const firstChapter: string = (await Requests.getChapterList(mangaName))[0];
    // window.location.href = "#/read/" + props.name;
    window.location.href = `#/read/${mangaName}/${firstChapter}`;
}

const name = ref(props.name);
</script>
<style scoped>
@import url("../assets/css/colors.css");

.manga-card {
    box-sizing: border-box;
    text-transform: capitalize;
    width: min(95%, 30rem);
    background-color: var(--secondary-clr);
    padding-block: 1rem;
    padding-inline: 0.5rem;
    font-size: large;
    display: grid;
    grid-template-columns: 1fr min(5rem, 30%);
    text-overflow: ellipsis;
}

/* .manga-card:hover {
} */

.btn {
    border: none;
    outline: none;
    padding: 0.75em 1.5em;
    border-radius: 0.5em;
    cursor: pointer;
    text-transform: capitalize;
    box-sizing: border-box;
}
.btn:hover {
    scale: 1.05;
}
.read {
    background-color: hsl(120, 80%, 40%);
    color: var(--primary-text-clr);
}
</style>
