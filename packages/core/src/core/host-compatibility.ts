/**
 * Host Compatibility Checker — Validates card compatibility with specific host apps
 */

import type { HostApp, HostCompatibilityReport, HostVersionSupport } from "../types/index.js";
import { analyzeCard } from "./card-analyzer.js";

/**
 * Host-specific version and feature support map
 */
const HOST_SUPPORT: Record<HostApp, HostVersionSupport> = {
  teams: {
    host: "teams",
    maxVersion: "1.6",
    unsupportedElements: ["Media"],
    unsupportedActions: [],
    maxActions: 6,
    notes: [
      "Teams supports up to v1.6 on latest clients",
      "Carousel requires Teams v1.6 client",
      "Charts are Teams-specific extensions",
      "Action.Execute preferred over Action.Submit for Universal Actions",
    ],
  },
  outlook: {
    host: "outlook",
    maxVersion: "1.4",
    unsupportedElements: [
      "Media",
      "Table",
      "Carousel",
      "Accordion",
      "TabSet",
      "List",
      "CompoundButton",
      "CodeBlock",
      "Rating",
      "ProgressBar",
      "ProgressRing",
      "Spinner",
      "DonutChart",
      "BarChart",
      "LineChart",
      "PieChart",
      "Badge",
      "Icon",
      "Input.Rating",
      "Input.DataGrid",
    ],
    unsupportedActions: ["Action.Popover", "Action.RunCommands", "Action.OpenUrlDialog"],
    maxActions: 4,
    notes: [
      "Outlook Actionable Messages support up to v1.4",
      "Action.Execute requires Universal Action Model registration",
      "Voting buttons sunsetting July 2026 — migrate to Adaptive Cards",
    ],
  },
  webchat: {
    host: "webchat",
    maxVersion: "1.6",
    unsupportedElements: [],
    unsupportedActions: ["Action.Popover", "Action.RunCommands", "Action.OpenUrlDialog"],
    maxActions: 10,
    notes: ["Bot Framework Web Chat supports full v1.6 schema"],
  },
  windows: {
    host: "windows",
    maxVersion: "1.6",
    unsupportedElements: [
      "Carousel",
      "Accordion",
      "TabSet",
      "DonutChart",
      "BarChart",
      "LineChart",
      "PieChart",
    ],
    unsupportedActions: ["Action.Popover", "Action.RunCommands", "Action.OpenUrlDialog"],
    maxActions: 5,
    notes: ["Windows Widgets support a subset of v1.6"],
  },
  "viva-connections": {
    host: "viva-connections",
    maxVersion: "1.4",
    unsupportedElements: [
      "Media",
      "Table",
      "Carousel",
      "Accordion",
      "TabSet",
      "List",
      "CompoundButton",
      "CodeBlock",
      "DonutChart",
      "BarChart",
      "LineChart",
      "PieChart",
    ],
    unsupportedActions: ["Action.Popover", "Action.RunCommands", "Action.OpenUrlDialog"],
    maxActions: 5,
    notes: [
      "Viva Connections ACE framework supports up to v1.4",
      "Requires SPFx-based Adaptive Card Extensions",
    ],
  },
  webex: {
    host: "webex",
    maxVersion: "1.3",
    unsupportedElements: [
      "Table",
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
      "DonutChart",
      "BarChart",
      "LineChart",
      "PieChart",
      "Badge",
      "Icon",
      "Input.Rating",
      "Input.DataGrid",
    ],
    unsupportedActions: [
      "Action.Execute",
      "Action.Popover",
      "Action.RunCommands",
      "Action.OpenUrlDialog",
    ],
    maxActions: 5,
    notes: [
      "Cisco Webex locked to v1.3 — no roadmap for 1.4/1.5",
      "Action.Execute not supported — use Action.Submit",
    ],
  },
  generic: {
    host: "generic",
    maxVersion: "1.6",
    unsupportedElements: [],
    unsupportedActions: [],
    maxActions: 20,
    notes: [],
  },
};

/**
 * Check if a card is compatible with a specific host app
 */
