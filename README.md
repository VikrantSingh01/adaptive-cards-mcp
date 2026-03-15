# Adaptive Cards AI Builder

AI-powered tool that converts any content into schema-validated [Adaptive Card](https://adaptivecards.io/) v1.6 JSON.

Available as an **MCP server**, **npm library**, **VS Code extension**, and **browser extension** for the Adaptive Cards Designer.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`packages/core`](packages/core/) | MCP server + npm library — 7 tools for card generation, validation, optimization, templating, and transformation | Published |
| [`packages/vscode-extension`](packages/vscode-extension/) | VS Code extension — generate, preview, validate, optimize cards with keyboard shortcuts and CodeLens | [Standalone repo](https://github.com/VikrantSingh01/adaptive-cards-ai-builder-vscode) |
| [`packages/browser-extension`](packages/browser-extension/) | Chrome/Edge extension — AI panel injected into the Adaptive Cards Designer | [Standalone repo](https://github.com/VikrantSingh01/adaptive-cards-ai-builder-browser) |

## Quick Start

### MCP Server (Claude Code / Copilot / Cursor)

```bash
npx adaptive-cards-ai-builder
```

Add to Claude Code:
```bash
claude mcp add adaptive-cards-ai-builder -- npx adaptive-cards-ai-builder
```

### npm Library

```typescript
import { generateCard, validateCardFull, dataToCard, optimizeCard } from 'adaptive-cards-ai-builder';

const result = await generateCard({
  content: "Create a flight status card",
  host: "teams",
  intent: "display"
});
```

## MCP Tools (7)

| Tool | Description |
|------|-------------|
| `generate_card` | Natural language / data → valid Adaptive Card v1.6 JSON |
| `validate_card` | Schema validation + accessibility score (0-100) + host compatibility |
| `data_to_card` | Auto-select Table / FactSet / Chart / List from data shape |
| `optimize_card` | Improve accessibility, performance, modernize actions |
| `template_card` | Static card → `${expression}` data-bound template |
| `transform_card` | Version upgrade/downgrade, host-config adaptation |
| `suggest_layout` | Recommend best layout pattern for a description |

## Host Compatibility

| Host | Max Version | Notes |
|------|-------------|-------|
| Teams | 1.6 | Max 6 actions, Action.Execute preferred |
| Outlook | 1.4 | Limited elements, max 4 actions |
| Web Chat | 1.6 | Full support |
| Windows | 1.6 | Subset of elements |
| Viva Connections | 1.4 | SPFx-based ACE framework |
| Webex | 1.3 | No Table, no Action.Execute |

## Development

```bash
# Install dependencies
cd packages/core && npm install

# Build
npm run build

# Test (42 tests)
npm test

# Run MCP server locally
node dist/server.js
```

## Architecture

```
packages/
├── core/                          # MCP server + npm library
│   ├── src/
│   │   ├── server.ts              # MCP server (stdio, 7 tools)
│   │   ├── index.ts               # Library exports
│   │   ├── tools/                 # 7 tool handlers
│   │   ├── core/                  # Schema validator, analyzer, accessibility, host compat
│   │   ├── generation/            # Patterns, data analyzer, assembler, LLM client
│   │   ├── data/                  # v1.6 schema, 25 examples, host configs
│   │   └── types/                 # TypeScript interfaces
│   └── tests/                     # 42 unit tests (vitest)
├── vscode-extension/              # VS Code extension
│   ├── src/                       # 5 commands, preview panel, CodeLens
│   └── snippets/                  # 11 AC snippets
└── browser-extension/             # Chrome/Edge extension
    ├── content-script.js          # AI panel for AC Designer
    ├── manifest.json              # Manifest V3
    └── popup.html                 # Quick-generate popup
```

## License

MIT
