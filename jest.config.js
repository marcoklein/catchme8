module.exports = {
  // Test environment
  testEnvironment: "node",

  // Test file patterns
  testMatch: ["**/tests/**/*.test.js", "**/__tests__/**/*.js"],

  // Coverage configuration
  collectCoverageFrom: [
    "server/**/*.js",
    "client/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**",
    "!server/server.js", // Main server file excluded from coverage
  ],

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],

  // Module paths
  roots: ["<rootDir>/server", "<rootDir>/client", "<rootDir>/tests"],

  // Transform configuration for ES6 modules if needed
  transform: {},

  // Test timeout
  testTimeout: 10000,

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    "./server/game/": {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
