/**
 * Integration test helpers for TaskNotes plugin
 * These helpers provide utilities for testing complex workflows and integration scenarios
 */

import { MockObsidian, TFile } from '../__mocks__/obsidian';
import { TaskFactory, PluginFactory, FileSystemFactory } from './mock-factories';
import { TaskInfo, TaskCreationData } from '../../src/types';

// Plugin integration test environment
export class TestEnvironment {
  private mockPlugin: any;
  private createdFiles: string[] = [];

  constructor() {
    this.mockPlugin = PluginFactory.createMockPlugin();
  }

  /**
   * Set up a clean test environment
   */
  async setup(): Promise<void> {
    // Reset mock file system
    MockObsidian.reset();
    
    // Clear created files tracking
    this.createdFiles = [];
    
    // Set up default mock responses
    this.setupMockResponses();
  }

  /**
   * Clean up after tests
   */
  async teardown(): Promise<void> {
    MockObsidian.reset();
    this.createdFiles = [];
    jest.clearAllMocks();
  }

  /**
   * Get the mock plugin instance
   */
  getPlugin(): any {
    return this.mockPlugin;
  }

  /**
   * Create a task file and update mocks accordingly
   */
  async createTaskFile(task: TaskInfo): Promise<TFile> {
    FileSystemFactory.createTaskFile(task);
    this.createdFiles.push(task.path);
    
    // Update vault mock to return the file
    const tFile = new TFile(task.path);
    this.mockPlugin.app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
      return path === task.path ? tFile : null;
    });
    
    return tFile;
  }

  /**
   * Create multiple task files
   */
  async createTaskFiles(tasks: TaskInfo[]): Promise<TFile[]> {
    const files: TFile[] = [];
    for (const task of tasks) {
      const file = await this.createTaskFile(task);
      files.push(file);
    }
    return files;
  }

  /**
   * Simulate task creation workflow
   */
  async simulateTaskCreation(taskData: TaskCreationData): Promise<{ file: TFile; taskInfo: TaskInfo }> {
    const task = TaskFactory.createTask({
      title: taskData.title,
      status: taskData.status,
      priority: taskData.priority,
      due: taskData.due,
      scheduled: taskData.scheduled,
      contexts: taskData.contexts,
      timeEstimate: taskData.timeEstimate
    });

    const file = await this.createTaskFile(task);
    
    // Simulate plugin events
    this.mockPlugin.emitter.trigger('task-created', { file, taskInfo: task });
    
    return { file, taskInfo: task };
  }

  /**
   * Simulate task update workflow
   */
  async simulateTaskUpdate(taskPath: string, updates: Partial<TaskInfo>): Promise<TaskInfo> {
    const existingTask = this.getTaskByPath(taskPath);
    if (!existingTask) {
      throw new Error(`Task not found: ${taskPath}`);
    }

    const updatedTask = { ...existingTask, ...updates };
    
    // Update file content
    FileSystemFactory.createTaskFile(updatedTask);
    
    // Simulate plugin events
    this.mockPlugin.emitter.trigger('task-updated', { 
      path: taskPath, 
      updatedTask 
    });
    
    return updatedTask;
  }

  /**
   * Simulate task deletion workflow
   */
  async simulateTaskDeletion(taskPath: string): Promise<void> {
    const file = new TFile(taskPath);
    
    // Remove from tracking
    const index = this.createdFiles.indexOf(taskPath);
    if (index > -1) {
      this.createdFiles.splice(index, 1);
    }
    
    // Simulate plugin events
    this.mockPlugin.emitter.trigger('task-deleted', { path: taskPath });
  }

  /**
   * Get all created tasks
   */
  getCreatedTasks(): TaskInfo[] {
    return this.createdFiles.map(path => this.getTaskByPath(path)).filter(Boolean) as TaskInfo[];
  }

  /**
   * Get task by path
   */
  getTaskByPath(path: string): TaskInfo | null {
    const file = MockObsidian.getFileSystem().getFile(path);
    if (!file) return null;

    try {
      const content = file.content;
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = require('yaml').parse(frontmatterMatch[1]);
        return {
          ...frontmatter,
          path,
          archived: frontmatter.tags?.includes('archived') || false
        };
      }
    } catch (error) {
      console.warn(`Failed to parse task file: ${path}`, error);
    }
    
    return null;
  }

  /**
   * Simulate plugin lifecycle events
   */
  simulatePluginLoad(): void {
    this.mockPlugin.emitter.trigger('plugin-loaded');
  }

  simulatePluginUnload(): void {
    this.mockPlugin.emitter.trigger('plugin-unloaded');
  }

  /**
   * Set up default mock responses
   */
  private setupMockResponses(): void {
    // Vault operations
    this.mockPlugin.app.vault.create.mockImplementation(async (path: string, content: string) => {
      MockObsidian.createTestFile(path, content);
      this.createdFiles.push(path);
      return new TFile(path);
    });

    this.mockPlugin.app.vault.modify.mockImplementation(async (file: TFile, content: string) => {
      const mockFile = MockObsidian.getFileSystem().getFile(file.path);
      if (mockFile) {
        MockObsidian.getFileSystem().modify(mockFile, content);
      }
    });

    this.mockPlugin.app.vault.delete.mockImplementation(async (file: TFile) => {
      MockObsidian.getFileSystem().delete(file.path);
      const index = this.createdFiles.indexOf(file.path);
      if (index > -1) {
        this.createdFiles.splice(index, 1);
      }
    });

    this.mockPlugin.app.vault.read.mockImplementation(async (file: TFile) => {
      return MockObsidian.getFileSystem().read(file.path);
    });

    // FieldMapper responses
    this.mockPlugin.fieldMapper.mapToFrontmatter.mockImplementation((taskData: any) => {
      return { ...taskData };
    });

    this.mockPlugin.fieldMapper.mapFromFrontmatter.mockImplementation((frontmatter: any) => {
      return { ...frontmatter };
    });

    // Cache manager responses
    this.mockPlugin.cacheManager.updateTaskInfoInCache.mockResolvedValue(undefined);
    this.mockPlugin.cacheManager.removeFromCache.mockResolvedValue(undefined);
    this.mockPlugin.cacheManager.getTaskInfo.mockImplementation((path: string) => {
      return this.getTaskByPath(path);
    });
  }
}

