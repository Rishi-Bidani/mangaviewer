import * as path from "node:path";
import express from "express";
import { orderBy } from "natural-orderby";
import { z } from "zod";
import { readEpubPage } from "./system/epub.ts";
import { BadRequestError, NotFoundError } from "./system/errors.ts";
import {
    finishSignIn,
    getExtensionFile,
    getExtensionInfo,
    getExtensionName,
    getMetadataSourceIds,
    getSignInUrl,
    listExtensions,
    setActiveMetadataSource,
    setExtensionSettings,
    setSyncEnabled,
    signOut,
} from "./system/extensions.ts";
import FileHandler from "./system/filesystem.ts";
import {
    getAllMetadata,
    getCover,
    getMetadata,
    parseMatchId,
    searchMetadataSource,
} from "./system/metadata.ts";
import { getPreferences, setMangaPreferences } from "./system/preferences.ts";
import { getSyncStatus, reportChapterFinished, retrySync } from "./system/sync.ts";

const INVALID_MATCH = "match must have a known source and a valid id";
const INVALID_SETTINGS = "Settings must be strings or null";

const preferencesBody = z
    .object({
        showCover: z.boolean({ error: "showCover must be true or false" }).optional(),
        // null removes it
        match: z
            .object(
                {
                    source: z.string({ error: INVALID_MATCH }),
                    id: z.string({ error: INVALID_MATCH }),
                },
                { error: INVALID_MATCH }
            )
            .nullable()
            .optional(),
    })
    .refine(({ showCover, match }) => showCover !== undefined || match !== undefined, {
        error: "Nothing to change, set showCover and/or match",
    });
const metadataSourceBody = z.object({ id: z.string({ error: "Set the source's id" }) });
const settingsBody = z.record(z.string(), z.string({ error: INVALID_SETTINGS }).nullable(), {
    error: INVALID_SETTINGS,
});
const syncBody = z.object({ enabled: z.boolean({ error: "enabled must be true or false" }) });
const progressBody = z.object({
    chapter: z.string({ error: "Set the chapter that was finished" }),
});

/**
 * @returns the request's body if it's what the schema expects
 * @throws BadRequestError saying what's wrong otherwise
 */
function readBody<T>(
    schema: z.ZodType<T>,
    req: { body?: unknown; method: string; originalUrl: string }
): T {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
        // every issue for the console, the first one for the browser
        console.warn(
            `Invalid body for ${req.method} ${req.originalUrl}:\n${z.prettifyError(result.error)}`
        );
        throw new BadRequestError(result.error.issues[0].message);
    }
    return result.data;
}

const router = express.Router();
router.use(express.json());

router.get("/mangas", async (_req, res) => {
    res.json(await FileHandler.getMangaList());
});

router.get("/mangas/:manga/chapters", async (req, res) => {
    res.json(orderBy(await FileHandler.getChapterList(req.params.manga)));
});

router.get("/mangas/:manga/chapters/:chapter/images", async (req, res) => {
    // the urls of all the images of the chapter, in reading order
    const { manga, chapter } = req.params;
    const found = await FileHandler.getChapter(manga, chapter);
    const [mangaUrl, chapterUrl] = [manga, chapter].map(encodeURIComponent);
    const images =
        found.type === "folder"
            ? found.images.map(
                  (image) => `/images/${mangaUrl}/${chapterUrl}/${encodeURIComponent(image)}`
              )
            : found.pages.map(
                  (_page, index) => `/api/mangas/${mangaUrl}/chapters/${chapterUrl}/pages/${index}`
              );
    res.json(images);
});

router.get("/mangas/:manga/chapters/:chapter/pages/:page", async (req, res) => {
    // a page of an epub chapter, numbered from 0
    const { manga, chapter, page } = req.params;
    const found = await FileHandler.getChapter(manga, chapter);
    const epubPage =
        found.type === "epub" && /^\d+$/.test(page) ? found.pages[Number(page)] : undefined;
    if (found.type !== "epub" || !epubPage) {
        throw new NotFoundError(`${manga}/${chapter} has no page ${page}`);
    }
    res.type(epubPage.mediaType).send(await readEpubPage(found.file, epubPage));
});

router.get("/mangas/:manga/cover", async (req, res) => {
    const cover = await getCover(req.params.manga);
    if (!cover) {
        throw new NotFoundError("No cover");
    }
    if ("data" in cover) {
        res.type(cover.mediaType).send(cover.data);
    } else {
        // the cache folder can be a hidden one (.mangaviewer in the standalone executables)
        res.sendFile(cover.file, { dotfiles: "allow" });
    }
});

// ---- metadata ----

router.get("/metadata", async (_req, res) => {
    // the metadata of all mangas, keyed by manga name
    res.json(await getAllMetadata());
});

router.post("/metadata/refresh", async (_req, res) => {
    // looks every manga up again, returns the same as GET /metadata
    res.json(await getAllMetadata(true));
});

router.get("/mangas/:manga/metadata", async (req, res) => {
    res.json(await getMetadata(req.params.manga));
});

