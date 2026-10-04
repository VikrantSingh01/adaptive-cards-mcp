/**
 * Adaptive Cards AI Builder — Library Entry Point
 *
 * Exports core functions for programmatic use:
 *   import { generateCard, validateCard, dataToCard } from 'adaptive-cards-mcp'
 */

// Core modules
export {
  validateCard,
  getValidElementTypes,
  getValidActionTypes,
  refreshSchema,
  resetSchemaToBundled,
  getSchemaInfo,
  getActiveSchema,
  DEFAULT_REMOTE_SCHEMA_URL,
} from "./core/schema-validator.js";
export { analyzeCard, findDuplicateIds, countElements } from "./core/card-analyzer.js";
export { checkAccessibility } from "./core/accessibility-checker.js";
export {
  checkHostCompatibility,
  getHostSupport,
  getAllHostSupport,
  adaptCardForHost,
} from "./core/host-compatibility.js";

// Tool handlers (high-level API)
export { handleGenerateCard as generateCard } from "./tools/generate-card.js";
export { handleValidateCard as validateCardFull } from "./tools/validate-card.js";
export { handleDataToCard as dataToCard } from "./tools/data-to-card.js";
export { handleOptimizeCard as optimizeCard } from "./tools/optimize-card.js";
export { handleTemplateCard as templateCard } from "./tools/template-card.js";
export { handleTransformCard as transformCard } from "./tools/transform-card.js";
export { handleSuggestLayout as suggestLayout } from "./tools/suggest-layout.js";

// Generation utilities
export { assembleCard } from "./generation/card-assembler.js";
export { analyzeData, parseCSV } from "./generation/data-analyzer.js";
export { getAllPatterns, findPatternByIntent, findPatternByName, scorePatterns } from "./generation/layout-patterns.js";
export { selectExamples } from "./generation/example-selector.js";

// LLM configuration
export { configureLLM, isLLMAvailable, initLLMFromEnv } from "./generation/llm-client.js";

// Utilities
export { createLogger, initLogger } from "./utils/logger.js";
export { checkInputSize, checkCardComplexity, checkDataSize, setInputLimits, getInputLimits } from "./utils/input-guards.js";
export { checkRateLimit, setRateLimitEnabled, setToolRateLimit, registerToolIfMissing } from "./utils/rate-limiter.js";
export type { BucketConfig } from "./utils/rate-limiter.js";
export { storeCard, getCard, listCards, clearCards, resolveCardRef } from "./utils/card-store.js";
export { configureAuth, validateAuth, getAuthMode, setBearerValidator } from "./utils/auth.js";
export { generatePreviewHtml, writePreviewFile } from "./utils/preview.js";
export { initTelemetry, recordToolCall, recordSessionStart, recordSessionEnd, recordUsageContext, getMetricsSnapshot, resetMetrics, isTelemetryEnabled } from "./utils/telemetry.js";
export { initRemoteReporting, shutdownReporting, queueEvent } from "./utils/telemetry-remote.js";

// Types
export type * from "./types/index.js";
