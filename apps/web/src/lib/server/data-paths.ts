import path from "node:path";

export function isTestRun() {
  return process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test";
}

export function getRepoDataRoot() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "..", "data");
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
