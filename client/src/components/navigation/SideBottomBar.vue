<template>
    <MobileBar :active-chapter="activeChapter" :chapter-list="props.chapterList" v-if="mobile" />
    <PCBar :active-chapter="activeChapter" :chapter-list="props.chapterList" v-else />
</template>
<script setup lang="ts">
import { useDisplay } from "vuetify";

import MobileBar from "@components/navigation/MobileBar.vue";
import PCBar from "./PCBar.vue";

const { mobile } = useDisplay();
const props = defineProps({
    chapterList: {
        type: Array<string>,
        default: () => [],
    },
    activeChapter: {
        type: String,
        default: "",
    },
});
</script>

<style scoped></style>
