/**
 * Schema Validator — Validates Adaptive Card JSON against the official v1.6
 * JSON Schema using ajv, with supplementary best-practice checks.
 */

import Ajv, { type ErrorObject } from "ajv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ValidationError } from "../types/index.js";

// ─── Load & prepare the official Adaptive Card v1.6 JSON Schema ─────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "..", "data", "schema.json");
const rawSchema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

// The official schema declares "id" (draft-04 style) but uses "$schema" draft-06.
// Ajv v8 expects "$id". Normalise so ajv can resolve internal $ref pointers.
if (rawSchema.id && !rawSchema.$id) {
  rawSchema.$id = rawSchema.id;
  delete rawSchema.id;
}
// Remove $schema meta-schema reference — ajv v8 doesn't ship draft-06 meta-schema
// and we don't need meta-validation, just card validation.
delete rawSchema.$schema;

// ─── Create and configure the Ajv instance ──────────────────────────────────

const ajv = new Ajv({
  allErrors: true,
  // strict:false avoids failures on draft-06 keywords like "id", unknown
  // formats, and non-standard "version"/"features" annotation keywords that
  // appear throughout the Adaptive Cards schema.
  strict: false,
  // Adaptive Card Templating adds properties like $data, $when, $root that
  // are NOT in the official schema (which uses additionalProperties:false).
  // We must not strip them — instead we tell ajv to silently allow extras.
  validateFormats: false,
});

const validate = ajv.compile(rawSchema);

// ─── Known types (kept for supplementary best-practice checks) ──────────────

const VALID_ELEMENT_TYPES = new Set([
  "TextBlock",
  "Image",
  "Media",
  "RichTextBlock",
  "Container",
  "ColumnSet",
  "ImageSet",
  "FactSet",
  "ActionSet",
  "Table",
  "Input.Text",
  "Input.Number",
  "Input.Date",
  "Input.Time",
  "Input.Toggle",
  "Input.ChoiceSet",
  "Input.Rating",
  "Input.DataGrid",
  "Carousel",
  "Accordion",
  "CodeBlock",
  "Rating",
  "ProgressBar",
  "ProgressRing",
  "Spinner",
  "TabSet",
  "List",
  "CompoundButton",
  "Badge",
  "Icon",
  // Charts
  "DonutChart",
  "BarChart",
  "LineChart",
  "PieChart",
]);

const VALID_ACTION_TYPES = new Set([
  "Action.Submit",
  "Action.OpenUrl",
  "Action.ShowCard",
  "Action.ToggleVisibility",
  "Action.Execute",
  // Teams extensions
  "Action.Popover",
  "Action.RunCommands",
  "Action.OpenUrlDialog",
]);

// Properties added by Adaptive Card Templating that the official schema does
// not include. We strip these before running ajv so that additionalProperties
// checks don't reject them, then restore them afterward.
const TEMPLATING_PROPS = ["$data", "$when", "$root"];

const VERSION_PATTERN = /^\d+\.\d+$/;

// ─── Public types ───────────────────────────────────────────────────────────

export interface SchemaValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert an ajv JSON-pointer path (e.g. "/body/0/text") to a dot-bracket
 * path (e.g. "$.body[0].text").
 */
function ajvPathToJsonPath(instancePath: string): string {
  if (!instancePath) return "$";
  const segments = instancePath.split("/").filter(Boolean);
  let result = "$";
  for (const seg of segments) {
    if (/^\d+$/.test(seg)) {
      result += `[${seg}]`;
    } else {
      result += `.${seg}`;
    }
  }
  return result;
}

/**
 * Map a single ajv ErrorObject to our ValidationError format.
 */
function mapAjvError(err: ErrorObject): ValidationError {
  const jsonPath = ajvPathToJsonPath(err.instancePath);

  let message: string;
  switch (err.keyword) {
    case "additionalProperties":
      message = `Unknown property "${(err.params as Record<string, unknown>).additionalProperty}"`;
      break;
    case "required":
      message = `Missing required property "${(err.params as Record<string, unknown>).missingProperty}"`;
      break;
    case "enum":
      message = `${err.message}`;
      break;
    case "type":
      message = `${err.message}`;
      break;
    default:
      message = err.message ?? `Schema validation failed (${err.keyword})`;
  }

  return {
    path: jsonPath,
    message,
    severity: "error",
    rule: `schema/${err.keyword}`,
  };
}

