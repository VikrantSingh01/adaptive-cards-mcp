/**
 * Tests for preview HTML generation
 */
import { describe, it, expect, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { generatePreviewHtml, writePreviewFile } from "../../src/utils/preview.js";

const sampleCard = {
  type: "AdaptiveCard",
  version: "1.6",
  body: [{ type: "TextBlock", text: "Hello World", wrap: true }],
};

describe("Preview", () => {
  const filesToCleanup: string[] = [];

  afterEach(() => {
    for (const f of filesToCleanup) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
    filesToCleanup.length = 0;
  });

  it("should generate valid HTML with embedded card payload", () => {
    const html = generatePreviewHtml(sampleCard);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("adaptivecards.microsoft.com/designer");
    expect(html).toContain("ac-designer-ready");
    expect(html).toContain("cardPayload");
    expect(html).toContain("Hello World");
  });

  it("should escape card JSON safely in HTML", () => {
    const cardWithSpecialChars = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "TextBlock", text: '<script>alert("xss")</script>' }],
    };

    const html = generatePreviewHtml(cardWithSpecialChars);
    // The payload should be double-JSON-stringified (escaped), not raw HTML
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("\\u003c"); // JSON-escaped < character
  });

  it("should write preview file to temp directory", () => {
    const filePath = writePreviewFile(sampleCard);
    filesToCleanup.push(filePath);

    expect(filePath).toContain("ac-preview-");
    expect(filePath).toMatch(/\.html$/);
    expect(existsSync(filePath)).toBe(true);
  });

  it("should include postMessage with correct structure", () => {
    const html = generatePreviewHtml(sampleCard);

    // Verify the postMessage call structure
    expect(html).toContain('type: "cardPayload"');
    expect(html).toContain('id: "card"');
    expect(html).toContain("payload: cardPayload");
  });
});
