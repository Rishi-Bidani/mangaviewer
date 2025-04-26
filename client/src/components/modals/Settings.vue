<template>
    <v-dialog v-model="dialog" scrim="false" class="modal-width">
        <v-card>
            <v-card-title> Settings </v-card-title>
            <v-divider />
            <v-card-text>
                <div class="text-caption">Image Width</div>
                <v-slider v-model="imageWidth" :max="100" :step="1" hide-details>
                    <template v-slot:append>
                        <v-text-field
                            v-model="imageWidth"
                            type="number"
                            style="width: 80px"
                            density="compact"
                            hide-details
                            variant="outlined"
                        ></v-text-field>
                    </template>
                </v-slider>
            </v-card-text>
            <v-card-text>
                <div class="text-caption">Image Brightness</div>
                <v-slider v-model="imageBrightness" :max="100" :step="1" hide-details>
                    <template v-slot:append>
                        <v-text-field
                            v-model="imageBrightness"
                            type="number"
                            style="width: 80px"
                            density="compact"
                            hide-details
                            variant="outlined"
                        ></v-text-field>
                    </template>
                </v-slider>
            </v-card-text>
            <v-card-text>
                <div class="text-caption">Bookmark chapter</div>
                <div class="d-flex">
                    <div class="d-flex ga-2 mr-2">
                        <v-btn @click="saveBookmark">
                            <v-icon> mdi-bookmark </v-icon>
                        </v-btn>
                        <v-btn color="red" @click="removeBookmark">
                            <v-icon> mdi-bookmark-remove </v-icon>
                        </v-btn>
                    </div>
                    <v-text-field
                        v-model="bookmarkedChapter"
                        type="text"
                        style="width: 80px"
                        density="compact"
                        hide-details
                        variant="outlined"
                    ></v-text-field>
                </div>
            </v-card-text>
            <v-card-text>
                <div class="text-caption">Image Spacing</div>
                <v-slider v-model="imageSpacing" :max="20" :step="1" hide-details>
                    <template v-slot:append>
                        <v-text-field
                            v-model="imageSpacing"
                            type="number"
                            style="width: 80px"
                            density="compact"
                            hide-details
                            variant="outlined"
                        ></v-text-field>
                    </template>
                </v-slider>
            </v-card-text>
            <v-card-text>
                <div class="text-caption">Image Alignment</div>
                <v-radio-group inline v-model="alignment">
                    <div class="d-flex flex-row gc-2 flex-wrap">
                        <v-radio name="alignment" label="Left" value="start"></v-radio>
                        <v-radio name="alignment" label="Center" value="center"></v-radio>
                        <v-radio name="alignment" label="Right" value="end"></v-radio>
                    </div>
                </v-radio-group>
            </v-card-text>
            <v-divider />
            <v-card-text>
                <div class="text-caption"></div>
            </v-card-text>
            <v-card-actions>
                <v-btn color="primary" block @click="closeModal">Close Dialog</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { storage } from "@/assets/storage";

const imageWidth = ref(100);
const imageBrightness = ref(100);
const alignment = ref("center");
const imageSpacing = ref(0);
const bookmarkedChapter = ref("");

const dialog = ref(false);

const props = defineProps({
    activeChapter: {
        type: String,
        default: "",
    },
});

function init() {
    imageWidth.value = storage.get("imageWidth", storage.get("imageWidth", 100));
    imageBrightness.value = storage.get("imageBrightness", storage.get("imageBrightness", 100));
    alignment.value = storage.get("alignment", storage.get("alignment", "center"));
    imageSpacing.value = storage.get("imageSpacing", storage.get("imageSpacing", 0));
    bookmarkedChapter.value = storage.get(
        "bookmarkedChapter",
        storage.get("bookmarkedChapter", "")
    );

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

function showModal() {
    dialog.value = true;
}

function closeModal() {
    dialog.value = false;
}

function saveBookmark() {
    storage.set("bookmarkedChapter", props.activeChapter);
    bookmarkedChapter.value = props.activeChapter;
}

function removeBookmark() {
    storage.remove("bookmarkedChapter");
    bookmarkedChapter.value = "";
}

defineExpose({
    showModal,
    closeModal,
});
</script>
<style scoped>
.modal-width {
    width: min(95vw, 600px);
}
</style>