/**
 * Recursively strip (and collect) Adaptive Card Templating properties that
 * are not in the official schema, so that additionalProperties:false doesn't
 * reject them. Returns a restore function that puts them back.
 */
function stripTemplatingProps(obj: unknown): () => void {
  const restoreOps: Array<() => void> = [];

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const record = node as Record<string, unknown>;
    for (const prop of TEMPLATING_PROPS) {
      if (prop in record) {
        const saved = record[prop];
        delete record[prop];
        restoreOps.push(() => {
          record[prop] = saved;
        });
      }
    }

    for (const value of Object.values(record)) {
      walk(value);
    }
  }

  walk(obj);
  return () => {
    for (const op of restoreOps) op();
  };
}

// ─── Supplementary best-practice checks (warnings) ─────────────────────────

function runSupplementaryChecks(card: Record<string, unknown>): ValidationError[] {
  const warnings: ValidationError[] = [];

  // Walk elements recursively
  function walkElements(elements: unknown[], basePath: string): void {
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el || typeof el !== "object") continue;
      const elem = el as Record<string, unknown>;
      const elPath = `${basePath}[${i}]`;

      // Unknown element type
      if (typeof elem.type === "string" && !VALID_ELEMENT_TYPES.has(elem.type)) {
        warnings.push({
          path: `${elPath}.type`,
          message: `Unknown element type: "${elem.type}"`,
          severity: "warning",
          rule: "unknown-element-type",
        });
      }

      // TextBlock missing text
      if (elem.type === "TextBlock" && (elem.text === undefined || elem.text === null)) {
        warnings.push({
          path: `${elPath}.text`,
          message: "TextBlock is missing the \"text\" property",
          severity: "warning",
          rule: "best-practice/textblock-text",
        });
      }

      // Image missing url
      if (elem.type === "Image" && !elem.url) {
        warnings.push({
          path: `${elPath}.url`,
          message: "Image is missing the \"url\" property",
          severity: "warning",
          rule: "best-practice/image-url",
        });
      }

      // FactSet — facts missing title/value
      if (elem.type === "FactSet" && Array.isArray(elem.facts)) {
        for (let f = 0; f < elem.facts.length; f++) {
          const fact = elem.facts[f] as Record<string, unknown> | undefined;
          if (!fact) continue;
          if (!fact.title) {
            warnings.push({
              path: `${elPath}.facts[${f}].title`,
              message: "Fact is missing the \"title\" property",
              severity: "warning",
              rule: "best-practice/fact-title",
            });
          }
          if (!fact.value) {
            warnings.push({
              path: `${elPath}.facts[${f}].value`,
              message: "Fact is missing the \"value\" property",
              severity: "warning",
              rule: "best-practice/fact-value",
            });
          }
        }
      }

      // Recurse into nested items (Container, etc.)
      if (Array.isArray(elem.items)) {
        walkElements(elem.items, `${elPath}.items`);
      }

      // Recurse into columns (ColumnSet)
      if (Array.isArray(elem.columns)) {
        for (let c = 0; c < elem.columns.length; c++) {
          const col = elem.columns[c] as Record<string, unknown> | undefined;
          if (col && Array.isArray(col.items)) {
            walkElements(col.items, `${elPath}.columns[${c}].items`);
          }
        }
      }

      // Recurse into rows/cells (Table)
      if (Array.isArray(elem.rows)) {
        for (let r = 0; r < elem.rows.length; r++) {
          const row = elem.rows[r] as Record<string, unknown> | undefined;
          if (row && Array.isArray(row.cells)) {
            for (let cl = 0; cl < row.cells.length; cl++) {
              const cell = row.cells[cl] as Record<string, unknown> | undefined;
              if (cell && Array.isArray(cell.items)) {
                walkElements(cell.items, `${elPath}.rows[${r}].cells[${cl}].items`);
              }
            }
          }
        }
      }

      // Recurse into images (ImageSet)
      if (Array.isArray(elem.images)) {
        walkElements(elem.images, `${elPath}.images`);
      }

      // Recurse into actions (ActionSet)
      if (Array.isArray(elem.actions)) {
        walkActions(elem.actions, `${elPath}.actions`);
      }
    }
  }

  function walkActions(actions: unknown[], basePath: string): void {
    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      if (!act || typeof act !== "object") continue;
      const action = act as Record<string, unknown>;
      const actPath = `${basePath}[${i}]`;

      // Unknown action type
      if (typeof action.type === "string" && !VALID_ACTION_TYPES.has(action.type)) {
        warnings.push({
          path: `${actPath}.type`,
          message: `Unknown action type: "${action.type}"`,
          severity: "warning",
          rule: "unknown-action-type",
        });
      }
    }
  }

  // Check host version compatibility
  if (typeof card.version === "string" && VERSION_PATTERN.test(card.version)) {
    const [major, minor] = card.version.split(".").map(Number);
    if (major !== undefined && minor !== undefined) {
      if (major > 1 || (major === 1 && minor > 6)) {
        warnings.push({
          path: "$.version",
          message: `Card targets version ${card.version} which is newer than the latest supported version 1.6`,
          severity: "warning",
          rule: "version-compatibility",
        });
      }
    }
  }

  // Walk body
  if (Array.isArray(card.body)) {
    walkElements(card.body, "$.body");
  }

  // Walk top-level actions
  if (Array.isArray(card.actions)) {
    walkActions(card.actions, "$.actions");
  }

  return warnings;
}

