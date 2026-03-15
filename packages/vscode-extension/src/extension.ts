import * as vscode from "vscode";
import { registerGenerateCommand } from "./generate-command";
import { CardPreviewPanel } from "./card-preview-panel";
import { CardDesignerPanel } from "./card-designer-panel";
import { AdaptiveCardCodeLensProvider } from "./codelens-provider";

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("adaptiveCards");
  context.subscriptions.push(diagnosticCollection);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("adaptiveCards.generate", () =>
      registerGenerateCommand(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("adaptiveCards.preview", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor");
        return;
      }
      try {
        const card = JSON.parse(editor.document.getText());
        CardPreviewPanel.createOrShow(context.extensionUri, card);
      } catch {
        vscode.window.showErrorMessage("Active editor does not contain valid JSON");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("adaptiveCards.validate", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor");
        return;
      }
      try {
        const card = JSON.parse(editor.document.getText());
        const { validateCardFull } = await import("adaptive-cards-mcp");
        const result = validateCardFull({ card });
        const diags: vscode.Diagnostic[] = [];
        for (const err of result.errors) {
          const severity =
            err.severity === "error"
              ? vscode.DiagnosticSeverity.Error
              : err.severity === "warning"
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;
          const diag = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            `[${err.rule}] ${err.message}`,
            severity
          );
          diags.push(diag);
        }
        diagnosticCollection.set(editor.document.uri, diags);
        if (result.valid) {
          vscode.window.showInformationMessage(
            `Card is valid! Accessibility: ${result.accessibility.score}/100, Elements: ${result.stats.elementCount}`
          );
        } else {
          vscode.window.showWarningMessage(
            `Card has ${result.errors.filter((e) => e.severity === "error").length} error(s)`
          );
        }
      } catch (e) {
        vscode.window.showErrorMessage("Invalid JSON: " + (e instanceof Error ? e.message : e));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("adaptiveCards.dataToCard", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showWarningMessage("Select data (JSON or CSV) first");
        return;
      }
      const title = await vscode.window.showInputBox({ prompt: "Card title", placeHolder: "My Data" });
      try {
        const { dataToCard } = await import("adaptive-cards-mcp");
        let data: unknown = selection;
        try {
          data = JSON.parse(selection);
        } catch {
          /* treat as CSV */
        }
        const result = await dataToCard({ data: data as any, title: title || undefined });
        const doc = await vscode.workspace.openTextDocument({
          content: JSON.stringify(result.card, null, 2),
          language: "json",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        CardPreviewPanel.createOrShow(context.extensionUri, result.card);
      } catch (e) {
        vscode.window.showErrorMessage("Error: " + (e instanceof Error ? e.message : e));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("adaptiveCards.optimize", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      try {
        const card = JSON.parse(editor.document.getText());
        const { optimizeCard } = await import("adaptive-cards-mcp");
        const result = optimizeCard({ card });
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );
        edit.replace(editor.document.uri, fullRange, JSON.stringify(result.card, null, 2));
        await vscode.workspace.applyEdit(edit);
        const changeList = result.changes.map((c) => c.description).join(", ");
        vscode.window.showInformationMessage(
          `Optimized! ${result.changes.length} changes: ${changeList}`
        );
      } catch (e) {
        vscode.window.showErrorMessage("Error: " + (e instanceof Error ? e.message : e));
      }
    })
  );

  // Designer command
  context.subscriptions.push(
    vscode.commands.registerCommand("adaptiveCards.designer", () => {
      const editor = vscode.window.activeTextEditor;
      let initialCard: Record<string, unknown> | undefined;
      if (editor) {
        try {
          const parsed = JSON.parse(editor.document.getText());
          if (parsed.type === "AdaptiveCard") {
            initialCard = parsed;
          }
        } catch { /* ignore */ }
      }
      CardDesignerPanel.createOrShow(context.extensionUri, initialCard);
    })
  );

  // Register CodeLens
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { pattern: "**/*.card.json" },
      new AdaptiveCardCodeLensProvider()
    )
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(symbol-misc) AC Builder";
  statusBar.tooltip = "Adaptive Cards AI Builder";
  statusBar.command = "adaptiveCards.generate";
  statusBar.show();
  context.subscriptions.push(statusBar);
}

export function deactivate() {
  diagnosticCollection?.dispose();
}
