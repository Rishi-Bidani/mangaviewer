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
    url: URL;

    constructor(message: string, url: URL) {
        super(message);
        this.name = "DownloadImageError";
        this.url = url;
    }
}

export { ImageFetchError, DownloadImageError, MainFetchError };
