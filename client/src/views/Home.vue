<template>
    <v-app>
        <SideBottomBar @settings-click="showSettings" />
        <Settings ref="settingsModal" />
    </v-app>
</template>
<script setup lang="ts">
import SideBottomBar from "@components/navigation/SideBottomBar.vue";
import Settings from "@components/modals/Settings.vue";

import { ref } from "vue";

const settingsModal = ref<InstanceType<typeof Settings>>();

function showSettings() {
    settingsModal.value?.showModal();
}
</script>

<style scoped></style>
