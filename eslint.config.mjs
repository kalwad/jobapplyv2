// Repository ESLint flat configuration.
// Baseline recommended rule sets for the M00-W02 scaffold; the strict
// toolchain configuration package (M00-W03) tightens these further.
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
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
