<template>
    <div class="navigation__pc">
        <header>
            {{ mangaName }}
        </header>
        <div class="container__chapter-list">
            <ol class="flex-column">
                <li v-for="chapter in chapterList" :key="chapter" class="item__chapter-list">
                    {{ chapter }}
                </li>
            </ol>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { defineProps, inject, onMounted, ref } from "vue";

// types
import { Ref } from "vue";

const props = defineProps<{
    mangaName: string;
    chapterList: any;
}>();
</script>

<style scoped>
header {
    padding-block: 1rem;
    padding-inline: 0.5rem;
    border-bottom: 2px solid var(--primary-clr);
    text-transform: capitalize;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;

    position: sticky;
    top: 0;
    background-color: var(--secondary-clr);
}

ol {
    gap: 2px;
}

.item__chapter-list {
    padding-block: 1rem;
    padding-inline: 0.5rem;
    cursor: pointer;
}
</style>
