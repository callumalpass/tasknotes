/**
 * Mock implementations for utility modules
 * These mocks provide controlled behavior for testing
 */

// Mock for src/utils/helpers.ts
export const ensureFolderExists = jest.fn().mockResolvedValue(undefined);


export const calculateDefaultDate = jest.fn().mockImplementation((option: string) => {
  switch (option) {
    case 'today':
      return '2025-01-15';
    case 'tomorrow':
      return '2025-01-16';
    case 'next-week':
      return '2025-01-22';
    default:
      return '';
  }
});


export const calculateDuration = jest.fn().mockImplementation((start: string, end: string) => {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Math.max(0, Math.round((endTime - startTime) / (1000 * 60)));
});

export const calculateTotalTimeSpent = jest.fn().mockImplementation((entries: any[]) => {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((total, entry) => {
    if (entry.startTime && entry.endTime) {
      return total + calculateDuration(entry.startTime, entry.endTime);
    }
    return total;
  }, 0);
});

export const formatTime = jest.fn().mockImplementation((minutes: number) => {
  if (!minutes || minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
});

export const extractTaskInfo = jest.fn().mockImplementation((app: any, content: string, path: string, file: any, fieldMapper?: any) => {
  return {
    title: file?.basename || 'Test Task',
    status: 'open',
    priority: 'normal',
    path,
    archived: false,
    tags: ['task'],
    contexts: [],
    dateCreated: '2025-01-15T10:00:00Z',
    dateModified: '2025-01-15T10:00:00Z'
  };
});

export const isTaskOverdue = jest.fn().mockImplementation((task: any) => false);

export const isDueByRRule = jest.fn().mockImplementation((task: any, date: Date) => true);

export const getEffectiveTaskStatus = jest.fn().mockImplementation((task: any, date: Date, completedStatus?: string) => task.status || 'open');

export const shouldShowRecurringTaskOnDate = jest.fn().mockImplementation((task: any, date: Date) => true);

export const generateRecurringInstances = jest.fn().mockImplementation((task: any, start: Date, end: Date) => []);

export const getRecurrenceDisplayText = jest.fn().mockImplementation((recurrence: any) => 'Daily');

// Mock for src/utils/filenameGenerator.ts
export const generateTaskFilename = jest.fn().mockImplementation((context: any, settings?: any) => {
  if (!context || !context.title) {
    return 'untitled-task';
  }
  
  const sanitizedTitle = context.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
    
  const date = context.date || new Date();
  const dateStr = date.toISOString().split('T')[0];
  
  return `${sanitizedTitle}-${dateStr}`;
});

export const validateFilename = jest.fn().mockImplementation((filename: string) => ({
  isValid: true,
  sanitized: filename
}));

export const generateUniqueFilename = jest.fn().mockImplementation(async (baseFilename: string, folderPath: string, vault: any) => {
  return baseFilename;
});

export const sanitizeForFilename = jest.fn().mockImplementation((input: string) => {
  if (!input || typeof input !== 'string') {
    return 'untitled';
  }

  // Simulate the same logic as the real sanitizeForFilename function
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[<>:"/\\|?*#\[\]]/g, '')
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
    .replace(/^\.+|\.+$/g, '')
    .trim() || 'untitled';
});

// Mock for src/utils/dateUtils.ts
export const getCurrentTimestamp = jest.fn(() => '2025-01-15T10:00:00.000+00:00');

export const hasTimeComponent = jest.fn((date: string) => date?.includes('T'));

export const getDatePart = jest.fn((date: string) => date?.split('T')[0] || date);

export const getTimePart = jest.fn((date: string) => date?.includes('T') ? '10:00' : null);

export const validateDateInput = jest.fn(() => true);

export const validateDateTimeInput = jest.fn(() => true);

export const parseDate = jest.fn().mockImplementation((dateStr: string) => {
  return new Date(dateStr);
});

export const getTodayString = jest.fn(() => '2025-01-15');

export const isBeforeDateSafe = jest.fn((date1: string, date2: string) => date1 < date2);

export const isSameDateSafe = jest.fn((date1: string, date2: string) => date1 === date2);

// Default export for compatibility
export default {
  ensureFolderExists,
  calculateDefaultDate,
  calculateDuration,
  calculateTotalTimeSpent,
  formatTime,
  extractTaskInfo,
  isTaskOverdue,
  isDueByRRule,
  getEffectiveTaskStatus,
  shouldShowRecurringTaskOnDate,
  generateRecurringInstances,
  getRecurrenceDisplayText,
  generateTaskFilename,
  validateFilename,
  generateUniqueFilename,
  sanitizeForFilename,
  getCurrentTimestamp,
  hasTimeComponent,
  getDatePart,
  getTimePart,
  validateDateInput,
  validateDateTimeInput,
  parseDate,
  getTodayString,
  isBeforeDateSafe,
  isSameDateSafe
};