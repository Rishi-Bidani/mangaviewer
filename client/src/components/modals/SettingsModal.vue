<template>
    <!-- no scrim so the pages stay visible and update live while adjusting -->
    <v-navigation-drawer v-model="dialog" location="right" temporary :scrim="false" :width="320">
        <v-toolbar density="compact" color="transparent">
            <v-toolbar-title class="text-subtitle-1 font-weight-medium">Settings</v-toolbar-title>
            <v-btn icon="mdi-close" variant="text" @click="closeModal" />
        </v-toolbar>
        <v-divider />

        <div class="pa-4 d-flex flex-column ga-6">
            <section>
                <div class="text-overline text-medium-emphasis">Theme</div>
                <v-btn-toggle
                    v-model="themeName"
                    mandatory
                    divided
                    variant="outlined"
                    density="comfortable"
                    color="primary"
                    class="d-flex"
                >
                    <v-btn
                        v-for="option in themeOptions"
                        :key="option.value"
                        :value="option.value"
                        :prepend-icon="option.icon"
                        class="flex-grow-1"
                    >
                        {{ option.label }}
                    </v-btn>
                </v-btn-toggle>
            </section>

            <section v-for="slider in sliders" :key="slider.label">
                <div class="d-flex align-center justify-space-between">
                    <div class="text-overline text-medium-emphasis">{{ slider.label }}</div>
                    <span class="text-body-2">{{ slider.model.value }}{{ slider.unit }}</span>
                </div>
                <v-slider
                    v-model="slider.model.value"
                    :min="slider.min"
                    :max="slider.max"
                    :step="1"
                    color="primary"
                    hide-details
                />
            </section>

            <section>
                <div class="text-overline text-medium-emphasis">Alignment</div>
                <v-btn-toggle
                    v-model="alignment"
                    mandatory
                    divided
                    variant="outlined"
                    density="comfortable"
                    color="primary"
                    class="d-flex"
                >
                    <v-btn
                        v-for="option in alignmentOptions"
                        :key="option.value"
                        :value="option.value"
                        :icon="option.icon"
                        :aria-label="option.label"
                        class="flex-grow-1"
                    />
                </v-btn-toggle>
            </section>

            <section>
                <div class="text-overline text-medium-emphasis">Bookmark</div>
                <div class="d-flex align-center ga-2">
                    <v-icon :icon="bookmarkedChapter ? 'mdi-bookmark' : 'mdi-bookmark-outline'" />
                    <span class="text-body-2 flex-grow-1 text-truncate">
                        {{ bookmarkedChapter || "No bookmark" }}
                    </span>
                    <v-btn
                        icon="mdi-bookmark-plus"
                        variant="tonal"
                        color="primary"
                        size="small"
                        aria-label="Bookmark this chapter"
                        @click="saveBookmark"
                    />
                    <v-btn
                        icon="mdi-bookmark-remove"
                        variant="text"
                        size="small"
                        aria-label="Remove bookmark"
                        :disabled="!bookmarkedChapter"
                        @click="removeBookmark"
                    />
                </div>
            </section>
        </div>

        <template v-slot:append>
            <div class="pa-4">
                <v-btn
                    block
                    variant="tonal"
                    prepend-icon="mdi-restore"
                    @click="resetDisplaySettings"
                >
                    Reset to defaults
                </v-btn>
            </div>
        </template>
    </v-navigation-drawer>
</template>
<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useTheme } from "vuetify";
import { storage, bookmarkKey } from "@/assets/storage";
import { themeOptions, themeKey, type ThemeName } from "@/assets/themes";

const displayDefaults = {
    imageWidth: 100,
    imageBrightness: 100,
    alignment: "center",
    imageSpacing: 0,
};

const imageWidth = ref(displayDefaults.imageWidth);
const imageBrightness = ref(displayDefaults.imageBrightness);
const alignment = ref(displayDefaults.alignment);
const imageSpacing = ref(displayDefaults.imageSpacing);
const bookmarkedChapter = ref("");

const theme = useTheme();
const themeName = ref(theme.global.name.value as ThemeName);

const dialog = ref(false);

const sliders = [
    { label: "Image width", model: imageWidth, min: 10, max: 100, unit: "%" },
    { label: "Brightness", model: imageBrightness, min: 10, max: 100, unit: "%" },
    { label: "Spacing", model: imageSpacing, min: 0, max: 20, unit: "px" },
];

const alignmentOptions = [
    { value: "start", label: "Align left", icon: "mdi-format-align-left" },
    { value: "center", label: "Align center", icon: "mdi-format-align-center" },
    { value: "end", label: "Align right", icon: "mdi-format-align-right" },
];

const props = defineProps({
    mangaName: {
        type: String,
        required: true,
    },
    activeChapter: {
        type: String,
        default: "",
    },
});

function init() {
    imageWidth.value = storage.get("imageWidth", displayDefaults.imageWidth);
    imageBrightness.value = storage.get("imageBrightness", displayDefaults.imageBrightness);
    alignment.value = storage.get("alignment", displayDefaults.alignment);
    imageSpacing.value = storage.get("imageSpacing", displayDefaults.imageSpacing);
    bookmarkedChapter.value = storage.get(bookmarkKey(props.mangaName), "");

    emits("updateImageWidth", imageWidth.value);
    emits("updateImageBrightness", imageBrightness.value);
    emits("updateAlignment", alignment.value);
    emits("updateImageSpacing", imageSpacing.value);
}

onMounted(() => {
    init();
});

const emits = defineEmits([
    "updateImageWidth",
    "updateImageBrightness",
    "updateAlignment",
    "updateImageSpacing",
]);

watch(imageWidth, () => {
    emits("updateImageWidth", imageWidth.value);
    storage.set("imageWidth", imageWidth.value);
});

watch(imageBrightness, () => {
    emits("updateImageBrightness", imageBrightness.value);
    storage.set("imageBrightness", imageBrightness.value);
});

watch(alignment, () => {
    emits("updateAlignment", alignment.value);
    storage.set("alignment", alignment.value);
});

watch(imageSpacing, () => {
    emits("updateImageSpacing", imageSpacing.value);
    storage.set("imageSpacing", imageSpacing.value);
});

watch(themeName, () => {
    theme.change(themeName.value);
    storage.set(themeKey, themeName.value);
});

// resets the image display settings; theme and bookmark are left alone
function resetDisplaySettings() {
    imageWidth.value = displayDefaults.imageWidth;
    imageBrightness.value = displayDefaults.imageBrightness;
    alignment.value = displayDefaults.alignment;
    imageSpacing.value = displayDefaults.imageSpacing;
}

function showModal() {
    dialog.value = true;
}

function closeModal() {
    dialog.value = false;
}

function saveBookmark() {
    storage.set(bookmarkKey(props.mangaName), props.activeChapter);
    bookmarkedChapter.value = props.activeChapter;
}

function removeBookmark() {
    storage.remove(bookmarkKey(props.mangaName));
    bookmarkedChapter.value = "";
}

defineExpose({
    showModal,
    closeModal,
});
</script>
