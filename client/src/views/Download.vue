<template>
    <main>
        <header class="flex">
            <!-- <h1 class="text-center padding-block-1">Download</h1> -->
            <form action="#" class="margin-inline-auto flex" @submit.prevent="searchManga">
                <input type="text" class="input__download" name="mangaName" />
                <button type="submit">🔍</button>
            </form>
        </header>
        <section class="container__mangacards flex-column gap-1">
            <article v-for="manga in displayedMangas" :key="manga" class="manga flex gap-1">
                <img :src="manga.img" :alt="manga.name" />
                <div class="flex-column gap-1">
                    <h2 class="title">{{ manga.name }}</h2>
                    <a :href="manga.link" class="button__download">download</a>
                </div>
            </article>
        </section>
    </main>
</template>

<script lang="ts" setup>
import Requests from "@/assets/js/requests";
import { ref, onMounted } from "vue";

// import types
import { Ref } from "vue";

const displayedMangas: Ref<any> = ref();
onMounted(async () => {
    displayedMangas.value = await Requests.MangaClash().hotMangas();
});

async function searchManga(event: Event) {
    event.preventDefault();
    const mangaName: string = (event.target as HTMLFormElement).mangaName.value;
    const mangas = await Requests.MangaClash().searchManga(mangaName);
    console.log(mangas);

    displayedMangas.value = mangas;
}
</script>

<style scoped>
@import url("../assets/css/utility.css");
@import url("../assets/css/colors.css");

img {
    width: 5rem;
    object-fit: cover;
}

h2.title {
    font-size: 1rem;
    font-weight: normal;
    text-overflow: ellipsis;
    overflow: hidden;
}

.button__download {
    --border-size: 1.5rem;

    text-decoration: none;
    text-transform: uppercase;
    font-weight: bolder;
    color: var(--primary-text-clr);
    width: fit-content;
    display: grid;
    place-items: center;
    padding-inline: 1rem;
    padding-block: 0.5rem;
    box-sizing: border-box;
    box-shadow: 0px 0px 2px var(--primary-text-clr);
    transition: 0.3s;
    position: relative;
}

.button__download::after {
    content: "";
    position: absolute;
    inset: 0;
    box-shadow: 0px 1px 5px var(--primary-text-clr);
    opacity: 0;
}

.button__download:hover::after {
    opacity: 1;
}

.container__mangacards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    place-content: center;
    width: 70%;
    margin-inline: auto;
}

.manga {
    box-sizing: border-box;
    text-overflow: ellipsis;
}

main > header {
    padding-block: 1rem;
}

input.input__download {
    width: 100%;
    margin-inline: auto;
    padding-block: 0.2rem;
    padding-inline: 0.5rem;
}

form {
    width: 50%;
    gap: 1rem;
}

button[type="submit"] {
    border: none;
    /* outline: transparent; */
    background-color: greenyellow;
    padding: 0.5rem;
}
</style>