// Workflow test helpers
export class WorkflowTester {
  private environment: TestEnvironment;

  constructor(environment: TestEnvironment) {
    this.environment = environment;
  }

  /**
   * Test complete task lifecycle
   */
  async testTaskLifecycle(): Promise<{
    created: TaskInfo;
    updated: TaskInfo;
    completed: TaskInfo;
  }> {
    // Create task
    const createData: TaskCreationData = {
      title: 'Lifecycle Test Task',
      status: 'open',
      priority: 'normal',
      details: 'Test task for lifecycle testing'
    };

    const { taskInfo: created } = await this.environment.simulateTaskCreation(createData);

    // Update task
    const updated = await this.environment.simulateTaskUpdate(created.path, {
      status: 'in-progress',
      priority: 'high'
    });

    // Complete task
    const completed = await this.environment.simulateTaskUpdate(created.path, {
      status: 'done',
      completedDate: new Date().toISOString().split('T')[0]
    });

    return { created, updated, completed };
  }

  /**
   * Test recurring task workflow
   */
  async testRecurringTaskWorkflow(): Promise<{
    original: TaskInfo;
    afterCompletion: TaskInfo;
    nextInstance: TaskInfo;
  }> {
    // Create recurring task
    const createData: TaskCreationData = {
      title: 'Recurring Test Task',
      status: 'open',
      priority: 'normal',
      recurrence: 'FREQ=DAILY;INTERVAL=1'
    };

    const { taskInfo: original } = await this.environment.simulateTaskCreation(createData);

    // Complete the task
    const today = new Date().toISOString().split('T')[0];
    const afterCompletion = await this.environment.simulateTaskUpdate(original.path, {
      status: 'done',
      completedDate: today,
      complete_instances: [today]
    });

    // Create next instance (simulated)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextInstance = TaskFactory.createTask({
      title: original.title,
      status: 'open',
      priority: original.priority,
      recurrence: original.recurrence,
      complete_instances: [today],
      due: tomorrow.toISOString().split('T')[0]
    });

    await this.environment.createTaskFile(nextInstance);

    return { original, afterCompletion, nextInstance };
  }

  /**
   * Test time tracking workflow
   */
  async testTimeTrackingWorkflow(): Promise<{
    taskWithEstimate: TaskInfo;
    taskWithActiveEntry: TaskInfo;
    taskWithCompletedEntry: TaskInfo;
  }> {
    // Create task with time estimate
    const createData: TaskCreationData = {
      title: 'Time Tracking Test Task',
      status: 'open',
      priority: 'normal',
      timeEstimate: 120 // 2 hours
    };

    const { taskInfo: taskWithEstimate } = await this.environment.simulateTaskCreation(createData);

    // Start time tracking
    const startTime = new Date().toISOString();
    const taskWithActiveEntry = await this.environment.simulateTaskUpdate(taskWithEstimate.path, {
      timeEntries: [{
        startTime,
        description: 'Working on task'
      }]
    });

    // Complete time entry
    const endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes later
    const taskWithCompletedEntry = await this.environment.simulateTaskUpdate(taskWithEstimate.path, {
      timeEntries: [{
        startTime,
        endTime,
        description: 'Completed work session'
      }]
    });

    return { taskWithEstimate, taskWithActiveEntry, taskWithCompletedEntry };
  }

  /**
   * Test bulk operations workflow
   */
  async testBulkOperationsWorkflow(count: number = 10): Promise<{
    created: TaskInfo[];
    updated: TaskInfo[];
    archived: TaskInfo[];
  }> {
    // Create multiple tasks
    const tasks = TaskFactory.createTasks(count, {
      status: 'open',
      priority: 'normal'
    });

    const created = [];
    for (const task of tasks) {
      await this.environment.createTaskFile(task);
      created.push(task);
    }

    // Update half of them
    const updated = [];
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const updatedTask = await this.environment.simulateTaskUpdate(created[i].path, {
        status: 'in-progress',
        priority: 'high'
      });
      updated.push(updatedTask);
    }

    // Archive the rest
    const archived = [];
    for (let i = Math.floor(count / 2); i < count; i++) {
      const archivedTask = await this.environment.simulateTaskUpdate(created[i].path, {
        archived: true,
        tags: [...(created[i].tags || []), 'archived']
      });
      archived.push(archivedTask);
    }

    return { created, updated, archived };
  }
}

