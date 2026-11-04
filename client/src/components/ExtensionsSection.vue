<template>
    <section class="mt-8">
        <h2 class="text-h6">Extensions</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">
            Extensions are installed by putting them in the server's extensions folder and listing
            them in ENABLED_EXTENSIONS. They run with full access to the server, so only use ones
            you trust.
        </p>
        <v-alert v-if="errorMessage" type="error" variant="tonal" :text="errorMessage" />
        <v-select
            v-if="metadataSources.length > 1"
            :model-value="activeSource"
            :items="metadataSources"
            item-title="name"
            item-value="id"
            label="Metadata source"
            hint="Where titles are looked up. To use another for one title, match it with its 🔗 button."
            persistent-hint
            variant="outlined"
            density="comfortable"
            class="mb-4"
            @update:model-value="chooseSource"
        />
        <v-card v-if="!errorMessage" rounded="lg">
            <v-list>
                <v-list-item v-for="extension in extensions" :key="extension.id">
                    <v-list-item-title>{{ extension.name }}</v-list-item-title>
                    <v-list-item-subtitle>{{ describe(extension) }}</v-list-item-subtitle>
                    <v-alert
                        v-if="extension.error"
                        type="error"
                        variant="tonal"
                        density="compact"
                        class="mt-2"
                        :text="extension.error"
                    />
                    <div v-if="extension.sync" class="mt-2">
                        <v-switch
                            :model-value="extension.sync.enabled"
                            label="Sync reading progress here"
                            color="primary"
                            density="compact"
                            inset
                            hide-details
                            @update:model-value="
                                (value: boolean | null) => setEnabled(extension, !!value)
                            "
                        />
                        <div v-if="extension.sync.account" class="mt-1">
                            <div class="d-flex align-center flex-wrap ga-2">
                                <span class="text-body-2">
                                    {{
                                        extension.sync.account.user
                                            ? `Signed in as ${extension.sync.account.user}`
                                            : "Not signed in"
                                    }}
                                </span>
                                <v-btn
                                    v-if="extension.sync.account.user"
                                    variant="text"
                                    size="small"
                                    @click="leave(extension)"
                                >
                                    Sign out
                                </v-btn>
                                <v-btn
                                    v-else
                                    variant="tonal"
                                    size="small"
                                    @click="signIn(extension)"
                                >
                                    Sign in
                                </v-btn>
                            </div>
                            <p
                                v-if="!extension.sync.account.user"
                                class="text-caption text-medium-emphasis mt-1"
                            >
                                Save the settings below first, and set this as the redirect URL
                                where you created them: {{ signInCallbackUrl(extension.id) }}
                            </p>
                        </div>
                        <v-btn
                            v-if="extension.sync.hasFile"
                            :href="extensionFileUrl(extension.id)"
                            variant="tonal"
                            size="small"
                            prepend-icon="mdi-download"
                            class="mt-1"
                        >
                            Download
                        </v-btn>
                    </div>
                    <form
                        v-if="extension.settings.length > 0"
                        class="mt-3"
                        @submit.prevent="save(extension)"
                    >
                        <v-text-field
                            v-for="setting in extension.settings"
                            :key="setting.key"
                            v-model="drafts[extension.id][setting.key]"
                            :label="setting.label"
                            :type="setting.secret ? 'password' : 'text'"
                            :hint="setting.description"
                            :placeholder="setting.secret && setting.isSet ? 'Saved' : undefined"
                            :persistent-placeholder="setting.secret && setting.isSet"
                            :clearable="!setting.secret"
                            persistent-hint
                            variant="outlined"
                            density="comfortable"
                            autocomplete="off"
                            class="mb-2"
                        >
                            <template v-if="setting.secret && setting.isSet" v-slot:append>
                                <v-btn
                                    icon="mdi-delete-outline"
                                    variant="text"
                                    size="small"
                                    :aria-label="`Remove ${setting.label}`"
                                    @click="removeSecret(extension, setting.key)"
                                />
                            </template>
                        </v-text-field>
                        <v-btn
                            type="submit"
                            variant="tonal"
                            size="small"
                            :loading="saving === extension.id"
                        >
                            Save
                        </v-btn>
                    </form>
                </v-list-item>
            </v-list>
        </v-card>
    </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { attempt } from "@/assets/utility";
import {
    extensionFileUrl,
    fetchExtensions,
    saveExtensionSettings,
    setActiveMetadataSource,
    setSyncEnabled,
    signInCallbackUrl,
    signOut,
    startSignIn,
    type IExtension,
} from "@/assets/extensions";

