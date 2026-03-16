/**
 * Card Assembler — Deterministic card construction from patterns and data
 * This is the fallback when no LLM API key is available.
 */

import type { CardIntent, DataPresentation, HostApp } from "../types/index.js";
import { analyzeData, parseCSV } from "./data-analyzer.js";
import { findPatternByIntent, findPatternByName, scorePatterns } from "./layout-patterns.js";

interface AssembleOptions {
  title?: string;
  content?: string;
  data?: unknown;
  intent?: CardIntent;
  presentation?: DataPresentation;
  host?: HostApp;
  version?: string;
}

/**
 * Assemble a card from content description and optional data
 */
export function assembleCard(options: AssembleOptions): Record<string, unknown> {
  const { content, data, intent, presentation, version = "1.6" } = options;

  // If we have structured data, build a data-driven card
  if (data) {
    return assembleDataCard(data, {
      title: options.title || extractTitle(content || ""),
      presentation,
      version,
    });
  }

  // Special handling for form intent — generate actual input fields
  if (intent === "form" || (content && /\b(form|input|survey|collect|register)\b/i.test(content))) {
    return buildFormCard(options);
  }

  // If we have an intent, use the matching pattern
  if (intent) {
    const pattern = findPatternByIntent(intent);
    if (pattern) {
      return fillPattern(pattern.template as Record<string, unknown>, options);
    }
  }

  // Score patterns against the content description
  if (content) {
    const scored = scorePatterns(content);
    if (scored.length > 0 && scored[0].score > 0) {
      return fillPattern(
        scored[0].pattern.template as Record<string, unknown>,
        options,
      );
    }
  }

  // Default: simple notification card
  return buildSimpleCard(options);
}

/**
 * Assemble a data-driven card
 */
function assembleDataCard(
  data: unknown,
  opts: { title: string; presentation?: DataPresentation; version: string },
): Record<string, unknown> {
  const analysis = analyzeData(data);
  const pres = opts.presentation === "auto" || !opts.presentation
    ? analysis.presentation
    : opts.presentation;

  switch (pres) {
    case "table":
      return buildTableCard(data, opts.title, opts.version, analysis);
    case "facts":
      return buildFactsCard(data, opts.title, opts.version);
    case "chart-bar":
      return buildChartCard(data, opts.title, opts.version, "BarChart");
    case "chart-line":
      return buildChartCard(data, opts.title, opts.version, "LineChart");
    case "chart-pie":
      return buildChartCard(data, opts.title, opts.version, "PieChart");
    case "chart-donut":
      return buildChartCard(data, opts.title, opts.version, "DonutChart");
    case "list":
      return buildListCard(data, opts.title, opts.version);
    case "carousel":
      return buildCarouselCard(data, opts.title, opts.version);
    default:
      return buildTableCard(data, opts.title, opts.version, analysis);
  }
}

function buildTableCard(
  data: unknown,
  title: string,
  version: string,
  analysis: ReturnType<typeof analyzeData>,
): Record<string, unknown> {
  let rows: Record<string, unknown>[] = [];
  let columns: string[] = analysis.columns || [];

  if (typeof data === "string") {
    rows = parseCSV(data);
    if (rows.length > 0) columns = Object.keys(rows[0]);
  } else if (Array.isArray(data)) {
    rows = data as Record<string, unknown>[];
    if (rows.length > 0) columns = Object.keys(rows[0]);
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // Find first array value
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        rows = obj[key] as Record<string, unknown>[];
        if (rows.length > 0) columns = Object.keys(rows[0]);
        break;
      }
    }
  }

  return {
    type: "AdaptiveCard",
    version,
    body: [
      {
        type: "TextBlock",
        text: title || "Data",
        size: "medium",
        weight: "bolder",
        wrap: true,
        style: "heading",
      },
      {
        type: "Table",
        firstRowAsHeader: true,
        showGridLines: true,
        gridStyle: "accent",
        columns: columns.map((col) => ({
          width: 1,
        })),
        rows: [
          // Header row
          {
            type: "TableRow",
            cells: columns.map((col) => ({
              type: "TableCell",
              items: [
                {
                  type: "TextBlock",
                  text: col,
                  weight: "bolder",
                  wrap: true,
                },
              ],
            })),
          },
          // Data rows
          ...rows.slice(0, 20).map((row) => ({
            type: "TableRow",
            cells: columns.map((col) => ({
              type: "TableCell",
              items: [
                {
                  type: "TextBlock",
                  text: String(row[col] ?? ""),
                  wrap: true,
                },
              ],
            })),
          })),
        ],
      },
    ],
  };
}

