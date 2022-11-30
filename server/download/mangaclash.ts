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
    searchManga: new URL("https://mangaclash.com/manga/?"),
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

    const mangaCards: Element[] = Array.from(dom.querySelectorAll(".manga"));
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
    const link: URL = MangaClashLinks.searchManga;
    link.searchParams.append("s", mangaName);
    link.searchParams.append("post_type", "wp-manga");
    console.log(link);
    const dom = new JSDOM(await (await fetch(link.toString())).text()).window.document;

    const mangaCards: Element[] = Array.from(dom.querySelectorAll(".row .c-tabs-item__content"));
    mangaCards.forEach((mangaCard: Element) => {
        const result = extractMangaCard(mangaCard);
        if (result) {
            results.push(result);
        }
    });
    return results;
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

async function getMangaDetails(mangaName: string, mangaLink: string): Promise<mangaDetails> {
    const link = new URL(mangaLink);
    const dom = new JSDOM(await (await fetch(link.toString())).text()).window.document;

    const summaryContent: string = dom
        .querySelector(".summary__content")
        ?.textContent?.trim() as string;

    const genres: string[] = [...dom.querySelectorAll(".genres-content a")].map(
        (genre) => genre.textContent
    ) as string[];

    const score: number = Number(dom.querySelector(".score")?.textContent ?? -1) as number;

    const chapterElements: HTMLAnchorElement[] = Array.from(
        dom.querySelectorAll(".wp-manga-chapter a")
    );
    const chapters: IChapterDetails[] = chapterElements.map((chapterElement) => {
        const name = (chapterElement.textContent as string).trim();
        const link = chapterElement.href;
        return { name, link: new URL(link) };
    });

    const image: string = (
        dom.querySelector(".summary_image img") as HTMLImageElement
    ).getAttribute("data-src") as string;

    const mangaDetails: mangaDetails = {
        mangaName,
        summary: summaryContent,
        genres,
        score,
        chapters,
        image,
    };
    return mangaDetails;
}

interface IMangaClash {
    getHotMangas: () => Promise<IManga[]>;
    searchManga: (mangaName: string) => Promise<IManga[]>;
    getMangaDetails: (mangaName: string, mangaLink: string) => Promise<mangaDetails>;
}

const mangaclash: IMangaClash = {
    getHotMangas: getHot,
    searchManga: searchManga,
    getMangaDetails: getMangaDetails,
};

export default mangaclash;

// TESTS
// mangaclash.getHotMangas().then((hotMangas) => {
//     console.log(hotMangas);
// });

// mangaclash.searchManga("naruto").then((mangas) => {
//     console.log(mangas);
// });