export function checkHostCompatibility(
  card: Record<string, unknown>,
  host: HostApp = "generic",
): HostCompatibilityReport {
  const support = HOST_SUPPORT[host];
  const stats = analyzeCard(card);
  const unsupportedElements: HostCompatibilityReport["unsupportedElements"] = [];

  // Check element types
  for (const elementType of stats.elementTypes) {
    if (support.unsupportedElements.includes(elementType)) {
      unsupportedElements.push({
        path: `(element type)`,
        type: elementType,
        reason: `${elementType} is not supported on ${host} (max version: ${support.maxVersion})`,
      });
    }
  }

  // Check action types
  for (const actionType of stats.actionTypes) {
    if (support.unsupportedActions.includes(actionType)) {
      unsupportedElements.push({
        path: `(action type)`,
        type: actionType,
        reason: `${actionType} is not supported on ${host}`,
      });
    }
  }

  // Check version compatibility
  const cardVersion = parseFloat(stats.version);
  const maxVersion = parseFloat(support.maxVersion);
  if (!isNaN(cardVersion) && !isNaN(maxVersion) && cardVersion > maxVersion) {
    unsupportedElements.push({
      path: "$.version",
      type: "version",
      reason: `Card version ${stats.version} exceeds ${host} max supported version ${support.maxVersion}`,
    });
  }

  // Check action count at card level
  if (card.actions && Array.isArray(card.actions)) {
    if (card.actions.length > support.maxActions) {
      unsupportedElements.push({
        path: "$.actions",
        type: "action-count",
        reason: `Card has ${card.actions.length} actions, but ${host} supports max ${support.maxActions}`,
      });
    }
  }

  return {
    supported: unsupportedElements.length === 0,
    unsupportedElements,
  };
}

/**
 * Get host support information
 */
export function getHostSupport(host: HostApp): HostVersionSupport {
  return HOST_SUPPORT[host];
}

/**
 * Get all supported hosts
 */
export function getAllHostSupport(): Record<HostApp, HostVersionSupport> {
  return { ...HOST_SUPPORT };
}

// ─── Element Replacement Helpers ────────────────────────────────────────────

type ElementRecord = Record<string, unknown>;

function convertTableToColumnSet(table: ElementRecord): ElementRecord {
  const rows = (table.rows as ElementRecord[]) || [];
  const items: ElementRecord[] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const cells = (row.cells as ElementRecord[]) || [];
    const isHeader = rowIdx === 0 && table.firstRowAsHeader;

    const columns: ElementRecord[] = cells.map((cell) => {
      const cellItems = (cell.items as ElementRecord[]) || [];
      const adaptedItems = isHeader
        ? cellItems.map((item) => ({ ...item, weight: "bolder" }))
        : cellItems;
      return {
        type: "Column",
        width: "stretch",
        items: adaptedItems,
      };
    });

    const columnSet: ElementRecord = {
      type: "ColumnSet",
      columns,
    };

    if (rowIdx > 0 && rowIdx < rows.length) {
      columnSet.separator = true;
    }

    items.push(columnSet);
  }

  return items.length === 1 ? items[0] : { type: "Container", items };
}

function convertCarouselToContainers(carousel: ElementRecord): ElementRecord {
  const pages = (carousel.pages as ElementRecord[]) || [];
  if (pages.length === 0) {
    return { type: "Container", items: [{ type: "TextBlock", text: "(Empty carousel)", wrap: true }] };
  }

  const containers: ElementRecord[] = pages.map((page, idx) => {
    const pageItems = (page.items as ElementRecord[]) || [];
    const container: ElementRecord = {
      type: "Container",
      items: [...pageItems],
    };
    if (idx > 0) {
      container.separator = true;
    }
    return container;
  });

  if (pages.length > 1) {
    containers.push({
      type: "TextBlock",
      text: `(Converted from Carousel with ${pages.length} pages)`,
      isSubtle: true,
      size: "small",
      wrap: true,
    });
  }

  if (containers.length === 1) {
    return containers[0];
  }

  return { type: "Container", items: containers };
}

function convertChartToFactSet(chart: ElementRecord): ElementRecord {
  const dataPoints = (chart.data as ElementRecord[]) || (chart.dataPoints as ElementRecord[]) || [];
  const chartType = (chart.type as string) || "Chart";

  const facts = dataPoints.map((point) => ({
    title: String(point.label || point.x || point.name || ""),
    value: String(point.value || point.y || 0),
  }));

  const factSet: ElementRecord = {
    type: "FactSet",
    facts: facts.length > 0 ? facts : [{ title: chartType, value: "No data" }],
  };

  return factSet;
}

