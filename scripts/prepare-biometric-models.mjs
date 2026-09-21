import fs from "node:fs/promises";
import path from "node:path";

const source = path.join(process.cwd(), "node_modules", "@vladmandic", "human", "models");
const target = path.join(process.cwd(), "public", "biometric-models");
const browserBundle = path.join(process.cwd(), "node_modules", "@vladmandic", "human", "dist", "human.js");
const browserBundleTarget = path.join(process.cwd(), "public", "biometric-human.js");

try {
  await fs.access(source);
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
  await fs.copyFile(browserBundle, browserBundleTarget);
  console.log("Biometric browser bundle and models prepared in public/.");
} catch (error) {
  console.warn("Biometric models were not copied:", error instanceof Error ? error.message : error);
}
