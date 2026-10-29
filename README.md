# MangaViewer

MangaViewer is a sleek and customizable manga reading web app for your local collection. Designed for PC and mobile,
it lets you comfortably enjoy your downloaded manga with features tailored for a smooth and flexible reading experience.

## Features ✨

-   [x] Adjustable image width and alignment (left, center, right)
-   [x] Image brightness control
-   [x] Adjustable spacing between images
-   [x] Bookmarking albeit not persistent (localStorage)

Please check the TODO if you wish to contribute

## Note

This project doesn't support downloading manga. It is primarily designed for reading manga that you
have already downloaded. I have manga downloading projects however, they haven't been maintained for a while.

## Getting Started 🚀

### Docker (recommended)

1. Clone the repository:

```bash
git clone https://github.com/Rishi-Bidani/mangaviewer.git
cd mangaviewer
```

2. Copy `.env.example` to `.env` and edit it:

```bash
PORT=8080                                    # port to open the site on
MANGA_DIR=/mnt/manga                         # folder containing one sub-folder per manga
IGNORE_LIST=kenja no mago,mangadownloader    # comma separated folders to hide
```

3. Start it with `docker compose up -d` (add `--build` to build the image yourself instead of
   pulling it) and open `http://<server-ip>:<PORT>`.

> [!NOTE]
> `IGNORE_LIST` is split on commas, so a folder whose name contains a comma can't be ignored this
> way. Rename the folder, or move it out of `MANGA_DIR`.

### Standalone executable

Download the executable for your system from the
[releases page](https://github.com/Rishi-Bidani/mangaviewer/releases) (`mangaviewer-win-x64.exe`,
`mangaviewer-linux-x64`, `mangaviewer-darwin-arm64`, ...). It contains everything, Node.js included,
so nothing needs to be installed:

```bash
mangaviewer-win-x64.exe --dir "D:\manga" --port 8080 --ignore "kenja no mago,mangadownloader"
```

Without `--dir` it serves the folder it's started from, so you can also drop it into your manga
folder and double-click it. `--help` lists the options; the `BASE_MANGA_FOLDER`, `PORT` and
`IGNORE_LIST` environment variables work too.

On Linux and macOS, make it executable first with `chmod +x mangaviewer-*`. macOS blocks downloaded
apps that aren't notarized: allow it under System Settings → Privacy & Security, or run
`xattr -d com.apple.quarantine mangaviewer-darwin-*`.

To build them yourself, run `pnpm bundle` with Node.js 25.7+; the executables for every platform
end up in `release/`. Executables for macOS are only signed when built on a Mac, and Apple Silicon
Macs won't run unsigned ones (sign them with `codesign --sign - <file>`).

### Without Docker

1. Install Node.js 24+ and pnpm 12 (`npm install -g pnpm@12`, or `corepack enable`), then run
   `pnpm install` in the repository root.
2. Update `server/data/settings.json`:

```json
{
    "PORT": 8080,
    "BASE_MANGA_FOLDER": "D:\\manga",
    "IGNORE_LIST": ["kenja no mago"]
}
```

The `PORT`, `BASE_MANGA_FOLDER` and `IGNORE_LIST` (comma separated) environment variables override these.
To ignore a folder whose name contains a comma, list it in `settings.json` and don't set the
`IGNORE_LIST` variable.

> [!NOTE]
> In development (`pnpm dev`, or the "Mangaviewer (dev)" launch config), the Vite dev server
> always forwards `/api` and `/images` to port 8080. If you change `PORT`, also change the two
> `target` URLs in `client/vite.config.ts`. Production builds and Docker aren't affected.

3. Run it, from the repository root:

| Command | What it does |
|---|---|
| `pnpm build` | Builds the client into `client/dist` and the server into `server/dist` |
| `pnpm start` | Runs the built app |
| `pnpm dev` | Runs the server and the Vite dev server with live reload |
| `pnpm bundle` | Builds the standalone executables into `release/` (needs Node.js 25.7+) |
| `pnpm lint` / `pnpm format` | Lints / formats both packages |

## TODO

-   [ ] Add persistent bookmarks
-   [ ] Sync with MAL

## Screenshots 📸

![image](https://github.com/Rishi-Bidani/mangaviewer/assets/64310471/91866776-6928-4835-8464-30947f5719f1)
![image](https://github.com/user-attachments/assets/b4fcc4aa-8476-4fb4-81b9-59b02cb2f57e)


Feel free to fork, star ⭐, or contribute! Have ideas? Create an issue or PR!