router.post("/mangas/:manga/metadata/refresh", async (req, res) => {
    // looks the manga up again, ignoring what's cached; the result has lookup "pending" unless
    // lookups are off ("disabled") or the name is too short ("skipped")
    res.json(await getMetadata(req.params.manga, true, "interactive"));
});

router.get("/metadata-sources", (_req, res) => {
    // every source a title can be matched to, the one titles are looked up on first
    res.json(getMetadataSourceIds().map((id) => ({ id, name: getExtensionName(id) })));
});

router.put("/metadata-source", (req, res) => {
    // chooses the source titles are looked up on
    setActiveMetadataSource(readBody(metadataSourceBody, req).id);
    res.json(listExtensions());
});

router.get("/metadata-sources/:source/search", async (req, res) => {
    const term = req.query.q;
    if (typeof term !== "string" || term.trim() === "") {
        throw new BadRequestError("Set what to search for with ?q=");
    }
    try {
        res.json(await searchMetadataSource(req.params.source, term.trim()));
    } catch (error) {
        if (error instanceof NotFoundError) throw error;
        console.warn(`Searching "${req.params.source}" failed: ${(error as Error).message}`);
        res.status(502).json({ error: "The metadata source couldn't be searched" });
    }
});

// ---- preferences ----

router.get("/preferences", (_req, res) => {
    // the display preferences of every manga that has any, keyed by manga name
    res.json(getPreferences());
});

router.patch("/mangas/:manga/preferences", async (req, res) => {
    // only the given preferences change
    const { showCover, match } = readBody(preferencesBody, req);
    // match.id can also be what was pasted in, usually a link to the manga
    const id = match ? parseMatchId(match.source, match.id) : undefined;
    if (match && id === undefined) {
        throw new BadRequestError(INVALID_MATCH);
    }
    res.json(
        await setMangaPreferences(req.params.manga, {
            showCover,
            match: match && { source: match.source, id: id as string },
        })
    );
});

// ---- reading progress ----

router.post("/mangas/:manga/progress", async (req, res) => {
    // a chapter was read to its end; returns the same as GET /mangas/:manga/sync
    const { chapter } = readBody(progressBody, req);
    res.json(await reportChapterFinished(req.params.manga, chapter));
});

router.get("/mangas/:manga/sync", async (req, res) => {
    // how far the manga is synced to each sync target that's switched on
    await FileHandler.getMangaFolder(req.params.manga);
    res.json(getSyncStatus(req.params.manga));
});

// ---- extensions ----

router.get("/extensions", (_req, res) => {
    // every extension and its settings; the values of secret settings are never included
    res.json(listExtensions());
});

router.patch("/extensions/:id/settings", (req, res) => {
    // only the given settings change, null removes one
    res.json(setExtensionSettings(req.params.id, readBody(settingsBody, req)));
});

router.patch("/extensions/:id/sync", (req, res) => {
    const extension = setSyncEnabled(req.params.id, readBody(syncBody, req).enabled);
    retrySync();
    res.json(extension);
});

router.post("/extensions/:id/sign-in", (req, res) => {
    // where to send the browser to sign in; the site sends it back to the callback below
    res.json({ url: getSignInUrl(req.params.id) });
});

router.delete("/extensions/:id/sign-in", async (req, res) => {
    await signOut(req.params.id);
    res.json(getExtensionInfo(req.params.id));
});

router.get("/extensions/:id/callback", async (req, res) => {
    // opened by the browser coming back from signing in, so it ends on the settings page
    const { id } = req.params;
    const query = Object.fromEntries(
        Object.entries(req.query).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
        )
    );
    try {
        await finishSignIn(id, query);
        retrySync();
        res.redirect(`/#/settings?signedIn=${encodeURIComponent(id)}`);
    } catch (error) {
        if (error instanceof NotFoundError) throw error;
        const message = (error as Error).message;
        console.warn(`Signing in to "${id}" failed: ${message}`);
        res.redirect(`/#/settings?signInError=${encodeURIComponent(message)}`);
    }
});

router.get("/extensions/:id/file", (req, res) => {
    const file = getExtensionFile(req.params.id);
    if (!file) {
        throw new NotFoundError(`"${req.params.id}" has no file`);
    }
    // the folder can be a hidden one (.mangaviewer in the standalone executables)
    res.download(file, path.basename(file), { dotfiles: "allow" });
});

// ---- errors ----

router.use(
    (
        error: Error & { status?: number; type?: string; code?: string },
        _req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        // the answer already started (e.g. a download that broke off), so express closes it
        if (res.headersSent) {
            next(error);
        } else if (error instanceof BadRequestError) {
            res.status(400).json({ error: error.message });
        } else if (
            error instanceof NotFoundError ||
            error.status === 404 ||
            error.code === "ENOENT" ||
            error.code === "ENOTDIR"
        ) {
            // a file or folder that disappeared while it was being read
            res.status(404).json({ error: "Not found" });
        } else if (error.type === "entity.parse.failed") {
            // malformed json body, from express.json()
            res.status(400).json({ error: "Invalid JSON" });
        } else {
            console.error(error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

export default router;
