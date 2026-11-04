# Extensions

Extensions add to the server in TypeScript. One can do either or both of these:

- A **metadata source** supplies the covers and details for your manga. One is in use at a time.
- A **sync target** saves your reading progress somewhere. Any number can be on at once.

The built-in ones use this same API (`server/src/extensions`):

| Extension | Metadata source | Sync target |
|---|---|---|
| AniList | Yes, the default | No |
| MyAnimeList | Yes | Your list |
| Excel spreadsheet | No | A file with a row per manga |

> [!WARNING]
> There is no sandbox: an extension you add can do anything the server can, including reading your files.
> Only run code you trust. There's deliberately no way to install one from the browser, since the
> server has no login and that would let anyone on your network run code on it.

## Installing one

1. Put the file in the extensions folder as `<id>.ts`, or as `<id>/index.ts` if it has several
   files.

    | Running as | Extensions folder |
    |---|---|
    | From source | `server/data/extensions` |
    | Docker | `EXTENSIONS_DIR` from `.env`, by default `./extensions` next to `docker-compose.yml` |
    | Standalone executable | `.mangaviewer/extensions` in the manga folder |
    | Anywhere | Whatever `EXTENSIONS_FOLDER` is set to (Docker: `EXTENSIONS_DIR` instead) |

2. Enable it with `ENABLED_EXTENSIONS=<id>` (or `--extensions <id>` on the standalone executable),
   in `server/.env` or the `.env` next to the executable). Nothing in the folder runs until then.
3. Restart the server. The startup log and the settings page show what loaded, and why anything
   didn't. A broken extension is skipped, it doesn't stop the server.

## Choosing a metadata source

Lookups need `FETCH_METADATA` turned on. Titles are looked up on the source picked on the settings
page, by default the first enabled extension that is a source, otherwise AniList. Only that source is
contacted.

To use another source for one title, open its 🔗 match dialog on the settings page and pick the
source there. Changing the source looks titles up again the next time they're requested, except
those with a match set by hand, which stay on the source they were matched to.

## Syncing progress

Switch sync targets on on the settings page; all of them start off. Scrolling to the end of a chapter
counts as having read it, once all its images have loaded.

- The chapter number comes from the chapter's folder name, e.g. `Vol.3 Ch.25` is 25. When none of a
  manga's chapters have a number their position is used. A chapter without a number among ones that
  do, like an extra, isn't sent.
- Progress only goes up: reading an earlier chapter again changes nothing.
- What can't be sent yet is kept and tried again every 5 minutes, also after a restart. The manga's
  info page shows where each target is up to, and why if it's stuck.
- Only chapters finished while a target is on are sent, earlier reading isn't added afterwards.

### MyAnimeList

1. Create an API client at [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig), with app
   type *Other*. Register exactly one redirect URL, the one the settings page shows under
   MyAnimeList, which looks like `http://localhost:8080/api/extensions/myanimelist/callback`.
2. Save the client ID on the settings page, sign in and switch syncing on. Using MyAnimeList as a
   metadata source only needs the client ID, not the sign in.

Since this changes your real list, it's careful about what it touches:

- A title only syncs once its match is confirmed, because a search by folder name can find the wrong
  manga. Confirm it with one click on the info page, set it with the 🔗 match dialog, or set `match`
  or `ids` in its `metadata.json`.
- The title needs a MyAnimeList id, which AniList usually knows. If it doesn't, match the title on
  MyAnimeList itself.
- It checks your list first and never lowers the chapter count, in case you read further elsewhere.
- A title not on your list is added as *Reading*, *Plan to read* becomes *Reading*, and a finished
  series becomes *Completed* at its last chapter. Other statuses are left alone.

The sign in is stored as plain text in the database in the metadata folder. Anyone on your network can sign the server
out or in to another account, since the server has no login, but they can't read the sign in itself.

### Excel spreadsheet

Keeps `progress.xlsx`, with the manga, chapter number, chapter name and time for each manga. Get it
with the Download button on the settings page, or from `extensions/excel` in the metadata folder.

The file is written from scratch each time, so changes you make in it don't last; keep them in a
copy. While it's open in Excel it can't be replaced, so updates wait until you close it.

Where it's kept can't be changed from the settings page on purpose, since anyone on your network
could then have the server overwrite any file it can write to.

## Writing a source

[`extensions/mangadex.ts`](extensions/mangadex.ts) is a complete example. The smallest possible
source looks like this:

