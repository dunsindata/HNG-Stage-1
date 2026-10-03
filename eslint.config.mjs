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
    // The previous Stage project kept in this repo: it has its own toolchain
    // (Vite + Vitest) and its own config, so it is not part of this app.
    "legacy-todo-app/**",
  ]),
]);

export default eslintConfig;
