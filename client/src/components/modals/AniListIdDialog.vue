<template>
    <v-dialog v-model="open" max-width="520">
        <v-card rounded="lg">
            <v-card-title class="text-wrap pt-4">Set AniList entry</v-card-title>
            <v-card-subtitle class="text-wrap">{{ target.title }}</v-card-subtitle>
            <v-card-text>
                <p class="text-body-2 text-medium-emphasis mb-4">
                    Find the manga on AniList and paste its link (like
                    <code>https://anilist.co/manga/30013</code>) or just its ID.
                </p>
                <v-text-field
                    v-model="input"
                    label="AniList link or ID"
                    variant="outlined"
                    autofocus
                    :error-messages="inputError"
                    @update:model-value="inputError = ''"
                    @keyup.enter="save"
                />
                <div class="d-flex flex-wrap ga-2">
                    <v-btn
                        :href="searchUrl"
                        target="_blank"
                        rel="noopener"
                        variant="text"
                        size="small"
                        prepend-icon="mdi-open-in-new"
                    >
                        Search AniList
                    </v-btn>
                    <v-btn
                        v-if="target.matchedUrl"
                        :href="target.matchedUrl"
                        target="_blank"
                        rel="noopener"
                        variant="text"
                        size="small"
                        prepend-icon="mdi-link-variant"
                    >
                        Current match
                    </v-btn>
                </div>
                <v-alert
                    v-if="target.fromFile"
                    type="info"
                    variant="tonal"
                    density="compact"
                    class="mt-3"
                    text="This title's metadata.json sets an anilistId, which is used instead of this one."
                />
            </v-card-text>
            <v-card-actions>
                <v-btn
                    v-if="target.currentId !== undefined"
                    color="error"
                    variant="text"
                    :disabled="saving"
                    @click="submit(null)"
                >
                    Remove
                </v-btn>
                <v-spacer />
                <v-btn variant="text" @click="open = false">Cancel</v-btn>
                <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<script setup lang="ts">
import { ref, computed } from "vue";
import { attempt } from "@/assets/utility";
import { parseAniListId, saveMangaPreferences, type IMangaPreferences } from "@/assets/preferences";

interface ITarget {
    mangaName: string;
    title: string;
    /**
     * @brief the anilistId currently set on the settings page
     */
    currentId?: number;
    /**
     * @brief the AniList page of what it's matched to now, if anything
     */
    matchedUrl?: string;
    fromFile: boolean;
}

const emit = defineEmits<{
    saved: [mangaName: string, preferences: IMangaPreferences];
}>();

const open = ref(false);
const input = ref("");
const inputError = ref("");
const saving = ref(false);
const target = ref<ITarget>({ mangaName: "", title: "", fromFile: false });

// searches for the folder name without tags like "[Colored]", as the server does
const searchUrl = computed(() => {
    const term = target.value.mangaName
        .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, " ")
        .replace(/_+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return `https://anilist.co/search/manga?search=${encodeURIComponent(term)}`;
});

function show(newTarget: ITarget) {
    target.value = newTarget;
    input.value = newTarget.currentId === undefined ? "" : String(newTarget.currentId);
    inputError.value = "";
    open.value = true;
}

/**
 * @param anilistId the id to use, null to go back to searching by folder name
 */
async function submit(anilistId: number | null) {
    saving.value = true;
    const result = await attempt(saveMangaPreferences(target.value.mangaName, { anilistId }));
    saving.value = false;
    if ("error" in result) {
        console.error("Error saving the AniList id:", result.error);
        inputError.value = "Couldn't save it, please try again.";
        return;
    }
    emit("saved", target.value.mangaName, result.data);
    open.value = false;
}

function save() {
    const anilistId = parseAniListId(input.value);
    if (anilistId === undefined) {
        inputError.value = "Paste an AniList manga link or ID, like https://anilist.co/manga/30013";
        return;
    }
    submit(anilistId);
}

defineExpose({
    show,
});
</script>
