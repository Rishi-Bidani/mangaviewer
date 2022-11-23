<template>
    <main>
        <!-- Search input -->
        <header class="flex flex-center">
            <div class="container flex-column gap-1 flex-center">
                <h1>What do you want to read?</h1>
                <input type="text" placeholder="One punch man" />
                <a href="#/download" class="button">download</a>
            </div>
        </header>

        <!-- Manga cards -->
        <section class="hero-container flex-column gap-1 flex-center">
            <manga-card v-for="manga in mangaNames" :key="manga" :name="manga" />
            <manga-card :name="'hello'" />
            <manga-card
                :name="'hello 2 lsnedgog rkgneprgvbn erkgnbverpg epernbgpewbrng pnregpewnrg wpkrnegpewrng pwkqkerngpre'"
            />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
            <manga-card :name="'hello 2'" />
        </section>
    </main>
</template>

<script lang="ts" setup>
import MangaCard from "@/components/MangaCard.vue";
import Requests from "@/assets/js/requests";
import { ref, onMounted } from "vue";

// on mounted

const mangaNames = ref();
onMounted(async () => {
    mangaNames.value = await Requests.getMangas();
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
@import url("../assets/css/colors.css");
@import url("../assets/css/utility.css");
main {
    width: 100%;
}

header {
    width: 100%;
    background-color: var(--primary-clr);
    position: sticky;
    top: 0;
    isolation: isolate;
    z-index: 1;
}

header .container {
    --only-bottom-value: 10px;
    --blur: var(--only-bottom-value);
    --spread: calc(var(--only-bottom-value) * -1);

    height: 100%;
    width: min(95%, 30rem);
    padding-block: 1rem;
    padding-inline: 1em;
    box-shadow: 0 10px var(--blur) var(--spread);
    clip-path: polygon(0% 0%, 100% 0%, 100% 120%, 0% 120%);
}

header .container h1 {
    font-size: clamp(1.5rem, 1.8vw + 0.5rem, 2.5rem);
}

input {
    box-sizing: border-box;
    padding: 0.5rem;
    outline: none;
    font-weight: bolder;
    font-size: 1.2rem;
    width: 100%;
}

.hero-container {
    margin-block: 1em 2em;
}

a.button {
    --border-size: 1.5rem;

    text-decoration: none;
    text-transform: uppercase;
    font-weight: bolder;
    color: var(--primary-text-clr);
    width: 100%;
    height: 3.5rem;
    display: grid;
    place-items: center;
    padding-block: 1rem;
    box-sizing: border-box;
    box-shadow: 0px 0px 2px var(--primary-text-clr);
    transition: 0.3s;
    position: relative;
}

a.button::after {
    content: "";
    position: absolute;
    inset: 0;
    box-shadow: 0px 1px 5px var(--primary-text-clr);
    opacity: 0;
}

a.button:hover::after {
    opacity: 1;
}

a.button:hover {
    font-size: larger;
}
</style>
