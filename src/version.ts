import packageJson from "@app/../package.json" with { type: "json" };

export const APP_VERSION = packageJson.version;
