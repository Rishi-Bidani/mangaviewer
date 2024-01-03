<template>
    <v-bottom-navigation grow :active="showNav">
        <v-container class="pa-0 ma-0">
            <v-row no-gutters class="gc-2 h-100">
                <v-col cols="auto" class="h-100">
                    <v-btn
                        @click="() => $emit('previous-chapter')"
                        value="prv-chapter"
                        icon="mdi-chevron-left"
                        rounded="0"
                        class="h-100"
                    />
                </v-col>
                <v-col class="h-100">
                    <!-- <div class="chapter-name d-flex align-center">Chapter Name</div> -->
                    <v-select
                        label="Chapter"
                        variant="solo-filled"
                        :items="chapterList"
                        v-model="tempActiveChapter"
                        @update:model-value="changeChapter"
                    ></v-select>
                </v-col>
                <v-col cols="auto" class="h-100">
                    <v-btn
                        @click="() => $emit('next-chapter')"
                        value="nxt-chapter"
                        icon="mdi-chevron-right"
                        rounded="0"
                        class="h-100"
                    />
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
import { ref, onMounted, watch } from "vue";

const emit = defineEmits(["settings-click", "next-chapter", "previous-chapter", "chapter-click"]);

const emitSettingsClick = () => {
    emit("settings-click");
};

const tempActiveChapter = ref("");

function changeChapter(chapter: string) {
    emit("chapter-click", chapter);
}

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

const showNav = ref(true);
const lastScrollPosition = ref(0);

function onScroll() {
    const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;

    // Stop executing this function if scroll position is negative
    if (currentScrollPosition < 0) {
        return;
    }
    const OFFSET = 60;
    // Stop executing this function if the difference between
    // current scroll position and last scroll position is less than some offset
    if (Math.abs(currentScrollPosition - lastScrollPosition.value) < OFFSET) {
        return;
    }

    // if near the bottom of the page, show the nav bar
    if (currentScrollPosition + window.innerHeight >= document.body.scrollHeight - 120) {
        showNav.value = true;
        return;
    }

    showNav.value = currentScrollPosition < lastScrollPosition.value;
    lastScrollPosition.value = currentScrollPosition;
}

onMounted(() => {
    window.addEventListener("scroll", onScroll);
    tempActiveChapter.value = props.activeChapter;
});

watch(
    () => props.activeChapter,
    (newVal) => {
        tempActiveChapter.value = newVal;
    }
);
</script>
<style scoped>
.chapter-name {
    height: 100%;
}
</style>
