<template>
    <v-card-text>
        <v-text-field
            :loading="loading"
            density="comfortable"
            variant="solo"
            label="Search mangas"
            append-inner-icon="mdi-magnify"
            single-line
            hide-details
            @click:append-inner="onClick"
            @keyup.enter="onClick"
            @change="emits('search', $event.target.value)"
            class="searchbar"
        ></v-text-field>
    </v-card-text>
</template>
<script setup lang="ts">
import { ref } from "vue";

const emits = defineEmits(["search"]);

const loading = ref(false);
const loaded = ref(false);

function onClick() {
    loading.value = true;
    setTimeout(() => {
        loading.value = false;
        loaded.value = true;
    }, 1000);
}
</script>
<style scoped>
.searchbar {
    min-width: 150px;
}
</style>
