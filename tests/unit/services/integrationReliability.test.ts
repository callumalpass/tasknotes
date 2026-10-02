import { TFile, requestUrl } from 'obsidian';
import { createServer } from 'http';
import { NotificationService } from '../../../src/ui/NotificationService';
import { TaskService } from '../../../src/services/TaskService';
import { PomodoroService } from '../../../src/services/PomodoroService';
import { TasksController } from '../../../src/api/TasksController';
import { WebhookController } from '../../../src/api/WebhookController';
import { resolveLocalCORSOrigin } from '../../../src/api/httpUtils';
import { PluginFactory, TaskFactory } from '../../helpers/mock-factories';

const task = () => TaskFactory.createTask({ path: 'Tasks/my-task-with-hyphens.md', status: 'open' });
const statuses = { getCompletedStatuses: () => ['done'], isCompletedStatus: (s: string) => s === 'done' };

describe('reminder reliability', () => {
  let service: any;
  let plugin: any;
  let current: any;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T10:00:00Z'));
    current = { ...task(), reminders: [{ id: 'rem-with-hyphens', type: 'absolute', absoluteTime: '2026-06-01T10:00:05Z' }] };
    plugin = { settings: { defaultTaskStatus: 'open', notificationType: 'in-app' }, statusManager: statuses,
      cacheManager: { getAllCachedTasks: () => [current] },
      app: { vault: { getAbstractFileByPath: () => new TFile(current.path) }, metadataCache: { getFileCache: () => ({ frontmatter: current }) } },
      fieldMapper: { mapFromFrontmatter: (fm: any) => fm } };
    service = new NotificationService(plugin);
    jest.spyOn(service, 'showInAppNotice').mockImplementation(() => {});
  });
  afterEach(() => { service.destroy(); jest.useRealTimers(); });
  it('drains just-due reminders before rebuilding and delivers once across rescans/wake', async () => {
    await service.refreshReminders();
    jest.setSystemTime(new Date('2026-06-01T10:00:06Z'));
    await service.refreshReminders();
    await service.handleSystemWakeUp();
    expect(service.showInAppNotice).toHaveBeenCalledTimes(1);
  });
  it('catches up an unqueued reminder after sleep, only once', async () => {
    current.reminders[0].absoluteTime = '2026-06-01T10:06:00Z';
    await service.refreshReminders();
    expect(service.notificationQueue).toHaveLength(0);
    jest.setSystemTime(new Date('2026-06-01T10:10:00Z'));
    await service.handleSystemWakeUp();
    await service.handleSystemWakeUp();
    expect(service.showInAppNotice).toHaveBeenCalledTimes(1);
  });
  it('bounds catch-up to the last 24 hours', async () => {
    current.reminders[0].absoluteTime = '2026-06-01T10:06:00Z';
    await service.refreshReminders();
    jest.setSystemTime(new Date('2026-06-03T10:10:00Z'));
    await service.handleSystemWakeUp();
    expect(service.showInAppNotice).not.toHaveBeenCalled();
  });
  it.each([{ status: 'done' }, { archived: true }])('does not queue ineligible tasks: %j', async (change) => {
    Object.assign(current, change);
    await service.refreshReminders();
    expect(service.notificationQueue).toHaveLength(0);
  });
  it.each([{ status: 'done' }, { archived: true }])('rechecks eligibility at delivery: %j', async (change) => {
    await service.refreshReminders();
    Object.assign(current, change);
    jest.setSystemTime(new Date('2026-06-01T10:00:06Z'));
    service.checkNotificationQueue();
    expect(service.showInAppNotice).not.toHaveBeenCalled();
  });
  it('uses the anchor occurrence for relative reminders across midnight', async () => {
    Object.assign(current, { recurrence: 'FREQ=DAILY', status: 'done', scheduled: '2026-06-02T00:01:00Z', complete_instances: ['2026-06-02'],
      reminders: [{ id: 'relative', type: 'relative', relatedTo: 'scheduled', offset: '-PT2M' }] });
    jest.setSystemTime(new Date('2026-06-01T23:58:00Z'));
    await service.refreshReminders();
    expect(service.notificationQueue).toHaveLength(0);
    current.complete_instances = ['2026-06-01'];
    await service.refreshReminders();
    expect(service.notificationQueue).toHaveLength(1);
  });
  it('dedupes by effective time and clears structurally by exact path', async () => {
    await service.refreshReminders();
    jest.setSystemTime(new Date('2026-06-01T10:00:06Z'));
    service.checkNotificationQueue();
    current.reminders[0].absoluteTime = '2026-06-01T10:00:10Z';
    await service.refreshReminders();
    jest.setSystemTime(new Date('2026-06-01T10:00:11Z'));
    service.checkNotificationQueue();
    expect(service.showInAppNotice).toHaveBeenCalledTimes(2);
    service.clearProcessedRemindersForTask('Tasks/my-task');
    expect(service.processedReminders.size).toBe(2);
    service.clearProcessedRemindersForTask(current.path);
    expect(service.processedReminders.size).toBe(0);
  });
});

