import nextPlugin from "@next/eslint-plugin-next"
import reactPlugin from "eslint-plugin-react"
import hooksPlugin from "eslint-plugin-react-hooks"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"

/**
 * ESLint Configuration for Zaigo Mockup Template
 *
 * Manual flat config setup for ESLint 9 + Next.js 16
 *
 * @see https://nextjs.org/docs/app/api-reference/config/eslint
 */
export default [
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": hooksPlugin,
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",

      // React Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]
