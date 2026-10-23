import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Flat config replaces a rule's whole value per matching block, so every
// `no-restricted-syntax` value below lists all selectors that apply to its files.
const PROCESS_ENV = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: "Read environment variables only through lib/env.ts or lib/env.public.ts.",
};
const SEGMENT_EXPORTS = ["runtime", "dynamic", "revalidate", "fetchCache", "dynamicParams"].map((name) => ({
  selector: `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='${name}']`,
  message: `\`export const ${name}\` is incompatible with cacheComponents (see context/code-standards.md).`,
}));
const COMPUTED_ENV = {
  selector:
    "MemberExpression[computed=true][object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
  message: "Use a literal process.env.NEXT_PUBLIC_X reference so Next.js can inline it.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
        },
      ],
      "no-restricted-syntax": ["error", PROCESS_ENV],
    },
  },
  {
    files: ["app/**"],
    rules: { "no-restricted-syntax": ["error", PROCESS_ENV, ...SEGMENT_EXPORTS] },
  },
  {
    files: ["lib/**", "trigger/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "@/hooks/*"],
              message: "lib/ and trigger/ must not import UI layers (dependency direction: app → components → lib).",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "lib/env.ts",
      "next.config.ts",
      "vitest.config.mts",
      "playwright.config.ts",
      "prisma.config.ts",
      "scripts/**",
      "tests/setup.ts",
      "tests/e2e/**",
      "tests/integration/db.ts",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["lib/env.public.ts"],
    rules: { "no-restricted-syntax": ["error", COMPUTED_ENV] },
  },
  {
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test and generated output:
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "coverage/**",
    "lib/generated/**",
    ".superpowers/**",
  ]),
]);

export default eslintConfig;
