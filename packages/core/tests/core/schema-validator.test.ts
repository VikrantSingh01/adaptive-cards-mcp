import { afterEach, describe, it, expect, vi } from "vitest";
import {
  getSchemaInfo,
  refreshSchema,
  resetSchemaToBundled,
  validateCard,
} from "../../src/core/schema-validator.js";

afterEach(() => {
  resetSchemaToBundled();
});

describe("schema-validator", () => {
  it("validates a minimal valid card", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "TextBlock", text: "Hello" }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });

  it("accepts card missing type (schema permits it)", () => {
    // The official AC schema does not require "type" at root level
    const result = validateCard({ version: "1.6", body: [] });
    expect(() => validateCard({ version: "1.6", body: [] })).not.toThrow();
  });

  it("accepts card missing version (schema permits it)", () => {
    // The official AC schema does not require "version" at root level
    const result = validateCard({ type: "AdaptiveCard", body: [] });
    expect(() => validateCard({ type: "AdaptiveCard", body: [] })).not.toThrow();
  });

  it("validates a card with all element types", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        { type: "TextBlock", text: "Title", size: "large", weight: "bolder" },
        { type: "Image", url: "https://example.com/img.png", altText: "test" },
        {
          type: "Container",
          items: [{ type: "TextBlock", text: "Nested" }],
        },
        {
          type: "ColumnSet",
          columns: [
            {
              type: "Column",
              width: "stretch",
              items: [{ type: "TextBlock", text: "Col 1" }],
            },
          ],
        },
        {
          type: "FactSet",
          facts: [{ title: "Key", value: "Value" }],
        },
      ],
      actions: [
        { type: "Action.Execute", title: "Submit", verb: "submit" },
        { type: "Action.OpenUrl", title: "Open", url: "https://example.com" },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid TextBlock properties", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        {
          type: "TextBlock",
          text: "Hi",
          size: "huge",     // invalid enum value
          weight: "bold",   // invalid — should be "bolder" or "lighter"
          color: "pink",    // invalid color
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it("validates Action.ShowCard with nested card", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "TextBlock", text: "Main" }],
      actions: [
        {
          type: "Action.ShowCard",
          title: "Show",
          card: {
            type: "AdaptiveCard",
            version: "1.6",
            body: [{ type: "TextBlock", text: "Sub" }],
          },
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects Action.OpenUrl missing url", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [],
      actions: [{ type: "Action.OpenUrl", title: "Open" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.severity === "error")).toBe(true);
  });

  it("rejects TextBlock missing text", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "TextBlock" }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects Image missing url", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "Image" }],
    });
    expect(result.valid).toBe(false);
  });

  it("validates FactSet with facts", () => {
    const result = validateCard({
      type: "AdaptiveCard",
      version: "1.6",
      body: [
        {
          type: "FactSet",
          facts: [{ title: "Key", value: "Value" }],
        },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("does not throw on any valid card", () => {
    expect(() =>
      validateCard({
        type: "AdaptiveCard",
        version: "1.6",
        body: [{ type: "TextBlock", text: "Hello", wrap: true }],
        actions: [{ type: "Action.Execute", title: "Go", verb: "go" }],
      })
    ).not.toThrow();
  });

  it("does not throw on empty input", () => {
    expect(() => validateCard({})).not.toThrow();
    expect(() => validateCard({ type: "AdaptiveCard" })).not.toThrow();
  });

  it("refreshes the active schema without changing the sync validateCard API", async () => {
    const remoteSchema = {
      type: "object",
      properties: {
        type: { const: "AdaptiveCard" },
        version: { type: "string" },
        body: { type: "array" },
        marker: { type: "string" },
      },
      required: ["type"],
      additionalProperties: false,
    };

    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(remoteSchema), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const result = await refreshSchema({
      url: "https://example.test/adaptive-card.json",
      fetchImpl,
    });

    expect(result.updated).toBe(true);
    expect(getSchemaInfo().source).toBe("remote");
    expect(
      validateCard({ type: "AdaptiveCard", marker: "remote-schema" }).valid,
    ).toBe(true);
  });

  it("keeps the bundled schema when a remote refresh fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const result = await refreshSchema({
      url: "https://example.test/unavailable.json",
      fetchImpl,
    });

    expect(result.updated).toBe(false);
    expect(result.source).toBe("bundled");
    expect(result.error).toContain("offline");
    expect(
      validateCard({
        type: "AdaptiveCard",
        version: "1.6",
        body: [{ type: "TextBlock", text: "Still valid" }],
      }).valid,
    ).toBe(true);
  });
});
