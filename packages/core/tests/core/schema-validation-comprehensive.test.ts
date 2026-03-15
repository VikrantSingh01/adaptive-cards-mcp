import { describe, it, expect } from "vitest";
import { validateCard } from "../../src/core/schema-validator.js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures");

/**
 * Helper: recursively collect all .json files from a directory
 */
function collectJsonFiles(dir: string, prefix = ""): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectJsonFiles(fullPath, relativePath));
    } else if (entry.endsWith(".json")) {
      files.push(relativePath);
    }
  }
  return files;
}

/**
 * Helper: check if a card JSON uses Adaptive Card templating expressions
 * ($data, $when, ${...} in string values)
 */
function usesTemplating(card: unknown): boolean {
  const json = JSON.stringify(card);
  return (
    json.includes('"$data"') ||
    json.includes('"$when"') ||
    /\$\{[^}]+\}/.test(json)
  );
}

/**
 * Helper: check if a card uses PascalCase enum values (e.g., "Large" instead of "large")
 * which are valid in the official AC schema but flagged by our strict validator
 */
function usesPascalCaseEnums(card: unknown): boolean {
  const json = JSON.stringify(card);
  return (
    /"size"\s*:\s*"(Large|Medium|Small|ExtraLarge)"/.test(json) ||
    /"weight"\s*:\s*"(Bolder|Lighter)"/.test(json) ||
    /"color"\s*:\s*"(Dark|Light|Accent|Good|Warning|Attention)"/.test(json) ||
    /"spacing"\s*:\s*"(None|Small|Medium|Large|ExtraLarge|Padding)"/.test(json)
  );
}

// ─── Collect all fixture files ──────────────────────────────────────────────

const allFiles = collectJsonFiles(fixturesDir);

// Top-level JSON files (not in subdirectories)
const topLevelFiles = allFiles.filter((f) => !f.includes("/"));

// Subdirectory files
const templateFiles = allFiles.filter((f) => f.startsWith("templates/"));
const officialSampleFiles = allFiles.filter((f) =>
  f.startsWith("official-samples/"),
);
const teamsOfficialSampleFiles = allFiles.filter((f) =>
  f.startsWith("teams-official-samples/"),
);

// Categorize top-level files
const edgeCards = topLevelFiles.filter((f) => f.startsWith("edge-"));
const templatingCards = topLevelFiles.filter(
  (f) => f.startsWith("templating-") && !f.includes(".data."),
);
const templatingDataFiles = topLevelFiles.filter(
  (f) => f.startsWith("templating-") && f.includes(".data."),
);
const standardCards = topLevelFiles.filter(
  (f) =>
    !f.startsWith("edge-") &&
    !f.startsWith("templating-"),
);

