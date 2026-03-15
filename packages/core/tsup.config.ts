import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
  },
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
  dts: true,
  splitting: false,
  shims: true,
  onSuccess: async () => {
    // Add shebang only to server.js for CLI usage
    const serverPath = "dist/server.js";
    const content = readFileSync(serverPath, "utf-8");
    if (!content.startsWith("#!/")) {
      writeFileSync(serverPath, "#!/usr/bin/env node\n" + content);
    }
  },
});
