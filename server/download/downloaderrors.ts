class MainFetchError extends Error {
    constructor() {
        super("");
        this.name = "MainFetchError";
    }
}

class ImageFetchError extends Error {
    constructor(img: HTMLImageElement) {
        super("");
        this.name = "ImageFetchError";
        this.message = `Error fetching image: ${img.id ?? img.alt}`;
    }
}

class DownloadImageError extends Error {
    constructor(url: string) {
        super("");
        this.name = "DownloadImageError";
        this.message = `Error downloading image: ${url}`;
    }
}

export { ImageFetchError, DownloadImageError, MainFetchError };
