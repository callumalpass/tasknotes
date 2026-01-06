/**
 * Comprehensive mock for date-fns library that behaves like the real library
 */

export const format = jest.fn((date: Date, formatStr: string) => {
  if (!date || isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();

  // Date formats
  if (formatStr === 'yyyy') return String(year);
  if (formatStr === 'MM') return String(month + 1).padStart(2, '0');
  if (formatStr === 'dd') return String(day).padStart(2, '0');
  if (formatStr === 'yyyy-MM-dd') return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Time formats
  if (formatStr === 'HH') return String(hours).padStart(2, '0');
  if (formatStr === 'mm') return String(minutes).padStart(2, '0');
  if (formatStr === 'ss') return String(seconds).padStart(2, '0');
  if (formatStr === 'HHmmss') return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}${String(seconds).padStart(2, '0')}`;
  if (formatStr === 'HH:mm') return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  if (formatStr === 'hh') return String(hours % 12 || 12).padStart(2, '0');
  if (formatStr === 'h:mm a') {
    const h = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }
  if (formatStr === 'hh:mm a') {
    const h = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }
  if (formatStr === 'a') return hours < 12 ? 'AM' : 'PM';

  // Combined date/time formats
  if (formatStr === 'yyyy-MM-dd-HHmmss') return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}-${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}${String(seconds).padStart(2, '0')}`;
  if (formatStr === 'yyyy-MM-dd-HHmm') return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}-${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;

  // Short date formats
  if (formatStr === 'yyMMdd') return `${String(year).slice(-2)}${String(month + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`;

  // Month/day names
  if (formatStr === 'MMMM') return date.toLocaleDateString('en-US', { month: 'long' });
  if (formatStr === 'MMM') return date.toLocaleDateString('en-US', { month: 'short' });
  if (formatStr === 'EEEE') return date.toLocaleDateString('en-US', { weekday: 'long' });
  if (formatStr === 'EEE') return date.toLocaleDateString('en-US', { weekday: 'short' });

  // Week/quarter
  if (formatStr === 'ww') {
    const start = new Date(year, 0, 1);
    const diff = (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return String(Math.ceil((diff + start.getDay() + 1) / 7)).padStart(2, '0');
  }
  if (formatStr === 'q') return String(Math.floor(month / 3) + 1);

  // Milliseconds
  if (formatStr === 'SSS') return String(ms).padStart(3, '0');

  // Timezone formats
  if (formatStr === 'xxx') {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetMinutes = String(absOffset % 60).padStart(2, '0');
    return `${sign}${offsetHours}:${offsetMinutes}`;
  }
  if (formatStr === 'xx') {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetMinutes = String(absOffset % 60).padStart(2, '0');
    return `${sign}${offsetHours}${offsetMinutes}`;
  }

  // Legacy formats
  if (formatStr === 'MMM d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (formatStr === 'MMM d h:mm a') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (formatStr === 'MMM d HH:mm') {
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    return `${dateStr} ${hoursStr}:${minutesStr}`;
  }
  if (formatStr === 'MMM d, yyyy') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (formatStr === 'MMM d, yyyy h:mm a') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (formatStr === 'MMM d, yyyy HH:mm') {
    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    return `${dateStr} ${hoursStr}:${minutesStr}`;
  }
  if (formatStr === "yyyy-MM-dd'T'HH:mm") {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // Default fallback
  return date.toISOString();
});

export const parse = jest.fn((dateStr: string, format: string, refDate: Date) => {
  if (format === 'yyyy-MM-dd') {
    return new Date(dateStr + 'T00:00:00');
  }
  return new Date(dateStr);
});

export const parseISO = jest.fn((dateStr: string) => {
  const date = new Date(dateStr);
  // Return the date even if invalid - let isValid handle the validation
  return date;
});

export const isSameDay = jest.fn((date1: Date, date2: Date) => {
  return date1.toDateString() === date2.toDateString();
});

export const isBefore = jest.fn((date1: Date, date2: Date) => {
  return date1.getTime() < date2.getTime();
});

export const isValid = jest.fn((date: Date) => {
  return date instanceof Date && !isNaN(date.getTime());
});

export const startOfDay = jest.fn((date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
});

export const endOfDay = jest.fn((date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
});

export const addDays = jest.fn((date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
});

export const addWeeks = jest.fn((date: Date, amount: number) => {
  return addDays(date, amount * 7);
});

export const addMonths = jest.fn((date: Date, amount: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + amount);
  return result;
});

export const addYears = jest.fn((date: Date, amount: number) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + amount);
  return result;
});