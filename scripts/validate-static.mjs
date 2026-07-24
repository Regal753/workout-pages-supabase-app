import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "index.html",
  "app.js",
  "config.js",
  "styles.css",
  "sw.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "README.md",
];

for (const relative of required) {
  const info = await stat(path.join(root, relative));
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Required file is empty: ${relative}`);
  }
}

const html = await readFile(path.join(root, "index.html"), "utf8");
const localReferences = [
  ...html.matchAll(/\b(?:src|href)=["']([^"'#]+)["']/g),
]
  .map((match) => match[1])
  .filter((value) => !/^(?:https?:|data:|mailto:|tel:)/i.test(value))
  .map((value) => value.replace(/^\.\//, "").split(/[?#]/, 1)[0])
  .filter(Boolean);

for (const relative of new Set(localReferences)) {
  await stat(path.join(root, relative));
}

JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));

const config = await readFile(path.join(root, "config.js"), "utf8");
if (/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i.test(config)) {
  throw new Error("A Supabase service-role secret must never be shipped to the browser.");
}

const app = await readFile(path.join(root, "app.js"), "utf8");
if (!app.includes("serviceWorker.register('./sw.js')")) {
  throw new Error("The PWA service worker registration is missing.");
}

const readme = await readFile(path.join(root, "README.md"), "utf8");
if (!readme.includes("RLS")) {
  throw new Error("README must retain the Supabase RLS deployment warning.");
}

console.log(
  JSON.stringify({
    ok: true,
    requiredFiles: required.length,
    localReferences: new Set(localReferences).size,
  }),
);
