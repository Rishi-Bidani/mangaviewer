<template>
    <v-bottom-navigation grow>
        <v-container class="pa-0 ma-0">
            <v-row no-gutters class="gc-2 h-100">
                <v-col cols="auto" class="h-100">
                    <v-btn value="prv-chapter" icon="mdi-chevron-left" rounded="0" class="h-100" />
                </v-col>
                <v-col class="h-100">
                    <div class="chapter-name">Chapter Name</div>
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
const emit = defineEmits(["settings-click"]);

const emitSettingsClick = () => {
    emit("settings-click");
};
</script>
<style scoped>
.chapter-name {
    height: 100%;
}
</style>
