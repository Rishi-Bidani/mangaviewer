<template>
    <div class="main">
        <Loading v-if="chapters.length == 0" />
        <div class="container">
            <section class="manga">
                <img :src="cover" alt="manga cover image" />
                <article class="manga__information">
                    <h1>
                        <a :href="mangaClashLink">{{ mangaName }}</a>
                    </h1>
                    <div class="genres">
                        <strong>genres</strong>
                        <ul>
                            <li v-for="genre in genres" :key="genre">{{ genre }}</li>
                        </ul>
                    </div>
                    <div class="score">
                        <strong>score</strong>
                        <span>{{ score }}</span>
                    </div>
                    <p>{{ summary }}</p>

                    <!-- <button class="download">Download {{ chapters.length }} chapters</button> -->
                    <Button :text="`Download ${chapters.length} chapters`" @click="downloadManga" />
                </article>
            </section>
        </div>
        <section class="chapters">
            <div
                class="chapter"
                v-for="chapter in chapters"
                :key="'' + chapter.name + ' ' + chapter.link.toString()"
            >
                <div class="chapter__title">{{ chapter.name }}</div>
                <Button
                    :text="'Download'"
                    :data-name="chapter.name"
                    :data-link="chapter.link"
                    @click="downloadChapter"
                />
            </div>
        </section>
    </div>
</template>
<script lang="ts" setup>
import { ref, Ref, onMounted } from "vue";

import Requests from "@/assets/js/requests";
import { IChapterDetails } from "@/assets/js/requeststypes";

// components
import Button from "@/components/Button.vue";
import Loading from "@/components/Loading.vue";

// function openMangaClashLink(event: Event) {
//     const link = (event.target as HTMLElement).dataset.link;
//     if (link) {
//         window.open(link, "_blank");
//     }
// }

function downloadChapter(event: Event) {
    const link: string = (event.target as HTMLElement).dataset.link as string;
    const name: string = (event.target as HTMLElement).dataset.name as string;
    if (link) {
        Requests.download().downloadChapter(link, name);
    }
}

const link: URL = new URL(document.location.href);

const mangaName = decodeURIComponent(link.pathname.split("/").at(-1) as string);
const mangaClashLink: string = decodeURIComponent(link.searchParams.get("link") as string);

// refs
const summary: Ref<string> = ref("summary");
const score: Ref<number> = ref(-1);
const genres: Ref<string[]> = ref([]);
const chapters: Ref<IChapterDetails[]> = ref([]);
const cover: Ref<string> = ref("");

function downloadManga() {
    Requests.download().downloadManga(mangaName, new URL(mangaClashLink));
}

onMounted(async () => {
    const details = await Requests.MangaClash().mangaDetails(mangaName, new URL(mangaClashLink));
    summary.value = details.summary;
    score.value = details.score;
    genres.value = details.genres;
    chapters.value = details.chapters.filter(
        (chapter) => chapter.link != null && chapter.name != ""
    );
    cover.value = details.image;
});
</script>
<style scoped>
.chapters {
    display: flex;
    flex-flow: column-reverse;
    gap: 1rem;
    padding-inline: 5rem;
}

.chapter {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    align-items: center;
}

.chapter:nth-child(odd) {
    background-color: var(--secondary-clr);
}
</style>

<style scoped>
@import url("~@/assets/css/colors.css");

.main {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background-color: var(--background-color);
}

.container {
    min-height: 100vh;
    display: flex;
    box-sizing: border-box;
}

section.manga {
    box-sizing: border-box;
    display: flex;
    padding-inline: 5rem;
    gap: 2rem;
    align-self: center;
}

section.manga img {
    height: 70%;
    width: 25rem;
    object-fit: contain;
    border: 2px solid var(--sidebar-active-clr);
}

.manga__information {
    display: flex;
    flex-flow: column;
    gap: 1rem;
}

.manga__information h1 a {
    color: purple;
}

.genres {
    display: flex;
}

strong {
    text-transform: capitalize;
    margin-inline-end: 1rem;
    align-self: center;
}

.genres ul {
    display: flex;
    flex-flow: row wrap;
    gap: 1rem;
}

.genres ul li {
    text-transform: capitalize;
    list-style: none;
    border-radius: 0.5rem;
}

.manga__information h1 {
    font-size: 2rem;
}

.manga__information p {
    line-height: 1.8em;
}

@media screen and (max-width: 768px) {
    section.manga {
        flex-flow: column;
        align-items: center;
        padding-inline: 1rem;
        gap: 1rem;
    }

    section.manga img {
        height: 20rem;
        width: fit-content;
        margin-top: 2rem;
    }
}
</style>
