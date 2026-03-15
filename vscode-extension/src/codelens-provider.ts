import * as vscode from "vscode";

export class AdaptiveCardCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    // Only provide CodeLens for .card.json files
    if (!document.fileName.endsWith(".card.json")) return [];

    try {
      const text = document.getText();
      const parsed = JSON.parse(text);
      if (parsed.type !== "AdaptiveCard") return [];
    } catch {
      return [];
    }

    const topOfDocument = new vscode.Range(0, 0, 0, 0);

    return [
      new vscode.CodeLens(topOfDocument, {
        title: "$(eye) Preview",
        command: "adaptiveCards.preview",
        tooltip: "Preview this Adaptive Card",
      }),
      new vscode.CodeLens(topOfDocument, {
        title: "$(check) Validate",
        command: "adaptiveCards.validate",
        tooltip: "Validate schema, accessibility, and host compatibility",
      }),
      new vscode.CodeLens(topOfDocument, {
        title: "$(sparkle) Optimize",
        command: "adaptiveCards.optimize",
        tooltip: "Optimize for accessibility and best practices",
      }),
    ];
  }
}
