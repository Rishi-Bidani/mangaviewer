<template>
    <v-app>
        <v-app-bar>
            <template v-slot:prepend>
                <v-btn icon="mdi-arrow-left" to="/" aria-label="Back to library" />
            </template>
            <v-app-bar-title class="font-weight-bold">Settings</v-app-bar-title>
        </v-app-bar>
        <v-main>
            <v-container class="settings-container">
                <div class="d-flex align-start flex-wrap ga-2 mb-4">
                    <div class="flex-grow-1 header-text">
                        <h2 class="text-h6">Titles</h2>
                        <p class="text-body-2 text-medium-emphasis">
                            Choose which titles show their cover on the home page (saved on the
                            server, so it applies on every device), or look a title up on AniList
                            again.
                        </p>
                    </div>
                    <v-btn
                        variant="tonal"
                        prepend-icon="mdi-refresh"
                        :disabled="!loaded"
                        @click="refetch()"
                    >
                        Refetch all
                    </v-btn>
                </div>

                <v-alert
                    v-if="errorMessage"
                    type="error"
                    variant="tonal"
                    class="mb-4"
                    :text="errorMessage"
                />
                <template v-else>
                    <v-text-field
                        v-model="search"
                        label="Filter titles"
                        prepend-inner-icon="mdi-magnify"
                        variant="solo-filled"
                        density="comfortable"
                        hide-details
                        clearable
                        class="mb-3"
                    />

                    <div
                        v-if="loaded && visibleMangas.length === 0"
                        class="text-center text-medium-emphasis py-8"
                    >
                        {{ search ? "No titles match your filter." : "No manga found." }}
                    </div>
                    <v-card v-else-if="loaded" rounded="lg">
                        <v-list>
                            <v-list-item v-for="mangaName in visibleMangas" :key="mangaName">
                                <template v-slot:prepend>
                                    <div class="cover-thumb bg-surface-variant mr-4">
                                        <v-img
                                            v-if="showsCover(mangaName)"
                                            :src="coverUrl(mangaName)"
                                            cover
                                            class="fill-height"
                                        />
                                        <div
                                            v-else
                                            class="d-flex align-center justify-center fill-height"
                                        >
                                            <v-icon
                                                icon="mdi-book-outline"
                                                class="text-medium-emphasis"
                                            />
                                        </div>
                                    </div>
                                </template>
                                <v-list-item-title>{{ titleOf(mangaName) }}</v-list-item-title>
                                <v-list-item-subtitle v-if="subtitleOf(mangaName)">
                                    {{ subtitleOf(mangaName) }}
                                </v-list-item-subtitle>
                                <template v-slot:append>
                                    <v-btn
                                        icon="mdi-link-variant"
                                        :variant="needsAniListId(mangaName) ? 'tonal' : 'text'"
                                        :color="needsAniListId(mangaName) ? 'primary' : undefined"
                                        size="small"
                                        class="mr-1"
                                        :aria-label="`Set AniList entry for ${titleOf(mangaName)}`"
                                        v-tooltip:top="'Set AniList entry'"
                                        @click="showAniListIdDialog(mangaName)"
                                    />
                                    <v-btn
                                        icon="mdi-refresh"
                                        variant="text"
                                        size="small"
                                        class="mr-2"
                                        :loading="metadata[mangaName]?.lookup === 'pending'"
                                        :aria-label="`Refetch metadata for ${titleOf(mangaName)}`"
                                        v-tooltip:top="'Refetch metadata'"
                                        @click="refetch(mangaName)"
                                    />
                                    <v-switch
                                        :model-value="showsCover(mangaName)"
                                        :aria-label="`Show cover for ${titleOf(mangaName)}`"
                                        color="primary"
                                        density="compact"
                                        inset
                                        hide-details
                                        @update:model-value="
                                            (value: boolean | null) =>
                                                setShowCover(mangaName, !!value)
                                        "
                                    />
                                </template>
                            </v-list-item>
                        </v-list>
                    </v-card>
                </template>
            </v-container>
        </v-main>
        <AniListIdDialog ref="aniListIdDialog" @saved="onAniListIdSaved" />
        <v-snackbar v-model="showNotice" :color="notice.color">{{ notice.text }}</v-snackbar>
    </v-app>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { attempt, fetchJson } from "@/assets/utility";
import {
    coverUrl as mangaCoverUrl,
    refreshMetadata,
    type IMangaMetadata,
    type LookupState,
} from "@/assets/metadata";
import {
    fetchPreferences,
    saveMangaPreferences,
    type IMangaPreferences,
    type IPreferences,
} from "@/assets/preferences";
import AniListIdDialog from "@components/modals/AniListIdDialog.vue";

// lookups run on the server one at a time, so check back while some are still pending
const METADATA_POLL_MS = 3000;

const LOOKUP_DESCRIPTIONS: Partial<Record<LookupState, string>> = {
    "not-found": "Not found on AniList, link it with 🔗",
    skipped: "Name too short to look up, link it with 🔗",
    pending: "Looking up…",
    error: "Lookup failed",
};

const route = useRoute();
const mangaNames = ref<string[]>([]);
const metadata = ref<Record<string, IMangaMetadata>>({});
const preferences = ref<IPreferences>({});
const search = ref<string | null>("");
const loaded = ref(false);
const errorMessage = ref("");

const notice = ref({ text: "", color: "error" });
const showNotice = ref(false);

let metadataPoll: ReturnType<typeof setTimeout> | undefined;

function notify(text: string, color = "error") {
    notice.value = { text, color };
    showNotice.value = true;
}

