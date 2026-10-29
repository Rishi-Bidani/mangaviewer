<template>
    <v-app>
        <v-app-bar>
            <template v-slot:prepend>
                <v-btn icon="mdi-arrow-left" :to="{ name: 'home' }" aria-label="Back to library" />
            </template>
            <v-app-bar-title class="font-weight-bold">{{ title }}</v-app-bar-title>
        </v-app-bar>
        <v-main>
            <!-- the cover, blurred and faded, behind the top of the page -->
            <div
                v-if="loaded && showCover"
                class="backdrop"
                :style="{ backgroundImage: `url('${cover}')` }"
            />
            <v-container class="info-container position-relative">
                <v-alert v-if="errorMessage" type="error" variant="tonal" :text="errorMessage" />
                <v-progress-linear v-else-if="!loaded" indeterminate color="primary" />

                <v-row v-else>
                    <v-col cols="12" sm="4" md="3">
                        <v-card rounded="lg" class="cover-card mx-auto" elevation="8">
                            <v-img
                                v-if="showCover"
                                :src="cover"
                                :aspect-ratio="2 / 3"
                                cover
                                class="bg-surface-variant"
                            />
                            <v-responsive v-else :aspect-ratio="2 / 3" class="bg-surface-variant">
                                <div class="d-flex align-center justify-center fill-height">
                                    <v-icon
                                        icon="mdi-book-outline"
                                        size="64"
                                        class="text-medium-emphasis"
                                    />
                                </div>
                            </v-responsive>
                        </v-card>

                        <div class="d-flex flex-column ga-2 mt-4 cover-card mx-auto">
                            <v-btn
                                color="primary"
                                size="large"
                                prepend-icon="mdi-book-open-variant"
                                :to="readLink(bookmark)"
                                :disabled="chapters.length === 0"
                                block
                            >
                                {{ bookmark ? "Continue reading" : "Start reading" }}
                            </v-btn>
                            <div
                                v-if="bookmark"
                                class="text-caption text-center text-medium-emphasis text-truncate"
                            >
                                <v-icon icon="mdi-bookmark" size="x-small" /> {{ bookmark }}
                            </div>
                            <v-btn
                                v-if="bookmark && chapters.length > 0"
                                variant="tonal"
                                :to="readLink(chapters[0])"
                                block
                            >
                                From the beginning
                            </v-btn>
                        </div>
                    </v-col>

                    <v-col cols="12" sm="8" md="9">
                        <h1
                            class="text-h4 font-weight-bold"
                            :class="{ 'text-capitalize': !metadata?.title }"
                        >
                            {{ title }}
                        </h1>
                        <div v-if="otherTitles" class="text-body-2 text-medium-emphasis mt-1">
                            {{ otherTitles }}
                        </div>
                        <div v-if="metadata?.authors?.length" class="text-subtitle-1 mt-2">
                            by {{ metadata.authors.join(", ") }}
                        </div>

                        <div v-if="facts.length > 0" class="d-flex flex-wrap ga-2 mt-4">
                            <v-chip
                                v-for="fact in facts"
                                :key="fact.text"
                                :prepend-icon="fact.icon"
                                :color="fact.color"
                                variant="tonal"
                                size="small"
                            >
                                {{ fact.text }}
                            </v-chip>
                        </div>

                        <div v-if="metadata?.genres?.length" class="d-flex flex-wrap ga-2 mt-3">
                            <v-chip
                                v-for="genre in metadata.genres"
                                :key="genre"
                                color="primary"
                                variant="outlined"
                                size="small"
                            >
                                {{ genre }}
                            </v-chip>
                        </div>

                        <v-alert
                            v-if="lookupNotice"
                            :type="metadata?.lookup === 'pending' ? 'info' : 'warning'"
                            variant="tonal"
                            density="compact"
                            class="mt-6"
                        >
                            {{ lookupNotice }}
                            <template v-if="canLink" v-slot:append>
                                <v-btn
                                    variant="text"
                                    size="small"
                                    prepend-icon="mdi-link-variant"
                                    :to="{ name: 'settings', query: { link: mangaName } }"
                                >
                                    Link it
                                </v-btn>
                            </template>
                        </v-alert>

                        <section v-if="metadata?.description" class="mt-6">
                            <h2 class="text-overline text-medium-emphasis">Description</h2>
                            <p class="description text-body-1">{{ metadata.description }}</p>
                        </section>

                        <section v-if="metadata?.tags?.length" class="mt-6">
                            <h2 class="text-overline text-medium-emphasis">Tags</h2>
                            <div class="d-flex flex-wrap ga-2">
                                <v-chip
                                    v-for="tag in metadata.tags"
                                    :key="tag"
                                    variant="tonal"
                                    size="small"
                                >
                                    {{ tag }}
                                </v-chip>
                            </div>
                        </section>

                        <div
                            v-if="metadata?.url || metadata?.malUrl"
                            class="d-flex flex-wrap ga-2 mt-6"
                        >
                            <v-btn
                                v-if="metadata.url"
                                :href="metadata.url"
                                target="_blank"
                                rel="noopener"
                                variant="tonal"
                                size="small"
                                append-icon="mdi-open-in-new"
                            >
                                AniList
                            </v-btn>
                            <v-btn
                                v-if="metadata.malUrl"
                                :href="metadata.malUrl"
                                target="_blank"
                                rel="noopener"
                                variant="tonal"
                                size="small"
                                append-icon="mdi-open-in-new"
                            >
                                MyAnimeList
                            </v-btn>
                        </div>

                        <section class="mt-8">
                            <h2 class="text-overline text-medium-emphasis">
                                Chapters ({{ chapters.length }} in your library)
                            </h2>
                            <div v-if="chapters.length === 0" class="text-medium-emphasis">
                                No chapters found in this folder.
                            </div>
                            <v-card v-else rounded="lg" class="chapter-list overflow-auto">
                                <v-list density="compact">
                                    <v-list-item
                                        v-for="chapter in chapters"
                                        :key="chapter"
                                        :to="readLink(chapter)"
                                        :title="chapter"
                                        :active="chapter === bookmark"
                                        color="primary"
                                    >
                                        <template v-if="chapter === bookmark" v-slot:append>
                                            <v-icon icon="mdi-bookmark" size="small" />
                                        </template>
                                    </v-list-item>
                                </v-list>
                            </v-card>
                        </section>
                    </v-col>
                </v-row>
            </v-container>
        </v-main>
    </v-app>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, type RouteLocationRaw } from "vue-router";
