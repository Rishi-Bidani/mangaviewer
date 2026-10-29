<template>
    <div>
        <v-app>
            <v-app-bar class="d-flex flex-wrap">
                <template v-slot:prepend>
                    <v-icon icon="mdi-book-open-page-variant" color="primary" class="ml-2" />
                </template>
                <v-app-bar-title class="font-weight-bold"> Manga Viewer </v-app-bar-title>
                <SearchBar @search="(value: string) => (search = value)" />
                <template v-slot:append>
                    <v-btn icon="mdi-cog" to="/settings" aria-label="Settings" />
                </template>
            </v-app-bar>
            <v-main>
                <v-container>
                    <v-alert
                        v-if="errorMessage"
                        type="error"
                        variant="tonal"
                        class="mb-4"
                        :text="errorMessage"
                    />
                    <div
                        v-else-if="loaded && visibleMangas.length === 0"
                        class="text-center text-medium-emphasis py-12"
                    >
                        <v-icon icon="mdi-bookshelf" size="48" class="mb-2" />
                        <div>
                            {{ search ? "No manga matches your search." : "No manga found." }}
                        </div>
                    </div>
                    <v-row dense>
                        <v-col
                            v-for="mangaName in visibleMangas"
                            :key="mangaName"
                            cols="6"
                            sm="4"
                            md="3"
                            lg="2"
                        >
                            <ReadManga
                                :mangaName="mangaName"
                                :mangaLink="`/#/read/${encodeURIComponent(mangaName)}`"
                                :metadata="metadata[mangaName]"
                                :showCover="preferences[mangaName]?.showCover ?? true"
                            />
                        </v-col>
                    </v-row>
                </v-container>
            </v-main>
        </v-app>
    </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import SearchBar from "@components/SearchBar.vue";
import ReadManga from "@/components/ReadManga.vue";
import { attempt, fetchJson } from "@/assets/utility";
import type { IMangaMetadata } from "@/assets/metadata";
import { fetchPreferences, type IPreferences } from "@/assets/preferences";

// the server looks mangas up one at a time, so check back while some are still pending
const METADATA_POLL_MS = 5000;

const mangaNames = ref<string[]>([]);
const metadata = ref<Record<string, IMangaMetadata>>({});
const preferences = ref<IPreferences>({});
const search = ref("");
const loaded = ref(false);
const errorMessage = ref("");

let metadataPoll: ReturnType<typeof setTimeout> | undefined;

const getMangaNames = async () => {
    const result = await attempt(fetchJson<string[]>("/api/mangas"));
    if ("error" in result) {
        console.error("Error fetching manga list:", result.error);
        errorMessage.value = "Could not load the manga list.";
        return;
    }
    mangaNames.value = result.data;
};

const getMetadata = async () => {
    const result = await attempt(fetchJson<Record<string, IMangaMetadata>>("/api/metadata"));
    // the cards still work without metadata, they just show the folder name and first page
    if ("error" in result) {
        console.error("Error fetching metadata:", result.error);
        return;
    }
    metadata.value = result.data;
    if (Object.values(result.data).some((entry) => entry.lookup === "pending")) {
        metadataPoll = setTimeout(getMetadata, METADATA_POLL_MS);
    }
};

const getPreferences = async () => {
    const result = await attempt(fetchPreferences());
    // without them every cover is shown, which is the default anyway
    if ("error" in result) {
        console.error("Error fetching preferences:", result.error);
        return;
    }
    preferences.value = result.data;
};

onMounted(async () => {
    // wait for both so the covers don't load once without metadata and then again with it
    await Promise.all([getMangaNames(), getMetadata(), getPreferences()]);
    loaded.value = true;
});

onUnmounted(() => {
    clearTimeout(metadataPoll);
});

// matches the folder name and any title found for it
const visibleMangas = computed(() => {
    if (!loaded.value) {
        return [];
    }
    const query = search.value.toLowerCase();
    if (query === "") {
        return mangaNames.value;
    }
    return mangaNames.value.filter((mangaName) => {
        const entry = metadata.value[mangaName];
        const names = [mangaName, entry?.title, ...(entry?.alternativeTitles ?? [])];
        return names.some((name) => name?.toLowerCase().includes(query));
    });
});
</script>
