<template>
    <div>
        <v-app>
            <v-app-bar class="d-flex flex-wrap">
                <v-app-bar-title> Read Manga </v-app-bar-title>
                <SearchBar @search="filterCards" />
            </v-app-bar>
            <v-main>
                <v-container class="d-flex flex-column gr-1">
                    <ReadManga
                        v-for="mangaName in mangaNames"
                        :key="mangaName"
                        :mangaName="mangaName"
                        :mangaLink="`/read/${mangaName}`"
                    />
                </v-container>
            </v-main>
        </v-app>
    </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import SearchBar from "@components/SearchBar.vue";
import ReadManga from "@/components/ReadManga.vue";

const mangaNames = ref([]);
const allManagaNames = ref([]);

const getMangaNames = async () => {
    const response = await fetch("/mangas");
    const data = await response.json();
    mangaNames.value = data;
    allManagaNames.value = data;
};

onMounted(() => {
    getMangaNames();
});

function filterCards(search: string) {
    // if it is empty then show all cards
    if (search === "") {
        return (mangaNames.value = allManagaNames.value);
    }
    mangaNames.value = allManagaNames.value;
    mangaNames.value = mangaNames.value.filter((mangaName: string) => {
        return mangaName.toLowerCase().includes(search.toLowerCase());
    });
}
</script>
<style></style>
