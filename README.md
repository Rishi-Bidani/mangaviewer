# MangaViewer

This application allows you to view your downloaded mangas using my custom manga viewer on PC which
allows several features such as changing he image widths, aligning the images to the left, right of centered,
It also allows you the change the brightness of the images, it works best for reducing the brightness when
you are in a dark room.

Furthermore, you can read the mangas on any device on the same network as the server. This is done by exposing the server to the network.

Please check the TODO if you wish to contribute

## Note

The downloading feature has been removed from the project, please use my other [Manga Downloader](https://github.com/Rishi-Bidani/go-manga-downloader) project to download the mangas.`

## Build the project yourself

1. Make sure you have nodejs, yarn and the make command installed
2. Clone the project
3. Edit the `settings.json` file in `./server/data` to point to the directory where you have downloaded your mangas
4. Run `make start` to build the project and start the server or `make build` to just build the project

## TODO

- [x] Convert the project to use vue and typescript
- [x] Fix UI for phone and smaller devices
- [x] Be able to view the mangas on the phone -> make it available on local network
- [ ] Open last read chapter when opening the manga
- [ ] Dockerise the project?

![image](https://user-images.githubusercontent.com/64310471/205026439-2c1f9054-4958-492c-8afd-106bf289b96f.png)
![image](https://user-images.githubusercontent.com/64310471/205026645-45b8407b-51df-4c94-ade5-c0aa7fc9f369.png)
