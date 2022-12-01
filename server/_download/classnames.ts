interface IMangaClashClasses {
    coverImage: string;
    chapterList: string;
    mangaImage: string;
    title: string;
    selfLink: string;
}

const MangaClash: IMangaClashClasses = {
    selfLink: "link[rel='canonical']",
    title: ".post-title h1",
    coverImage: ".summary_image img",
    chapterList: ".wp-manga-chapter a",
    mangaImage: ".reading-content img",
};

export { MangaClash };
