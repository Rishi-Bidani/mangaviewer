<template>
    <div>
        <v-app>
            <v-app-bar class="d-flex flex-wrap">
                <v-app-bar-title> Read Manga </v-app-bar-title>
                <SearchBar @search="filterCards" />
            </v-app-bar>
            <v-main>
                <v-container class="d-flex flex-column gr-1">
                    <v-alert
                        v-if="errorMessage"
                        type="error"
                        variant="tonal"
                        :text="errorMessage"
                    />
                    <ReadManga
                        v-for="mangaName in mangaNames"
                        :key="mangaName"
                        :mangaName="mangaName"
                        :mangaLink="`/#/read/${encodeURIComponent(mangaName)}`"
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
import { attempt, fetchJson } from "@/assets/utility";

const mangaNames = ref<string[]>([]);
const allManagaNames = ref<string[]>([]);
const errorMessage = ref("");

const getMangaNames = async () => {
    const result = await attempt(fetchJson<string[]>("/api/mangas"));
    if ("error" in result) {
        console.error("Error fetching manga list:", result.error);
        errorMessage.value = "Could not load the manga list.";
        return;
    }
    mangaNames.value = result.data;
    allManagaNames.value = result.data;
};

onMounted(() => {
    getMangaNames();
});

function filterCards(search: string) {
    // if it is empty then show all cards
    if (search === "") {
        return (mangaNames.value = allManagaNames.value);
    }
    mangaNames.value = allManagaNames.value.filter((mangaName) => {
        return mangaName.toLowerCase().includes(search.toLowerCase());
    });
}
</script>
<style></style>
