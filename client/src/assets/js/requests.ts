import { IEndpoints, mangaDetails, IMangaClashRequests } from "./requeststypes";

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
    mangaClashMangaDetails: "/mangaclash/manga/:manga",
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

    static MangaClash(): IMangaClashRequests {
        async function hotMangas() {
            const response = await fetch(BASE_URL + ENDPOINTS.mangaClashHotMangas);
            return await response.json();
        }

        async function searchManga(mangaName: string) {
            const url = new URL(BASE_URL + ENDPOINTS.mangaClashSearch);
            url.searchParams.append("manga", mangaName);
            const response = await fetch(url.toString());
            return await response.json();
        }

        async function mangaDetails(mangaName: string, link: URL): Promise<mangaDetails> {
            const url = new URL(
                BASE_URL + ENDPOINTS.mangaClashMangaDetails.replace(":manga", mangaName)
            );
            url.searchParams.append("link", link.toString());

            const response = await fetch(url.toString());
            return await response.json();
        }

        return {
            hotMangas,
            searchManga,
            mangaDetails,
        };
    }
}
