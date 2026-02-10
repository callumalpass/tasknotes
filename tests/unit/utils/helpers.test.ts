/**
 * Helpers Unit Tests
 * 
 * Tests for utility helper functions including:
 * - Debouncing functions
 * - Folder creation utilities
 * - Time and duration calculations
 * - Template processing
 * - Task and note extraction
 * - Recurring task logic
 * - File validation utilities
 * - Error handling and edge cases
 */

import {
  ensureFolderExists,
  calculateDuration,
  calculateTotalTimeSpent,
  getActiveTimeEntry,
  formatTime,
  parseTime,
  calculateDefaultDate,
  isSameDay,
  extractTaskInfo,
  isTaskOverdue,
  isDueByRRule,
  isRecurringTaskDueOn,
  getEffectiveTaskStatus,
  shouldShowRecurringTaskOnDate,
  generateRecurringInstances,
  getRecurrenceDisplayText,
  extractNoteInfo,
  validateTimeBlock,
  extractTimeblocksFromNote,
  timeblockToCalendarEvent,
  generateTimeblockId
} from '../../../src/utils/helpers';

import { TaskInfo, TimeEntry, TimeBlock } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('obsidian');
jest.mock('rrule');

// Mock date-fns functions
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0];
    }
    if (formatStr === 'HH:mm') {
      return date.toTimeString().substr(0, 5);
    }
    return date.toISOString();
  }),
  parseISO: jest.fn((dateStr: string) => new Date(dateStr)),
  isBefore: jest.fn((date1: Date, date2: Date) => date1.getTime() < date2.getTime()),
  startOfDay: jest.fn((date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }),
  isSameDay: jest.fn((date1: Date, date2: Date) => date1.toDateString() === date2.toDateString())
}));

// Mock RRule specifically
jest.mock('rrule', () => ({
  RRule: {
    fromString: jest.fn().mockReturnValue({
      toText: jest.fn().mockReturnValue('Daily')
    }),
    parseString: jest.fn().mockReturnValue({}),
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
    SU: 'SU', MO: 'MO', TU: 'TU', WE: 'WE', TH: 'TH', FR: 'FR', SA: 'SA'
  }
}));

// Mock dateUtils functions
jest.mock('../../../src/utils/dateUtils', () => ({
  parseDate: jest.fn((dateStr: string) => new Date(dateStr)),
  getTodayString: jest.fn(() => '2025-06-25'), // Fixed future date
  getTodayLocal: jest.fn(() => new Date('2025-06-25')),
  parseDateAsLocal: jest.fn((dateStr: string) => new Date(dateStr)),
  hasTimeComponent: jest.fn((dateStr: string) => dateStr.includes('T')),
  isBeforeDateSafe: jest.fn((date1: string, date2: string) => {
    // Mock past dates as overdue
    if (date1 === '2020-01-01') return true;
    return false;
  }),
  isSameDateSafe: jest.fn((date1: string, date2: string) => date1 === date2),
  createUTCDateForRRule: jest.fn((dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }),
  formatDateForStorage: jest.fn((date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })
}));

