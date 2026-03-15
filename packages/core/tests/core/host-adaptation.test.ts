import { describe, it, expect } from "vitest";
import { adaptCardForHost } from "../../src/core/host-compatibility.js";

describe("host-adaptation", () => {
  it("adapts Table to ColumnSet for Outlook", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        {
          type: "Table",
          firstRowAsHeader: true,
          columns: [{ width: 1 }, { width: 1 }],
          rows: [
            {
              type: "TableRow",
              cells: [
                { type: "TableCell", items: [{ type: "TextBlock", text: "Name", weight: "bolder", wrap: true }] },
                { type: "TableCell", items: [{ type: "TextBlock", text: "Role", weight: "bolder", wrap: true }] },
              ],
            },
            {
              type: "TableRow",
              cells: [
                { type: "TableCell", items: [{ type: "TextBlock", text: "Alice", wrap: true }] },
                { type: "TableCell", items: [{ type: "TextBlock", text: "Engineer", wrap: true }] },
              ],
            },
          ],
        },
      ],
    };

    const result = adaptCardForHost(card, "outlook");
    const cardStr = JSON.stringify(result.card);

    expect(result.card.version).toBe("1.4");
    expect(cardStr).toContain("ColumnSet");
    expect(cardStr).not.toContain('"type":"Table"');
    expect(cardStr).toContain("Alice");
    expect(cardStr).toContain("Engineer");
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.includes("Table"))).toBe(true);
  });

  it("adapts Carousel to Container for Outlook", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        {
          type: "Carousel",
          pages: [
            {
              type: "CarouselPage",
              items: [{ type: "TextBlock", text: "Page 1 content", wrap: true }],
            },
            {
              type: "CarouselPage",
              items: [{ type: "TextBlock", text: "Page 2 content", wrap: true }],
            },
          ],
        },
      ],
    };

    const result = adaptCardForHost(card, "outlook");
    const cardStr = JSON.stringify(result.card);

    expect(cardStr).toContain("Container");
    expect(cardStr).not.toContain('"type":"Carousel"');
    expect(cardStr).toContain("Page 1 content");
    expect(cardStr).toContain("Page 2 content");
    expect(cardStr).toContain("Converted from Carousel");
    expect(result.changes.some((c) => c.includes("Carousel"))).toBe(true);
  });

  it("replaces Action.Execute with Action.Submit for Webex", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.3",
      body: [{ type: "TextBlock", text: "Hello", wrap: true }],
      actions: [
        {
          type: "Action.Execute",
          title: "Approve",
          verb: "approve",
          style: "positive",
          data: { requestId: "123" },
        },
      ],
    };

    const result = adaptCardForHost(card, "webex");
    const actions = result.card.actions as Record<string, unknown>[];

    expect(actions[0].type).toBe("Action.Submit");
    expect(actions[0].title).toBe("Approve");
    expect(actions[0].style).toBe("positive");
    expect((actions[0].data as Record<string, unknown>).verb).toBe("approve");
    expect((actions[0].data as Record<string, unknown>).requestId).toBe("123");
    expect(result.changes.some((c) => c.includes("Action.Execute") && c.includes("Action.Submit"))).toBe(true);
  });

  it("converts Chart to FactSet for Outlook", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        {
          type: "BarChart",
          data: [
            { label: "Q1", value: 100 },
            { label: "Q2", value: 200 },
            { label: "Q3", value: 150 },
          ],
        },
      ],
    };

    const result = adaptCardForHost(card, "outlook");
    const cardStr = JSON.stringify(result.card);

    expect(cardStr).toContain("FactSet");
    expect(cardStr).not.toContain('"type":"BarChart"');
    expect(cardStr).toContain("Q1");
    expect(cardStr).toContain("200");
    expect(result.changes.some((c) => c.includes("BarChart") && c.includes("FactSet"))).toBe(true);
  });

  it("trims actions to host maxActions limit", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.4",
      body: [{ type: "TextBlock", text: "Hello", wrap: true }],
      actions: Array.from({ length: 8 }, (_, i) => ({
        type: "Action.Execute",
        title: `Action ${i + 1}`,
      })),
    };

    const result = adaptCardForHost(card, "outlook");
    const actions = result.card.actions as Record<string, unknown>[];

    expect(actions.length).toBe(4); // Outlook maxActions is 4
    expect(result.changes.some((c) => c.includes("Trimmed"))).toBe(true);
  });

  it("downgrades version for the target host", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "TextBlock", text: "Hello", wrap: true }],
    };

    const result = adaptCardForHost(card, "webex");
    expect(result.card.version).toBe("1.3");
    expect(result.changes.some((c) => c.includes("Downgraded version"))).toBe(true);
  });

  it("returns warnings with host notes", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.3",
      body: [{ type: "TextBlock", text: "Hello", wrap: true }],
    };

    const result = adaptCardForHost(card, "webex");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("Webex") || w.includes("webex") || w.includes("1.3"))).toBe(true);
  });

  it("leaves cards unchanged for generic host", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        { type: "Carousel", pages: [{ items: [{ type: "TextBlock", text: "Slide" }] }] },
        { type: "Table", columns: [], rows: [] },
        { type: "DonutChart", data: [{ label: "A", value: 1 }] },
      ],
      actions: [
        { type: "Action.Execute", title: "Go" },
      ],
    };

    const result = adaptCardForHost(card, "generic");
    const cardStr = JSON.stringify(result.card);

    expect(cardStr).toContain('"type":"Carousel"');
    expect(cardStr).toContain('"type":"Table"');
    expect(cardStr).toContain('"type":"DonutChart"');
    expect(cardStr).toContain('"type":"Action.Execute"');
    expect(result.changes.length).toBe(0);
  });

  it("handles deeply nested unsupported elements", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        {
          type: "Container",
          items: [
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "CodeBlock",
                      codeSnippet: "console.log('hello');",
                      language: "javascript",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = adaptCardForHost(card, "outlook");
    const cardStr = JSON.stringify(result.card);

    expect(cardStr).not.toContain('"type":"CodeBlock"');
    expect(cardStr).toContain("monospace");
    expect(cardStr).toContain("console.log");
    expect(result.changes.some((c) => c.includes("CodeBlock"))).toBe(true);
  });

  it("converts Rating and ProgressBar to TextBlock", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        { type: "Rating", value: 4, max: 5 },
        { type: "ProgressBar", value: 75 },
        { type: "Spinner", label: "Please wait..." },
      ],
    };

    const result = adaptCardForHost(card, "outlook");
    const cardStr = JSON.stringify(result.card);

    expect(cardStr).not.toContain('"type":"Rating"');
    expect(cardStr).not.toContain('"type":"ProgressBar"');
    expect(cardStr).not.toContain('"type":"Spinner"');
    expect(cardStr).toContain("Rating: 4/5");
    expect(cardStr).toContain("Progress: 75%");
    expect(cardStr).toContain("Please wait...");
    expect(result.changes.length).toBeGreaterThanOrEqual(3);
  });
});
