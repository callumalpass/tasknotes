/**
 * Global test setup for TaskNotes plugin tests
 * This file is run once before all tests
 */

// Mock global objects and APIs that would normally be provided by Obsidian
global.window = global.window || {};
global.document = global.document || {};

// Mock requestAnimationFrame for animations and timers
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 16);
  };
}

if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = (handle: number) => {
    clearTimeout(handle);
  };
}

// Mock ResizeObserver for DOM resize detection
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock IntersectionObserver for visibility detection
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock URL constructor for URL handling
if (!global.URL) {
  global.URL = class URL {
    constructor(public href: string, public base?: string) {}
    toString() { return this.href; }
  };
}

// Mock fetch for HTTP requests
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    } as Response)
  );
}

// Set up date mocking utilities
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  // Override specific date functions for consistent testing
}));

// Configure Jest globals
jest.setTimeout(10000);

// Add custom matchers if needed in the future
// expect.extend({
//   toBeValidTaskInfo(received) {
//     // Custom matcher for TaskInfo validation
//   }
// });

// Global test utilities that can be used across all tests
export const TestUtils = {
  // Wait for next tick
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Wait for specific duration
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create a mock date that's consistent across tests
  createMockDate: (dateString: string) => new Date(dateString),
  
  // Mock current date for consistent testing
  mockCurrentDate: (dateString: string) => {
    const mockDate = new Date(dateString);
    jest.spyOn(global.Date, 'now').mockReturnValue(mockDate.getTime());
    return mockDate;
  },
  
  // Restore date mocking
  restoreDate: () => {
    jest.restoreAllMocks();
  }
};

// Export for use in individual test files
export default TestUtils;