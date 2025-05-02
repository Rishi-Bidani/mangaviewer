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

1. Install Node.js, Yarn, and ensure the `make` command is available.
2. Clone the repository:

```bash
git clone https://github.com/Rishi-Bidani/mangaviewer.git
```

3. Update the settings.json file in ./server/data to point to your manga folder.

```json
{
    "BASE_MANGA_FOLDER": ["D:\\", "manga"], // The base folder where your manga is stored. The app will look for the manga in this folder.
    "IGNORE_LIST": ["kenja no mago"] // The list of (sub)folders to ignore.
}
```

4. `make build-exec` will run everything but maken sure to update `GLOBAL_EXECUTABLE_FOLDER` in the makefile.

## TODO

-   [ ] Add persistent bookmarks
-   [ ] Sync with MAL

## Screenshots 📸

![image](https://github.com/Rishi-Bidani/mangaviewer/assets/64310471/91866776-6928-4835-8464-30947f5719f1)
![image](https://github.com/user-attachments/assets/b4fcc4aa-8476-4fb4-81b9-59b02cb2f57e)


Feel free to fork, star ⭐, or contribute! Have ideas? Create an issue or PR!