function buildFactsCard(
  data: unknown,
  title: string,
  version: string,
): Record<string, unknown> {
  let facts: Array<{ title: string; value: string }> = [];

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    facts = Object.entries(obj)
      .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      .map(([k, v]) => ({
        title: formatLabel(k),
        value: String(v),
      }));
  } else if (Array.isArray(data)) {
    const arr = data as Record<string, unknown>[];
    if (arr.length > 0) {
      const keys = Object.keys(arr[0]);
      if (keys.length === 2) {
        facts = arr.map((item) => ({
          title: String(item[keys[0]] ?? ""),
          value: String(item[keys[1]] ?? ""),
        }));
      } else {
        facts = arr.map((item, i) => ({
          title: String(item[keys[0]] || `Item ${i + 1}`),
          value: keys.slice(1).map((k) => String(item[k] ?? "")).join(", "),
        }));
      }
    }
  }

  return {
    type: "AdaptiveCard",
    version,
    body: [
      {
        type: "TextBlock",
        text: title || "Details",
        size: "medium",
        weight: "bolder",
        wrap: true,
        style: "heading",
      },
      {
        type: "FactSet",
        facts: facts.slice(0, 20),
      },
    ],
  };
}

function buildChartCard(
  data: unknown,
  title: string,
  version: string,
  chartType: string,
): Record<string, unknown> {
  // Build chart data from array
  const chartData: Array<{ x: string; y: number }> = [];

  if (Array.isArray(data)) {
    const arr = data as Record<string, unknown>[];
    if (arr.length > 0) {
      const keys = Object.keys(arr[0]);
      const labelKey = keys[0];
      const valueKey = keys.find((k) => typeof arr[0][k] === "number") || keys[1];

      for (const item of arr) {
        chartData.push({
          x: String(item[labelKey] ?? ""),
          y: Number(item[valueKey] ?? 0),
        });
      }
    }
  }

  return {
    type: "AdaptiveCard",
    version,
    body: [
      {
        type: "TextBlock",
        text: title || "Chart",
        size: "medium",
        weight: "bolder",
        wrap: true,
        style: "heading",
      },
      {
        type: chartType,
        title: title || "Chart",
        data: chartData,
      },
    ],
  };
}

function buildListCard(
  data: unknown,
  title: string,
  version: string,
): Record<string, unknown> {
  const items: Array<Record<string, unknown>> = [];

  if (Array.isArray(data)) {
    for (const item of data.slice(0, 20)) {
      if (typeof item === "string") {
        items.push({
          type: "TextBlock",
          text: `- ${item}`,
          wrap: true,
        });
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const keys = Object.keys(obj);
        const primary = String(obj[keys[0]] ?? "");
        const secondary = keys.length > 1 ? String(obj[keys[1]] ?? "") : "";

        items.push({
          type: "ColumnSet",
          columns: [
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: primary,
                  weight: "bolder",
                  wrap: true,
                },
                ...(secondary
                  ? [
                      {
                        type: "TextBlock",
                        text: secondary,
                        isSubtle: true,
                        spacing: "none",
                        wrap: true,
                      },
                    ]
                  : []),
              ],
            },
          ],
          separator: items.length > 0,
        });
      }
    }
  }

  return {
    type: "AdaptiveCard",
    version,
    body: [
      {
        type: "TextBlock",
        text: title || "List",
        size: "medium",
        weight: "bolder",
        wrap: true,
        style: "heading",
      },
      ...items,
    ],
  };
}

function buildCarouselCard(
  data: unknown,
  title: string,
  version: string,
): Record<string, unknown> {
  const pages: Array<Record<string, unknown>> = [];

  if (Array.isArray(data)) {
    for (const item of data.slice(0, 10)) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const keys = Object.keys(obj);
        const imageKey = keys.find(
          (k) =>
            k.toLowerCase().includes("image") ||
            k.toLowerCase().includes("url") ||
            k.toLowerCase().includes("src"),
        );
        const titleKey = keys.find(
          (k) => k.toLowerCase().includes("title") || k.toLowerCase().includes("name"),
        ) || keys[0];

        const pageItems: Record<string, unknown>[] = [];

        if (imageKey && obj[imageKey]) {
          pageItems.push({
            type: "Image",
            url: String(obj[imageKey]),
            altText: String(obj[titleKey] ?? "Image"),
            size: "large",
          });
        }

        pageItems.push({
          type: "TextBlock",
          text: String(obj[titleKey] ?? ""),
          weight: "bolder",
          wrap: true,
        });

        pages.push({
          type: "CarouselPage",
          items: pageItems,
        });
      }
    }
  }

  return {
    type: "AdaptiveCard",
    version,
    body: [
      {
        type: "TextBlock",
        text: title || "Gallery",
        size: "medium",
        weight: "bolder",
        wrap: true,
        style: "heading",
      },
      {
        type: "Carousel",
        pages,
      },
    ],
  };
}