function convertCodeBlockToContainer(codeBlock: ElementRecord): ElementRecord {
  const code = (codeBlock.codeSnippet as string) || (codeBlock.code as string) || "";
  const language = (codeBlock.language as string) || "";

  const items: ElementRecord[] = [];
  if (language) {
    items.push({
      type: "TextBlock",
      text: `[${language}]`,
      weight: "bolder",
      size: "small",
      wrap: true,
    });
  }
  items.push({
    type: "TextBlock",
    text: code,
    fontType: "monospace",
    wrap: true,
    size: "small",
  });

  return {
    type: "Container",
    style: "emphasis",
    items,
  };
}

function convertRatingToTextBlock(element: ElementRecord): ElementRecord {
  const value = element.value ?? element.max ?? "";
  const max = element.max ?? 5;
  return {
    type: "TextBlock",
    text: `Rating: ${value}/${max}`,
    wrap: true,
  };
}

function convertProgressToTextBlock(element: ElementRecord): ElementRecord {
  const value = element.value ?? 0;
  const elementType = element.type as string;
  if (elementType === "Spinner") {
    return {
      type: "TextBlock",
      text: (element.label as string) || "Loading...",
      wrap: true,
    };
  }
  return {
    type: "TextBlock",
    text: `Progress: ${value}%`,
    wrap: true,
  };
}

function convertActionExecuteToSubmit(action: ElementRecord): ElementRecord {
  const data: ElementRecord = typeof action.data === "object" && action.data !== null
    ? { ...(action.data as ElementRecord) }
    : {};
  if (action.verb) {
    data.verb = action.verb;
  }
  const result: ElementRecord = {
    type: "Action.Submit",
    title: action.title,
    data,
  };
  if (action.style) result.style = action.style;
  if (action.id) result.id = action.id;
  return result;
}

function convertActionSubmitToExecute(action: ElementRecord): ElementRecord {
  const data: ElementRecord = typeof action.data === "object" && action.data !== null
    ? { ...(action.data as ElementRecord) }
    : {};
  const verb = (data.verb as string) || (action.title as string) || "";
  const result: ElementRecord = {
    type: "Action.Execute",
    title: action.title,
    verb,
    data,
  };
  if (action.style) result.style = action.style;
  if (action.id) result.id = action.id;
  return result;
}

// ─── Adaptation Engine ──────────────────────────────────────────────────────

const CHART_TYPES = new Set(["BarChart", "LineChart", "PieChart", "DonutChart"]);
const PROGRESS_TYPES = new Set(["ProgressBar", "ProgressRing", "Spinner"]);

/**
 * Adapt a card for a specific host by replacing unsupported elements with
 * compatible alternatives, downgrading the version, and trimming actions.
 */
export function adaptCardForHost(
  card: Record<string, unknown>,
  targetHost: HostApp,
): { card: Record<string, unknown>; changes: string[]; warnings: string[] } {
  const support = HOST_SUPPORT[targetHost];
  const changes: string[] = [];
  const warnings: string[] = [];

  // Deep clone the card to avoid mutating the original
  const adapted = JSON.parse(JSON.stringify(card)) as Record<string, unknown>;

  // 1. Downgrade version if needed
  const cardVersion = parseFloat(adapted.version as string);
  const maxVersion = parseFloat(support.maxVersion);
  if (!isNaN(cardVersion) && !isNaN(maxVersion) && cardVersion > maxVersion) {
    changes.push(`Downgraded version from ${adapted.version} to ${support.maxVersion}`);
    adapted.version = support.maxVersion;
  }

  // 2. Walk and replace unsupported body elements
  if (Array.isArray(adapted.body)) {
    adapted.body = adaptElements(adapted.body as ElementRecord[], support, changes);
  }

  // 3. Walk and replace unsupported actions at card level
  if (Array.isArray(adapted.actions)) {
    adapted.actions = adaptActions(adapted.actions as ElementRecord[], support, changes);

    // Trim to maxActions
    const actions = adapted.actions as ElementRecord[];
    if (actions.length > support.maxActions) {
      const removed = actions.length - support.maxActions;
      adapted.actions = actions.slice(0, support.maxActions);
      changes.push(`Trimmed ${removed} action(s) to meet ${targetHost} limit of ${support.maxActions}`);
    }
  }

  // 4. Add host-specific warnings
  for (const note of support.notes) {
    warnings.push(note);
  }

  return { card: adapted, changes, warnings };
}

