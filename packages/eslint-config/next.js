/** Shared ESLint config for Next.js apps in the monorepo. */
module.exports = {
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  ignorePatterns: [".next", "node_modules", "dist", ".turbo"],
};