function buildFormCard(options: AssembleOptions): Record<string, unknown> {
  const content = (options.content || "").toLowerCase();
  const title = options.title || extractTitle(options.content || "Form");
  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      text: title,
      size: "medium",
      weight: "bolder",
      wrap: true,
      style: "heading",
    },
  ];

  // Parse field hints from the content description
  const fieldPatterns: Array<{
    match: RegExp;
    field: Record<string, unknown>;
  }> = [
    {
      match: /\b(title|name|subject)\b/,
      field: { type: "Input.Text", id: "title", label: "Title", placeholder: "Enter title..." },
    },
    {
      match: /\b(description|details|body|summary|notes)\b/,
      field: { type: "Input.Text", id: "description", label: "Description", isMultiline: true, placeholder: "Enter description..." },
    },
    {
      match: /\b(severity|priority|urgency|level)\b/,
      field: {
        type: "Input.ChoiceSet",
        id: "severity",
        label: "Severity",
        style: "compact",
        choices: [
          { title: "Critical", value: "critical" },
          { title: "High", value: "high" },
          { title: "Medium", value: "medium" },
          { title: "Low", value: "low" },
        ],
      },
    },
    {
      match: /\b(category|type|kind)\b/,
      field: {
        type: "Input.ChoiceSet",
        id: "category",
        label: "Category",
        style: "compact",
        choices: [
          { title: "Bug", value: "bug" },
          { title: "Feature", value: "feature" },
          { title: "Improvement", value: "improvement" },
          { title: "Task", value: "task" },
        ],
      },
    },
    {
      match: /\b(date|due|deadline|when)\b/,
      field: { type: "Input.Date", id: "date", label: "Date" },
    },
    {
      match: /\b(time)\b/,
      field: { type: "Input.Time", id: "time", label: "Time" },
    },
    {
      match: /\b(email|e-mail)\b/,
      field: { type: "Input.Text", id: "email", label: "Email", placeholder: "user@example.com", style: "email" },
    },
    {
      match: /\b(steps|reproduce|repro)\b/,
      field: { type: "Input.Text", id: "steps", label: "Steps to Reproduce", isMultiline: true, placeholder: "1. ...\n2. ...\n3. ..." },
    },
    {
      match: /\b(comment|feedback|message)\b/,
      field: { type: "Input.Text", id: "comment", label: "Comment", isMultiline: true, placeholder: "Enter your comment..." },
    },
    {
      match: /\b(number|amount|quantity|count)\b/,
      field: { type: "Input.Number", id: "amount", label: "Amount" },
    },
    {
      match: /\b(agree|consent|terms|accept)\b/,
      field: { type: "Input.Toggle", id: "agree", label: "I agree to the terms", title: "I agree" },
    },
  ];

  let addedFields = 0;
  for (const { match, field } of fieldPatterns) {
    if (match.test(content)) {
      body.push(field);
      addedFields++;
    }
  }

  // If no fields matched, add some generic fields
  if (addedFields === 0) {
    body.push(
      { type: "Input.Text", id: "name", label: "Name", placeholder: "Enter name..." },
      { type: "Input.Text", id: "details", label: "Details", isMultiline: true, placeholder: "Enter details..." },
    );
  }

  return {
    type: "AdaptiveCard",
    version: options.version || "1.6",
    body,
    actions: [
      {
        type: "Action.Execute",
        title: "Submit",
        style: "positive",
        verb: "submit",
      },
    ],
  };
}

function buildSimpleCard(options: AssembleOptions): Record<string, unknown> {
  const body: Record<string, unknown>[] = [];

  if (options.title || options.content) {
    body.push({
      type: "TextBlock",
      text: options.title || extractTitle(options.content || ""),
      size: "medium",
      weight: "bolder",
      wrap: true,
      style: "heading",
    });
  }

  if (options.content) {
    body.push({
      type: "TextBlock",
      text: options.content,
      wrap: true,
    });
  }

  return {
    type: "AdaptiveCard",
    version: options.version || "1.6",
    body,
  };
}

