class ImageDownloadError extends Error {
    url: string;
    filepath: string;

    constructor(message: string, url: string, filepath: string) {
        super(message);
        this.name = "ImageDownloadError";
        this.url = url;
        this.filepath = filepath;
    }
}

export { ImageDownloadError };
