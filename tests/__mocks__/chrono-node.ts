/**
 * Mock for chrono-node library
 * Used for natural language date parsing in TaskNotes plugin
 */

export interface ParsedResult {
  start: {
    date(): Date;
    get(component: string): number;
    isCertain(component: string): boolean;
  };
  end?: {
    date(): Date;
    get(component: string): number;
    isCertain(component: string): boolean;
  };
  text: string;
  index: number;
}

export interface ParsedComponents {
  get(component: string): number;
  isCertain(component: string): boolean;
  date(): Date;
}

// Mock parsed result factory
const createMockParsedResult = (
  text: string,
  date: Date,
  index: number = 0,
  endDate?: Date,
  certainComponents: string[] = []
): ParsedResult => ({
  start: {
    date: () => date,
    get: (component: string) => {
      switch (component) {
        case 'year': return date.getFullYear();
        case 'month': return date.getMonth() + 1;
        case 'day': return date.getDate();
        case 'hour': return date.getHours();
        case 'minute': return date.getMinutes();
        default: return 0;
      }
    },
    isCertain: (component: string) => certainComponents.includes(component)
  },
  end: endDate ? {
    date: () => endDate,
    get: (component: string) => {
      switch (component) {
        case 'year': return endDate.getFullYear();
        case 'month': return endDate.getMonth() + 1;
        case 'day': return endDate.getDate();
        case 'hour': return endDate.getHours();
        case 'minute': return endDate.getMinutes();
        default: return 0;
      }
    },
    isCertain: (component: string) => certainComponents.includes(component)
  } : undefined,
  text,
  index
});

// Mock chrono parser
const mockChrono = {
  parse: jest.fn((text: string, refDate?: Date): ParsedResult[] => {
    const referenceDate = refDate || new Date();
    const results: ParsedResult[] = [];
    
    // Enhanced date patterns for testing - handle time expressions properly
    const patterns = [
      // Date + time patterns (must come first for longest match)
      { regex: /\btomorrow\s+at\s+(\d{1,2})\s*pm\b/i, offset: 1, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) + 12 },
      { regex: /\btomorrow\s+at\s+(\d{1,2})\s*am\b/i, offset: 1, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) },
      { regex: /\btoday\s+at\s+(\d{1,2})\s*pm\b/i, offset: 0, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) + 12 },
      { regex: /\btoday\s+at\s+(\d{1,2})\s*am\b/i, offset: 0, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) },
      { regex: /\byesterday\s+at\s+(\d{1,2})\s*pm\b/i, offset: -1, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) + 12 },
      { regex: /\byesterday\s+at\s+(\d{1,2})\s*am\b/i, offset: -1, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) },
      // Due/scheduled patterns with time
      { regex: /\bdue\s+tomorrow\s+at\s+(\d{1,2})\s*pm\b/i, offset: 1, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) + 12 },
      { regex: /\bdue\s+tomorrow\s+at\s+(\d{1,2})\s*am\b/i, offset: 1, timeFn: (match: RegExpMatchArray) => parseInt(match[1]) },
      // Basic date patterns (without time)
      { regex: /\btomorrow\b/i, offset: 1 },
      { regex: /\byesterday\b/i, offset: -1 },
      { regex: /\btoday\b/i, offset: 0 },
      { regex: /\bnext week\b/i, offset: 7 },
      { regex: /\bnext month\b/i, offset: 30 },
      { regex: /\bin (\d+) days?\b/i, offsetFn: (match: RegExpMatchArray) => parseInt(match[1]) },
      { regex: /\bin (\d+) weeks?\b/i, offsetFn: (match: RegExpMatchArray) => parseInt(match[1]) * 7 },
      { regex: /(\d{4})-(\d{2})-(\d{2})/i, dateFn: (match: RegExpMatchArray) =>
        new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])) },
      { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/i, dateFn: (match: RegExpMatchArray) =>
        new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2])) },
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        let targetDate: Date;

        if (pattern.dateFn) {
          targetDate = pattern.dateFn(match);
        } else if (pattern.offsetFn) {
          const offset = pattern.offsetFn(match);
          targetDate = new Date(referenceDate);
          targetDate.setDate(targetDate.getDate() + offset);
        } else if (pattern.offset !== undefined) {
          targetDate = new Date(referenceDate);
          targetDate.setDate(targetDate.getDate() + pattern.offset);
        } else {
          continue;
        }

        // Handle time if specified
        if (pattern.timeFn) {
          const hour = pattern.timeFn(match);
          targetDate.setHours(hour, 0, 0, 0);
        }

        // Determine certain components based on pattern
        let certainComponents: string[] = ['year', 'month', 'day'];
        if (pattern.timeFn || pattern.regex.toString().includes('am|pm')) {
          certainComponents.push('hour', 'minute');
        }

        results.push(createMockParsedResult(
          match[0], // This now includes the full match like "tomorrow at 3pm"
          targetDate,
          match.index || 0,
          undefined,
          certainComponents
        ));

        // Return first match only (like real chrono-node)
        break;
      }
    }
    
    return results;
  }),

  parseDate: jest.fn((text: string, refDate?: Date): Date | null => {
    const results = mockChrono.parse(text, refDate);
    return results.length > 0 ? results[0].start.date() : null;
  }),

  // Additional chrono methods
  casual: {
    parse: jest.fn(),
    parseDate: jest.fn(),
  },

  strict: {
    parse: jest.fn(),
    parseDate: jest.fn(),
  }
};

// Initialize casual and strict implementations after mockChrono is defined
mockChrono.casual.parse.mockImplementation(mockChrono.parse);
mockChrono.casual.parseDate.mockImplementation(mockChrono.parseDate);
mockChrono.strict.parse.mockImplementation(mockChrono.parse);
mockChrono.strict.parseDate.mockImplementation(mockChrono.parseDate);

// Mock test utilities
export const ChronoTestUtils = {
  // Reset all mocks
  reset: () => {
    jest.clearAllMocks();
  },

  // Mock specific parse result
  mockParseResult: (text: string, results: ParsedResult[]) => {
    mockChrono.parse.mockImplementation((inputText: string) => {
      if (inputText.includes(text)) {
        return results;
      }
      return [];
    });
  },

  // Mock specific date parsing
  mockParseDate: (text: string, date: Date | null) => {
    mockChrono.parseDate.mockImplementation((inputText: string) => {
      if (inputText.includes(text)) {
        return date;
      }
      return null;
    });
  },

  // Create mock result for testing
  createResult: createMockParsedResult,
  
  // Create mock result with certain components for testing
  createResultWithCertainty: (text: string, date: Date, index: number = 0, endDate?: Date, certainComponents: string[] = []) => 
    createMockParsedResult(text, date, index, endDate, certainComponents),
};

// Export as default to match chrono-node structure
export default mockChrono;

// Named exports for specific imports
export const parse = mockChrono.parse;
export const parseDate = mockChrono.parseDate;
export const casual = mockChrono.casual;
export const strict = mockChrono.strict;