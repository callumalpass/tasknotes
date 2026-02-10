/**
 * Mock for the rrule module
 */

// Frequency constants that match the real RRule
export enum Frequency {
  YEARLY = 0,
  MONTHLY = 1,
  WEEKLY = 2,
  DAILY = 3,
  HOURLY = 4,
  MINUTELY = 5,
  SECONDLY = 6
}

// Weekday mock class
export class Weekday {
  weekday: number;
  n?: number;

  constructor(weekday: number, n?: number) {
    this.weekday = weekday;
    this.n = n;
  }

  static MO = new Weekday(0);
  static TU = new Weekday(1);
  static WE = new Weekday(2);
  static TH = new Weekday(3);
  static FR = new Weekday(4);
  static SA = new Weekday(5);
  static SU = new Weekday(6);
}

export class RRule {
  static WEEKLY = Frequency.WEEKLY;
  static DAILY = Frequency.DAILY;
  static MONTHLY = Frequency.MONTHLY;
  static YEARLY = Frequency.YEARLY;
  static HOURLY = Frequency.HOURLY;
  static MINUTELY = Frequency.MINUTELY;
  static SECONDLY = Frequency.SECONDLY;

  static MO = Weekday.MO;
  static TU = Weekday.TU;
  static WE = Weekday.WE;
  static TH = Weekday.TH;
  static FR = Weekday.FR;
  static SA = Weekday.SA;
  static SU = Weekday.SU;

  public options: any;

  constructor(options: any = {}) {
    this.options = options;
  }
  
  get origOptions() {
    return this.options;
  }

  between(start: Date, end: Date, inclusive: boolean = false): Date[] {
    // Mock implementation that generates dates based on the recurrence rule
    const dates: Date[] = [];
    
    if (!this.options || !this.options.dtstart) {
      return dates;
    }
    
    const { freq, byweekday, dtstart } = this.options;
    
    if (freq === Frequency.WEEKLY && byweekday && byweekday.length > 0) {
      // For weekly recurrence, generate dates that match the specified weekdays
      const current = new Date(start);
      current.setUTCHours(0, 0, 0, 0);
      
      while (current <= end) {
        const dayOfWeek = current.getUTCDay();
        
        // Check if this day matches any of the specified weekdays
        const matchesWeekday = byweekday.some((wd: any) => {
          const targetDay = wd.weekday !== undefined ? wd.weekday : wd;
          // Convert Sunday=0 to Sunday=6 for our comparison
          const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          return targetDay === adjustedDayOfWeek;
        });
        
        if (matchesWeekday && current >= start) {
          dates.push(new Date(current));
        }
        
        current.setUTCDate(current.getUTCDate() + 1);
      }
    } else if (freq === Frequency.DAILY) {
      // For daily recurrence, generate dates respecting the interval
      const dailyInterval = this.options.interval || 1;
      const current = new Date(dtstart);
      current.setUTCHours(0, 0, 0, 0);

      // Advance to the first occurrence at or after start
      while (current < start) {
        current.setUTCDate(current.getUTCDate() + dailyInterval);
      }

      while (current <= end) {
        dates.push(new Date(current));
        current.setUTCDate(current.getUTCDate() + dailyInterval);
      }
    } else if (freq === Frequency.WEEKLY && (!byweekday || byweekday.length === 0)) {
      // Weekly recurrence without specific weekdays
      const weeklyInterval = this.options.interval || 1;
      const current = new Date(dtstart);
      current.setUTCHours(0, 0, 0, 0);

      while (current < start) {
        current.setUTCDate(current.getUTCDate() + weeklyInterval * 7);
      }

      while (current <= end) {
        dates.push(new Date(current));
        current.setUTCDate(current.getUTCDate() + weeklyInterval * 7);
      }
    }
    
    return dates;
  }

  after(date: Date): Date | null {
    return null;
  }

  before(date: Date): Date | null {
    return null;
  }

