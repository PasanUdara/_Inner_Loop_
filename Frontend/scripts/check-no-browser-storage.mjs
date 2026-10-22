import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const forbiddenPatterns = [
  ["local" + "Storage", /\blocalStorage\b/],
  ["session" + "Storage", /\bsessionStorage\b/],
  ["indexed" + "DB", /\bindexedDB\b/],
  ["Cache " + "Storage", /\bcaches\.(?:open|match|keys|delete)\b/],
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".js", ".jsx"].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const file of await sourceFiles(sourceRoot)) {
  const contents = await readFile(file, "utf8");
  for (const [name, pattern] of forbiddenPatterns) {
    if (pattern.test(contents)) {
      violations.push(`${relative(sourceRoot, file)} uses ${name}`);
    }
  }
}

if (violations.length) {
  console.error("Browser-side persistence is not allowed in InnerLoop source files:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Browser-side persistence check passed.");
}
