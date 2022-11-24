<template>
    <div class="navigation__pc">
        <header>
            {{ mangaName }}
        </header>
        <div class="container__chapter-list">
            <ol class="flex-column" ref="chapterOrderedList">
                <li
                    ref="chapterListItem"
                    v-for="(chapter, index) in chapterList"
                    :key="chapter"
                    class="item__chapter-list"
                    :class="index === activeElementIndex ? 'active' : ''"
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
}>();

const activeElementIndex = ref(0);
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

// const chapterOrderedList: Ref<any> = ref();
// // const firstChapterName = computed(() => {
// //     return props.chapterList.value[0];
// // });

// onMounted(async () => {
//     const defaultActive = 1;
//     const listElement = chapterOrderedList.value.querySelector(`:first-child`);
//     listElement.classList.add("active");
// });

function loadChapter(event: Event) {
    const listElement = event.target as HTMLElement;
    const chapterName = listElement.dataset.chapterName as string;

    //

    // set class active on list element
    Chapters.clearActive();
    listElement.classList.add("active");
    // activeListElement.value.classList.remove("active");
    // activeListElement.value = listElement;
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
}

ol {
    gap: 2px;
}

.item__chapter-list {
    padding-block: 1rem;
    padding-inline: 0.5rem;
    cursor: pointer;
}

.active {
    background-color: var(--sidebar-active-clr);
    color: var(--primary-text-clr);
}
</style>
