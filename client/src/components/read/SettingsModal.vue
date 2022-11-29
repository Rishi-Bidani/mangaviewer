<template>
    <dialog>
        <datalist id="imageWidthList">
            <option value="0" label="0"></option>
            <option value="25" label="25"></option>
            <option value="50" label="50"></option>
            <option value="75" label="75"></option>
            <option value="80" label="80"></option>
            <option value="100" label="100"></option>
        </datalist>
        <!-- Layout -->
        <div class="container__settings">
            <header class="header__settings flex">
                <h2>Settings</h2>
                <button class="btn__close" @click="closeSettings">X</button>
            </header>
            <section class="container__settings-list">
                <div class="item__settings gap-1 flex">
                    <label for="imageWidth">Image Width</label>
                    <input
                        type="range"
                        id="imageWidth"
                        :value="imageWidth"
                        @change="changeWidth"
                        list="imageWidthList"
                    />
                    <output id="outputWidth">{{ imageWidth }}%</output>
                </div>
            </section>
        </div>
    </dialog>
</template>
<script lang="ts" setup>
import { defineProps, defineExpose } from "vue";

const props = defineProps<{
    imageWidth: number;
    changeWidth: (event: Event) => void;
}>();

function showSettings() {
    const dialog: HTMLDialogElement = document.querySelector("dialog") as HTMLDialogElement;
    console.log(dialog);
    dialog.showModal();
}

function closeSettings() {
    const dialog: HTMLDialogElement = document.querySelector("dialog") as HTMLDialogElement;
    dialog.close();
}

defineExpose({
    showSettings,
    closeSettings,
});
</script>
<style scoped>
@import url("~@/assets/css/colors.css");
@import url("~@/assets/css/utility.css");

dialog:modal {
    padding: 1rem 2rem;
    margin: auto;
    width: min(30rem, 80vw);
    box-sizing: border-box;
    background-color: var(--primary-clr);
    border: 3px solid var(--sidebar-active-clr);
    color: var(--primary-text-clr);
}

input[type="range"] {
    color: inherit;
    width: 100%;
}

.item__settings > * {
    width: max-content;
    white-space: nowrap;
}

.header__settings {
    margin-bottom: 1rem;
    justify-content: space-between;
}

.btn__close {
    background-color: transparent;
    color: inherit;
    cursor: pointer;
    border: none;
    font-size: 1.5rem;
    font-weight: bold;
}
</style>
