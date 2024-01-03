<template>
    <v-card :href="mangaLink">
        <v-card-title class="text-capitalize">{{ mangaName }}</v-card-title>
    </v-card>
</template>
<script setup lang="ts">
defineProps({
    mangaName: {
        type: String,
        required: true,
    },
    mangaLink: {
        type: String,
        required: true,
    },
});
</script>
<style></style>
