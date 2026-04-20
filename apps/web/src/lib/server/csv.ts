import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parse } from "csv-parse/sync";
import { createAppError } from "@/lib/errors/app-error";

const projectRoot = process.cwd();
const curatedDir = path.join(projectRoot, "..", "..", "data", "curated");
const dataRootDir = path.join(projectRoot, "..", "..", "data");

type CsvRow = Record<string, string>;
const missingCsvWarnings = new Set<string>();

const readCsvOptional = cache(async (directory: string, fileName: string) => {
  try {
    const content = await readFile(path.join(directory, fileName), "utf-8");
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const warningKey = `${directory}:${fileName}`;
      if (!missingCsvWarnings.has(warningKey)) {
        missingCsvWarnings.add(warningKey);
        console.warn(
          `[data-csv:missing] ${fileName} was not found in ${directory}. Falling back to empty data.`,
        );
      }

      return [];
    }

    throw error;
  }
});

const readCsvRequired = cache(async (directory: string, fileName: string) => {
  try {
    const content = await readFile(path.join(directory, fileName), "utf-8");
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw createAppError({
        kind: "internal",
        code: "service_unavailable",
        status: 503,
        message: `Required dataset ${fileName} is missing from ${directory}.`,
        userMessage: "Required product data is unavailable right now.",
        details: {
          directory,
          fileName,
        },
        exposeDetails: process.env.NODE_ENV !== "production",
        cause: error,
      });
    }

    throw error;
  }
});

export async function readCuratedCsv(fileName: string) {
  return readCsvRequired(curatedDir, fileName);
}

export async function readCuratedCsvOptional(fileName: string) {
  return readCsvOptional(curatedDir, fileName);
}

export async function readDataCsv(relativeDirectory: string, fileName: string) {
  return readCsvRequired(path.join(dataRootDir, relativeDirectory), fileName);
}

export async function readDataCsvOptional(relativeDirectory: string, fileName: string) {
  return readCsvOptional(path.join(dataRootDir, relativeDirectory), fileName);
}

export function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

export function parseBoolean(value: string | undefined) {
  return value === "true" || value === "True";
}
