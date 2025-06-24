/**
 * Global test setup for TaskNotes plugin tests
 * This file is run once before all tests
 */

// Mock global objects and APIs that would normally be provided by Obsidian
(global as any).window = global.window || {};
(global as any).document = global.document || {};

// Store the original createElement to avoid recursion
const originalCreateElement = document.createElement;

// Enhanced DOM mocking for Obsidian's HTMLElement extensions
function createMockElement(tagName: string = 'div'): any {
  const element = originalCreateElement.call(document, tagName) as any;

  // Mock Obsidian's createEl method
  element.createEl = function(this: any, tagName: string, options: any = {}, callback?: (el: any) => void): any {
    const child = createMockElement(tagName);
    
    // Handle options object
    if (options) {
      // Handle class names
      if (options.cls) {
        if (typeof options.cls === 'string') {
          child.className = options.cls;
        } else if (Array.isArray(options.cls)) {
          child.className = options.cls.join(' ');
        }
      }
      
      // Handle text content
      if (options.text !== undefined) {
        child.textContent = options.text;
      }
      
      // Handle HTML content
      if (options.html !== undefined) {
        child.innerHTML = options.html;
      }
      
      // Handle attributes
      if (options.attr) {
        Object.entries(options.attr).forEach(([key, value]) => {
          child.setAttribute(key, String(value));
        });
      }
      
      // Handle other properties (like type for input elements)
      Object.keys(options).forEach(key => {
        if (!['cls', 'text', 'html', 'attr'].includes(key)) {
          (child as any)[key] = options[key];
        }
      });
    }
    
    // Append to parent
    this.appendChild(child);
    
    // Call callback if provided
    if (callback) {
      callback(child);
    }
    
    return child;
  };

  // Mock createDiv as a convenience method
  element.createDiv = function(this: any, options: any = {}, callback?: (el: any) => void): any {
    return this.createEl('div', options, callback);
  };

  // Mock createSpan as a convenience method
  element.createSpan = function(this: any, options: any = {}, callback?: (el: any) => void): any {
    return this.createEl('span', options, callback);
  };

  // Mock setText method
  element.setText = function(this: any, text: string): any {
    this.textContent = text;
    return this;
  };

  // Mock addClass method
  element.addClass = function(this: any, className: string): any {
    this.classList.add(className);
    return this;
  };

  // Mock removeClass method
  element.removeClass = function(this: any, className: string): any {
    this.classList.remove(className);
    return this;
  };

  // Mock toggleClass method
  element.toggleClass = function(this: any, className: string, add?: boolean): any {
    if (add !== undefined) {
      this.classList.toggle(className, add);
    } else {
      this.classList.toggle(className);
    }
    return this;
  };

  return element;
}

// Override document.createElement to return enhanced mock elements
document.createElement = function(tagName: string, options?: ElementCreationOptions): HTMLElement {
  return createMockElement(tagName);
} as any;

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
    root = null;
    rootMargin = '';
    thresholds = [];
    
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  } as any;
}

// Mock URL constructor for URL handling
if (!global.URL) {
  global.URL = class URL {
    constructor(public href: string, public base?: string) {}
    toString() { return this.href; }
    
    static createObjectURL() { return ''; }
    static revokeObjectURL() {}
  } as any;
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

// Make Notice globally available for tests
(global as any).Notice = jest.fn().mockImplementation((message: string, timeout?: number) => {
  return {};
});

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