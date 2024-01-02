<template>
    <v-container>
        <v-navigation-drawer :width="245" class="d-flex flex-column">
            <header class="navbar-header">
                <v-list-item title="Manga Viewer"></v-list-item>
                <v-divider thickness="4"></v-divider>
            </header>
            <div class="overflow-auto">
                <v-list-item v-for="item in props.chapterList" link :title="item"></v-list-item>
            </div>
            <template v-slot:append>
                <div class="pa-4">
                    <v-btn block elevation="12" prepend-icon="mdi-cog" @click="emitSettingsClick">
                        settings
                    </v-btn>
                </div>
            </template>
        </v-navigation-drawer>
    </v-container>
</template>
<script setup lang="ts">
const emit = defineEmits(["settings-click"]);

const emitSettingsClick = () => {
    emit("settings-click");
};

const props = defineProps({
    chapterList: {
        type: Array<string>,
        default: () => [],
    },
});
</script>
<style scoped>
.navbar-header {
    isolation: isolate;
    z-index: 1;
    position: sticky;
    top: 0;
    background-color: rgb(var(--v-theme-surface));
}
</style>
