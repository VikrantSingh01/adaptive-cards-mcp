/**
 * Embedded Adaptive Card Designer — Full interactive editor inside VS Code
 *
 * Features:
 * - Split view: rendered card preview (left) + JSON editor (right)
 * - Live preview: card updates as you type
 * - Host config switcher (Teams light/dark, Outlook, Webchat)
 * - Element palette: drag-and-drop common elements
 * - Validation panel with real-time diagnostics
 * - Export to file / copy to clipboard
 * - AI Generate button (uses configured provider)
 */
import * as vscode from "vscode";

export class CardDesignerPanel {
  public static currentPanel: CardDesignerPanel | undefined;
  private static readonly viewType = "adaptiveCardDesigner";
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, initialCard?: Record<string, unknown>) {
    const column = vscode.ViewColumn.One;

    if (CardDesignerPanel.currentPanel) {
      CardDesignerPanel.currentPanel.panel.reveal(column);
      if (initialCard) {
        CardDesignerPanel.currentPanel.loadCard(initialCard);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      CardDesignerPanel.viewType,
      "Adaptive Card Designer",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    CardDesignerPanel.currentPanel = new CardDesignerPanel(panel, extensionUri, initialCard);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initialCard?: Record<string, unknown>
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(initialCard);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "saveToFile": {
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file("card.json"),
              filters: { "Adaptive Card": ["json"], "Card JSON": ["card.json"] },
            });
            if (uri) {
              await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(message.json, "utf-8")
              );
              vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
            }
            break;
          }
          case "copyToClipboard":
            await vscode.env.clipboard.writeText(message.json);
            vscode.window.showInformationMessage("Card JSON copied to clipboard");
            break;
          case "openInEditor": {
            const doc = await vscode.workspace.openTextDocument({
              content: message.json,
              language: "json",
            });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            break;
          }
          case "openExternal":
            await vscode.env.clipboard.writeText(message.json);
            await vscode.env.openExternal(
              vscode.Uri.parse("https://adaptivecards.microsoft.com/designer")
            );
            vscode.window.showInformationMessage(
              "Card JSON copied. Paste into the Designer's Card Payload Editor."
            );
            break;
          case "aiGenerate": {
            const { generateWithAI } = await import("./llm-generator");
            const result = await generateWithAI(
              message.prompt,
              message.host || "teams",
              message.intent
            );
            if (result) {
              this.panel.webview.postMessage({
                command: "loadCard",
                card: result.card,
                provider: result.provider,
              });
            } else {
              // Fallback to deterministic
              const { generateCard } = await import("adaptive-cards-mcp");
              const fallback = await generateCard({
                content: message.prompt,
                host: message.host || "teams",
                intent: message.intent,
              });
              this.panel.webview.postMessage({
                command: "loadCard",
                card: fallback.card,
                provider: "Pattern matching",
              });
            }
            break;
          }
        }
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public loadCard(card: Record<string, unknown>) {
    this.panel.webview.postMessage({ command: "loadCard", card });
  }

  private dispose() {
    CardDesignerPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  private getHtml(initialCard?: Record<string, unknown>): string {
    const cardJson = initialCard
      ? JSON.stringify(initialCard, null, 2)
      : JSON.stringify(
          {
            type: "AdaptiveCard",
            version: "1.6",
            body: [
              {
                type: "TextBlock",
                text: "Welcome to the Adaptive Card Designer",
                size: "medium",
                weight: "bolder",
                wrap: true,
                style: "heading",
              },
              {
                type: "TextBlock",
                text: "Edit the JSON on the right or use AI Generate below to create a card.",
                wrap: true,
                isSubtle: true,
              },
            ],
          },
          null,
          2
        );

    const escaped = cardJson.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Adaptive Card Designer</title>
<script src="https://unpkg.com/adaptivecards@3.0.4/dist/adaptivecards.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #1e1e1e; --fg: #e0e0e0; --border: #333; --card-bg: #252526;
    --input-bg: #2d2d2d; --accent: #0078d4; --accent-hover: #106ebe;
    --success: #107c10; --error: #d13438; --warning: #ff8c00;
    --subtle: #888; --panel-bg: #252526; --code-bg: #1a1a1a;
  }
  body { font-family: 'Segoe UI', -apple-system, sans-serif; background: var(--bg); color: var(--fg); height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

  /* ─── Toolbar ─── */
  .toolbar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--panel-bg); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .toolbar-title { font-weight: 600; font-size: 13px; margin-right: auto; }
  .toolbar select { background: var(--input-bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 12px; font-family: inherit; }
  .btn { padding: 5px 10px; border: 1px solid var(--border); border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; font-weight: 500; background: var(--input-bg); color: var(--fg); white-space: nowrap; }
  .btn:hover { background: #3c3c3c; }
  .btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-success { background: var(--success); color: white; border-color: var(--success); }

  /* ─── Main Layout ─── */
  .main { display: flex; flex: 1; overflow: hidden; }

  /* ─── Left: Preview ─── */
  .preview-pane { flex: 1; display: flex; flex-direction: column; border-right: 1px solid var(--border); min-width: 300px; }
  .preview-header { padding: 6px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--subtle); background: var(--panel-bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .preview-scroll { flex: 1; overflow: auto; padding: 16px; display: flex; justify-content: center; align-items: flex-start; }
  #card-container { width: 100%; max-width: 500px; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.3); overflow: hidden; min-height: 100px; }
  .ac-adaptiveCard { padding: 12px !important; }
  .preview-error { color: var(--error); padding: 16px; font-size: 13px; }

  /* ─── Right: Editor ─── */
  .editor-pane { flex: 1; display: flex; flex-direction: column; min-width: 300px; }
  .editor-header { padding: 6px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--subtle); background: var(--panel-bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  #json-editor { flex: 1; width: 100%; background: var(--code-bg); color: #d4d4d4; border: none; padding: 12px; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; resize: none; outline: none; tab-size: 2; }

  /* ─── Validation Bar ─── */
  .validation-bar { padding: 6px 12px; font-size: 11px; border-top: 1px solid var(--border); background: var(--panel-bg); display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-ok { background: rgba(16,124,16,0.2); color: #4ec94e; }
  .badge-err { background: rgba(209,52,56,0.2); color: #f48771; }
  .badge-warn { background: rgba(255,140,0,0.2); color: #ffaa44; }

  /* ─── Element Palette ─── */
  .palette { display: flex; gap: 4px; flex-wrap: wrap; padding: 8px 12px; background: var(--panel-bg); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .palette-btn { padding: 3px 8px; border: 1px solid var(--border); border-radius: 3px; font-size: 10px; cursor: pointer; background: var(--input-bg); color: var(--fg); font-family: inherit; }
  .palette-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* ─── AI Panel ─── */
  .ai-panel { padding: 8px 12px; background: var(--panel-bg); border-top: 1px solid var(--border); display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .ai-input { flex: 1; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; color: var(--fg); padding: 6px 10px; font-size: 12px; font-family: inherit; }
  .ai-input:focus { outline: none; border-color: var(--accent); }
  .ai-input::placeholder { color: var(--subtle); }

  /* ─── Resizer ─── */
  .resizer { width: 4px; cursor: col-resize; background: var(--border); flex-shrink: 0; }
  .resizer:hover { background: var(--accent); }
</style>
</head>
<body>

<div class="toolbar">
  <span class="toolbar-title">Adaptive Card Designer</span>
  <label style="font-size:11px;color:var(--subtle)">Host:</label>
  <select id="host-select">
    <option value="teams-light">Teams (Light)</option>
    <option value="teams-dark">Teams (Dark)</option>
    <option value="outlook">Outlook</option>
    <option value="webchat">Web Chat</option>
    <option value="default">Default</option>
  </select>
  <label style="font-size:11px;color:var(--subtle)">Size:</label>
  <select id="size-select">
    <option value="desktop">Desktop (500px)</option>
    <option value="tablet">Tablet (400px)</option>
    <option value="mobile">Mobile (320px)</option>
    <option value="narrow">Narrow (280px)</option>
    <option value="full">Full width</option>
  </select>
  <button class="btn" onclick="action('copyToClipboard')">Copy</button>
  <button class="btn" onclick="action('saveToFile')">Save</button>
  <button class="btn" onclick="action('openInEditor')">Open in Editor</button>
  <button class="btn" onclick="action('openExternal')">Open in AC Designer</button>
</div>

<div class="palette">
  <span style="font-size:10px;color:var(--subtle);margin-right:4px;">Insert:</span>
  <button class="palette-btn" onclick="insertElement('TextBlock')">TextBlock</button>
  <button class="palette-btn" onclick="insertElement('Image')">Image</button>
  <button class="palette-btn" onclick="insertElement('ColumnSet')">ColumnSet</button>
  <button class="palette-btn" onclick="insertElement('FactSet')">FactSet</button>
  <button class="palette-btn" onclick="insertElement('Table')">Table</button>
  <button class="palette-btn" onclick="insertElement('Container')">Container</button>
  <button class="palette-btn" onclick="insertElement('Input.Text')">Input.Text</button>
  <button class="palette-btn" onclick="insertElement('Input.ChoiceSet')">Input.ChoiceSet</button>
  <button class="palette-btn" onclick="insertElement('Input.Date')">Input.Date</button>
  <button class="palette-btn" onclick="insertElement('Input.Toggle')">Input.Toggle</button>
  <button class="palette-btn" onclick="insertElement('ActionSet')">ActionSet</button>
  <button class="palette-btn" onclick="insertElement('ImageSet')">ImageSet</button>
</div>

<div class="main">
  <div class="preview-pane" id="preview-pane">
    <div class="preview-header">
      <span>Preview</span>
      <span id="element-count" style="font-weight:400"></span>
    </div>
    <div class="preview-scroll">
      <div id="card-container"></div>
    </div>
  </div>
  <div class="resizer" id="resizer"></div>
  <div class="editor-pane" id="editor-pane">
    <div class="editor-header">
      <span>Card Payload Editor</span>
      <button class="btn" onclick="formatJson()" style="font-size:10px">Format</button>
    </div>
    <textarea id="json-editor" spellcheck="false"></textarea>
  </div>
</div>

<div class="validation-bar" id="validation-bar">
  <span id="valid-badge" class="badge badge-ok">Valid</span>
  <span id="validation-msg" style="font-size:11px"></span>
</div>

<div class="ai-panel">
  <input class="ai-input" id="ai-input" placeholder="Describe a card... (Ctrl+Enter to generate)" />
  <button class="btn btn-primary" onclick="aiGenerate()">AI Generate</button>
</div>

<script>
const vscode = acquireVsCodeApi();
const editor = document.getElementById('json-editor');
const container = document.getElementById('card-container');
let debounceTimer = null;

// ─── Host Configs ───
const hostConfigs = {
  'teams-light': { fontFamily: "'Segoe UI',sans-serif", containerStyles: { default: { backgroundColor: "#fff", foregroundColors: { default:{default:"#333"}, accent:{default:"#0078d4"}, good:{default:"#107c10"}, attention:{default:"#d13438"}, warning:{default:"#ff8c00"} } }, emphasis: { backgroundColor: "#f0f0f0" } } },
  'teams-dark': { fontFamily: "'Segoe UI',sans-serif", containerStyles: { default: { backgroundColor: "#2d2d2d", foregroundColors: { default:{default:"#e0e0e0"}, accent:{default:"#6cb6ff"}, good:{default:"#4ec94e"}, attention:{default:"#f48771"}, warning:{default:"#ff8c00"} } }, emphasis: { backgroundColor: "#383838" } } },
  'outlook': { fontFamily: "'Segoe UI',sans-serif", containerStyles: { default: { backgroundColor: "#fff", foregroundColors: { default:{default:"#333"}, accent:{default:"#0078d4"}, good:{default:"#107c10"}, attention:{default:"#d13438"}, warning:{default:"#ff8c00"} } }, emphasis: { backgroundColor: "#f4f4f4" } } },
  'webchat': { fontFamily: "'Segoe UI',sans-serif", containerStyles: { default: { backgroundColor: "#fff", foregroundColors: { default:{default:"#333"}, accent:{default:"#0078d4"}, good:{default:"#107c10"}, attention:{default:"#d13438"}, warning:{default:"#ff8c00"} } }, emphasis: { backgroundColor: "#f0f0f0" } } },
  'default': { containerStyles: { default: { backgroundColor: "#fff", foregroundColors: { default:{default:"#333"}, accent:{default:"#0078d4"}, good:{default:"#107c10"}, attention:{default:"#d13438"}, warning:{default:"#ff8c00"} } }, emphasis: { backgroundColor: "#f0f0f0" } } }
};

// ─── Element Templates ───
const ELEMENTS = {
  TextBlock: { type: "TextBlock", text: "New text", wrap: true },
  Image: { type: "Image", url: "https://adaptivecards.io/content/cats/1.png", altText: "Image", size: "medium" },
  ColumnSet: { type: "ColumnSet", columns: [{ type: "Column", width: "stretch", items: [{ type: "TextBlock", text: "Column 1", wrap: true }] }, { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: "Column 2", wrap: true }] }] },
  FactSet: { type: "FactSet", facts: [{ title: "Fact 1", value: "Value 1" }, { title: "Fact 2", value: "Value 2" }] },
  Table: { type: "Table", firstRowAsHeader: true, showGridLines: true, gridStyle: "accent", columns: [{ width: 1 }, { width: 1 }], rows: [{ type: "TableRow", cells: [{ type: "TableCell", items: [{ type: "TextBlock", text: "Header 1", weight: "bolder", wrap: true }] }, { type: "TableCell", items: [{ type: "TextBlock", text: "Header 2", weight: "bolder", wrap: true }] }] }, { type: "TableRow", cells: [{ type: "TableCell", items: [{ type: "TextBlock", text: "Value 1", wrap: true }] }, { type: "TableCell", items: [{ type: "TextBlock", text: "Value 2", wrap: true }] }] }] },
  Container: { type: "Container", items: [{ type: "TextBlock", text: "Container content", wrap: true }] },
  "Input.Text": { type: "Input.Text", id: "input" + Date.now(), label: "Text Input", placeholder: "Enter text..." },
  "Input.ChoiceSet": { type: "Input.ChoiceSet", id: "choice" + Date.now(), label: "Choice", style: "compact", choices: [{ title: "Option 1", value: "1" }, { title: "Option 2", value: "2" }] },
  "Input.Date": { type: "Input.Date", id: "date" + Date.now(), label: "Date" },
  "Input.Toggle": { type: "Input.Toggle", id: "toggle" + Date.now(), title: "Toggle option", label: "Toggle" },
  ActionSet: { type: "ActionSet", actions: [{ type: "Action.Execute", title: "Submit", verb: "submit" }] },
  ImageSet: { type: "ImageSet", imageSize: "medium", images: [{ type: "Image", url: "https://adaptivecards.io/content/cats/1.png", altText: "Image 1" }, { type: "Image", url: "https://adaptivecards.io/content/cats/2.png", altText: "Image 2" }] },
};

// ─── Init ───
editor.value = \`${escaped}\`;
render();

// ─── Render ───
function render() {
  container.innerHTML = '';
  try {
    const card = JSON.parse(editor.value);
    const ac = new AdaptiveCards.AdaptiveCard();
    const host = document.getElementById('host-select').value;
    ac.hostConfig = new AdaptiveCards.HostConfig(hostConfigs[host] || hostConfigs['default']);
    // Set background for dark hosts
    if (host === 'teams-dark') {
      container.style.background = '#2d2d2d';
    } else {
      container.style.background = '#fff';
    }
    ac.parse(card);
    const rendered = ac.render();
    if (rendered) {
      container.appendChild(rendered);
      validate(card, true);
    } else {
      container.innerHTML = '<div class="preview-error">Failed to render card</div>';
      validate(card, false);
    }
    // Stats
    let count = 0;
    function countEls(items) { if (!Array.isArray(items)) return; items.forEach(el => { if (el && el.type) { count++; if (el.items) countEls(el.items); if (el.columns) el.columns.forEach(c => { if (c.items) countEls(c.items); }); } }); }
    countEls(card.body || []);
    document.getElementById('element-count').textContent = count + ' elements';
  } catch (e) {
    container.innerHTML = '<div class="preview-error">' + e.message + '</div>';
    validate(null, false, e.message);
  }
}

function validate(card, rendered, error) {
  const badge = document.getElementById('valid-badge');
  const msg = document.getElementById('validation-msg');
  if (!card) {
    badge.className = 'badge badge-err'; badge.textContent = 'Invalid JSON';
    msg.textContent = error || '';
    return;
  }
  const issues = [];
  if (card.type !== 'AdaptiveCard') issues.push('Missing type: AdaptiveCard');
  if (!card.version) issues.push('Missing version');
  if (!card.body || !Array.isArray(card.body)) issues.push('Missing body array');
  if (!card.speak) issues.push('No speak property (accessibility)');
  // Check body elements
  (card.body || []).forEach((el, i) => {
    if (el.type === 'TextBlock' && el.wrap !== true) issues.push('body['+i+']: TextBlock missing wrap:true');
    if (el.type === 'Image' && !el.altText) issues.push('body['+i+']: Image missing altText');
  });
  if (issues.length === 0) {
    badge.className = 'badge badge-ok'; badge.textContent = 'Valid';
    msg.textContent = 'v' + (card.version || '?') + ' • ' + (card.body||[]).length + ' body items';
  } else if (issues.some(i => i.includes('Missing type') || i.includes('Missing body'))) {
    badge.className = 'badge badge-err'; badge.textContent = issues.length + ' issues';
    msg.textContent = issues[0];
  } else {
    badge.className = 'badge badge-warn'; badge.textContent = issues.length + ' warnings';
    msg.textContent = issues[0];
  }
}

// ─── Live Edit ───
editor.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 300);
});
document.getElementById('host-select').addEventListener('change', render);
document.getElementById('size-select').addEventListener('change', () => {
  const size = document.getElementById('size-select').value;
  const sizes = { desktop: '500px', tablet: '400px', mobile: '320px', narrow: '280px', full: '100%' };
  container.style.maxWidth = sizes[size] || '500px';
  container.style.width = sizes[size] || '500px';
});

// ─── Insert Element ───
function insertElement(type) {
  try {
    const card = JSON.parse(editor.value);
    if (!card.body) card.body = [];
    const el = JSON.parse(JSON.stringify(ELEMENTS[type]));
    // Ensure unique IDs for inputs
    if (el.id) el.id = type.replace('.','_').toLowerCase() + '_' + Date.now().toString(36);
    card.body.push(el);
    editor.value = JSON.stringify(card, null, 2);
    render();
  } catch (e) {
    // If JSON is invalid, can't insert
  }
}

// ─── Format JSON ───
function formatJson() {
  try {
    const card = JSON.parse(editor.value);
    editor.value = JSON.stringify(card, null, 2);
  } catch (e) { /* leave as-is */ }
}

// ─── Actions ───
function action(cmd) {
  vscode.postMessage({ command: cmd, json: editor.value });
}

// ─── AI Generate ───
function aiGenerate() {
  const prompt = document.getElementById('ai-input').value.trim();
  if (!prompt) return;
  const host = document.getElementById('host-select').value.replace('-light','').replace('-dark','');
  vscode.postMessage({ command: 'aiGenerate', prompt, host });
  document.getElementById('ai-input').value = '';
}
document.getElementById('ai-input').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') aiGenerate();
});

// ─── Receive messages from extension ───
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.command === 'loadCard') {
    editor.value = JSON.stringify(msg.card, null, 2);
    render();
  }
});

// ─── Resizer ───
const resizer = document.getElementById('resizer');
const previewPane = document.getElementById('preview-pane');
const editorPane = document.getElementById('editor-pane');
let isResizing = false;
resizer.addEventListener('mousedown', (e) => { isResizing = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const containerRect = document.querySelector('.main').getBoundingClientRect();
  const pct = ((e.clientX - containerRect.left) / containerRect.width) * 100;
  if (pct > 20 && pct < 80) {
    previewPane.style.flex = 'none';
    previewPane.style.width = pct + '%';
    editorPane.style.flex = '1';
  }
});
document.addEventListener('mouseup', () => { isResizing = false; document.body.style.cursor = ''; });
</script>
</body>
</html>`;
  }
}
