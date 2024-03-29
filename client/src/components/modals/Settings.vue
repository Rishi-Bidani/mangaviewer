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
                <div class="text-caption">Image Alignment</div>
                <v-radio-group inline v-model="alignment">
                    <div class="d-flex flex-row gc-2 flex-wrap">
                        <v-radio name="alignment" label="Left" value="start"></v-radio>
                        <v-radio name="alignment" label="Center" value="center"></v-radio>
                        <v-radio name="alignment" label="Right" value="end"></v-radio>
                    </div>
                </v-radio-group>
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

const dialog = ref(false);

function init() {
    imageWidth.value = storage.get("imageWidth", storage.get("imageWidth", 100));
    imageBrightness.value = storage.get("imageBrightness", storage.get("imageBrightness", 100));
    alignment.value = storage.get("alignment", storage.get("alignment", "center"));

    emits("updateImageWidth", imageWidth.value);
    emits("updateImageBrightness", imageBrightness.value);
    emits("updateAlignment", alignment.value);
}

onMounted(() => {
    init();
});

const emits = defineEmits(["updateImageWidth", "updateImageBrightness", "updateAlignment"]);

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

function showModal() {
    dialog.value = true;
}

function closeModal() {
    dialog.value = false;
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
