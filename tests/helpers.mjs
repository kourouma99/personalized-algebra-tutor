/*
  helpers.mjs — shared by every test file.

  ROOT: the project folder (tests/ is one level below it).
  RUNS: how many random scenarios the logic tests try. Default 400, so `npm test`
        stays fast. Set TEST_RUNS for a deeper check, e.g. TEST_RUNS=3000 npm test.
*/
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export const RUNS = Number(process.env.TEST_RUNS) || 400;

// Import a project file by its path from the project root, e.g. load("js/main.js")
export const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
