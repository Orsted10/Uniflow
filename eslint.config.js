const eslintConfig = require("@eslint/js");
const tsParser = require("typescript-eslint").parser;
const tsPlugin = require("typescript-eslint").plugin;

const nextPlugin = require("@next/eslint-plugin-next");
const tsRecommended =
  typeof tsPlugin.configs?.recommended === "object" &&
  Array.isArray(tsPlugin.configs.recommended)
    ? tsPlugin.configs.recommended
    : [];
const tsRecommendedRules =
  typeof tsPlugin.configs?.recommended?.rules === "object"
    ? tsPlugin.configs.recommended.rules
    : {};

module.exports = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      ".tsbuildinfo",
      "next-env.d.ts",
      "postcss.config.js",
      "eslint.config.js",
    ],
  },
  eslintConfig.configs.recommended,
  ...tsRecommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...require("globals").browser,
        ...require("globals").node,
        React: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": require("eslint-plugin-react-hooks"),
      next: nextPlugin,
    },
    rules: {
      ...tsRecommendedRules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