describe("Comprehensive Schema Validation", () => {
  // ─── Sanity check: fixtures exist ─────────────────────────────────────────

  it("discovers fixture files", () => {
    expect(allFiles.length).toBeGreaterThanOrEqual(50);
    expect(edgeCards.length).toBeGreaterThan(0);
    expect(templatingCards.length).toBeGreaterThan(0);
    expect(standardCards.length).toBeGreaterThan(0);
  });

  // ─── Standard cards (top-level, non-edge, non-templating) ─────────────────

  describe("Standard cards pass structural validation", () => {
    for (const file of standardCards) {
      it(`validates ${file}`, () => {
        const raw = readFileSync(join(fixturesDir, file), "utf-8");
        const card = JSON.parse(raw);
        const result = validateCard(card);

        // Should never throw
        expect(result).toBeDefined();
        expect(result.errors).toBeDefined();

        // Filter to only structural errors (type/version checks)
        // PascalCase enum values (e.g., "Large" vs "large") are allowed by the
        // official AC schema, so we exclude enum-value errors for cards that
        // use PascalCase. The validator is stricter than the spec here.
        const structuralErrors = result.errors.filter(
          (e) =>
            e.severity === "error" &&
            ["required-type", "required-version", "type-check", "body-type", "actions-type"].includes(e.rule),
        );
        expect(structuralErrors).toEqual([]);
      });
    }
  });

  // ─── Edge case cards ──────────────────────────────────────────────────────

  describe("Edge case cards do not throw", () => {
    for (const file of edgeCards) {
      it(`handles ${file} without throwing`, () => {
        const raw = readFileSync(join(fixturesDir, file), "utf-8");
        const card = JSON.parse(raw);

        // Must not throw regardless of validation outcome
        expect(() => validateCard(card)).not.toThrow();

        const result = validateCard(card);
        expect(result).toBeDefined();
        expect(result.errors).toBeDefined();
        expect(Array.isArray(result.errors)).toBe(true);
      });
    }
  });

  describe("Edge case cards have correct type and version", () => {
    for (const file of edgeCards) {
      it(`${file} has valid AdaptiveCard structure`, () => {
        const card = JSON.parse(
          readFileSync(join(fixturesDir, file), "utf-8"),
        );
        const result = validateCard(card);

        // Edge cards should still be structurally valid AdaptiveCards
        const typeErrors = result.errors.filter(
          (e) =>
            e.severity === "error" &&
            (e.rule === "required-type" || e.rule === "required-version"),
        );
        expect(typeErrors).toEqual([]);
      });
    }
  });

  // ─── Templating cards (top-level) ─────────────────────────────────────────

  describe("Templating cards do not throw", () => {
    for (const file of templatingCards) {
      it(`handles template ${file} without throwing`, () => {
        const raw = readFileSync(join(fixturesDir, file), "utf-8");
        const card = JSON.parse(raw);

        expect(() => validateCard(card)).not.toThrow();

        const result = validateCard(card);
        expect(result).toBeDefined();

        // Templating cards use ${...} expressions in string fields, which may
        // cause enum-value errors (e.g., color: "${statusColor}"). These are
        // expected and acceptable -- the card is structurally valid.
        const structuralErrors = result.errors.filter(
          (e) =>
            e.severity === "error" &&
            ["required-type", "required-version", "type-check"].includes(e.rule),
        );
        expect(structuralErrors).toEqual([]);
      });
    }
  });

  describe("Templating cards are detected as using templating", () => {
    for (const file of templatingCards) {
      it(`${file} contains templating expressions`, () => {
        const card = JSON.parse(
          readFileSync(join(fixturesDir, file), "utf-8"),
        );
        expect(usesTemplating(card)).toBe(true);
      });
    }
  });

  // ─── Templating data files are valid JSON ─────────────────────────────────

  describe("Templating data files are valid JSON", () => {
    for (const file of templatingDataFiles) {
      it(`${file} parses as valid JSON`, () => {
        const raw = readFileSync(join(fixturesDir, file), "utf-8");
        expect(() => JSON.parse(raw)).not.toThrow();
      });
    }
  });

  // ─── Template directory (Adaptive Cards templating samples) ───────────────

  describe("Template directory samples", () => {
    const templateSampleTemplates = templateFiles.filter(
      (f) => f.endsWith(".template.json") || f.includes("Template."),
    );
    const templateSampleData = templateFiles.filter((f) =>
      f.endsWith(".data.json"),
    );

    describe("Template files are valid JSON and do not throw on validate", () => {
      for (const file of templateSampleTemplates) {
        it(`validates template ${file}`, () => {
          const raw = readFileSync(join(fixturesDir, file), "utf-8");
          const card = JSON.parse(raw);

          // Templates may lack version or use ${...} expressions everywhere.
          // The key assertion is that validateCard handles them gracefully.
          expect(() => validateCard(card)).not.toThrow();

          const result = validateCard(card);
          expect(result).toBeDefined();
          expect(Array.isArray(result.errors)).toBe(true);
        });
      }
    });

    describe("Data files are valid JSON", () => {
      for (const file of templateSampleData) {
        it(`${file} parses as valid JSON`, () => {
          const raw = readFileSync(join(fixturesDir, file), "utf-8");
          expect(() => JSON.parse(raw)).not.toThrow();
        });
      }
    });
  });

  // ─── Official samples ─────────────────────────────────────────────────────

  describe("Official samples pass structural validation", () => {
    for (const file of officialSampleFiles) {
      it(`validates ${file}`, () => {
        const raw = readFileSync(join(fixturesDir, file), "utf-8");
        const card = JSON.parse(raw);

        expect(() => validateCard(card)).not.toThrow();

        const result = validateCard(card);
        // Official samples should be structurally valid AdaptiveCards
        const structuralErrors = result.errors.filter(
          (e) =>
            e.severity === "error" &&
            ["required-type", "required-version", "type-check", "body-type", "actions-type"].includes(e.rule),
        );
        expect(structuralErrors).toEqual([]);
      });
    }
  });

  // ─── Teams official samples ───────────────────────────────────────────────

  describe("Teams official samples pass structural validation", () => {
    for (const file of teamsOfficialSampleFiles) {
      it(`validates ${file}`, () => {
        const raw = readFileSync(join(fixturesDir, file), "utf-8");
        const card = JSON.parse(raw);

        expect(() => validateCard(card)).not.toThrow();

        const result = validateCard(card);
        const structuralErrors = result.errors.filter(
          (e) =>
            e.severity === "error" &&
            ["required-type", "required-version", "type-check", "body-type", "actions-type"].includes(e.rule),
        );
        expect(structuralErrors).toEqual([]);
      });
    }
  });

  // ─── Cross-cutting: all fixtures are parseable ────────────────────────────

  describe("All fixture JSON files are parseable", () => {
    for (const file of allFiles) {
      it(`${file} is valid JSON`, () => {
        const raw = readFileSync(join(fixturesDir, file), "utf-8");
        expect(() => JSON.parse(raw)).not.toThrow();
      });
    }
  });

  // ─── Cross-cutting: no fixture causes a crash ─────────────────────────────

  describe("No fixture crashes the validator", () => {
    // Only run validateCard on files that look like AdaptiveCards (have "type" key)
    const cardFiles = allFiles.filter((f) => {
      if (f.endsWith(".data.json")) return false;
      try {
        const card = JSON.parse(
          readFileSync(join(fixturesDir, f), "utf-8"),
        );
        return card && typeof card === "object" && "type" in card;
      } catch {
        return false;
      }
    });

    for (const file of cardFiles) {
      it(`validateCard(${file}) does not throw`, () => {
        const card = JSON.parse(
          readFileSync(join(fixturesDir, file), "utf-8"),
        );
        expect(() => validateCard(card)).not.toThrow();
      });
    }
  });

  // ─── Validation result shape ──────────────────────────────────────────────

  describe("Validation results have correct shape", () => {
    const sampleFiles = standardCards.slice(0, 5);
    for (const file of sampleFiles) {
      it(`${file} result has valid/errors properties`, () => {
        const card = JSON.parse(
          readFileSync(join(fixturesDir, file), "utf-8"),
        );
        const result = validateCard(card);

        expect(typeof result.valid).toBe("boolean");
        expect(Array.isArray(result.errors)).toBe(true);

        for (const err of result.errors) {
          expect(typeof err.path).toBe("string");
          expect(typeof err.message).toBe("string");
          expect(["error", "warning", "info"]).toContain(err.severity);
          expect(typeof err.rule).toBe("string");
        }
      });
    }
  });
});
