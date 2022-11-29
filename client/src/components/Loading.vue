<template>
    <div>
        <div class="loader"></div>
    </div>
</template>
<script lang="ts" setup></script>
<style scoped>
@import url("~@/assets/css/colors.css");
@import url("~@/assets/css/utility.css");

.loader {
    --size: 4rem;
    --border-size: 0.5rem;

    border: var(--border-size) solid #f3f3f3; /* Light grey */
    border-top: var(--border-size) solid var(--sidebar-active-clr); /* Blue */
    border-radius: 50%;
    width: var(--size);
    height: var(--size);
    animation: spin 2s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
