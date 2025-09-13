/**
 * Comprehensive mock for date-fns library that behaves like the real library
 */

export const format = jest.fn((date: Date, formatStr: string) => {
  if (!date || isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  
  if (formatStr === 'yyyy-MM-dd') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else if (formatStr === 'MMM d, yyyy') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } else if (formatStr === 'MMM d, yyyy h:mm a') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else if (formatStr === 'MMM d, yyyy HH:mm') {
    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${dateStr} ${hours}:${minutes}`;
  } else if (formatStr === 'h:mm a') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else if (formatStr === 'HH:mm') {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } else if (formatStr === "yyyy-MM-dd'T'HH:mm") {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
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