import { JSDOM } from "jsdom";
import fetch from "node-fetch";

interface IManga {
    name: string;
    link: URL;
    img: URL;
}

interface MangaClashLinks {
    hotMangas: URL;
    searchManga: URL;
}

const MangaClashLinks: MangaClashLinks = {
    hotMangas: new URL("https://mangaclash.com/manga/?m_orderby=views"),
    searchManga: new URL("https://mangaclash.com/manga/?s="),
};

function extractMangaCard(mangaCard: Element): IManga | undefined {
    const title = mangaCard.querySelector("a")?.title.trim();
    const link = mangaCard.querySelector("a")?.href;
    const img = mangaCard.querySelector("img")?.dataset.src;
    if (title && link && img) {
        const manga: IManga = {
            name: title,
            link: new URL(link),
            img: new URL(img),
        };
        return manga;
    }
}

async function getHot(): Promise<IManga[]> {
    const hotMangas: IManga[] = [];
    const link: string = MangaClashLinks.hotMangas.toString();
    const dom = new JSDOM(await (await fetch(link)).text()).window.document;

    // function getHotMangas(mangaCard: Element): IManga | undefined {
    //     const title = mangaCard.querySelector("a")?.title.trim();
    //     const link = mangaCard.querySelector("a")?.href;
    //     const img = mangaCard.querySelector("img")?.dataset.src;
    //     if (title && link && img) {
    //         const manga: IManga = {
    //             name: title,
    //             link: new URL(link),
    //             img: new URL(img),
    //         };
    //         return manga;
    //     }
    // }

    const mangaCards: Element[] = Array.from(dom.querySelectorAll(".manga"));
    console.log(mangaCards);
    mangaCards.forEach((mangaCard: Element) => {
        const hotManga = extractMangaCard(mangaCard);
        if (hotManga) {
            hotMangas.push(hotManga);
        }
    });
    return hotMangas;
}

async function searchManga(mangaName: string): Promise<IManga[]> {
    const results: IManga[] = [];
    const link: string = MangaClashLinks.searchManga.toString() + mangaName;
    const dom = new JSDOM(await (await fetch(link)).text()).window.document;

    const mangaCards: Element[] = Array.from(dom.querySelectorAll(".manga"));
    mangaCards.forEach((mangaCard: Element) => {
        const result = extractMangaCard(mangaCard);
        if (result) {
            results.push(result);
        }
    });
    return results;
}

interface MangaClash {
    getHotMangas: () => Promise<IManga[]>;
}

const mangaclash: MangaClash = {
    getHotMangas: getHot,
};

export default mangaclash;

// TESTS
mangaclash.getHotMangas().then((hotMangas) => {
    console.log(hotMangas);
});
