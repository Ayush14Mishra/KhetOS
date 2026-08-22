import fs from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url);
const vinext = new URL("node_modules/.bin/vinext", root);
const vinextWin = new URL("node_modules/.bin/vinext.cmd", root);

if (fs.existsSync(vinext) || fs.existsSync(vinextWin)) {
  console.log("Dependencies ready: vinext is installed.");
  process.exit(0);
}

console.log("vinext is not installed. Installing the locked npm dependencies before build...");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["ci"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  shell: false,
});
if (result.error) {
  console.error(`Could not start npm ci: ${result.error.message}`);
  process.exit(69);
}
if (result.status !== 0) process.exit(result.status ?? 1);

if (!fs.existsSync(vinext) && !fs.existsSync(vinextWin)) {
  console.error("npm ci completed but vinext is still unavailable.");
  process.exit(69);
}
console.log("Dependencies installed successfully.");
