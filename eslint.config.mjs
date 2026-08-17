import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone dev/CLI utilities (CommonJS scripts run directly with node,
    // not part of the app build) — excluded from the Next.js app lint rules.
    "fix_ts.js",
    "fix_ts2.js",
    "scripts/**",
  ]),
]);

export default eslintConfig;
