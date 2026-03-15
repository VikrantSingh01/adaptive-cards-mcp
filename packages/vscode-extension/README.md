# Adaptive Cards AI Builder — VS Code Extension

AI-powered Adaptive Card generation, preview, and validation inside VS Code.

## Features

- **Generate Card** (`Ctrl+Shift+A` / `Cmd+Shift+A`): Describe a card in natural language, select host and intent, get valid JSON
- **Preview**: Rendered card preview in a side panel using the official Adaptive Cards renderer
- **Validate**: Schema validation, accessibility scoring (0-100), host compatibility checks
- **Optimize**: Auto-fix accessibility, modernize actions, upgrade version
- **Data to Card**: Select JSON/CSV data, convert to optimal card (Table, FactSet, Chart)
- **CodeLens**: Preview / Validate / Optimize buttons on `.card.json` files
- **Snippets**: 11 code snippets for common card elements (`ac-card`, `ac-textblock`, `ac-table`, etc.)
- **Right-click menu**: Generate from selection, convert data from selection

## Installation

### From Source
```bash
cd vscode-extension
npm install
npm run compile
```

Then press F5 in VS Code to launch the Extension Development Host.

### From VSIX
```bash
npm run package
code --install-extension adaptive-cards-ai-builder-vscode-1.0.0.vsix
```

## Snippets

| Prefix | Description |
|--------|-------------|
| `ac-card` | Full Adaptive Card skeleton |
| `ac-textblock` | TextBlock element |
| `ac-image` | Image with altText |
| `ac-columnset` | ColumnSet with 2 columns |
| `ac-factset` | FactSet |
| `ac-table` | Table with headers |
| `ac-input-text` | Input.Text with label |
| `ac-input-choice` | Input.ChoiceSet |
| `ac-action-execute` | Action.Execute |
| `ac-action-openurl` | Action.OpenUrl |
| `ac-container` | Container |

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Generate Card | `Ctrl+Shift+A` | AI-powered card generation |
| Preview Card | — | Render card in side panel |
| Validate Card | — | Full diagnostics |
| Optimize Card | — | Auto-fix issues |
| Data to Card | — | Convert selected data |
