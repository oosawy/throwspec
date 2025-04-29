import tseslint from "typescript-eslint";
import pluginThrowspec from "../lib/index.mjs";

export default tseslint.config({
  files: ["**/*.ts"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: "./tsconfig.json",
    },
  },
  plugins: {
    throwspec: pluginThrowspec,
  },
  rules: {
    "throwspec/throws-annotation": "warn",
  },
});
