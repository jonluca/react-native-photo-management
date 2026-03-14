const { defineConfig } = require("eslint/config");
const baseConfig = require("expo-module-scripts/eslint.config.base");

module.exports = defineConfig([
  {
    ignores: ["build/**/*", "plugin/build/**/*", "example/**/*"],
  },
  ...(Array.isArray(baseConfig) ? baseConfig : [baseConfig]),
]);
