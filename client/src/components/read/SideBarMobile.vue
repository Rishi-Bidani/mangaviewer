<template>
    <div class="navigation__mobile flex">
        <div class="back-btn">↩</div>
        <div class="chapter-list"></div>
        <div class="fwd-btn">↪</div>
    </div>
</template>
<script lang="ts" setup></script>
<style scoped>
@import url("../../assets/css/colors.css");
@import url("../../assets/css/utility.css");

.navigation__mobile {
    height: 100%;
}

.navigation__mobile > * {
    flex: 1;
    display: grid;
    place-content: center;
    font-size: 2rem;
}
</style>
