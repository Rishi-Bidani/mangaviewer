import { promises as fs } from "node:fs";

class JSONWriter {
    static async write(obj: unknown, filepath: string) {
        // Function to write a JSON file
        try {
            await fs.writeFile(filepath, JSON.stringify(obj, null, 4));
        } catch {
            console.error(`Error while writing to log file${filepath}${obj}`);
        }
    }

    static async writeToErroredImages(filepath: string, image: string) {
        // Function to write an image to the errored images file
        try {
            const data = await JSON.parse(await fs.readFile(filepath, "utf-8"));
            data.erroredImages.push(image);
            await JSONWriter.write(data, filepath);
        } catch {
            console.error(`Error while writing to log file${filepath}${image}`);
        }
    }

    static async read(filepath: string) {
        // Function to read a JSON file
        try {
            const data = await fs.readFile(filepath, "utf-8");
            return JSON.parse(data);
        } catch {
            console.error(`Error while reading log file${filepath}`);
        }
    }
}

export { JSONWriter };
