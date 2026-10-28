// local storage

export const storage = {
    get: <T>(key: string, defaultValue: T): T => {
        const value = localStorage.getItem(key);
        return value ? (JSON.parse(value) as T) : defaultValue;
    },
    set: (key: string, value: unknown) => {
        localStorage.setItem(key, JSON.stringify(value));
    },
    remove: (key: string) => {
        localStorage.removeItem(key);
    },
    clear: () => {
        localStorage.clear();
    },
};

// bookmarks are stored per manga
export const bookmarkKey = (mangaName: string) => `bookmarkedChapter:${mangaName}`;
