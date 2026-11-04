<template>
    <v-dialog v-model="open" max-width="560" scrollable>
        <v-card rounded="lg">
            <v-card-title class="text-wrap pt-4">Set metadata match</v-card-title>
            <v-card-subtitle class="text-wrap">{{ target.title }}</v-card-subtitle>
            <v-card-text>
                <v-alert
                    v-if="sources.length === 0"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    text="There are no metadata sources to search."
                />
                <template v-else>
                    <v-select
                        v-if="sources.length > 1"
                        v-model="sourceId"
                        :items="sources"
                        item-title="name"
                        item-value="id"
                        label="Source"
                        variant="outlined"
                        density="comfortable"
                        @update:model-value="clearSearch"
                    />
                    <v-text-field
                        v-model="term"
                        :label="`Search ${sourceName}`"
                        variant="outlined"
                        density="comfortable"
                        autofocus
                        append-inner-icon="mdi-magnify"
                        :loading="searching"
                        :error-messages="searchError"
                        @click:append-inner="search"
                        @keyup.enter="search"
                    />

                    <v-list v-if="results && results.length > 0" density="compact" class="mb-4">
                        <v-list-item
                            v-for="result in results"
                            :key="result.id"
                            :title="result.title"
                            :subtitle="describe(result)"
                            :disabled="saving"
                            @click="submit({ source: sourceId, id: result.id })"
                        >
                            <template v-slot:prepend>
                                <div class="result-cover bg-surface-variant mr-3">
                                    <v-img
                                        v-if="result.coverUrl"
                                        :src="result.coverUrl"
                                        cover
                                        class="fill-height"
                                    />
                                </div>
                            </template>
                            <template v-if="result.url" v-slot:append>
                                <v-btn
                                    :href="result.url"
                                    target="_blank"
                                    rel="noopener"
                                    icon="mdi-open-in-new"
                                    variant="text"
                                    size="small"
                                    :aria-label="`Open ${result.title} on ${sourceName}`"
                                    @click.stop
                                />
                            </template>
                        </v-list-item>
                    </v-list>
                    <p v-else-if="results" class="text-body-2 text-medium-emphasis mb-4">
                        Nothing found on {{ sourceName }}.
                    </p>

                    <v-text-field
                        v-model="input"
                        :label="`Or paste a ${sourceName} link or ID`"
                        variant="outlined"
                        density="comfortable"
                        :error-messages="inputError"
                        hide-details="auto"
                        @update:model-value="inputError = ''"
                        @keyup.enter="save"
                    />
                </template>
                <v-btn
                    v-if="target.matchedUrl"
                    :href="target.matchedUrl"
                    target="_blank"
                    rel="noopener"
                    variant="text"
                    size="small"
                    prepend-icon="mdi-link-variant"
                    class="mt-2"
                >
                    Current match
                </v-btn>
                <v-alert
                    v-if="target.fromFile"
                    type="info"
                    variant="tonal"
                    density="compact"
                    class="mt-3"
                    text="This title's metadata.json sets a match, which is used instead of this one."
                />
            </v-card-text>
            <v-card-actions>
                <v-btn
                    v-if="target.current"
                    color="error"
                    variant="text"
                    :disabled="saving"
                    @click="submit(null)"
                >
                    Remove
                </v-btn>
                <v-spacer />
                <v-btn variant="text" @click="open = false">Cancel</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    :loading="saving"
                    :disabled="sources.length === 0"
                    @click="save"
                >
                    Save
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<script setup lang="ts">
import { ref, computed } from "vue";
import { attempt } from "@/assets/utility";
import {
    fetchMetadataSources,
    searchMetadataSource,
    type IMetadataSource,
    type ISearchResult,
} from "@/assets/extensions";
import {
    saveMangaPreferences,
    type IMangaPreferences,
    type IMetadataMatch,
} from "@/assets/preferences";

interface ITarget {
    mangaName: string;
    title: string;
    searchTitle: string;
    /**
     * @brief the match currently set on the settings page
     */
    current?: IMetadataMatch;
    /**
     * @brief the page of what it's matched to now, if anything
     */
    matchedUrl?: string;
    fromFile: boolean;
}

const emit = defineEmits<{
    saved: [mangaName: string, preferences: IMangaPreferences];
}>();

const open = ref(false);
const sources = ref<IMetadataSource[]>([]);
const sourceId = ref("");
const term = ref("");
const results = ref<ISearchResult[]>();
const searching = ref(false);
const searchError = ref("");
const input = ref("");
const inputError = ref("");
const saving = ref(false);
const target = ref<ITarget>({ mangaName: "", title: "", searchTitle: "", fromFile: false });
// a reply to an older search, e.g. on the previous source, is dropped
let searchRun = 0;

const sourceName = computed(
    () => sources.value.find((source) => source.id === sourceId.value)?.name ?? ""
);

function describe(result: ISearchResult): string {
    return [result.year, result.format].filter(Boolean).join(" · ");
}

function clearSearch() {
    searchRun++;
    searching.value = false;
    searchError.value = "";
    results.value = undefined;
}

async function show(newTarget: ITarget) {
    target.value = newTarget;
    term.value = newTarget.searchTitle;
    input.value = newTarget.current?.id ?? "";
    inputError.value = "";
    clearSearch();
    open.value = true;

    const result = await attempt(fetchMetadataSources());
    if ("error" in result) {
        console.error("Error fetching the metadata sources:", result.error);
        sources.value = [];
        return;
    }
    sources.value = result.data;
    sourceId.value = newTarget.current?.source ?? result.data[0]?.id ?? "";
}

async function search() {
    if (term.value.trim() === "" || searching.value) {
        return;
    }
    const run = ++searchRun;
    searching.value = true;
    searchError.value = "";
    const result = await attempt(searchMetadataSource(sourceId.value, term.value));
    if (run !== searchRun) {
        return;
    }
    searching.value = false;
    if ("error" in result) {
        console.error("Error searching:", result.error);
        searchError.value = `Couldn't search ${sourceName.value}, please try again.`;
        return;
    }
    results.value = result.data;
}

/**
 * @param match the entry to use, null to go back to searching by folder name
 */
async function submit(match: IMetadataMatch | null) {
    saving.value = true;
    const result = await attempt(saveMangaPreferences(target.value.mangaName, { match }));
    saving.value = false;
    if ("error" in result) {
        console.error("Error saving the match:", result.error);
        inputError.value = `Couldn't save it, check that it's a ${sourceName.value} link or ID.`;
        return;
    }
    emit("saved", target.value.mangaName, result.data);
    open.value = false;
}

function save() {
    if (input.value.trim() === "") {
        inputError.value = `Paste a ${sourceName.value} link or ID, or pick a search result.`;
        return;
    }
    submit({ source: sourceId.value, id: input.value });
}

defineExpose({
    show,
});
</script>
<style scoped>
.result-cover {
    width: 32px;
    height: 48px;
    border-radius: 4px;
    overflow: hidden;
}
</style>