describe('timer transactions', () => {
  let plugin: any;
  let service: TaskService;
  let fm: any;
  let stale: any;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T10:40:00Z'));
    stale = task();
    fm = { ...stale, timeEntries: [] };
    plugin = PluginFactory.createMockPlugin();
    const file = new TFile(stale.path);
    plugin.app.vault.getAbstractFileByPath.mockReturnValue(file);
    plugin.fieldMapper.mapFromFrontmatter = (data: any) => JSON.parse(JSON.stringify(data));
    plugin.fieldMapper.toUserField = (field: string) => field;
    plugin.app.fileManager.processFrontMatter.mockImplementation(async (_file: any, callback: any) => callback(fm));
    plugin.getActiveTimeSession = (t: any) => t.timeEntries?.find((entry: any) => !entry.endTime);
    service = new TaskService(plugin);
  });
  afterEach(() => jest.useRealTimers());
  it('rejects concurrent duplicate starts and publishes exactly the persisted array', async () => {
    const results = await Promise.allSettled([service.startTimeTracking(stale), service.startTimeTracking(stale)]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(fm.timeEntries).toHaveLength(1);
    expect(plugin.cacheManager.updateTaskInfoInCache.mock.calls.at(-1)[1].timeEntries).toEqual(fm.timeEntries);
  });
  it('serializes start/stop from stale caller data', async () => {
    await Promise.all([service.startTimeTracking(stale), service.stopTimeTracking(stale)]);
    expect(fm.timeEntries).toHaveLength(1);
    expect(fm.timeEntries[0].endTime).toBeDefined();
    expect(plugin.cacheManager.updateTaskInfoInCache.mock.calls.at(-1)[1].timeEntries).toEqual(fm.timeEntries);
  });
  it('rejects duplicate stops and recovers after rejected transactions', async () => {
    fm.timeEntries = [{ startTime: '2026-06-01T10:00:00Z' }];
    const results = await Promise.allSettled([service.stopTimeTracking(stale), service.stopTimeTracking(stale)]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    await expect(service.startTimeTracking(stale)).resolves.toBeDefined();
  });
  it('uses an explicit completion time and guards ownership', async () => {
    fm.timeEntries = [{ startTime: '2026-06-01T10:00:00Z' }];
    await expect(service.stopTimeTracking(stale, '2026-06-01T10:25:00Z', 'different')).rejects.toThrow('changed');
    const result = await service.stopTimeTracking(stale, '2026-06-01T10:25:00Z', fm.timeEntries[0].startTime);
    expect(new Date(result.timeEntries![0].endTime!).toISOString()).toBe('2026-06-01T10:25:00.000Z');
  });
  it.each(['bad', '2026-06-01', '2026-06-01T09:59:59Z', '2026-06-01T10:41:00Z', '2026-02-30T10:00:00Z'])('rejects invalid explicit stop %s', async (stop) => {
    fm.timeEntries = [{ startTime: '2026-06-01T10:00:00Z' }];
    await expect(service.stopTimeTracking(stale, stop)).rejects.toThrow('Invalid');
    expect(fm.timeEntries[0].endTime).toBeUndefined();
  });
});

