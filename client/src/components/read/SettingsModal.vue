<template>
    <dialog>
        <!-- Layout -->
        <div class="container__settings">
            <header class="header__settings flex">
                <h2>Settings</h2>
                <button class="btn__close" @click="closeSettings">X</button>
            </header>
            <datalist id="imageWidthList">
                <option value="0" label="0"></option>
                <option value="25" label="25"></option>
                <option value="50" label="50"></option>
                <option value="75" label="75"></option>
                <option value="80" label="80"></option>
                <option value="100" label="100"></option>
            </datalist>

            <datalist id="imageBrightnessList">
                <option value="0" label="0"></option>
                <option value="25" label="25"></option>
                <option value="50" label="50"></option>
                <option value="75" label="75"></option>
                <option value="100" label="100"></option>
                <!-- 100 to 200 -->
                <option value="125" label="125"></option>
                <option value="150" label="150"></option>
                <option value="175" label="175"></option>
                <option value="200" label="200"></option>
            </datalist>
            <section class="container__settings-list flex-column gap-1">
                <fieldset>
                    <legend>image width</legend>
                    <input
                        type="range"
                        id="imageWidth"
                        :value="imageWidth"
                        @change="changeWidth"
                        list="imageWidthList"
                    />
                    <output id="outputWidth">{{ imageWidth }}%</output>
                </fieldset>

                <fieldset>
                    <legend>image brightness</legend>
                    <input
                        type="range"
                        id="imageBrightness"
                        min="0"
                        max="200"
                        value="100"
                        list="imageBrightnessList"
                        @change="changeBrightness"
                    />
                    <output id="outputBrightness">{{ imageBrightness }}%</output>
                </fieldset>
            </section>
        </div>
    </dialog>
</template>
<script lang="ts" setup>
import { defineProps, defineExpose } from "vue";

const props = defineProps<{
    imageWidth: number;
    imageBrightness: number;
    changeWidth: (event: Event) => void;
    changeBrightness: (event: Event) => void;
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

fieldset {
    padding: 0.5rem;
    border: none;
    display: grid;
    grid-template-columns: 1fr 2rem;
    gap: 1rem;
}

legend {
    /* margin-left: 1rem; */
    text-transform: capitalize;
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

@media screen and (max-width: 500px) {
    dialog:modal {
        width: 100vw;
        padding: 1rem 0.5rem;
    }

    fieldset {
        grid-template-columns: 1fr;
    }
}
</style>
