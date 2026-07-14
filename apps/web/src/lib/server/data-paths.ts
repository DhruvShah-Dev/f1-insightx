import path from "node:path";
import { existsSync } from "node:fs";

export function isTestRun() {
  return process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test";
}

export function getRepoDataRoot() {
  const configuredRoot = process.env.F1_INSIGHTX_DATA_ROOT;
  if (configuredRoot) {
    return path.resolve(/*turbopackIgnore: true*/ configuredRoot);
  }

  const cwd = process.cwd();
  const candidates = [
    path.join(/*turbopackIgnore: true*/ cwd, "data"),
    path.join(/*turbopackIgnore: true*/ cwd, "..", "..", "data"),
    path.join(/*turbopackIgnore: true*/ cwd, "..", "data"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1];
}

export function getRepoDataPath(...segments: string[]) {
  return path.join(/*turbopackIgnore: true*/ getRepoDataRoot(), ...segments);
}

export function getTestFixtureRoot() {
  const configuredTestRoot = process.env.F1_INSIGHTX_TEST_DATA_ROOT;
  return configuredTestRoot
    ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), configuredTestRoot)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "test-fixtures", "data");
}

export function getTestFixturePath(...segments: string[]) {
  return path.join(getTestFixtureRoot(), ...segments);
}
