module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
    '^@fullcalendar/(.*)$': '<rootDir>/tests/__mocks__/fullcalendar.ts',
    // Keep mocks for complex/large libraries that benefit from controlled testing
    '^chrono-node$': '<rootDir>/tests/__mocks__/chrono-node.ts',
    '^ical.js$': '<rootDir>/tests/__mocks__/ical.ts',
    // Add ES module mocks for problematic imports
    '^yaml$': '<rootDir>/tests/__mocks__/yaml.ts',
    '^rrule$': '<rootDir>/tests/__mocks__/rrule.ts',
    '^date-fns$': '<rootDir>/tests/__mocks__/date-fns.ts'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!tests/**/*'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85
    },
    './src/services/': {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    },
    './src/utils/': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true
};