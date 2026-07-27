// Repository ESLint flat configuration (M00-W03: strict, deterministic).
//
// TypeScript files get the typed strict + stylistic rule sets from
// typescript-eslint (projectService resolves each file's tsconfig).
// Plain JS/MJS files (this config file) get eslint's recommended set.
// Exclusions are limited to tool/build output and the Python venv; the
// canonical docs are Markdown and outside ESLint's scope by construction.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/coverage/**",
      ".venv/**",
      "services/native-host/target/**",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
      // Generated contract trees are byte-exact generator output (M01-W02):
      // integrity is enforced by the contract-gen drift suite and strict
      // typechecking, not by style lint over emitted code.
      "packages/contracts/generated/**",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
