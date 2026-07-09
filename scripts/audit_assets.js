const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const assetsRoot = path.join(root, "apps", "web", "public", "assets");

const requiredPaths = [
  "drivers/2026/headshots",
  "drivers/2026/body",
  "drivers/2026/fallback/driver-placeholder.svg",
  "teams/2026/cars",
  "teams/2026/fallback/car-placeholder.svg",
  "teams/logos/dark",
  "teams/logos/light",
  "teams/logos/mono",
  "logos/product/dark/wordmark.svg",
  "logos/product/light/minimal.svg",
  "logos/product/icon/icon-light.svg",
];

function exists(relativePath) {
  return fs.existsSync(path.join(assetsRoot, relativePath));
}

function listFiles(relativePath, extension) {
  const directory = path.join(assetsRoot, relativePath);
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory).filter((file) => file.endsWith(extension)).sort();
}

const failures = [];

for (const requiredPath of requiredPaths) {
  if (!exists(requiredPath)) {
    failures.push(`Missing required asset path: ${requiredPath}`);
  }
}

const legacyTeamLogos = listFiles("teams/logos", ".svg");
for (const logo of legacyTeamLogos) {
  for (const theme of ["dark", "light", "mono"]) {
    const themedLogo = `teams/logos/${theme}/${logo}`;
    if (!exists(themedLogo)) {
      failures.push(`Missing ${theme} team logo variant: ${themedLogo}`);
    }
  }
}

const legacyCars = listFiles("teams/2026", ".webp");
for (const car of legacyCars) {
  const stagedCar = `teams/2026/cars/${car}`;
  if (!exists(stagedCar)) {
    failures.push(`Missing staged team car asset: ${stagedCar}`);
  }
}

const legacyDrivers = listFiles("drivers/2026", ".webp");
for (const driver of legacyDrivers) {
  const bodyImage = `drivers/2026/body/${driver}`;
  if (!exists(bodyImage)) {
    failures.push(`Missing driver body asset: ${bodyImage}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Asset audit passed: ${legacyDrivers.length} driver body images, ${legacyCars.length} cars, ${legacyTeamLogos.length} team logos.`);