const emit = defineEmits<{
    notify: [text: string, color?: string];
    sourceChanged: [];
}>();

const route = useRoute();

const extensions = ref<IExtension[]>([]);
// what's typed into each extension's settings, keyed by extension id then setting key; secrets
// stay empty, since the server never sends them back
const drafts = ref<Record<string, Record<string, string | null>>>({});
const saving = ref("");
const errorMessage = ref("");

const metadataSources = computed(() =>
    extensions.value.filter(({ isMetadataSource }) => isMetadataSource)
);
const activeSource = computed(
    () => extensions.value.find(({ isActiveMetadataSource }) => isActiveMetadataSource)?.id
);

function describe(extension: IExtension): string {
    if (extension.status === "disabled") {
        return "Not enabled, add it to ENABLED_EXTENSIONS to run it";
    }
    if (extension.status === "failed") {
        return "Failed to load";
    }
    return [
        extension.builtIn ? "Built in" : "Added",
        extension.isMetadataSource && "metadata source",
        extension.sync && "sync target",
    ]
        .filter(Boolean)
        .join(" · ");
}

function setDrafts(extension: IExtension) {
    drafts.value[extension.id] = Object.fromEntries(
        extension.settings.map((setting) => [setting.key, setting.value ?? ""])
    );
}

function replaceExtension(updated: IExtension) {
    extensions.value = extensions.value.map((extension) =>
        extension.id === updated.id ? updated : extension
    );
    setDrafts(updated);
}

onMounted(async () => {
    const result = await attempt(fetchExtensions());
    if ("error" in result) {
        console.error("Error fetching extensions:", result.error);
        errorMessage.value = "Could not load the extensions.";
        return;
    }
    result.data.forEach(setDrafts);
    extensions.value = result.data;

    // the browser just came back from signing in
    const { signedIn, signInError } = route.query;
    if (typeof signInError === "string") {
        emit("notify", `Couldn't sign in: ${signInError}`);
    } else if (typeof signedIn === "string") {
        const name = extensions.value.find(({ id }) => id === signedIn)?.name ?? signedIn;
        emit("notify", `Signed in to ${name}.`, "success");
    }
});

async function chooseSource(id: string) {
    const result = await attempt(setActiveMetadataSource(id));
    if ("error" in result) {
        console.error("Error choosing the metadata source:", result.error);
        emit("notify", "Couldn't change the metadata source.");
        return;
    }
    extensions.value = result.data;
    emit("sourceChanged");
}

async function setEnabled(extension: IExtension, enabled: boolean) {
    const result = await attempt(setSyncEnabled(extension.id, enabled));
    if ("error" in result) {
        console.error("Error changing sync:", result.error);
        emit("notify", `Couldn't change syncing to ${extension.name}.`);
        return;
    }
    replaceExtension(result.data);
}

async function signIn(extension: IExtension) {
    const result = await attempt(startSignIn(extension.id));
    if ("error" in result) {
        console.error("Error starting the sign in:", result.error);
        emit("notify", `Couldn't sign in to ${extension.name}, check its settings are saved.`);
        return;
    }
    window.location.href = result.data;
}

async function leave(extension: IExtension) {
    const result = await attempt(signOut(extension.id));
    if ("error" in result) {
        console.error("Error signing out:", result.error);
        emit("notify", `Couldn't sign out of ${extension.name}.`);
        return;
    }
    replaceExtension(result.data);
}

async function send(extension: IExtension, changes: Record<string, string | null>) {
    saving.value = extension.id;
    const result = await attempt(saveExtensionSettings(extension.id, changes));
    saving.value = "";
    if ("error" in result) {
        console.error("Error saving extension settings:", result.error);
        emit("notify", `Couldn't save the settings of ${extension.name}.`);
        return;
    }
    replaceExtension(result.data);
    emit("notify", `Saved the settings of ${extension.name}.`, "success");
}

function save(extension: IExtension) {
    const changes: Record<string, string | null> = {};
    for (const setting of extension.settings) {
        const value = drafts.value[extension.id][setting.key];
        // an empty secret field means it wasn't changed, it has its own button to remove it
        if (setting.secret && !value) {
            continue;
        }
        changes[setting.key] = value || null;
    }
    send(extension, changes);
}

function removeSecret(extension: IExtension, key: string) {
    send(extension, { [key]: null });
}
</script>
