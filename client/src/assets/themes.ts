import type { ThemeDefinition } from "vuetify";

// muted chrome so the manga pages stand out, with one amber accent across all themes
const dark: ThemeDefinition = {
    dark: true,
    colors: {
        background: "#0e0e11",
        surface: "#17171c",
        "surface-variant": "#2a2a31",
        primary: "#e0a458",
        secondary: "#8f8f9c",
    },
};

const light: ThemeDefinition = {
    dark: false,
    colors: {
        background: "#f4f4f6",
        surface: "#ffffff",
        primary: "#b7791f",
        secondary: "#6b6b76",
    },
};

const sepia: ThemeDefinition = {
    dark: false,
    colors: {
        background: "#f1e7d0",
        surface: "#f8f0dc",
        "on-background": "#5b4636",
        "on-surface": "#5b4636",
        primary: "#8b5e34",
        secondary: "#8a7560",
    },
};

export const themes = { dark, light, sepia };
export type ThemeName = keyof typeof themes;

export const themeOptions: { value: ThemeName; label: string; icon: string }[] = [
    { value: "dark", label: "Dark", icon: "mdi-weather-night" },
    { value: "light", label: "Light", icon: "mdi-white-balance-sunny" },
    { value: "sepia", label: "Sepia", icon: "mdi-book-open-variant" },
];

export const themeKey = "theme";