import { storage, bookmarkKey } from "@/assets/storage";
import { attempt, fetchJson } from "@/assets/utility";
import { coverUrl, type IMangaMetadata, type LookupState } from "@/assets/metadata";
import { fetchPreferences } from "@/assets/preferences";

// the server looks mangas up one at a time, so check back while this one is pending
const METADATA_POLL_MS = 3000;

const LOOKUP_NOTICES: Partial<Record<LookupState, string>> = {
    pending: "Looking up details on AniList…",
    "not-found": "AniList didn't find this title, so there are no details for it.",
    skipped: "The folder name is too short to look up on AniList.",
    error: "Looking up details failed, it will be tried again later.",
    disabled: "Details aren't looked up, because metadata lookups are turned off on the server.",
};

// router params are already decoded, so encode them again when building api urls
const mangaName = useRoute().params.mangaName as string;
const mangaPath = `/api/mangas/${encodeURIComponent(mangaName)}`;

const metadata = ref<IMangaMetadata>();
const chapters = ref<string[]>([]);
const showCover = ref(true);
const bookmark = ref("");
const loaded = ref(false);
const errorMessage = ref("");

let metadataPoll: ReturnType<typeof setTimeout> | undefined;

async function loadMetadata() {
    const result = await attempt(fetchJson<IMangaMetadata>(`${mangaPath}/metadata`));
    // the page still works without it, with the folder name and chapters
    if ("error" in result) {
        console.error("Error fetching metadata:", result.error);
        return;
    }
    metadata.value = result.data;
    if (result.data.lookup === "pending") {
        metadataPoll = setTimeout(loadMetadata, METADATA_POLL_MS);
    }
}

