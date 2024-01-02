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

            <v-card-actions>
                <v-btn color="primary" block @click="closeModal">Close Dialog</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<script setup lang="ts">
import { ref } from "vue";

const imageWidth = ref(100);
const imageBrightness = ref(100);

const dialog = ref(false);

function showModal() {
    dialog.value = true;
}

function closeModal() {
    dialog.value = false;
}

defineExpose({
    dialog,
    showModal,
    closeModal,
});
</script>
<style scoped>
.modal-width {
    width: min(90vw, 600px);
}
</style>
