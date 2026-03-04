/**
 * One-time script to parse the Pathfinder feats CSV and generate a static TypeScript file.
 * This script reads feats/feats_with_books_and_categories.csv, parses prerequisites using
 * the prerequisiteParser, and outputs src/db/seeders/featData.ts with static feat data.
 *
 * Run with: npx tsx scripts/generateFeatData.ts
 */

import { parse } from "csv-parse";
import { createReadStream } from "fs";
import { writeFile } from "fs/promises";
import {
  parsePrerequisites,
  type ParsedPrerequisite,
} from "../src/services/feats/prerequisiteParser.js";

/** CSV row structure */
type CsvRow = {
  URI: string;
  Name: string;
  Prerequisites: string;
  "Short Description": string;
  long_description: string;
  Books: string;
  Category: string;
};

/** Output feat data structure */
type FeatData = {
  name: string;
  prerequisitesText: string | null;
  shortDescription: string;
  longDescription: string | null;
  sourceBook: string | null;
  category: string;
  supportabilityStatus: "supported" | "unsupported" | "partially_supported";
  effectType: string | null;
  prerequisites: ParsedPrerequisite[];
};

/**
 * Parse the CSV file and return all rows.
 * @param filePath - Path to the CSV file
 * @returns Promise resolving to array of CSV rows
 */
async function parseCsv(filePath: string): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];

  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    createReadStream(filePath)
      .pipe(parser)
      .on("data", (row: CsvRow) => {
        rows.push(row);
      })
      .on("end", () => {
        resolve(rows);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Clean and normalize text from CSV.
 * @param text - Raw text from CSV
 * @returns Cleaned text or null if empty
 */
function cleanText(text: string | undefined): string | null {
  if (!text) return null;
  // Remove excessive whitespace and normalize line breaks
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

/**
 * Escape a string for use in TypeScript source code.
 * @param str - String to escape
 * @returns Escaped string safe for template literals
 */
function escapeForTemplate(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

async function main() {
  console.log("🔍 Parsing CSV file...\n");

  const csvPath = "feats/feats_with_books_and_categories.csv";
  const rows = await parseCsv(csvPath);

  console.log(`  Found ${rows.length} feats in CSV\n`);

  // First pass: collect all feat names for prerequisite matching
  console.log("📋 Collecting feat names for prerequisite matching...\n");
  const knownFeatNames = new Set<string>();
  for (const row of rows) {
    if (row.Name) {
      knownFeatNames.add(row.Name.trim());
    }
  }
  console.log(`  Collected ${knownFeatNames.size} unique feat names\n`);

  // Second pass: parse prerequisites with known feat names
  console.log("⚙️  Parsing prerequisites...\n");
  const featData: FeatData[] = [];
  let supportedCount = 0;
  let unsupportedCount = 0;
  let partialCount = 0;

  for (const row of rows) {
    const name = row.Name?.trim();
    if (!name) continue;

    const prerequisitesText = cleanText(row.Prerequisites);
    const parseResult = parsePrerequisites(
      prerequisitesText || "",
      knownFeatNames,
    );

    const feat: FeatData = {
      name,
      prerequisitesText,
      shortDescription: cleanText(row["Short Description"]) || name,
      longDescription: cleanText(row.long_description),
      sourceBook: cleanText(row.Books),
      category: cleanText(row.Category) || "Untyped",
      supportabilityStatus: parseResult.supportability,
      effectType: null, // Will be set for starter feats in task 4.2
      prerequisites: parseResult.prerequisites,
    };

    featData.push(feat);

    // Track supportability stats
    switch (parseResult.supportability) {
      case "supported":
        supportedCount++;
        break;
      case "unsupported":
        unsupportedCount++;
        break;
      case "partially_supported":
        partialCount++;
        break;
    }
  }

  console.log("  Supportability breakdown:");
  console.log(`    - Supported: ${supportedCount}`);
  console.log(`    - Unsupported: ${unsupportedCount}`);
  console.log(`    - Partially supported: ${partialCount}\n`);

  // Generate the TypeScript file
  console.log("📝 Generating featData.ts...\n");

  const output = generateTypeScriptFile(featData);
  const outputPath = "src/db/seeders/featData.ts";

  await writeFile(outputPath, output, "utf-8");

  console.log(`  ✅ Generated ${outputPath}`);
  console.log(`     Contains ${featData.length} feats\n`);
}

/**
 * Generate the TypeScript file content.
 * @param feats - Array of feat data
 * @returns TypeScript source code
 */
function generateTypeScriptFile(feats: FeatData[]): string {
  const lines: string[] = [
    "/**",
    " * Auto-generated feat data from Pathfinder CSV.",
    " * Generated by: npx tsx scripts/generateFeatData.ts",
    " * DO NOT EDIT MANUALLY - regenerate from CSV instead.",
    " */",
    "",
    'import type { ParsedPrerequisite } from "../../services/feats/prerequisiteParser.js";',
    "",
    "/** Feat data structure for seeding */",
    "export type FeatSeedData = {",
    "  name: string;",
    "  prerequisitesText: string | null;",
    "  shortDescription: string;",
    "  longDescription: string | null;",
    "  sourceBook: string | null;",
    "  category: string;",
    '  supportabilityStatus: "supported" | "unsupported" | "partially_supported";',
    "  effectType: string | null;",
    "  prerequisites: ParsedPrerequisite[];",
    "};",
    "",
    "/** All feats parsed from the CSV */",
    "export const FEAT_DATA: FeatSeedData[] = [",
  ];

  for (const feat of feats) {
    lines.push("  {");
    lines.push(`    name: ${JSON.stringify(feat.name)},`);
    lines.push(
      `    prerequisitesText: ${JSON.stringify(feat.prerequisitesText)},`,
    );
    lines.push(
      `    shortDescription: ${JSON.stringify(feat.shortDescription)},`,
    );
    lines.push(`    longDescription: ${JSON.stringify(feat.longDescription)},`);
    lines.push(`    sourceBook: ${JSON.stringify(feat.sourceBook)},`);
    lines.push(`    category: ${JSON.stringify(feat.category)},`);
    lines.push(
      `    supportabilityStatus: ${JSON.stringify(feat.supportabilityStatus)},`,
    );
    lines.push(`    effectType: ${JSON.stringify(feat.effectType)},`);
    lines.push(`    prerequisites: ${JSON.stringify(feat.prerequisites)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");

  return lines.join("\n");
}

main().catch((error) => {
  console.error("❌ Generation failed:", error);
  process.exit(1);
});
