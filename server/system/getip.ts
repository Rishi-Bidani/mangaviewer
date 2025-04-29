import { createRequire } from "module";
const require = createRequire(import.meta.url);

export default function getIPAddresses() {
    const ipAddresses = [];

    const interfaces = require("os").networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal) {
                ipAddresses.push(alias.address);
            }
        }
    }
    return ipAddresses;
}
