/**
 * Mock for rrule library
 * Used for recurrence rule handling in TaskNotes plugin
 */

export enum Frequency {
  YEARLY = 0,
  MONTHLY = 1,
  WEEKLY = 2,
  DAILY = 3,
  HOURLY = 4,
  MINUTELY = 5,
  SECONDLY = 6
}

export enum Weekday {
  MO = 0,
  TU = 1,
  WE = 2,
  TH = 3,
  FR = 4,
  SA = 5,
  SU = 6
}

export interface RRuleOptions {
  freq: Frequency;
  interval?: number;
  wkst?: Weekday;
  count?: number;
  until?: Date;
  dtstart?: Date;
  bysetpos?: number[];
  bymonth?: number[];
  bymonthday?: number[];
  byyearday?: number[];
  byweekno?: number[];
  byweekday?: (Weekday | [Weekday, number])[];
  byhour?: number[];
  byminute?: number[];
  bysecond?: number[];
}

// Mock RRule class
export class RRule {
  private options: RRuleOptions;
  private static FREQ_NAMES = ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'MINUTELY', 'SECONDLY'];
  private static WEEKDAY_NAMES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  constructor(options: RRuleOptions) {
    this.options = { ...options };
  }

  // Generate dates based on rule
  all(iterator?: (date: Date, index: number) => boolean): Date[] {
    const results: Date[] = [];
    const start = this.options.dtstart || new Date();
    let current = new Date(start);
    
    // Simple mock implementation for common cases
    const count = this.options.count || 10;
    
    for (let i = 0; i < count; i++) {
      if (iterator && !iterator(current, i)) {
        break;
      }
      
      results.push(new Date(current));
      
      // Advance date based on frequency
      switch (this.options.freq) {
        case Frequency.DAILY:
          current.setDate(current.getDate() + (this.options.interval || 1));
          break;
        case Frequency.WEEKLY:
          current.setDate(current.getDate() + (this.options.interval || 1) * 7);
          break;
        case Frequency.MONTHLY:
          current.setMonth(current.getMonth() + (this.options.interval || 1));
          break;
        case Frequency.YEARLY:
          current.setFullYear(current.getFullYear() + (this.options.interval || 1));
          break;
      }
      
      // Check until date
      if (this.options.until && current > this.options.until) {
        break;
      }
    }
    
    return results;
  }

  // Get next occurrence after given date
  after(date: Date, inc: boolean = false): Date | null {
    const start = this.options.dtstart || new Date();
    if (date < start) {
      return start;
    }
    
    let current = new Date(inc ? date : date.getTime() + 1);
    
    // Simple implementation - find next occurrence
    for (let i = 0; i < 366; i++) { // Max 1 year lookout
      if (this.matches(current)) {
        return current;
      }
      current.setDate(current.getDate() + 1);
      
      if (this.options.until && current > this.options.until) {
        return null;
      }
    }
    
    return null;
  }

  // Get previous occurrence before given date
  before(date: Date, inc: boolean = false): Date | null {
    const start = this.options.dtstart || new Date();
    if (date <= start) {
      return inc && this.matches(date) ? date : null;
    }
    
    let current = new Date(inc ? date : date.getTime() - 1);
    
    // Simple implementation - find previous occurrence
    for (let i = 0; i < 366; i++) { // Max 1 year lookback
      if (current < start) {
        return null;
      }
      
      if (this.matches(current)) {
        return current;
      }
      current.setDate(current.getDate() - 1);
    }
    
    return null;
  }

  // Check if date matches rule
  private matches(date: Date): boolean {
    const start = this.options.dtstart || new Date();
    
    // Check if date is on or after start date
    if (date < start) {
      return false;
    }
    
    // Check until date
    if (this.options.until && date > this.options.until) {
      return false;
    }
    
    // Calculate days since start
    const daysSinceStart = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check frequency and interval
    switch (this.options.freq) {
      case Frequency.DAILY:
        return daysSinceStart % (this.options.interval || 1) === 0;
      case Frequency.WEEKLY:
        return daysSinceStart % ((this.options.interval || 1) * 7) === 0;
      case Frequency.MONTHLY:
        // Simplified monthly check
        const monthsDiff = (date.getFullYear() - start.getFullYear()) * 12 + 
                          (date.getMonth() - start.getMonth());
        return monthsDiff % (this.options.interval || 1) === 0 && 
               date.getDate() === start.getDate();
      case Frequency.YEARLY:
        // Simplified yearly check
        const yearsDiff = date.getFullYear() - start.getFullYear();
        return yearsDiff % (this.options.interval || 1) === 0 &&
               date.getMonth() === start.getMonth() &&
               date.getDate() === start.getDate();
      default:
        return false;
    }
  }

  // Convert to string representation
  toString(): string {
    const parts: string[] = [];
    
    parts.push(`FREQ=${RRule.FREQ_NAMES[this.options.freq]}`);
    
    if (this.options.interval && this.options.interval > 1) {
      parts.push(`INTERVAL=${this.options.interval}`);
    }
    
    if (this.options.count) {
      parts.push(`COUNT=${this.options.count}`);
    }
    
    if (this.options.until) {
      const until = this.options.until.toISOString().split('T')[0].replace(/-/g, '');
      parts.push(`UNTIL=${until}`);
    }
    
    if (this.options.byweekday && this.options.byweekday.length > 0) {
      const weekdays = this.options.byweekday.map(wd => 
        typeof wd === 'number' ? RRule.WEEKDAY_NAMES[wd] : RRule.WEEKDAY_NAMES[wd[0]]
      );
      parts.push(`BYDAY=${weekdays.join(',')}`);
    }
    
    return parts.join(';');
  }

  // Convert options to object
  origOptions(): RRuleOptions {
    return { ...this.options };
  }

  // Convert to human readable text
  toText(): string {
    switch (this.options.freq) {
      case Frequency.DAILY:
        if (this.options.interval && this.options.interval > 1) {
          return `every ${this.options.interval} days`;
        }
        return 'every day';
      case Frequency.WEEKLY:
        if (this.options.interval && this.options.interval > 1) {
          return `every ${this.options.interval} weeks`;
        }
        return 'every week';
      case Frequency.MONTHLY:
        if (this.options.interval && this.options.interval > 1) {
          return `every ${this.options.interval} months`;
        }
        return 'every month';
      case Frequency.YEARLY:
        if (this.options.interval && this.options.interval > 1) {
          return `every ${this.options.interval} years`;
        }
        return 'every year';
      default:
        return 'unknown recurrence';
    }
  }

  // Static methods
  static fromString(str: string): RRule {
    const options: Partial<RRuleOptions> = {};
    const parts = str.split(';');
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      
      switch (key) {
        case 'FREQ':
          options.freq = RRule.FREQ_NAMES.indexOf(value);
          break;
        case 'INTERVAL':
          options.interval = parseInt(value);
          break;
        case 'COUNT':
          options.count = parseInt(value);
          break;
        case 'UNTIL':
          // Parse UNTIL date (YYYYMMDD format)
          const year = parseInt(value.substr(0, 4));
          const month = parseInt(value.substr(4, 2)) - 1;
          const day = parseInt(value.substr(6, 2));
          options.until = new Date(year, month, day);
          break;
        case 'BYDAY':
          options.byweekday = value.split(',').map(wd => {
            const index = RRule.WEEKDAY_NAMES.indexOf(wd);
            return index >= 0 ? index : 0;
          });
          break;
      }
    }
    
    return new RRule(options as RRuleOptions);
  }

  static fromText(text: string): RRule {
    // Simple text parsing for common cases
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('daily')) {
      return new RRule({ freq: Frequency.DAILY });
    } else if (lowerText.includes('weekly')) {
      return new RRule({ freq: Frequency.WEEKLY });
    } else if (lowerText.includes('monthly')) {
      return new RRule({ freq: Frequency.MONTHLY });
    } else if (lowerText.includes('yearly')) {
      return new RRule({ freq: Frequency.YEARLY });
    }
    
    // Default to daily
    return new RRule({ freq: Frequency.DAILY });
  }
}

// Export constants
export const FREQ = Frequency;
export const WEEKDAYS = Weekday;

// Mock utilities for testing
export const RRuleTestUtils = {
  createRule: (options: Partial<RRuleOptions>) => {
    return new RRule({ freq: Frequency.DAILY, ...options });
  },
  
  createDailyRule: (interval: number = 1, count?: number) => {
    return new RRule({ 
      freq: Frequency.DAILY, 
      interval, 
      count,
      dtstart: new Date()
    });
  },
  
  createWeeklyRule: (interval: number = 1, count?: number) => {
    return new RRule({ 
      freq: Frequency.WEEKLY, 
      interval, 
      count,
      dtstart: new Date()
    });
  },
  
  createMonthlyRule: (interval: number = 1, count?: number) => {
    return new RRule({ 
      freq: Frequency.MONTHLY, 
      interval, 
      count,
      dtstart: new Date()
    });
  },
  
  reset: () => {
    // Reset any mock state if needed
  }
};

// Default export
export default RRule;