interface IEndpoints {
    mangas: string;
    mangaData: string;
    mangaChapters: string;
    mangaChapterData: string;
    mangaChapterImages: string;
    mangaClashSearch: string;
    mangaClashHotMangas: string;
}

const BASE_URL = "http://localhost:5000";

const ENDPOINTS: IEndpoints = {
    mangas: "/mangas",
    mangaData: "/mangas?data=true",
    mangaChapters: "/mangas/:manga/chapters",
    mangaChapterData: "/mangas/:manga/chapters?data=true",
    mangaChapterImages: "/mangas/:manga/chapters/:chapter/images",
    // ------------------- MANGA CLASH --------------------------
    mangaClashSearch: "/mangaclash/search",
    mangaClashHotMangas: "/mangaclash/hot",
};

export default class Requests {
    static async getMangas(): Promise<string[]> {
        const response = await fetch(BASE_URL + ENDPOINTS.mangas);
        return await response.json();
    }

    static async getChapterList(manga: string): Promise<string[]> {
        const response = await fetch(BASE_URL + ENDPOINTS.mangaChapters.replace(":manga", manga));
        return await response.json();
    }

    static async getChapterImages(manga: string, chapter: string) {
        const url = new URL(
            BASE_URL +
                ENDPOINTS.mangaChapterImages.replace(":manga", manga).replace(":chapter", chapter)
        );
        const response = await fetch(url.toString());
        return await response.json();
    }

    static MangaClash() {
        async function hotMangas() {
            const response = await fetch(BASE_URL + ENDPOINTS.mangaClashHotMangas);
            return await response.json();
        }

        async function searchManga(mangaName: string) {
            const url = new URL(BASE_URL + ENDPOINTS.mangaClashSearch);
            url.searchParams.append("manga", mangaName);
            console.log(url.toString());
            const response = await fetch(url.toString());
            return await response.json();
        }

        return {
            hotMangas,
            searchManga,
        };
    }
}