function adaptElements(elements: ElementRecord[], support: HostVersionSupport, changes: string[]): ElementRecord[] {
  const result: ElementRecord[] = [];

  for (const element of elements) {
    const type = element.type as string;

    if (!type) {
      result.push(element);
      continue;
    }

    // Check if this element type is unsupported
    if (support.unsupportedElements.includes(type)) {
      const replacement = replaceElement(element, type, changes);
      if (Array.isArray(replacement)) {
        result.push(...replacement);
      } else {
        result.push(replacement);
      }
    } else {
      // Element is supported — but recurse into children
      const adapted = { ...element };

      if (Array.isArray(adapted.items)) {
        adapted.items = adaptElements(adapted.items as ElementRecord[], support, changes);
      }
      if (Array.isArray(adapted.columns)) {
        adapted.columns = (adapted.columns as ElementRecord[]).map((col) => {
          if (Array.isArray(col.items)) {
            return { ...col, items: adaptElements(col.items as ElementRecord[], support, changes) };
          }
          return col;
        });
      }
      if (Array.isArray(adapted.body)) {
        adapted.body = adaptElements(adapted.body as ElementRecord[], support, changes);
      }
      // Recurse into Carousel pages (if Carousel is supported on this host)
      if (Array.isArray(adapted.pages)) {
        adapted.pages = (adapted.pages as ElementRecord[]).map((page) => {
          if (Array.isArray(page.items)) {
            return { ...page, items: adaptElements(page.items as ElementRecord[], support, changes) };
          }
          return page;
        });
      }
      // Recurse into inline actions
      if (Array.isArray(adapted.actions)) {
        adapted.actions = adaptActions(adapted.actions as ElementRecord[], support, changes);
      }

      result.push(adapted);
    }
  }

  return result;
}

function replaceElement(element: ElementRecord, type: string, changes: string[]): ElementRecord | ElementRecord[] {
  if (type === "Table") {
    changes.push("Replaced Table with ColumnSet layout");
    return convertTableToColumnSet(element);
  }

  if (type === "Carousel") {
    changes.push("Replaced Carousel with Container(s)");
    return convertCarouselToContainers(element);
  }

  if (CHART_TYPES.has(type)) {
    changes.push(`Replaced ${type} with FactSet`);
    return convertChartToFactSet(element);
  }

  if (type === "CodeBlock") {
    changes.push("Replaced CodeBlock with styled Container + monospace TextBlock");
    return convertCodeBlockToContainer(element);
  }

  if (type === "Rating") {
    changes.push("Replaced Rating with TextBlock representation");
    return convertRatingToTextBlock(element);
  }

  if (PROGRESS_TYPES.has(type)) {
    changes.push(`Replaced ${type} with TextBlock representation`);
    return convertProgressToTextBlock(element);
  }

  // Generic fallback: replace with a TextBlock noting the unsupported element
  changes.push(`Removed unsupported element: ${type}`);
  return {
    type: "TextBlock",
    text: `[${type} — not supported on this host]`,
    isSubtle: true,
    wrap: true,
  };
}

function adaptActions(actions: ElementRecord[], support: HostVersionSupport, changes: string[]): ElementRecord[] {
  return actions.map((action) => {
    const type = action.type as string;

    if (type === "Action.Execute" && support.unsupportedActions.includes("Action.Execute")) {
      changes.push("Replaced Action.Execute with Action.Submit");
      return convertActionExecuteToSubmit(action);
    }

    if (type === "Action.Submit" && support.unsupportedActions.includes("Action.Submit")) {
      changes.push("Replaced Action.Submit with Action.Execute");
      return convertActionSubmitToExecute(action);
    }

    if (support.unsupportedActions.includes(type)) {
      changes.push(`Removed unsupported action: ${type}`);
      return {
        type: "Action.OpenUrl",
        title: action.title || "(unsupported action)",
        url: "",
      };
    }

    return action;
  });
}
