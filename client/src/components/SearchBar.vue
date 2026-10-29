<template>
    <v-card-text>
        <v-text-field
            v-model="query"
            density="comfortable"
            variant="solo"
            label="Search mangas"
            append-inner-icon="mdi-magnify"
            single-line
            hide-details
            @click:append-inner="emits('search', query)"
            @keyup.enter="emits('search', query)"
            @update:model-value="(value: string) => emits('search', value)"
            class="searchbar"
        ></v-text-field>
    </v-card-text>
</template>
<script setup lang="ts">
import { ref } from "vue";

const emits = defineEmits(["search"]);

const query = ref("");
</script>
<style scoped>
.searchbar {
    min-width: 150px;
}
</style>
