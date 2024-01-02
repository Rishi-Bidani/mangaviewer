<template>
    <MobileBar :chapter-list="props.chapterList" v-if="mobile" />
    <PCBar :chapter-list="props.chapterList" v-else />
</template>
<script setup lang="ts">
import { onMounted } from "vue";
import { useDisplay } from "vuetify";

import MobileBar from "@components/navigation/MobileBar.vue";
import PCBar from "./PCBar.vue";

const { mobile } = useDisplay();
const props = defineProps({
    chapterList: {
        type: Array<string>,
        default: () => [],
    },
});

onMounted(() => {
    console.log(mobile.value); // false

    // check if viewport size changed
    // window.addEventListener("resize", () => {
    //     console.log(mobile.value);
    // });
});
</script>

<style scoped></style>
