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
    '^date-fns$': '<rootDir>/tests/__mocks__/date-fns.ts',
    // Mock utility modules
    '^../../src/utils/helpers$': '<rootDir>/tests/__mocks__/utils.ts',
    '^../../src/utils/filenameGenerator$': '<rootDir>/tests/__mocks__/utils.ts',
    '^../../src/utils/dateUtils$': '<rootDir>/tests/__mocks__/utils.ts'
  },
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/utils/**/*.ts',
    '!src/services/PriorityManager.ts',
    '!src/services/StatusManager.ts',
    '!src/services/FieldMapper.ts',
    '!src/**/*.d.ts',
    '!tests/**/*'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 60,
      statements: 60
    },
    './src/services/': {
      branches: 70,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/utils/': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true
};