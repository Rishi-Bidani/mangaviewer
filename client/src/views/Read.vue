<template>
    <section class="main">
        <side-bar :mangaName="mangaName" />
    </section>
</template>
<script lang="ts" setup>
import SideBar from "@/components/read/SideBar.vue";

const mangaName: string = decodeURIComponent(window.location.hash.split("#/read/")[1]);
</script>
<style scoped>
@import url("../assets/css/colors.css");
@import url("../assets/css/utility.css");

.main {
    overflow: hidden;
}
</style>
