import { mkdir, copyFile, cp } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("dist/", root), { recursive: true });
await copyFile(new URL("index.html", root), new URL("dist/index.html", root));
await cp(new URL("assets/", root), new URL("dist/assets/", root), {
  recursive: true,
});
console.log("Static app copied to dist. No framework or runtime dependencies.");
