module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  displayName: 'Integration Tests',
  roots: ['<rootDir>/tests/integration'],
  testMatch: [
    '**/integration/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        paths: {
          obsidian: ['node_modules/obsidian-test-mocks/dist/lib/cjs/obsidian/index.cjs']
        }
      }
    }],
  },
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
