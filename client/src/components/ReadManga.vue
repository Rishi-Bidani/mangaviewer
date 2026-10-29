<template>
    <!-- the info button sits next to the card link rather than inside it, links can't nest -->
    <div class="manga-tile position-relative h-100">
        <v-card :href="mangaLink" rounded="lg" class="h-100">
            <v-responsive v-if="!showCover" :aspect-ratio="2 / 3" class="bg-surface-variant">
                <div class="d-flex align-center justify-center fill-height">
                    <v-icon icon="mdi-book-outline" size="48" class="text-medium-emphasis" />
                </div>
            </v-responsive>
            <v-img v-else :src="coverUrl" :aspect-ratio="2 / 3" cover class="bg-surface-variant">
                <template v-slot:placeholder>
                    <div class="d-flex align-center justify-center fill-height">
                        <v-progress-circular indeterminate color="primary" size="24" />
                    </div>
                </template>
                <template v-slot:error>
                    <div class="d-flex align-center justify-center fill-height">
                        <v-icon
                            icon="mdi-image-off-outline"
                            size="40"
                            class="text-medium-emphasis"
                        />
                    </div>
                </template>
            </v-img>
            <div class="pa-3">
                <div
                    class="manga-title text-body-1 font-weight-medium"
                    :class="{ 'text-capitalize': !metadata?.title }"
                >
                    {{ metadata?.title ?? mangaName }}
                </div>
                <div v-if="details" class="text-caption text-medium-emphasis">{{ details }}</div>
            </div>
        </v-card>
        <v-btn
            :to="{ name: 'manga', params: { mangaName } }"
            icon="mdi-information-variant"
            size="small"
            density="comfortable"
            variant="flat"
            class="info-button"
            :aria-label="`About ${metadata?.title ?? mangaName}`"
            v-tooltip:top="'Info'"
        />
    </div>
</template>
<script setup lang="ts">
import { computed, type PropType } from "vue";
import { coverUrl as mangaCoverUrl, type IMangaMetadata } from "@/assets/metadata";

const props = defineProps({
    mangaName: {
        type: String,
        required: true,
    },
    mangaLink: {
        type: String,
        required: true,
    },
    metadata: {
        type: Object as PropType<IMangaMetadata>,
        default: undefined,
    },
    showCover: {
        type: Boolean,
        default: true,
    },
});

const coverUrl = computed(() => mangaCoverUrl(props.mangaName, props.metadata));

const details = computed(() =>
    [props.metadata?.year, props.metadata?.status].filter(Boolean).join(" · ")
);
</script>
<style scoped>
.manga-tile {
    transition: transform 0.15s ease;
}

.manga-tile:hover {
    transform: translateY(-3px);
}

/* translucent so it reads on any cover */
.info-button {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.55) !important;
    color: #fff !important;
    backdrop-filter: blur(4px);
}

/* at most two lines, cut off with an ellipsis */
.manga-title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
}
</style>
