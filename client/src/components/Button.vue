<template>
    <button @click="emitClick">
        {{ props.text }}
    </button>
</template>
<script lang="ts" setup>
import { defineProps, defineEmits } from "vue";

const emit = defineEmits(["click"]);

function emitClick(event: Event) {
    emit("click", event);
}

const props = defineProps({
    text: {
        type: String,
        required: true,
    },
});
</script>
<style scoped>
@import url("~@/assets/css/colors.css");

button {
    height: 3rem;
    color: var(--primary-text-clr);
    border: 2px solid var(--primary-text-clr);
    background-color: var(--primary-clr);
    padding: 0.8rem 1rem;
    cursor: pointer;
    border-radius: 4px;
}

button:hover {
    font-size: 1.01rem;
}
</style>