function fillPattern(
  template: Record<string, unknown>,
  options: AssembleOptions,
): Record<string, unknown> {
  // Deep clone the template
  const card = JSON.parse(JSON.stringify(template));

  // Extract contextual hints from content for smarter defaults
  const content = options.content || "";
  const title = options.title || extractTitle(content || "Untitled");

  // Replace placeholders with actual values (prefer meaningful defaults over empty strings)
  const replacements: Record<string, string> = {
    "{{title}}": title,
    "{{body}}": content,
    "{{description}}": content,
    "{{subtitle}}": extractSubtitle(content, title),
    "{{requesterName}}": extractName(content) || "Pending",
    "{{avatarUrl}}": "https://ui-avatars.com/api/?name=AC&background=0078D4&color=fff&size=64&rounded=true",
    "{{iconUrl}}": "https://adaptivecards.io/content/pending.png",
    "{{status}}": "Pending",
    "{{name}}": extractName(content) || "Name",
    "{{role}}": "",
    "{{organization}}": "",
    "{{profileUrl}}": "https://example.com",
  };

  function replaceInObj(obj: unknown): unknown {
    if (typeof obj === "string") {
      for (const [placeholder, value] of Object.entries(replacements)) {
        obj = (obj as string).replace(placeholder, value);
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(replaceInObj);
    }
    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = replaceInObj(value);
      }
      return result;
    }
    return obj;
  }

  const filled = replaceInObj(card) as Record<string, unknown>;
  if (options.version) {
    filled.version = options.version;
  }

  // Post-process: clean up empty elements and fix spec violations
  cleanupCard(filled);

  return filled;
}

/**
 * Remove empty TextBlocks, empty FactSets, and strip version from nested ShowCard cards
 */
function cleanupCard(card: Record<string, unknown>): void {
  // Clean body elements
  if (Array.isArray(card.body)) {
    card.body = cleanupElements(card.body);
  }

  // Clean actions (including nested ShowCard cards)
  if (Array.isArray(card.actions)) {
    cleanupActions(card.actions);
  }
}

function cleanupElements(elements: unknown[]): unknown[] {
  const cleaned: unknown[] = [];

  for (const el of elements) {
    if (!el || typeof el !== "object") {
      cleaned.push(el);
      continue;
    }
    const element = el as Record<string, unknown>;

    // Remove TextBlocks with empty text
    if (element.type === "TextBlock" && typeof element.text === "string" && element.text.trim() === "") {
      continue;
    }

    // Remove FactSets with no facts
    if (element.type === "FactSet" && Array.isArray(element.facts) && element.facts.length === 0) {
      continue;
    }

    // Recurse into containers
    if (Array.isArray(element.items)) {
      element.items = cleanupElements(element.items);
    }
    if (Array.isArray(element.columns)) {
      for (const col of element.columns) {
        if (col && typeof col === "object") {
          const column = col as Record<string, unknown>;
          if (Array.isArray(column.items)) {
            column.items = cleanupElements(column.items);
          }
        }
      }
    }

    cleaned.push(element);
  }

  return cleaned;
}

function cleanupActions(actions: unknown[]): void {
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    const act = action as Record<string, unknown>;

    // Strip version from nested ShowCard cards (spec violation)
    if (act.type === "Action.ShowCard" && act.card && typeof act.card === "object") {
      const nested = act.card as Record<string, unknown>;
      delete nested.version;
      // Recurse into nested card
      cleanupCard(nested);
    }
  }
}

/**
 * Extract a subtitle from content that differs from the title
 */
function extractSubtitle(content: string, title: string): string {
  if (!content) return "";
  // If content has multiple sentences, use the second as subtitle
  const sentences = content.split(/[.!?\n]/).map(s => s.trim()).filter(Boolean);
  if (sentences.length > 1 && sentences[1] !== title) {
    return sentences[1];
  }
  return "";
}

/**
 * Try to extract a person's name from content (e.g. "from John Smith" or "by Jane Doe")
 */
function extractName(content: string): string {
  const namePatterns = [
    /\bfrom\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /\bsubmitted\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /\brequester[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ];
  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function extractTitle(content: string): string {
  // Extract first sentence or first N words as title
  const firstSentence = content.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length <= 60) return firstSentence;
  return firstSentence.slice(0, 57) + "...";
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
