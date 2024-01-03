<template>
    <v-bottom-navigation grow :active="showNav">
        <v-container class="pa-0 ma-0">
            <v-row no-gutters class="gc-2 h-100">
                <v-col cols="auto" class="h-100">
                    <v-btn value="prv-chapter" icon="mdi-chevron-left" rounded="0" class="h-100" />
                </v-col>
                <v-col class="h-100">
                    <div class="chapter-name d-flex align-center">Chapter Name</div>
                </v-col>
                <v-col cols="auto" class="h-100">
                    <v-btn value="nxt-chapter" icon="mdi-chevron-right" rounded="0" class="h-100" />
                </v-col>
            </v-row>
        </v-container>

        <v-btn value="settings" @click="emitSettingsClick">
            <v-icon>mdi-cog</v-icon>
            <span>Settings</span>
        </v-btn>
    </v-bottom-navigation>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";

const emit = defineEmits(["settings-click"]);

const emitSettingsClick = () => {
    emit("settings-click");
};

const showNav = ref(true);
const lastScrollPosition = ref(0);

function onScroll() {
    const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
    if (currentScrollPosition < 0) {
        return;
    }
    const OFFSET = 60;
    // Stop executing this function if the difference between
    // current scroll position and last scroll position is less than some offset
    if (Math.abs(currentScrollPosition - lastScrollPosition.value) < OFFSET) {
        return;
    }
    showNav.value = currentScrollPosition < lastScrollPosition.value;
    lastScrollPosition.value = currentScrollPosition;
}

onMounted(() => {
    window.addEventListener("scroll", onScroll);
});
</script>
<style scoped>
.chapter-name {
    height: 100%;
}
</style>