// ─── Main validation function ───────────────────────────────────────────────

/**
 * Validate an Adaptive Card JSON object against the official v1.6 schema
 * using ajv, then run supplementary best-practice checks.
 */
export function validateCard(card: unknown): SchemaValidationResult {
  const errors: ValidationError[] = [];

  // Basic sanity check
  if (!card || typeof card !== "object") {
    errors.push({
      path: "$",
      message: "Card must be a JSON object",
      severity: "error",
      rule: "type-check",
    });
    return { valid: false, errors };
  }

  const obj = card as Record<string, unknown>;

  // Deep-clone so we can safely strip templating props without mutating input
  let cardCopy: Record<string, unknown>;
  try {
    cardCopy = JSON.parse(JSON.stringify(obj));
  } catch {
    errors.push({
      path: "$",
      message: "Card contains values that cannot be serialized to JSON",
      severity: "error",
      rule: "type-check",
    });
    return { valid: false, errors };
  }

  // Strip Adaptive Card Templating properties before validation
  const restore = stripTemplatingProps(cardCopy);

  // Run ajv schema validation
  const schemaValid = validate(cardCopy);

  // Restore templating props on the copy (not strictly needed but keeps things tidy)
  restore();

  if (!schemaValid && validate.errors) {
    // De-duplicate errors: ajv can produce many errors for anyOf/allOf branches.
    // Keep only unique (path + message) pairs.
    const seen = new Set<string>();
    for (const err of validate.errors) {
      // Skip "if" / "anyOf" / "oneOf" wrapper errors that just say
      // "must match X schema" without actionable detail
      if (
        err.keyword === "if" ||
        err.keyword === "anyOf" ||
        err.keyword === "oneOf" ||
        err.keyword === "allOf"
      ) {
        continue;
      }

      const mapped = mapAjvError(err);
      const key = `${mapped.path}::${mapped.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push(mapped);
      }
    }
  }

  // If schema validation passed, run supplementary best-practice checks
  // (these are warnings, not hard errors)
  if (schemaValid) {
    const supplementary = runSupplementaryChecks(obj);
    errors.push(...supplementary);
  }

  const hasErrors = errors.some((e) => e.severity === "error");
  return { valid: !hasErrors, errors };
}

// ─── Public accessors ───────────────────────────────────────────────────────

/**
 * Get the set of valid element types
 */
export function getValidElementTypes(): Set<string> {
  return new Set(VALID_ELEMENT_TYPES);
}

/**
 * Get the set of valid action types
 */
export function getValidActionTypes(): Set<string> {
  return new Set(VALID_ACTION_TYPES);
}
