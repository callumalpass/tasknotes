/**
 * Mock for ical.js library
 * Used for ICS calendar parsing in TaskNotes plugin
 */

// Mock ICAL component types
export const ICAL = {
  EventType: 'vevent',
  Calendar: 'vcalendar',
  Timezone: 'vtimezone',
  
  // Component class mock
  Component: class Component {
    private properties = new Map<string, any>();
    private components = new Map<string, Component[]>();
    
    constructor(private jCal: any[] | string) {
      if (typeof jCal === 'string') {
        this.jCal = [jCal, [], []];
      }
    }
    
    static fromString(str: string): Component {
      // Simple parsing for test purposes
      const component = new Component('vcalendar');
      
      // Extract events from VEVENT blocks
      const eventMatches = str.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
      if (eventMatches) {
        const events = eventMatches.map(eventStr => {
          const event = new Component('vevent');
          
          // Extract summary
          const summaryMatch = eventStr.match(/SUMMARY:(.*)/);
          if (summaryMatch) {
            event.addPropertyWithValue('summary', summaryMatch[1].trim());
          }
          
          // Extract start date
          const dtStartMatch = eventStr.match(/DTSTART[^:]*:(.*)/);
          if (dtStartMatch) {
            event.addPropertyWithValue('dtstart', new Time().fromString(dtStartMatch[1].trim()));
          }
          
          // Extract end date
          const dtEndMatch = eventStr.match(/DTEND[^:]*:(.*)/);
          if (dtEndMatch) {
            event.addPropertyWithValue('dtend', new Time().fromString(dtEndMatch[1].trim()));
          }
          
          // Extract UID
          const uidMatch = eventStr.match(/UID:(.*)/);
          if (uidMatch) {
            event.addPropertyWithValue('uid', uidMatch[1].trim());
          }
          
          // Extract description
          const descMatch = eventStr.match(/DESCRIPTION:(.*)/);
          if (descMatch) {
            event.addPropertyWithValue('description', descMatch[1].trim());
          }
          
          return event;
        });
        
        component.components.set('vevent', events);
      }
      
      return component;
    }
    
    getFirstSubcomponent(type: string): Component | null {
      const components = this.components.get(type);
      return components && components.length > 0 ? components[0] : null;
    }
    
    getAllSubcomponents(type: string): Component[] {
      return this.components.get(type) || [];
    }
    
    getFirstPropertyValue(name: string): any {
      return this.properties.get(name);
    }
    
    addPropertyWithValue(name: string, value: any): void {
      this.properties.set(name, value);
    }
    
    addSubcomponent(component: Component): void {
      const type = component.name;
      if (!this.components.has(type)) {
        this.components.set(type, []);
      }
      this.components.get(type)!.push(component);
    }
    
    get name(): string {
      return Array.isArray(this.jCal) ? this.jCal[0] : this.jCal;
    }
  },
  
  // Event class mock
  Event: class Event {
    component: any;
    summary: string = '';
    startDate: any;
    endDate: any;
    uid: string = '';
    description: string = '';
    
    constructor(component?: any) {
      this.component = component;
      if (component) {
        this.summary = component.getFirstPropertyValue('summary') || '';
        this.startDate = component.getFirstPropertyValue('dtstart');
        this.endDate = component.getFirstPropertyValue('dtend');
        this.uid = component.getFirstPropertyValue('uid') || '';
        this.description = component.getFirstPropertyValue('description') || '';
      }
    }
    
    get isRecurring(): boolean {
      return this.component?.getFirstPropertyValue('rrule') != null;
    }
    
    iterator(startTime?: any): any {
      return new RecurIterator(this, startTime);
    }
  },
  
  // Time class mock
  Time: class Time {
    year: number = 0;
    month: number = 0;
    day: number = 0;
    hour: number = 0;
    minute: number = 0;
    second: number = 0;
    isDate: boolean = false;
    
    constructor(data?: any) {
      if (data) {
        Object.assign(this, data);
      }
    }
    
    fromString(str: string): Time {
      // Parse ICAL date/time format
      if (str.includes('T')) {
        // DateTime format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
        const dateTime = str.replace('Z', '');
        const [datePart, timePart] = dateTime.split('T');
        
        this.year = parseInt(datePart.substr(0, 4));
        this.month = parseInt(datePart.substr(4, 2));
        this.day = parseInt(datePart.substr(6, 2));
        
        if (timePart) {
          this.hour = parseInt(timePart.substr(0, 2));
          this.minute = parseInt(timePart.substr(2, 2));
          this.second = parseInt(timePart.substr(4, 2));
        }
        this.isDate = false;
      } else {
        // Date only format: YYYYMMDD
        this.year = parseInt(str.substr(0, 4));
        this.month = parseInt(str.substr(4, 2));
        this.day = parseInt(str.substr(6, 2));
        this.isDate = true;
      }
      
      return this;
    }
    
    toJSDate(): Date {
      return new Date(this.year, this.month - 1, this.day, this.hour, this.minute, this.second);
    }

    toUnixTime(): number {
      // Return Unix timestamp (seconds since epoch)
      return Math.floor(this.toJSDate().getTime() / 1000);
    }

    toString(): string {
      const year = this.year.toString().padStart(4, '0');
      const month = this.month.toString().padStart(2, '0');
      const day = this.day.toString().padStart(2, '0');
      
      if (this.isDate) {
        return `${year}${month}${day}`;
      } else {
        const hour = this.hour.toString().padStart(2, '0');
        const minute = this.minute.toString().padStart(2, '0');
        const second = this.second.toString().padStart(2, '0');
        return `${year}${month}${day}T${hour}${minute}${second}`;
      }
    }
    
    static now(): Time {
      const now = new Date();
      return new Time({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        isDate: false
      });
    }
    
    static fromJSDate(date: Date, isDate: boolean = false): Time {
      return new Time({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: isDate ? 0 : date.getHours(),
        minute: isDate ? 0 : date.getMinutes(),
        second: isDate ? 0 : date.getSeconds(),
        isDate
      });
    }
  }
};

