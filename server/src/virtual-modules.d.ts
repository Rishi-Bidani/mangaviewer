// generated at bundle time by the plugins in tsdown.config.ts

declare module "virtual:client-assets" {
    const assets: Map<string, Buffer>;
    export default assets;
}

declare module "virtual:migrations" {
    // server/drizzle
    const migrations: { name: string; sql: string }[];
    export default migrations;
}