function pollWhilePending() {
    clearTimeout(metadataPoll);
    if (Object.values(metadata.value).some((entry) => entry.lookup === "pending")) {
        metadataPoll = setTimeout(loadMetadata, METADATA_POLL_MS);
    }
}

async function loadMetadata() {
    const result = await attempt(fetchJson<Record<string, IMangaMetadata>>("/api/metadata"));
    // only used for the nicer titles and lookup states, the folder names work too
    if ("error" in result) {
        console.error("Error fetching metadata:", result.error);
        return;
    }
    metadata.value = result.data;
    pollWhilePending();
    promptForMissingIds();
}

onMounted(async () => {
    const [names, fetchedPreferences] = await Promise.all([
        attempt(fetchJson<string[]>("/api/mangas")),
        attempt(fetchPreferences()),
        loadMetadata(),
    ]);
    if ("error" in names || "error" in fetchedPreferences) {
        console.error("Error loading settings:", names.error ?? fetchedPreferences.error);
        errorMessage.value = "Could not load the settings.";
        return;
    }
    mangaNames.value = names.data;
    preferences.value = fetchedPreferences.data;
    loaded.value = true;

    // opened from a manga's info page to link it to the right AniList entry
    const link = route.query.link;
    if (typeof link === "string" && mangaNames.value.includes(link)) {
        showAniListIdDialog(link);
    }
});

onUnmounted(() => {
    clearTimeout(metadataPoll);
});

function titleOf(mangaName: string): string {
    return metadata.value[mangaName]?.title ?? mangaName;
}

// the folder name when a different title was found, and how the lookup went if it didn't work
function subtitleOf(mangaName: string): string {
    const lookup = metadata.value[mangaName]?.lookup;
    return [
        titleOf(mangaName) !== mangaName ? mangaName : undefined,
        lookup && LOOKUP_DESCRIPTIONS[lookup],
    ]
        .filter(Boolean)
        .join(" · ");
}

function showsCover(mangaName: string): boolean {
    return preferences.value[mangaName]?.showCover ?? true;
}

// same url as on the home page, so the browser can reuse the cached image
function coverUrl(mangaName: string): string {
    return mangaCoverUrl(mangaName, metadata.value[mangaName]);
}

/**
 * @param mangaName refetch just this one, otherwise every manga
 */
async function refetch(mangaName?: string) {
    const result = await attempt(refreshMetadata(mangaName));
    if ("error" in result) {
        console.error("Error refetching metadata:", result.error);
        notify(
            `Couldn't start the lookup for ${mangaName ? `"${titleOf(mangaName)}"` : "all titles"}.`
        );
        return;
    }
    metadata.value = { ...metadata.value, ...result.data };
    pollWhilePending();

    const lookups = Object.values(result.data).map((entry) => entry.lookup);
    if (lookups.includes("disabled")) {
        notify("Metadata lookups are turned off on the server (FETCH_METADATA).", "warning");
    } else if (mangaName && lookups[0] === "skipped") {
        // too short to search for, so ask for the entry straight away
        showAniListIdDialog(mangaName);
    } else if (mangaName) {
        promptIfNotFound.add(mangaName);
        promptForMissingIds();
    }
}

// titles refetched one at a time, whose AniList id is asked for if the lookup finds nothing
const promptIfNotFound = new Set<string>();

function promptForMissingIds() {
    for (const mangaName of promptIfNotFound) {
        const lookup = metadata.value[mangaName]?.lookup;
        if (lookup === "pending") {
            continue;
        }
        promptIfNotFound.delete(mangaName);
        if (lookup === "not-found") {
            showAniListIdDialog(mangaName);
            return;
        }
    }
}

const aniListIdDialog = ref<InstanceType<typeof AniListIdDialog>>();

function needsAniListId(mangaName: string): boolean {
    const lookup = metadata.value[mangaName]?.lookup;
    return lookup === "not-found" || lookup === "skipped";
}

function showAniListIdDialog(mangaName: string) {
    const entry = metadata.value[mangaName];
    aniListIdDialog.value?.show({
        mangaName,
        title: titleOf(mangaName),
        currentId: preferences.value[mangaName]?.anilistId,
        matchedUrl: entry?.lookup === "found" ? entry.url : undefined,
        fromFile: entry?.anilistIdFromFile ?? false,
    });
}

// the new id is looked up right away, and asked for again if AniList has nothing for it
function onAniListIdSaved(mangaName: string, saved: IMangaPreferences) {
    preferences.value = { ...preferences.value, [mangaName]: saved };
    refetch(mangaName);
}

const visibleMangas = computed(() => {
    const query = (search.value ?? "").toLowerCase();
    if (query === "") {
        return mangaNames.value;
    }
    return mangaNames.value.filter((mangaName) =>
        [mangaName, titleOf(mangaName)].some((name) => name.toLowerCase().includes(query))
    );
});

// updates right away and undoes the change if the server couldn't save it
async function setShowCover(mangaName: string, showCover: boolean) {
    const previous = preferences.value[mangaName];
    preferences.value = { ...preferences.value, [mangaName]: { ...previous, showCover } };

    const result = await attempt(saveMangaPreferences(mangaName, { showCover }));
    if ("error" in result) {
        console.error("Error saving preferences:", result.error);
        preferences.value = { ...preferences.value, [mangaName]: { ...previous } };
        notify(`Couldn't save the change for "${titleOf(mangaName)}".`);
    }
}
</script>
<style scoped>
.settings-container {
    max-width: 800px;
}

.header-text {
    min-width: 240px;
}

.cover-thumb {
    width: 40px;
    height: 60px;
    border-radius: 4px;
    overflow: hidden;
}
</style>