```ts
import type { IExtension } from "./api.ts";

export default {
    id: "my-source", // has to match the file name
    name: "My Source",
    apiVersion: 1,
    setup(context) {
        context.provideMetadata({
            async search(title) {
                return [{ id: "42", title: "Some Manga" }];
            },
            async fetch(id) {
                return { id, title: "Some Manga", genres: ["Action"], coverUrl: "https://..." };
            },
        });
    },
} satisfies IExtension;
```

For autocomplete and type checking, copy
[`server/src/extensions/api.ts`](../server/src/extensions/api.ts) next to your extension. It documents
every field and has no dependencies. `import type` is removed when the file is loaded, so nothing
breaks if the file isn't there at runtime.

The server takes care of caching, retries, downloading covers, `metadata.json` overrides and waiting
`minRequestIntervalMs` between calls, so a source only has to answer `search` and `fetch`. Fields
with the wrong type are dropped, as are links and covers that aren't `http(s)` urls.

- `match(title)` is optional and finds the best match in one call. Without it the first `search`
  result is fetched, which takes two.
- `parseId(input)` is optional and turns a pasted link into an id. Without it the pasted text is used
  as the id.
- Throw when something goes wrong and return `null` when the source doesn't have the manga. A thrown
  error is retried later, and what was found before stays in place until then.
- `ids` says what the manga is called on other sites, e.g. `{ anilist: "105398" }`.

### Settings

Declare settings, such as an API key, and they appear on the settings page:

```ts
export default {
    id: "my-source",
    name: "My Source",
    apiVersion: 1,
    settings: [{ key: "apiKey", label: "API key", secret: true }],
    setup(context) {
        const headers = () => ({ Authorization: `Bearer ${context.getSetting("apiKey")}` });
        // ...
    },
} satisfies IExtension;
```

Read a setting when it's needed, since it can change while the server runs. Secret settings are
never sent back to the browser, but they are stored as plain text in the database in the metadata
folder. Anyone on your network can overwrite a setting, since the server has no login.

### Keeping data

`context.store` keeps small values in the server's database, separately for every extension. The values
can be anything JSON can hold, and its calls finish straight away, so they don't need an `await`:

```ts
const token = context.store.get<IToken>("token");
context.store.set("token", newToken);
context.store.delete("token");
const everything = context.store.all<IToken>();
```

`context.storageFolder` is a folder of your extension's own, for actual files.
`context.writeFile(name, data)` writes one there without ever leaving it half written, even if the
server stops in the middle.

## Writing a sync target

```ts
import type { IExtension } from "./api.ts";

export default {
    id: "my-tracker", // has to match the file name
    name: "My Tracker",
    apiVersion: 1,
    setup(context) {
        context.provideSync({
            async save(progress) {
                const id = progress.ids["my-tracker"];
                if (!id) {
                    return { skipped: "Link this title to an entry first" };
                }
                // ...send progress.chapterNumber to the site
            },
        });
    },
} satisfies IExtension;
```

The server decides what to send and when, so `save` only gets a higher chapter than it last saved,
one call at a time, and is called again later after it throws or returns `{ skipped }`. It can't see
progress made elsewhere, so check first if the site's value shouldn't be lowered. If what it changes
matters, respect `progress.matchConfirmed`, which is false when the ids came from a search by name.

- `account` adds sign in and sign out buttons, for sites that use OAuth. The site has to send the
  browser back to `/api/extensions/<id>/callback`, see `server/src/extensions/myanimelist.ts`.
- `getFile()` adds a download button for a file it keeps.
- An extension can call both `provideMetadata` and `provideSync`, and they share one rate limit.

### What Node.js allows

Extensions run with Node.js' built-in TypeScript support, which removes the types without
compiling anything, with no build step. Two things follow from that:

- **Only erasable syntax:** no `enum`, `namespace` or constructor parameter properties. Setting
  `erasableSyntaxOnly` in your `tsconfig.json` will flag these in your editor.
- **No top-level `await`:** do that kind of work in `setup`, which can be `async` (it gets 30
  seconds).

Extensions can't import the server's code, only Node.js' built-in modules and their own files
(using the full name, like `./helper.ts`). A `.ts` file inside `node_modules` isn't supported by
Node.js, so a dependency has to be plain JavaScript in a `node_modules` folder next to the extension.

Each call to an extension can take up to 3 minutes before it's given up on. Calls get an `AbortSignal`
as their last argument, which is aborted at that point: pass it on to `fetch` so the call really stops.
One that ignores it gets 30 more seconds before the next call starts anyway, so it could then overlap
with that one.