  toString(): string {
    if (!this.options) {
      return 'FREQ=DAILY;INTERVAL=1';
    }
    
    const { freq, interval = 1, byweekday, bymonthday, bymonth, bysetpos, until, count } = this.options;
    let result = '';
    
    switch (freq) {
      case Frequency.DAILY:
        result = 'FREQ=DAILY';
        break;
      case Frequency.WEEKLY:
        result = 'FREQ=WEEKLY';
        break;
      case Frequency.MONTHLY:
        result = 'FREQ=MONTHLY';
        break;
      case Frequency.YEARLY:
        result = 'FREQ=YEARLY';
        break;
      default:
        return 'FREQ=DAILY;INTERVAL=1';
    }

    if (interval && interval > 1) {
      result += `;INTERVAL=${interval}`;
    }

    if (byweekday && byweekday.length > 0) {
      const dayMap = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
      const days = byweekday.map((w: any) => dayMap[w.weekday || w]).filter(Boolean);
      if (days.length > 0) {
        result += `;BYDAY=${days.join(',')}`;
      }
    }

    if (bymonthday && bymonthday.length > 0) {
      result += `;BYMONTHDAY=${bymonthday.join(',')}`;
    }

    if (bymonth && bymonth.length > 0) {
      result += `;BYMONTH=${bymonth.join(',')}`;
    }

    if (bysetpos && bysetpos.length > 0) {
      result += `;BYSETPOS=${bysetpos.join(',')}`;
    }

    if (until) {
      const dateStr = until.toISOString().split('T')[0].replace(/-/g, '');
      result += `;UNTIL=${dateStr}`;
    }

    if (count) {
      result += `;COUNT=${count}`;
    }

    return result;
  }

  static parseString = jest.fn((str: string): any => {
    // Parse the RRule string and return options object
    const options: any = {};
    
    if (str.includes('FREQ=DAILY')) options.freq = Frequency.DAILY;
    else if (str.includes('FREQ=WEEKLY')) options.freq = Frequency.WEEKLY;
    else if (str.includes('FREQ=MONTHLY')) options.freq = Frequency.MONTHLY;
    else if (str.includes('FREQ=YEARLY')) options.freq = Frequency.YEARLY;
    else {
      // Throw error for invalid rrule string to test error handling
      throw new Error('Invalid RRule string');
    }
    
    const intervalMatch = str.match(/INTERVAL=(\d+)/);
    if (intervalMatch) options.interval = parseInt(intervalMatch[1]);
    
    const bydayMatch = str.match(/BYDAY=([^;]+)/);
    if (bydayMatch) {
      const dayMap: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
      options.byweekday = bydayMatch[1].split(',').map(day => ({ weekday: dayMap[day] }));
    }
    
    const bysetposMatch = str.match(/BYSETPOS=([^;]+)/);
    if (bysetposMatch) {
      options.bysetpos = bysetposMatch[1].split(',').map(p => parseInt(p));
    }
    
    const bymonthdayMatch = str.match(/BYMONTHDAY=([^;]+)/);
    if (bymonthdayMatch) {
      options.bymonthday = bymonthdayMatch[1].split(',').map(d => parseInt(d));
    }
    
    const bymonthMatch = str.match(/BYMONTH=([^;]+)/);
    if (bymonthMatch) {
      options.bymonth = bymonthMatch[1].split(',').map(m => parseInt(m));
    }
    
    const untilMatch = str.match(/UNTIL=([^;]+)/);
    if (untilMatch) {
      const dateStr = untilMatch[1];
      // Parse YYYYMMDD format
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-based
      const day = parseInt(dateStr.substring(6, 8));
      options.until = new Date(year, month, day);
    }
    
    const countMatch = str.match(/COUNT=(\d+)/);
    if (countMatch) {
      options.count = parseInt(countMatch[1]);
    }
    
    return options;
  });

  static fromString = jest.fn((str: string): RRule => {
    // Parse the RRule string and create a mock rule with corresponding options
    const options = RRule.parseString(str);
    
    const rule = new RRule(options);
    rule.toText = jest.fn(() => {
      if (str.includes('FREQ=DAILY')) return 'every day';
      if (str.includes('FREQ=WEEKLY')) return 'every week';
      if (str.includes('FREQ=MONTHLY')) return 'every month';
      if (str.includes('FREQ=YEARLY')) return 'every year';
      return 'Invalid recurrence rule';
    });
    return rule;
  });

  toText(): string {
    if (this.options?.freq === Frequency.DAILY) return 'every day';
    if (this.options?.freq === Frequency.WEEKLY) return 'every week';
    if (this.options?.freq === Frequency.MONTHLY) return 'every month';
    if (this.options?.freq === Frequency.YEARLY) return 'every year';
    return 'unknown recurrence';
  }
}

// Mock test utilities
export const RRuleTestUtils = {
  reset: () => {
    jest.clearAllMocks();
  }
};

// Export all the constants and classes
export default RRule;