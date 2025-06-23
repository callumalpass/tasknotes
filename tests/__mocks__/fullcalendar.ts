/**
 * Mock for FullCalendar libraries
 * Used for calendar views in TaskNotes plugin
 */

// Mock event object structure
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: Record<string, any>;
}

// Mock calendar API
export interface CalendarApi {
  render(): void;
  destroy(): void;
  getDate(): Date;
  gotoDate(date: Date | string): void;
  prev(): void;
  next(): void;
  today(): void;
  changeView(viewName: string, dateOrRange?: Date | string): void;
  getView(): { type: string; title: string; };
  addEvent(event: CalendarEvent): void;
  removeAllEvents(): void;
  getEvents(): CalendarEvent[];
  refetchEvents(): void;
  updateSize(): void;
  setOption(name: string, value: any): void;
  getOption(name: string): any;
}

// Mock Calendar class
export class Calendar implements CalendarApi {
  private events: CalendarEvent[] = [];
  private currentDate = new Date();
  private currentView = 'dayGridMonth';
  private options: Record<string, any> = {};
  private element: HTMLElement;
  
  constructor(element: HTMLElement | string, options: Record<string, any> = {}) {
    this.element = typeof element === 'string' ? 
      document.querySelector(element) as HTMLElement : 
      element;
    this.options = { ...options };
    
    // Mock DOM creation
    if (this.element) {
      this.element.innerHTML = '<div class="fc fc-media-screen fc-theme-standard"></div>';
    }
  }
  
  render(): void {
    // Mock render implementation
    if (this.options.events) {
      this.events = Array.isArray(this.options.events) ? 
        this.options.events : [];
    }
  }
  
  destroy(): void {
    if (this.element) {
      this.element.innerHTML = '';
    }
    this.events = [];
  }
  
  getDate(): Date {
    return new Date(this.currentDate);
  }
  
  gotoDate(date: Date | string): void {
    this.currentDate = typeof date === 'string' ? new Date(date) : date;
  }
  
  prev(): void {
    const newDate = new Date(this.currentDate);
    if (this.currentView.includes('month')) {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (this.currentView.includes('week')) {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    this.currentDate = newDate;
  }
  
  next(): void {
    const newDate = new Date(this.currentDate);
    if (this.currentView.includes('month')) {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (this.currentView.includes('week')) {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    this.currentDate = newDate;
  }
  
  today(): void {
    this.currentDate = new Date();
  }
  
  changeView(viewName: string, dateOrRange?: Date | string): void {
    this.currentView = viewName;
    if (dateOrRange) {
      this.gotoDate(dateOrRange);
    }
  }
  
  getView(): { type: string; title: string; } {
    return {
      type: this.currentView,
      title: this.getViewTitle()
    };
  }
  
  private getViewTitle(): string {
    const date = this.currentDate;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    if (this.currentView.includes('month')) {
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } else if (this.currentView.includes('week')) {
      return `Week of ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } else {
      return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
  }
  
  addEvent(event: CalendarEvent): void {
    this.events.push({ ...event });
  }
  
  removeAllEvents(): void {
    this.events = [];
  }
  
  getEvents(): CalendarEvent[] {
    return [...this.events];
  }
  
  refetchEvents(): void {
    // Mock refetch - would normally reload from source
    if (this.options.events && typeof this.options.events === 'function') {
      // Simulate async event loading
      setTimeout(() => {
        this.options.events((events: CalendarEvent[]) => {
          this.events = events;
        });
      }, 0);
    }
  }
  
  updateSize(): void {
    // Mock size update
  }
  
  setOption(name: string, value: any): void {
    this.options[name] = value;
    
    // Handle special options
    if (name === 'events') {
      if (Array.isArray(value)) {
        this.events = value;
      }
    }
  }
  
  getOption(name: string): any {
    return this.options[name];
  }
}

// Mock plugin classes
export class DayGridPlugin {
  static pluginName = 'dayGrid';
}

export class TimeGridPlugin {
  static pluginName = 'timeGrid';
}

export class InteractionPlugin {
  static pluginName = 'interaction';
}

export class MultiMonthPlugin {
  static pluginName = 'multiMonth';
}

// Mock utilities and helpers
export const formatDate = jest.fn((date: Date | string, format?: string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (!format) {
    return d.toISOString().split('T')[0];
  }
  
  // Simple format implementation
  const formats: Record<string, string> = {
    'YYYY-MM-DD': d.toISOString().split('T')[0],
    'MM/DD/YYYY': `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`,
    'MMMM D, YYYY': d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  };
  
  return formats[format] || d.toISOString();
});

export const addDays = jest.fn((date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
});

export const startOfWeek = jest.fn((date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day;
  result.setDate(diff);
  return result;
});

export const endOfWeek = jest.fn((date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + 6;
  result.setDate(diff);
  return result;
});

// Mock event utilities
export const createEventId = jest.fn((): string => {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
});

// Test utilities
export const FullCalendarTestUtils = {
  createMockCalendar: (element?: HTMLElement, options?: Record<string, any>) => {
    const mockElement = element || document.createElement('div');
    return new Calendar(mockElement, options);
  },
  
  createMockEvent: (overrides?: Partial<CalendarEvent>): CalendarEvent => ({
    id: createEventId(),
    title: 'Test Event',
    start: new Date(),
    allDay: false,
    backgroundColor: '#3788d8',
    ...overrides
  }),
  
  createMockEvents: (count: number): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const baseDate = new Date();
    
    for (let i = 0; i < count; i++) {
      const eventDate = new Date(baseDate);
      eventDate.setDate(baseDate.getDate() + i);
      
      events.push({
        id: `test-event-${i}`,
        title: `Test Event ${i + 1}`,
        start: eventDate,
        allDay: i % 2 === 0,
        backgroundColor: i % 2 === 0 ? '#3788d8' : '#ff6b6b'
      });
    }
    
    return events;
  },
  
  simulateEventClick: (calendar: Calendar, eventId: string) => {
    const events = calendar.getEvents();
    const event = events.find(e => e.id === eventId);
    
    if (event && calendar.getOption('eventClick')) {
      calendar.getOption('eventClick')({
        event,
        jsEvent: new MouseEvent('click'),
        view: calendar.getView()
      });
    }
  },
  
  simulateDateClick: (calendar: Calendar, date: Date) => {
    if (calendar.getOption('dateClick')) {
      calendar.getOption('dateClick')({
        date,
        dateStr: formatDate(date),
        allDay: true,
        jsEvent: new MouseEvent('click'),
        view: calendar.getView()
      });
    }
  },
  
  reset: () => {
    jest.clearAllMocks();
  }
};

// Default exports for different modules
export default {
  Calendar,
  formatDate,
  addDays,
  startOfWeek,
  endOfWeek,
  createEventId
};