describe('pomodoro ownership after sleep', () => {
  it.each([true, false])('ends only owned task timers at the intended completion time (owned=%s)', async (owned) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T10:40:00Z'));
    const t = task();
    const plugin: any = { settings: { pomodoroLongBreakInterval: 4, pomodoroWorkDuration: 25 },
      taskService: { stopTimeTracking: jest.fn() }, cacheManager: { getTaskInfo: async () => t }, emitter: { trigger: jest.fn() } };
    const service: any = new PomodoroService(plugin);
    service.state = { isRunning: true, timeRemaining: 0, currentSession: { id: 'test', taskPath: t.path, type: 'work',
      startTime: '2026-06-01T10:00:00Z', plannedDuration: 25, activePeriods: [{ startTime: '2026-06-01T10:00:00Z' }],
      timeTrackingStartTime: owned ? '2026-06-01T10:00:00Z' : undefined } };
    jest.spyOn(service, 'getTodayStats').mockResolvedValue({ pomodorosCompleted: 0 });
    jest.spyOn(service, 'addSessionToHistory').mockResolvedValue(undefined);
    jest.spyOn(service, 'saveState').mockResolvedValue(undefined);
    jest.spyOn(service, 'showPomodoroNotification').mockImplementation(() => {});
    await service.completePomodoro();
    if (owned) {
      const args = plugin.taskService.stopTimeTracking.mock.calls[0];
      expect(args[0]).toBe(t);
      expect(new Date(args[1]).toISOString()).toBe('2026-06-01T10:25:00.000Z');
      expect(args[2]).toBe('2026-06-01T10:00:00Z');
    } else expect(plugin.taskService.stopTimeTracking).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('extension CORS', () => {
  it.each(['chrome-extension:', 'moz-extension:'])('accepts origin-only %s', protocol => {
    expect(resolveLocalCORSOrigin(`${protocol}//abc-123`, 'fallback')).toBe(`${protocol}//abc-123`);
  });
  it.each(['/options.html', '?q=1', '#frag', ':999', '@evil/path'])('rejects non-origin extension URLs %s', suffix => {
    expect(resolveLocalCORSOrigin(`moz-extension://abc${suffix}`, 'fallback')).toBeUndefined();
  });
  it.each(['moz-extension://user@abc', 'moz-extension://', 'https://evil.test', 'safari-web-extension://abc'])('rejects %s', origin => {
    expect(resolveLocalCORSOrigin(origin, 'fallback')).toBeUndefined();
  });
});

describe('webhook failure streak', () => {
  let controller: any;
  let webhook: any;
  const deliver = () => controller.deliverWebhook(webhook, { payload: {}, attempts: 0 }, 3);
  beforeEach(() => {
    controller = new WebhookController({ settings: {}, saveSettings: jest.fn() } as any);
    jest.spyOn(controller, 'generateSignature').mockResolvedValue('signature');
    webhook = { id: 'test', url: 'http://example.invalid', secret: 'test', active: true, successCount: 0, failureCount: 0 };
  });
  it('does not disable after intermittent lifetime failures', async () => {
    for (let i = 0; i < 11; i++) {
      (requestUrl as jest.Mock).mockResolvedValueOnce({ status: 500 }); await deliver();
      (requestUrl as jest.Mock).mockResolvedValueOnce({ status: 200 }); await deliver();
    }
    expect(webhook.active).toBe(true);
    expect(webhook.failureCount).toBe(11);
    expect(webhook.consecutiveFailures).toBe(0);
  });
  it('disables after eleven consecutive exhausted deliveries, not retry attempts', async () => {
    (requestUrl as jest.Mock).mockResolvedValue({ status: 500 });
    for (let i = 0; i < 10; i++) await deliver();
    expect(webhook.active).toBe(true);
    await deliver();
    expect(webhook.active).toBe(false);
  });
});

describe('complete-instance date contract', () => {
  const setup = () => {
    const toggle = jest.fn(async () => task());
    const controller: any = new TasksController({} as any, { toggleRecurringTaskCompleteWithOccurrenceNotes: toggle } as any, {} as any,
      { getTaskInfo: async () => task() } as any, {} as any);
    const response: any = { setHeader: jest.fn(), end: jest.fn() };
    return { controller, response, toggle };
  };
  it.each([{ date: '2026-09-20' }, { instanceDate: '2026-09-20' }, { date: '2026-09-20', instanceDate: '2026-09-20' }, {}])('accepts %j', async body => {
    const { controller, response, toggle } = setup();
    jest.spyOn(controller, 'parseRequestBody').mockResolvedValue(body);
    await controller.completeRecurringInstance({}, response, { id: 'task' });
    expect(response.statusCode).toBe(200);
    expect(toggle.mock.calls[0][1]?.toISOString().slice(0, 10)).toBe(Object.keys(body).length ? '2026-09-20' : undefined);
  });
  it.each([{ date: '2026-02-30' }, { date: 'garbage' }, { date: null }, { instanceDate: 123 }, { date: '' },
    { date: '2026-09-20', instanceDate: '2026-09-21' }, { date: '2026-09-20T10:00:00Z' }])('rejects %j without mutation', async body => {
    const { controller, response, toggle } = setup();
    jest.spyOn(controller, 'parseRequestBody').mockResolvedValue(body);
    await controller.completeRecurringInstance({}, response, { id: 'task' });
    expect(response.statusCode).toBe(400);
    expect(toggle).not.toHaveBeenCalled();
  });
  const contractTest = process.env.TASKNOTES_CLI_CONTRACT_PATH ? it : it.skip;
  contractTest('real CLI sends its occurrence date through HTTP to the server controller', async () => {
    const { controller, toggle } = setup();
    const server = createServer((req, res) => { void controller.completeRecurringInstance(req, res, { id: 'task' }); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const API = require(process.env.TASKNOTES_CLI_CONTRACT_PATH!);
      const api = new API();
      api.config = { host: '127.0.0.1', port: (server.address() as any).port };
      await api.completeRecurringInstance('task', '2026-09-20');
      expect(toggle.mock.calls[0][1].toISOString().slice(0, 10)).toBe('2026-09-20');
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
