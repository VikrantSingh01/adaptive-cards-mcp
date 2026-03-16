/**
 * Preview — Generate a self-contained HTML page that opens the Adaptive Cards
 * Designer with a card payload auto-loaded via postMessage.
 *
 * The AC Designer (https://adaptivecards.microsoft.com/designer) supports
 * receiving card payloads via window.postMessage after it emits "ac-designer-ready".
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const DESIGNER_BASE_URL = "https://adaptivecards.microsoft.com";
const DESIGNER_URL = `${DESIGNER_BASE_URL}/designer`;

/**
 * Generate the HTML bridge page that embeds the AC Designer and auto-sends
 * the card payload via postMessage.
 */
export function generatePreviewHtml(cardJson: Record<string, unknown>): string {
  // Double-stringify then escape HTML-sensitive chars to prevent XSS
  const rawPayload = JSON.stringify(JSON.stringify(cardJson));
  const escapedPayload = rawPayload
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Adaptive Card Preview — Designer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; height: 100vh; display: flex; flex-direction: column; }
    .header { padding: 8px 16px; background: #0078d4; color: white; display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .header .status { opacity: 0.8; font-size: 12px; }
    .header .status.ready { opacity: 1; color: #a0f0a0; }
    iframe { flex: 1; border: none; width: 100%; }
  </style>
</head>
<body>
  <div class="header">
    <strong>Adaptive Cards MCP — Designer Preview</strong>
    <span class="status" id="status">Loading designer...</span>
  </div>
  <iframe id="designer" src="${DESIGNER_URL}" title="Adaptive Cards Designer"></iframe>
  <script>
    const designerOrigin = "${DESIGNER_BASE_URL}";
    const cardPayload = ${escapedPayload};
    const iframe = document.getElementById("designer");
    const status = document.getElementById("status");

    window.addEventListener("message", function(event) {
      if (event.origin === designerOrigin && event.data === "ac-designer-ready") {
        status.textContent = "Card loaded!";
        status.className = "status ready";
        iframe.contentWindow.postMessage({
          type: "cardPayload",
          id: "card",
          payload: cardPayload
        }, designerOrigin + "/designer");
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Write a preview HTML file to a temp directory and return the file path.
 * Used by stdio transport where we can't serve HTTP.
 */
export function writePreviewFile(cardJson: Record<string, unknown>): string {
  const html = generatePreviewHtml(cardJson);
  const filename = `ac-preview-${randomUUID().slice(0, 8)}.html`;
  const filePath = join(tmpdir(), filename);
  writeFileSync(filePath, html, "utf-8");
  return filePath;
}
