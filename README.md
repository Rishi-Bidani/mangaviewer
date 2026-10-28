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

### Without Docker

1. Install Node.js 24+ and Yarn.
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
> In development (`yarn dev` in `client/`, or the "Mangaviewer (dev)" launch config), the Vite dev
> server always forwards `/api` and `/images` to port 8080. If you change `PORT`, also change the
> two `target` URLs in `client/vite.config.ts`. Production builds and Docker aren't affected.

3. `./compile.sh` builds everything, make sure to update `GLOBAL_EXECUTABLE_FOLDER` in it first.

## TODO

-   [ ] Add persistent bookmarks
-   [ ] Sync with MAL

## Screenshots 📸

![image](https://github.com/Rishi-Bidani/mangaviewer/assets/64310471/91866776-6928-4835-8464-30947f5719f1)
![image](https://github.com/user-attachments/assets/b4fcc4aa-8476-4fb4-81b9-59b02cb2f57e)


Feel free to fork, star ⭐, or contribute! Have ideas? Create an issue or PR!
