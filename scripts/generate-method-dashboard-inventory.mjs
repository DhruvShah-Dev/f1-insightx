import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataRoot = path.join(root, "data");
const outputPath = path.join(root, "src", "data", "method-dashboard-inventory.ts");
const skippedTopLevelDirs = new Set(["raw", "staged", "ml"]);

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativeParts = path.relative(dataRoot, fullPath).split(path.sep);

    if (entry.isDirectory()) {
      if (relativeParts.length === 1 && skippedTopLevelDirs.has(entry.name)) {
        continue;
      }

      walk(fullPath, output);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".csv")) {
      output.push(fullPath);
    }
  }

  return output;
}

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(value);
      value = "";
      continue;
    }

    value += char;
  }

  fields.push(value);
  return fields;
}

function normalizePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

const inventory = walk(dataRoot)
  .sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)))
  .map((filePath) => {
    const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/);

    while (lines.length > 0 && lines.at(-1) === "") {
      lines.pop();
    }

    const relativePath = normalizePath(filePath);
    const [, category = "data"] = relativePath.split("/");

    return {
      path: relativePath,
      category,
      table: path.basename(filePath, ".csv"),
      rows: Math.max(0, lines.length - 1),
      columns: lines.length > 0 ? parseCsvLine(lines[0]).length : 0,
      header: lines.length > 0 ? parseCsvLine(lines[0]) : [],
    };
  });

const source = `// Generated compact inventory for the Methods data trust dashboard.
// Source: committed CSV files under data/, excluding raw/staged/schema-template artifacts.

export type MethodDashboardInventoryFile = {
  path: string;
  category: string;
  table: string;
  rows: number;
  columns: number;
  header: string[];
};

export const methodDashboardInventory = ${JSON.stringify(
  inventory,
  null,
  2,
)} satisfies MethodDashboardInventoryFile[];
`;

fs.writeFileSync(outputPath, source);

console.log(
  JSON.stringify({
    files: inventory.length,
    rows: inventory.reduce((total, file) => total + file.rows, 0),
    output: normalizePath(outputPath),
  }),
);
