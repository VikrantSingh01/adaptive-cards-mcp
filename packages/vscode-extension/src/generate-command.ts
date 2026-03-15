import * as vscode from "vscode";
import { CardPreviewPanel } from "./card-preview-panel";

const HOST_OPTIONS = [
  { label: "Generic", value: "generic" },
  { label: "Microsoft Teams", value: "teams" },
  { label: "Outlook", value: "outlook" },
  { label: "Web Chat", value: "webchat" },
  { label: "Windows", value: "windows" },
];

const INTENT_OPTIONS = [
  { label: "Auto-detect", value: undefined },
  { label: "Notification", value: "notification" },
  { label: "Approval", value: "approval" },
  { label: "Form / Survey", value: "form" },
  { label: "Dashboard", value: "dashboard" },
  { label: "Data Display", value: "display" },
  { label: "Profile / Contact", value: "profile" },
  { label: "Status Update", value: "status" },
  { label: "List", value: "list" },
  { label: "Image Gallery", value: "gallery" },
];

export async function registerGenerateCommand(context: vscode.ExtensionContext) {
  // Check if user has text selected — use it as the description
  const editor = vscode.window.activeTextEditor;
  const selection = editor?.document.getText(editor.selection);

  const description =
    selection && selection.length > 0
      ? selection
      : await vscode.window.showInputBox({
          prompt: "Describe the Adaptive Card you want to generate",
          placeHolder: "e.g., Create a flight status card with departure, arrival, and gate info",
        });

  if (!description) return;

  const hostPick = await vscode.window.showQuickPick(HOST_OPTIONS, {
    placeHolder: "Select target host",
  });

  const intentPick = await vscode.window.showQuickPick(INTENT_OPTIONS, {
    placeHolder: "Select card intent (or auto-detect)",
  });

  try {
    const { generateCard } = await import("adaptive-cards-ai-builder");
    const result = await generateCard({
      content: description,
      host: (hostPick?.value as any) || "generic",
      intent: (intentPick?.value as any) || undefined,
    });

    // Open JSON in a new editor
    const doc = await vscode.workspace.openTextDocument({
      content: JSON.stringify(result.card, null, 2),
      language: "json",
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

    // Show preview
    CardPreviewPanel.createOrShow(context.extensionUri, result.card);

    // Show validation summary
    const { valid, accessibility, stats } = result.validation;
    const statusMsg = valid
      ? `Card generated! Accessibility: ${accessibility.score}/100, Elements: ${stats.elementCount}`
      : `Card generated with ${result.validation.errors.filter((e) => e.severity === "error").length} validation issue(s)`;
    vscode.window.showInformationMessage(statusMsg);
  } catch (e) {
    vscode.window.showErrorMessage(
      "Error generating card: " + (e instanceof Error ? e.message : e)
    );
  }
}