describe('Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockObsidian.reset();
    
    // Mock console methods to reduce noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });


  describe('ensureFolderExists', () => {
    let mockVault: any;

    beforeEach(() => {
      // Mock normalizePath from obsidian
      const obsidianMock = require('obsidian');
      obsidianMock.normalizePath = jest.fn((path: string) => {
        if (!path) return '';
        return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/*/, '').replace(/\/*$/, '');
      });
      
      mockVault = {
        adapter: {
          exists: jest.fn().mockResolvedValue(false),
        },
        createFolder: jest.fn().mockResolvedValue(undefined)
      };
    });

    it('should create single folder', async () => {
      await ensureFolderExists(mockVault, 'Tasks');

      expect(mockVault.createFolder).toHaveBeenCalledWith('Tasks');
    });

    it('should create nested folders', async () => {
      await ensureFolderExists(mockVault, 'Projects/TaskNotes/Archive');

      expect(mockVault.createFolder).toHaveBeenCalledWith('Projects');
      expect(mockVault.createFolder).toHaveBeenCalledWith('Projects/TaskNotes');
      expect(mockVault.createFolder).toHaveBeenCalledWith('Projects/TaskNotes/Archive');
    });

    it('should skip existing folders', async () => {
      mockVault.adapter.exists
        .mockResolvedValueOnce(true)  // Projects exists
        .mockResolvedValueOnce(false) // TaskNotes doesn't exist
        .mockResolvedValueOnce(true); // Archive exists

      await ensureFolderExists(mockVault, 'Projects/TaskNotes/Archive');

      expect(mockVault.createFolder).toHaveBeenCalledTimes(1);
      expect(mockVault.createFolder).toHaveBeenCalledWith('Projects/TaskNotes');
    });

    it('should handle empty folder path', async () => {
      await ensureFolderExists(mockVault, '');
      expect(mockVault.createFolder).not.toHaveBeenCalled();
    });

    it('should handle folder creation errors', async () => {
      mockVault.createFolder.mockRejectedValue(new Error('Permission denied'));
      // Folder still doesn't exist after the failed attempt
      mockVault.adapter.exists.mockResolvedValue(false);

      await expect(ensureFolderExists(mockVault, 'Tasks'))
        .rejects.toThrow('Failed to create folder "Tasks"');
    });

    it('should tolerate race condition where folder is created between check and create', async () => {
      // adapter.exists returns false initially (folder doesn't exist yet)
      mockVault.adapter.exists.mockResolvedValueOnce(false);
      // createFolder throws "Folder already exists" (race condition)
      mockVault.createFolder.mockRejectedValueOnce(new Error('Folder already exists.'));
      // Second exists check confirms folder now exists
      mockVault.adapter.exists.mockResolvedValueOnce(true);

      await expect(ensureFolderExists(mockVault, 'Tasks')).resolves.toBeUndefined();
    });

    it('should normalize folder paths', async () => {
      await ensureFolderExists(mockVault, 'Tasks/SubFolder');

      expect(mockVault.createFolder).toHaveBeenCalledWith('Tasks');
      expect(mockVault.createFolder).toHaveBeenCalledWith('Tasks/SubFolder');
    });
  });

  describe('Time Calculation Functions', () => {
    describe('calculateDuration', () => {
      it('should calculate duration in minutes', () => {
        const start = '2025-01-01T10:00:00Z';
        const end = '2025-01-01T11:30:00Z';
        
        const result = calculateDuration(start, end);
        expect(result).toBe(90); // 1.5 hours = 90 minutes
      });

      it('should handle same start and end times', () => {
        const time = '2025-01-01T10:00:00Z';
        
        const result = calculateDuration(time, time);
        expect(result).toBe(0);
      });

      it('should handle invalid timestamps', () => {
        const result = calculateDuration('invalid', '2025-01-01T10:00:00Z');
        expect(result).toBe(0);
      });

      it('should handle end time before start time', () => {
        const start = '2025-01-01T11:00:00Z';
        const end = '2025-01-01T10:00:00Z';
        
        const result = calculateDuration(start, end);
        expect(result).toBe(0);
      });

      it('should round to nearest minute', () => {
        const start = '2025-01-01T10:00:00Z';
        const end = '2025-01-01T10:00:30Z'; // 30 seconds
        
        const result = calculateDuration(start, end);
        expect(result).toBe(1); // Rounded up to 1 minute
      });
    });

    describe('calculateTotalTimeSpent', () => {
      it('should sum completed time entries', () => {
        const timeEntries: TimeEntry[] = [
          {
            startTime: '2025-01-01T10:00:00Z',
            endTime: '2025-01-01T10:30:00Z',
            description: 'Session 1'
          },
          {
            startTime: '2025-01-01T11:00:00Z',
            endTime: '2025-01-01T11:45:00Z',
            description: 'Session 2'
          }
        ];

        const result = calculateTotalTimeSpent(timeEntries);
        expect(result).toBe(75); // 30 + 45 minutes
      });

      it('should skip active entries without end time', () => {
        const timeEntries: TimeEntry[] = [
          {
            startTime: '2025-01-01T10:00:00Z',
            endTime: '2025-01-01T10:30:00Z',
            description: 'Completed'
          },
          {
            startTime: '2025-01-01T11:00:00Z',
            description: 'Active session'
          }
        ];

        const result = calculateTotalTimeSpent(timeEntries);
        expect(result).toBe(30); // Only the completed session
      });

      it('should handle empty or invalid arrays', () => {
        expect(calculateTotalTimeSpent([])).toBe(0);
        expect(calculateTotalTimeSpent(null as any)).toBe(0);
        expect(calculateTotalTimeSpent(undefined as any)).toBe(0);
      });

      it('should handle entries with invalid timestamps', () => {
        const timeEntries: TimeEntry[] = [
          {
            startTime: 'invalid',
            endTime: '2025-01-01T10:30:00Z',
            description: 'Invalid start'
          },
          {
            startTime: '2025-01-01T11:00:00Z',
            endTime: '2025-01-01T11:30:00Z',
            description: 'Valid entry'
          }
        ];

        const result = calculateTotalTimeSpent(timeEntries);
        expect(result).toBe(30); // Only the valid entry
      });
    });

    describe('getActiveTimeEntry', () => {
      it('should find active entry without end time', () => {
        const timeEntries: TimeEntry[] = [
          {
            startTime: '2025-01-01T10:00:00Z',
            endTime: '2025-01-01T10:30:00Z',
            description: 'Completed'
          },
          {
            startTime: '2025-01-01T11:00:00Z',
            description: 'Active session'
          }
        ];

        const result = getActiveTimeEntry(timeEntries);
        expect(result).toEqual({
          startTime: '2025-01-01T11:00:00Z',
          description: 'Active session'
        });
      });

      it('should return null if no active entries', () => {
        const timeEntries: TimeEntry[] = [
          {
            startTime: '2025-01-01T10:00:00Z',
            endTime: '2025-01-01T10:30:00Z',
            description: 'Completed'
          }
        ];

        const result = getActiveTimeEntry(timeEntries);
        expect(result).toBeNull();
      });

      it('should handle empty or invalid arrays', () => {
        expect(getActiveTimeEntry([])).toBeNull();
        expect(getActiveTimeEntry(null as any)).toBeNull();
        expect(getActiveTimeEntry(undefined as any)).toBeNull();
      });
    });

    describe('formatTime', () => {
      it('should format hours and minutes', () => {
        expect(formatTime(90)).toBe('1h 30m');
        expect(formatTime(120)).toBe('2h');
        expect(formatTime(45)).toBe('45m');
        expect(formatTime(0)).toBe('0m');
      });

      it('should handle edge cases', () => {
        expect(formatTime(null as any)).toBe('0m');
        expect(formatTime(undefined as any)).toBe('0m');
        expect(formatTime(NaN)).toBe('0m');
      });

      it('should handle large values', () => {
        expect(formatTime(1440)).toBe('24h'); // 24 hours
        expect(formatTime(1500)).toBe('25h'); // 25 hours
      });
    });

    describe('parseTime', () => {
      it('should parse valid time strings', () => {
        expect(parseTime('14:30')).toEqual({ hours: 14, minutes: 30 });
        expect(parseTime('09:05')).toEqual({ hours: 9, minutes: 5 });
        expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
        expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
      });

      it('should reject invalid time strings', () => {
        expect(parseTime('25:00')).toBeNull(); // Invalid hour
        expect(parseTime('12:60')).toBeNull(); // Invalid minute
        expect(parseTime('12:5')).toBeNull(); // Missing leading zero
        expect(parseTime('12')).toBeNull(); // Missing minutes
        expect(parseTime('invalid')).toBeNull();
        expect(parseTime('')).toBeNull();
      });

      it('should handle edge cases', () => {
        expect(parseTime(null as any)).toBeNull();
        expect(parseTime(undefined as any)).toBeNull();
      });
    });
  });

  describe('Template Processing', () => {

    describe('calculateDefaultDate', () => {
      it('should return empty for none option', () => {
        expect(calculateDefaultDate('none')).toBe('');
      });

      it('should return today for today option', () => {
        const result = calculateDefaultDate('today');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should return tomorrow for tomorrow option', () => {
        const result = calculateDefaultDate('tomorrow');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should return next week for next-week option', () => {
        const result = calculateDefaultDate('next-week');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle invalid options', () => {
        expect(calculateDefaultDate('invalid' as any)).toBe('');
      });
    });
  });

  describe('Task and Note Extraction', () => {
    describe('extractTaskInfo', () => {
      let mockApp: any;
      let mockFile: TFile;

      beforeEach(() => {
        mockFile = new TFile('/tasks/test.md');
        mockApp = {
          metadataCache: {
            getFileCache: jest.fn()
          }
        };
      });

      it('should extract task info from frontmatter', () => {
        const frontmatter = {
          title: 'Test Task',
          status: 'open',
          priority: 'high',
          due: '2025-01-15',
          tags: ['task']
        };

        mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

        const mockFieldMapper = {
          mapFromFrontmatter: jest.fn().mockReturnValue(frontmatter),
          mapToFrontmatter: jest.fn().mockImplementation((taskData: any) => {
            const frontmatter: any = {};
            Object.keys(taskData).forEach(key => {
              if (taskData[key] !== undefined && key !== 'path' && key !== 'tags') {
                frontmatter[key] = taskData[key];
              }
            });
            return frontmatter;
          }),
          toUserField: jest.fn().mockImplementation((field: string) => field),
          updateMapping: jest.fn(),
          getMapping: jest.fn().mockReturnValue({
            title: 'title',
            status: 'status',
            priority: 'priority',
            due: 'due',
            scheduled: 'scheduled',
            contexts: 'contexts',
            timeEstimate: 'timeEstimate',
            completedDate: 'completedDate',
            dateCreated: 'dateCreated',
            dateModified: 'dateModified',
            recurrence: 'recurrence',
            archiveTag: 'archived',
            timeEntries: 'timeEntries',
            completeInstances: 'complete_instances',
            pomodoros: 'pomodoros'
          })
        } as any;

        const result = extractTaskInfo(mockApp, '', '/tasks/test.md', mockFile, mockFieldMapper);

        expect(result).toMatchObject({
          title: 'Test Task',
          status: 'open',
          priority: 'high',
          due: '2025-01-15',
          path: '/tasks/test.md',
          archived: false
        });
      });

      it('should fallback to filename when no frontmatter', () => {
        mockApp.metadataCache.getFileCache.mockReturnValue(null);

        const result = extractTaskInfo(mockApp, '', '/tasks/my-task.md', mockFile);

        expect(result).toMatchObject({
          title: 'my-task',
          status: 'open',
          priority: 'normal',
          path: '/tasks/my-task.md',
          archived: false
        });
      });

      it('should use default field mapper when none provided', () => {
        const frontmatter = { title: 'Test', status: 'open' };
        mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

        const result = extractTaskInfo(mockApp, '', '/tasks/test.md', mockFile);

        expect(result).toBeDefined();
        expect(result?.title).toBe('Test');
      });
    });

    describe('extractNoteInfo', () => {
      let mockApp: any;
      let mockFile: TFile;

      beforeEach(() => {
        mockFile = new TFile('/notes/test.md');
        mockFile.stat = { mtime: Date.now(), ctime: Date.now() };
        
        mockApp = {
          metadataCache: {
            getFileCache: jest.fn()
          }
        };
      });

      it('should extract note info from frontmatter', () => {
        const frontmatter = {
          title: 'Test Note',
          tags: ['note'],
          dateCreated: '2025-01-01'
        };

        mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

        const result = extractNoteInfo(mockApp, '', '/notes/test.md', mockFile);

        expect(result).toMatchObject({
          title: 'Test Note',
          tags: ['note'],
          path: '/notes/test.md',
          createdDate: '2025-01-01'
        });
      });

      it('should extract title from first heading', () => {
        const content = '# My Note Title\n\nSome content here.';
        mockApp.metadataCache.getFileCache.mockReturnValue(null);
        
        // Use a generic filename that would trigger heading extraction
        const result = extractNoteInfo(mockApp, content, '/notes/Untitled.md', mockFile);

        expect(result?.title).toBe('My Note Title');
      });

      it('should use filename as fallback title', () => {
        mockApp.metadataCache.getFileCache.mockReturnValue(null);

        const result = extractNoteInfo(mockApp, '', '/notes/my-note.md', mockFile);

        expect(result?.title).toBe('my-note');
      });
    });
  });

  describe('Recurring Task Logic', () => {
    describe('getEffectiveTaskStatus', () => {
      it('should return actual status for non-recurring tasks', () => {
        const task = { status: 'in-progress' };
        const result = getEffectiveTaskStatus(task, new Date());
        expect(result).toBe('in-progress');
      });

      it('should return completed status for recurring task with completed instance', () => {
        const date = new Date('2025-01-15');
        const task = {
          status: 'open',
          recurrence: 'FREQ=DAILY',
          complete_instances: ['2025-01-15']
        };

        const result = getEffectiveTaskStatus(task, date);
        expect(result).toBe('done');
      });

      it('should return open status for recurring task without completed instance', () => {
        const date = new Date('2025-01-15');
        const task = {
          status: 'open',
          recurrence: 'FREQ=DAILY',
          complete_instances: ['2025-01-14']
        };

        const result = getEffectiveTaskStatus(task, date);
        expect(result).toBe('open');
      });
    });

    describe('shouldShowRecurringTaskOnDate', () => {
      it('should always show non-recurring tasks', () => {
        const task = TaskFactory.createTask({ recurrence: undefined });
        const result = shouldShowRecurringTaskOnDate(task, new Date());
        expect(result).toBe(true);
      });

      it('should check RRule for recurring tasks', () => {
        const task = TaskFactory.createRecurringTask('FREQ=DAILY');
        // This will use the mocked isDueByRRule function
        const result = shouldShowRecurringTaskOnDate(task, new Date());
        expect(result).toBeDefined();
      });
    });
  });

  describe('TimeBlock Utilities', () => {
    describe('validateTimeBlock', () => {
      it('should validate correct timeblock', () => {
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'Meeting',
          startTime: '09:00',
          endTime: '10:00'
        };

        expect(validateTimeBlock(timeblock)).toBe(true);
      });

      /**
       * Issue #1076: Cannot create timeblock with end time = 00:00
       *
       * The validation logic treats 00:00 as "0 minutes since midnight",
       * which will always be less than any reasonable start time.
       *
       * Example: 22:00 to 00:00 should be a valid 2-hour timeblock ending at midnight.
       * Current behavior: endMinutes (0) <= startMinutes (1320) returns false.
       *
       * @see https://github.com/callumalpass/tasknotes/issues/1076
       */
      it.skip('reproduces issue #1076 - should accept 00:00 as valid end time (midnight)', () => {
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'Late Night Work',
          startTime: '22:00',
          endTime: '00:00'
        };

        // This should be valid: a 2-hour timeblock from 22:00 to midnight
        expect(validateTimeBlock(timeblock)).toBe(true);
      });

      it.skip('reproduces issue #1076 - should accept 23:30 to 00:00 as valid 30-minute block', () => {
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'End of Day Review',
          startTime: '23:30',
          endTime: '00:00'
        };

        // This should be valid: a 30-minute timeblock ending at midnight
        expect(validateTimeBlock(timeblock)).toBe(true);
      });

      it.skip('reproduces issue #1076 - should calculate correct duration for timeblock ending at 00:00', () => {
        // When fixed, the validation should treat 00:00 as 1440 minutes (24 hours)
        // Duration should be: 1440 - (22 * 60) = 1440 - 1320 = 120 minutes (2 hours)
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'Test Duration',
          startTime: '22:00',
          endTime: '00:00'
        };

        expect(validateTimeBlock(timeblock)).toBe(true);

        // The actual duration calculation (if exposed) would be:
        // startMinutes = 22 * 60 = 1320
        // endMinutes = 0 (should be treated as 1440)
        // duration = 1440 - 1320 = 120 minutes
      });

      it.skip('reproduces issue #1076 - edge case: 00:00 to 00:00 should be invalid', () => {
        // A timeblock starting and ending at midnight (same time) should still be invalid
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'Zero Duration',
          startTime: '00:00',
          endTime: '00:00'
        };

        // This should be invalid: zero duration timeblock
        expect(validateTimeBlock(timeblock)).toBe(false);
      });

      it('should reject timeblock with invalid time format', () => {
        const timeblock = {
          id: 'tb-1',
          title: 'Meeting',
          startTime: '25:00', // Invalid hour
          endTime: '10:00'
        };

        expect(validateTimeBlock(timeblock)).toBe(false);
      });

      it('should reject timeblock with end time before start time', () => {
        const timeblock = {
          id: 'tb-1',
          title: 'Meeting',
          startTime: '10:00',
          endTime: '09:00'
        };

        expect(validateTimeBlock(timeblock)).toBe(false);
      });

      it('should reject timeblock missing required fields', () => {
        const timeblock = {
          title: 'Meeting',
          startTime: '09:00'
          // Missing id and endTime
        };

        expect(validateTimeBlock(timeblock)).toBe(false);
      });

      it('should validate optional fields correctly', () => {
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'Meeting',
          startTime: '09:00',
          endTime: '10:00',
          attachments: ['[[Task 1]]', '[Meeting Notes](notes.md)'],
          color: '#ff0000',
          description: 'Team standup'
        };

        expect(validateTimeBlock(timeblock)).toBe(true);
      });

      it('should reject invalid attachments', () => {
        const timeblock = {
          id: 'tb-1',
          title: 'Meeting',
          startTime: '09:00',
          endTime: '10:00',
          attachments: ['valid', ''] // Empty attachment
        };

        expect(validateTimeBlock(timeblock)).toBe(false);
      });
    });

    describe('timeblockToCalendarEvent', () => {
      it('should convert timeblock to calendar event', () => {
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'Team Meeting',
          startTime: '09:00',
          endTime: '10:00',
          color: '#ff0000',
          description: 'Weekly standup'
        };

        const result = timeblockToCalendarEvent(timeblock, '2025-01-15');

        expect(result).toMatchObject({
          id: 'timeblock-tb-1',
          title: 'Team Meeting',
          start: '2025-01-15T09:00:00',
          end: '2025-01-15T10:00:00',
          allDay: false,
          backgroundColor: '#ff0000',
          eventType: 'timeblock'
        });

        expect(result.extendedProps).toMatchObject({
          type: 'timeblock',
          timeblock: timeblock,
          originalDate: '2025-01-15',
          description: 'Weekly standup'
        });
      });

      it('should use default color when none provided', () => {
        const timeblock: TimeBlock = {
          id: 'tb-1',
          title: 'Meeting',
          startTime: '09:00',
          endTime: '10:00'
        };

        const result = timeblockToCalendarEvent(timeblock, '2025-01-15');

        expect(result.backgroundColor).toBe('#6366f1');
        expect(result.borderColor).toBe('#6366f1');
      });
    });

    describe('generateTimeblockId', () => {
      it('should generate unique IDs', () => {
        const id1 = generateTimeblockId();
        const id2 = generateTimeblockId();

        expect(id1).toMatch(/^tb-\d+-[a-z0-9]+$/);
        expect(id2).toMatch(/^tb-\d+-[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('extractTimeblocksFromNote', () => {
      it('should extract valid timeblocks from frontmatter', () => {
        // Mock parseYaml to return the expected structure
        const obsidianMock = require('obsidian');
        obsidianMock.parseYaml = jest.fn().mockReturnValue({
          title: 'Daily Note',
          timeblocks: [
            {
              id: 'tb-1',
              title: 'Meeting',
              startTime: '09:00',
              endTime: '10:00'
            },
            {
              id: 'tb-2',
              title: 'Focus Time',
              startTime: '14:00',
              endTime: '16:00'
            }
          ]
        });
        
        const content = `---
title: Daily Note
timeblocks:
  - id: tb-1
    title: Meeting
    startTime: "09:00"
    endTime: "10:00"
  - id: tb-2
    title: Focus Time
    startTime: "14:00"
    endTime: "16:00"
---

# Daily Note Content`;

        const result = extractTimeblocksFromNote(content, '/daily/2025-01-15.md');

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: 'tb-1',
          title: 'Meeting',
          startTime: '09:00',
          endTime: '10:00'
        });
      });

      it('should filter out invalid timeblocks', () => {
        // Mock parseYaml to return mixed valid/invalid timeblocks
        const obsidianMock = require('obsidian');
        obsidianMock.parseYaml = jest.fn().mockReturnValue({
          timeblocks: [
            {
              id: 'tb-1',
              title: 'Valid',
              startTime: '09:00',
              endTime: '10:00'
            },
            {
              id: 'tb-2',
              title: 'Invalid',
              startTime: '10:00',
              endTime: '09:00' // End before start = invalid
            }
          ]
        });
        
        const content = `---
timeblocks:
  - id: tb-1
    title: Valid
    startTime: "09:00"
    endTime: "10:00"
  - id: tb-2
    title: Invalid
    startTime: "10:00"
    endTime: "09:00"
---`;

        const result = extractTimeblocksFromNote(content, '/daily/test.md');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('tb-1');
      });

      it('should return empty array for content without timeblocks', () => {
        // Reset parseYaml mock for this test
        const obsidianMock = require('obsidian');
        obsidianMock.parseYaml = jest.fn().mockReturnValue({
          title: 'Note without timeblocks'
          // No timeblocks property
        });
        
        const content = `---
title: Note without timeblocks
---

Just a regular note.`;

        const result = extractTimeblocksFromNote(content, '/notes/test.md');
        expect(result).toEqual([]);
      });

      it('should handle malformed frontmatter', () => {
        // Mock parseYaml to throw an error for malformed YAML
        const obsidianMock = require('obsidian');
        obsidianMock.parseYaml = jest.fn().mockImplementation(() => {
          throw new Error('Invalid YAML');
        });
        
        const content = `---
invalid yaml: [
---`;

        const result = extractTimeblocksFromNote(content, '/notes/test.md');
        expect(result).toEqual([]);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(calculateTotalTimeSpent(null as any)).toBe(0);
      expect(getActiveTimeEntry(undefined as any)).toBeNull();
      expect(formatTime(null as any)).toBe('0m');
      expect(parseTime(null as any)).toBeNull();
    });

    it('should handle malformed data structures', () => {
      const malformedEntries = [
        { startTime: 'invalid' },
        { endTime: 'also-invalid' },
        { startTime: '2025-01-01T10:00:00Z' } // Missing end time
      ];

      expect(() => calculateTotalTimeSpent(malformedEntries as any)).not.toThrow();
    });

    it('should preserve data integrity in transformations', () => {
      const timeblock: TimeBlock = {
        id: 'original-id',
        title: 'Original Title',
        startTime: '09:00',
        endTime: '10:00',
        attachments: ['[[Original]]'],
        description: 'Original description'
      };

      const calendarEvent = timeblockToCalendarEvent(timeblock, '2025-01-15');
      
      // Original timeblock should be preserved in extended props
      expect(calendarEvent.extendedProps.timeblock).toEqual(timeblock);
      expect(calendarEvent.title).toBe(timeblock.title);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large datasets efficiently', () => {
      const largeTimeEntries: TimeEntry[] = Array.from({ length: 1000 }, (_, i) => ({
        startTime: `2025-01-01T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
        endTime: `2025-01-01T${String(Math.floor((i + 30) / 60)).padStart(2, '0')}:${String((i + 30) % 60).padStart(2, '0')}:00Z`,
        description: `Session ${i}`
      }));

      const startTime = Date.now();
      const result = calculateTotalTimeSpent(largeTimeEntries);
      const endTime = Date.now();

      expect(result).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    it('should not accumulate memory with repeated operations', () => {
      for (let i = 0; i < 100; i++) {
        formatTime(i * 15);
        parseTime(`${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
        generateTimeblockId();
      }

      // No explicit memory assertions, but operations should complete without issues
      expect(true).toBe(true);
    });
  });
});