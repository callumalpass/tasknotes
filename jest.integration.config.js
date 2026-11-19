// Pin the test timezone to UTC so local runs match CI (GitHub Actions runs in
// UTC). See jest.config.js for the rationale (set before workers spawn so each
// inherits TZ before any Date is constructed). Overridable via `TZ=... jest`.
process.env.TZ = process.env.TZ || 'UTC';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  displayName: 'Integration Tests',
  globalSetup: '<rootDir>/scripts/jest-catalogues.cjs',
  roots: ['<rootDir>/tests/integration'],
  testMatch: [
    '**/integration/**/*.test.ts'
  ],
  // Share real Lingui macro/ESM compilation, not the unit suite's library mocks.
  transform: require('./jest.config.js').transform,
  transformIgnorePatterns: require('./jest.config.js').transformIgnorePatterns,
  setupFiles: ['obsidian-test-mocks/jest-setup'],
  setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts'],
  moduleNameMapper: {
    // Only mock Obsidian and UI libraries - use real date/parsing libraries
    '^obsidian$': '<rootDir>/tests/helpers/obsidian-bridge.ts',
    '^@fullcalendar/(.*)$': '<rootDir>/tests/__mocks__/fullcalendar.ts'
    // chrono-node, rrule, ical.js, date-fns will use real implementations
  },
  // Integration tests may need more time for complex workflows
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  // Less strict coverage for integration tests (focus on workflow completion)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!tests/**/*'
  ]
};
