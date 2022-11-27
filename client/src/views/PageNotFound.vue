<template>
    <section class="container">
        <div class="container">
            <span class="error-type">404</span>
            <span class="text">Not Found</span>
        </div>
    </section>
</template>
<script setup lang="ts"></script>
<style scoped>
section.container {
    height: 100vh;
    display: grid;
    place-content: center;
}

div.container {
    display: flex;
    flex-flow: column;
    align-items: center;
}

.error-type {
    font-size: clamp(5rem, 5vw + 5rem, 10rem);
}

.text {
    font-size: clamp(2rem, 2vw + 2rem, 5rem);
}
</style>