onMounted(async () => {
    const [chapterList, preferences] = await Promise.all([
        attempt(fetchJson<string[]>(`${mangaPath}/chapters`)),
        attempt(fetchPreferences()),
        loadMetadata(),
    ]);
    if ("error" in chapterList) {
        console.error("Error fetching chapter list:", chapterList.error);
        errorMessage.value = `Could not load "${mangaName}".`;
        return;
    }
    chapters.value = chapterList.data;
    if (!("error" in preferences)) {
        showCover.value = preferences.data[mangaName]?.showCover ?? true;
    }
    // only a bookmark that still exists, chapters can be renamed or removed
    const bookmarked = storage.get(bookmarkKey(mangaName), "");
    bookmark.value = chapters.value.includes(bookmarked) ? bookmarked : "";
    loaded.value = true;
});

onUnmounted(() => {
    clearTimeout(metadataPoll);
});

const title = computed(() => metadata.value?.title ?? mangaName);
const cover = computed(() => coverUrl(mangaName, metadata.value));

const otherTitles = computed(() =>
    [
        metadata.value?.title && metadata.value.title !== mangaName ? mangaName : undefined,
        ...(metadata.value?.alternativeTitles ?? []).slice(0, 3),
    ]
        .filter(Boolean)
        .join(" · ")
);

const facts = computed(() => {
    const info = metadata.value;
    if (!info) {
        return [];
    }
    // a series still running has no end year yet
    const years =
        info.year &&
        (info.endYear && info.endYear !== info.year
            ? `${info.year}–${info.endYear}`
            : info.status === "Releasing"
              ? `${info.year}–`
              : `${info.year}`);
    const length = [
        info.chapters && `${info.chapters} chapters`,
        info.volumes && `${info.volumes} volumes`,
    ]
        .filter(Boolean)
        .join(", ");
    return [
        { text: info.format, icon: "mdi-book-outline" },
        { text: info.status, icon: "mdi-progress-clock" },
        { text: years, icon: "mdi-calendar" },
        { text: length, icon: "mdi-book-multiple-outline" },
        { text: info.score && `${info.score}%`, icon: "mdi-star", color: "primary" },
        {
            text: info.popularity && `${info.popularity.toLocaleString()} readers`,
            icon: "mdi-account-group-outline",
        },
        { text: info.isAdult ? "18+" : undefined, icon: "mdi-alert-outline", color: "error" },
    ].filter((fact): fact is { text: string; icon: string; color?: string } => !!fact.text);
});

const lookupNotice = computed(() =>
    metadata.value ? LOOKUP_NOTICES[metadata.value.lookup] : undefined
);
const canLink = computed(
    () => metadata.value?.lookup === "not-found" || metadata.value?.lookup === "skipped"
);

/**
 * @param chapter the chapter to open, otherwise the reader picks (bookmark or first chapter)
 */
function readLink(chapter?: string): RouteLocationRaw {
    return { name: "read", params: { mangaName }, query: chapter ? { chapter } : {} };
}
</script>
<style scoped>
.info-container {
    max-width: 1100px;
}

.cover-card {
    max-width: 280px;
}

.backdrop {
    position: absolute;
    inset: 0 0 auto 0;
    height: 420px;
    background-size: cover;
    background-position: center 25%;
    filter: blur(40px) saturate(1.2);
    opacity: 0.3;
    /* fade into the page background */
    mask-image: linear-gradient(to bottom, black, transparent);
    pointer-events: none;
}

.description {
    white-space: pre-line;
    max-width: 75ch;
}

.chapter-list {
    max-height: 420px;
}
</style>
