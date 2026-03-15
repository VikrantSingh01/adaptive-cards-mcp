import * as vscode from "vscode";

export class CardPreviewPanel {
  public static currentPanel: CardPreviewPanel | undefined;
  private static readonly viewType = "adaptiveCardPreview";
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, card: Record<string, unknown>) {
    const column = vscode.ViewColumn.Beside;

    if (CardPreviewPanel.currentPanel) {
      CardPreviewPanel.currentPanel.panel.reveal(column);
      CardPreviewPanel.currentPanel.update(card);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      CardPreviewPanel.viewType,
      "Adaptive Card Preview",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    CardPreviewPanel.currentPanel = new CardPreviewPanel(panel, card);
  }

  private constructor(panel: vscode.WebviewPanel, card: Record<string, unknown>) {
    this.panel = panel;
    this.update(card);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public update(card: Record<string, unknown>) {
    this.panel.webview.html = this.getHtml(card);
  }

  private dispose() {
    CardPreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  private getHtml(card: Record<string, unknown>): string {
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const cardJson = JSON.stringify(card, null, 2);
    const escapedJson = cardJson.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Adaptive Card Preview</title>
  <script src="https://unpkg.com/adaptivecards@3.0.4/dist/adaptivecards.min.js"></script>
  <style>
    body {
      font-family: 'Segoe UI', -apple-system, sans-serif;
      margin: 0;
      padding: 16px;
      background: ${isDark ? "#1e1e1e" : "#ffffff"};
      color: ${isDark ? "#e0e0e0" : "#333"};
    }
    #card-container {
      max-width: 450px;
      margin: 0 auto;
      border: 1px solid ${isDark ? "#333" : "#ddd"};
      border-radius: 8px;
      overflow: hidden;
      background: ${isDark ? "#252526" : "#fff"};
    }
    .ac-adaptiveCard {
      padding: 12px !important;
    }
    h3 {
      font-size: 13px;
      color: ${isDark ? "#888" : "#666"};
      margin: 16px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    pre {
      background: ${isDark ? "#1a1a1a" : "#f5f5f5"};
      border: 1px solid ${isDark ? "#333" : "#ddd"};
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      font-size: 12px;
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      max-height: 400px;
    }
    .error { color: #f48771; padding: 12px; }
  </style>
</head>
<body>
  <h3>Preview</h3>
  <div id="card-container"></div>
  <h3>JSON</h3>
  <pre id="json-output"></pre>
  <script>
    try {
      const cardPayload = ${escapedJson};
      document.getElementById('json-output').textContent = JSON.stringify(cardPayload, null, 2);
      const adaptiveCard = new AdaptiveCards.AdaptiveCard();
      adaptiveCard.hostConfig = new AdaptiveCards.HostConfig({
        fontFamily: "'Segoe UI', -apple-system, sans-serif",
        containerStyles: {
          default: {
            backgroundColor: "${isDark ? "#252526" : "#ffffff"}",
            foregroundColors: {
              default: { default: "${isDark ? "#e0e0e0" : "#333333"}" },
              accent: { default: "#0078d4" },
              good: { default: "#107c10" },
              attention: { default: "#d13438" },
              warning: { default: "#ff8c00" }
            }
          },
          emphasis: {
            backgroundColor: "${isDark ? "#333333" : "#f0f0f0"}"
          }
        }
      });
      adaptiveCard.parse(cardPayload);
      const rendered = adaptiveCard.render();
      if (rendered) {
        document.getElementById('card-container').appendChild(rendered);
      } else {
        document.getElementById('card-container').innerHTML = '<div class="error">Failed to render card</div>';
      }
    } catch (e) {
      document.getElementById('card-container').innerHTML = '<div class="error">Error: ' + e.message + '</div>';
      document.getElementById('json-output').textContent = '${escapedJson}';
    }
  </script>
</body>
</html>`;
  }
}
