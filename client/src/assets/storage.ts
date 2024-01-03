// local storage

export const storage = {
    get: (key: string, defaultValue: any) => {
        const value = localStorage.getItem(key);
        // return value ? JSON.parse(value) : null;
        return value ? JSON.parse(value) : defaultValue ? defaultValue : null;
    },
    set: (key: string, value: any) => {
        localStorage.setItem(key, JSON.stringify(value));
    },
    remove: (key: string) => {
        localStorage.removeItem(key);
    },
    clear: () => {
        localStorage.clear();
    },
};
