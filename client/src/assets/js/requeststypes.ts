interface IEndpoints {
    mangas: string;
    mangaData: string;
    mangaChapters: string;
    mangaChapterData: string;
    mangaChapterImages: string;
    mangaClashSearch: string;
    mangaClashHotMangas: string;
    mangaClashMangaDetails: string;
    mangaDownloadManga: string;
    mangaDownloadChapter: string;
}

interface IChapterDetails {
    name: string | null;
    link: URL;
}
interface mangaDetails {
    mangaName: string;
    summary: string;
    genres: string[];
    score: number;
    chapters: IChapterDetails[];
    image: string;
}

interface IMangaClashRequests {
    hotMangas: () => Promise<string[]>;
    searchManga: (mangaName: string) => Promise<string[]>;
    mangaDetails: (mangaName: string, link: URL) => Promise<mangaDetails>;
}

interface IDownloadManga {
    downloadManga: (mangaName: string, mangaLink: URL) => Promise<string>;
    downloadChapter: (chapterLink: string, chapterName: string) => Promise<string>;
}

export { IEndpoints, IChapterDetails, mangaDetails, IMangaClashRequests, IDownloadManga };
