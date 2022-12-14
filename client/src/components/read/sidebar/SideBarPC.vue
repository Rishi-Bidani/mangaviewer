<template>
    <div class="navigation__pc">
        <header class="flex">
            <a href="/" class="home icon__container">
                <img src="@/assets/icons/home.svg" alt="home" class="icon" />
            </a>
            <span class="title">
                {{ mangaName }}
            </span>
            <span class="settings icon__container">
                <img
                    class="icon"
                    src="@/assets/icons/gear.svg"
                    alt="settings"
                    @click="$emit('showSettings')"
                />
            </span>
        </header>
        <div class="container__chapter-list">
            <ol class="flex-column" ref="chapterOrderedList">
                <li
                    ref="chapterListItem"
                    v-for="chapter in chapterList"
                    :key="chapter"
                    class="item__chapter-list"
                    :class="chapter == chapterName ? 'active' : ''"
                    :data-chapter-name="chapter"
                    @click="loadChapter"
                >
                    {{ chapter }}
                </li>
            </ol>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { defineProps, ref } from "vue";

// types
import { Ref } from "vue";

const props = defineProps<{
    mangaName: string;
    chapterList: any;
    chapterName: string;
}>();

// const activeElementIndex = ref(0);
const chapterListItem: Ref<any> = ref([]);

const Chapters = {
    clearActive: () => {
        chapterListItem.value.forEach((element: HTMLElement) => {
            element.classList.remove("active");
        });
    },

    setActive: (chapterName: string) => {
        chapterListItem.value.forEach((element: HTMLElement) => {
            if (element.dataset.chapterName === chapterName) {
                element.classList.add("active");
            }
        });
    },
};

function loadChapter(event: Event) {
    const listElement = event.target as HTMLElement;
    const chapterName = listElement.dataset.chapterName as string;

    Chapters.clearActive();
    listElement.classList.add("active");
    window.location.href = `/read/${props.mangaName}/${chapterName}`;
}
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

    place-content: space-between;
    gap: 0.5rem;

    height: 2rem;
}

header > * {
    align-self: center;
}

.title {
    overflow: hidden;
    text-overflow: ellipsis;
}

.icon__container {
    height: 1.5rem;
}

.icon {
    height: 100%;
    filter: invert(1);
    cursor: pointer;
}

ol {
    gap: 2px;
}

.item__chapter-list {
    padding-block: 1rem;
    padding-inline: 0.5rem;
    cursor: pointer;
}

.item__chapter-list:hover {
    background-color: var(--sidebar-active-clr);
}

.active {
    background-color: var(--sidebar-active-clr);
    color: var(--primary-text-clr);
}
</style>