// Mock Time class (also exported directly)
export class Time extends ICAL.Time {}

// Mock Component class (also exported directly)
export class Component extends ICAL.Component {}

// Mock Event class (also exported directly)
export class Event extends ICAL.Event {}

// Mock recurrence iterator
class RecurIterator {
  private event: any;
  private current: Date;
  private count: number = 0;
  private maxCount: number = 100; // Prevent infinite loops
  
  constructor(event: any, startTime?: any) {
    this.event = event;
    this.current = startTime ? startTime.toJSDate() : event.startDate?.toJSDate() || new Date();
  }
  
  next(): { value: any; done: boolean } {
    if (this.count >= this.maxCount) {
      return { value: null, done: true };
    }
    
    // Simple recurrence simulation - add 1 day
    const occurrence = Time.fromJSDate(this.current);
    this.current.setDate(this.current.getDate() + 1);
    this.count++;
    
    return { value: occurrence, done: false };
  }
  
  [Symbol.iterator]() {
    return this;
  }
}

// Parse ICAL string
export function parse(str: string): any[] {
  const component = Component.fromString(str);

  // Build jCal format with actual components
  const jCalComponents = [];
  const events = component.getAllSubcomponents('vevent');

  for (const event of events) {
    const eventProperties = [];
    const eventComponent = event as any;

    // Add properties from the event component
    for (const [key, value] of eventComponent.properties.entries()) {
      eventProperties.push([key, {}, 'text', value]);
    }

    jCalComponents.push(['vevent', eventProperties, []]);
  }

  return [component.name, [], jCalComponents];
}

// Mock utilities for testing
export const ICALTestUtils = {
  createMockCalendar: (events: Array<{
    uid: string;
    summary: string;
    start: Date;
    end?: Date;
    description?: string;
    isAllDay?: boolean;
  }>): string => {
    let ical = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:MockICAL\n';
    
    for (const event of events) {
      ical += 'BEGIN:VEVENT\n';
      ical += `UID:${event.uid}\n`;
      ical += `SUMMARY:${event.summary}\n`;
      
      if (event.isAllDay) {
        ical += `DTSTART;VALUE=DATE:${event.start.toISOString().split('T')[0].replace(/-/g, '')}\n`;
      } else {
        ical += `DTSTART:${event.start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
      }
      
      if (event.end) {
        if (event.isAllDay) {
          ical += `DTEND;VALUE=DATE:${event.end.toISOString().split('T')[0].replace(/-/g, '')}\n`;
        } else {
          ical += `DTEND:${event.end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
        }
      }
      
      if (event.description) {
        ical += `DESCRIPTION:${event.description}\n`;
      }
      
      ical += 'END:VEVENT\n';
    }
    
    ical += 'END:VCALENDAR';
    return ical;
  },
  
  createMockEvent: (data: {
    uid?: string;
    summary?: string;
    start?: Date;
    end?: Date;
    description?: string;
  }) => {
    const component = new Component('vevent');
    component.addPropertyWithValue('uid', data.uid || 'mock-uid');
    component.addPropertyWithValue('summary', data.summary || 'Mock Event');
    
    if (data.start) {
      component.addPropertyWithValue('dtstart', Time.fromJSDate(data.start));
    }
    
    if (data.end) {
      component.addPropertyWithValue('dtend', Time.fromJSDate(data.end));
    }
    
    if (data.description) {
      component.addPropertyWithValue('description', data.description);
    }
    
    return new Event(component);
  },
  
  reset: () => {
    // Reset any mock state if needed
  }
};

// Default export
export default ICAL;