// Performance test helpers
export class PerformanceTester {
  private environment: TestEnvironment;

  constructor(environment: TestEnvironment) {
    this.environment = environment;
  }

  /**
   * Test performance with large dataset
   */
  async testLargeDatasetPerformance(taskCount: number = 1000): Promise<{
    creationTime: number;
    queryTime: number;
    updateTime: number;
  }> {
    const tasks = TaskFactory.createTasks(taskCount);

    // Measure creation time
    const creationStart = Date.now();
    for (const task of tasks) {
      await this.environment.createTaskFile(task);
    }
    const creationTime = Date.now() - creationStart;

    // Measure query time (simulated)
    const queryStart = Date.now();
    const createdTasks = this.environment.getCreatedTasks();
    const openTasks = createdTasks.filter(t => t.status === 'open');
    const queryTime = Date.now() - queryStart;

    // Measure update time
    const updateStart = Date.now();
    if (openTasks.length > 0) {
      await this.environment.simulateTaskUpdate(openTasks[0].path, {
        priority: 'high'
      });
    }
    const updateTime = Date.now() - updateStart;

    return { creationTime, queryTime, updateTime };
  }

  /**
   * Test memory usage (simulated)
   */
  getMemoryUsageEstimate(): number {
    const tasks = this.environment.getCreatedTasks();
    // Rough estimate: 1KB per task
    return tasks.length * 1024;
  }
}

// Error simulation helpers
export class ErrorSimulator {
  private environment: TestEnvironment;

  constructor(environment: TestEnvironment) {
    this.environment = environment;
  }

  /**
   * Simulate file system errors
   */
  simulateFileSystemError(operation: 'create' | 'read' | 'write' | 'delete'): void {
    const plugin = this.environment.getPlugin();
    
    switch (operation) {
      case 'create':
        plugin.app.vault.create.mockRejectedValue(new Error('Failed to create file'));
        break;
      case 'read':
        plugin.app.vault.read.mockRejectedValue(new Error('Failed to read file'));
        break;
      case 'write':
        plugin.app.vault.modify.mockRejectedValue(new Error('Failed to write file'));
        break;
      case 'delete':
        plugin.app.vault.delete.mockRejectedValue(new Error('Failed to delete file'));
        break;
    }
  }

  /**
   * Simulate cache errors
   */
  simulateCacheError(): void {
    const plugin = this.environment.getPlugin();
    plugin.cacheManager.updateTaskInfoInCache.mockRejectedValue(new Error('Cache update failed'));
    plugin.cacheManager.getTaskInfo.mockImplementation(() => {
      throw new Error('Cache lookup failed');
    });
  }

  /**
   * Reset error simulations
   */
  reset(): void {
    const plugin = this.environment.getPlugin();
    plugin.app.vault.create.mockRestore?.();
    plugin.app.vault.read.mockRestore?.();
    plugin.app.vault.modify.mockRestore?.();
    plugin.app.vault.delete.mockRestore?.();
    plugin.cacheManager.updateTaskInfoInCache.mockRestore?.();
    plugin.cacheManager.getTaskInfo.mockRestore?.();
  }
}

// Export main utilities
export const IntegrationHelpers = {
  TestEnvironment,
  WorkflowTester,
  PerformanceTester,
  ErrorSimulator
};

export default IntegrationHelpers;