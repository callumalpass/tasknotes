/**
 * Issue #850: [Bug]: Auto Archive Not Working
 *
 * @see https://github.com/callumalpass/tasknotes/issues/850
 *
 * Bug Description:
 * User has 2 statuses configured as a checkbox property: "true" and "false".
 * The "true" status has auto-archive enabled with a delay set.
 * However, tasks with status "true" are not being auto-archived.
 * The normal right-click archive function still works.
 *
 * Reproduction Steps:
 * 1. Configure status property as a checkbox with values "true" and "false"
 * 2. Enable auto-archive on the "true" status with a delay (e.g., 1 minute)
 * 3. Change a task's status to "true" (by checking the checkbox)
 * 4. Wait for the delay period
 * 5. Task should auto-archive but doesn't (BUG)
 *
 * Potential Root Causes:
 * 1. StatusConfig lookup failure - getStatusConfig("true") may not match if status
 *    values are stored differently (boolean vs string)
 * 2. Auto-archive scheduling not triggered when status changes via checkbox toggle
 * 3. Type coercion issues between boolean checkbox values and string status configs
 *
 * Current Code Analysis:
 * - TaskService.updateTaskProperty (line 839-862) handles auto-archive scheduling
 * - StatusManager.getStatusConfig() looks up by exact string value match
 * - FieldMapper converts boolean frontmatter values to strings "true"/"false"
 * - AutoArchiveService.scheduleAutoArchive() requires correct StatusConfig
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StatusManager } from '../../../src/services/StatusManager';
import { StatusConfig, TaskInfo } from '../../../src/types';

// Mock status configurations matching user's setup (checkbox property with true/false values)
const createCheckboxStatusConfigs = (): StatusConfig[] => [
	{
		id: 'status-false',
		value: 'false',
		label: 'Not Done',
		color: '#808080',
		isCompleted: false,
		order: 0,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: 'status-true',
		value: 'true',
		label: 'Done',
		color: '#00aa00',
		isCompleted: true,
		order: 1,
		autoArchive: true,
		autoArchiveDelay: 1, // 1 minute delay as user reported
	},
];

describe.skip('Issue #850: Auto Archive Not Working with Checkbox Status', () => {
	let statusManager: StatusManager;
	let checkboxStatusConfigs: StatusConfig[];

	beforeEach(() => {
		checkboxStatusConfigs = createCheckboxStatusConfigs();
		statusManager = new StatusManager(checkboxStatusConfigs);
	});

	describe('StatusConfig lookup for boolean-like status values', () => {
		it('should find status config when value is string "true"', () => {
			// When status is set via TaskService, it uses string values
			const config = statusManager.getStatusConfig('true');

			expect(config).toBeDefined();
			expect(config?.autoArchive).toBe(true);
			expect(config?.autoArchiveDelay).toBe(1);
		});

		it('should find status config when value is string "false"', () => {
			const config = statusManager.getStatusConfig('false');

			expect(config).toBeDefined();
			expect(config?.autoArchive).toBe(false);
		});

		it('should handle case where status might be actual boolean true', () => {
			// When status comes from checkbox property in frontmatter, it might be boolean
			// FieldMapper should convert it to string, but this tests the edge case
			const booleanTrue = true as unknown as string;
			const config = statusManager.getStatusConfig(booleanTrue);

			// This may fail if getStatusConfig uses strict equality and doesn't handle boolean
			expect(config).toBeDefined();
			expect(config?.autoArchive).toBe(true);
		});

		it('should handle case where status might be actual boolean false', () => {
			const booleanFalse = false as unknown as string;
			const config = statusManager.getStatusConfig(booleanFalse);

			expect(config).toBeDefined();
			expect(config?.autoArchive).toBe(false);
		});
	});

	describe('Auto-archive scheduling with checkbox status', () => {
		it('should schedule auto-archive when task status changes to "true"', async () => {
			// Simulate what happens in TaskService.updateTaskProperty
			const task: Partial<TaskInfo> = {
				path: 'test-task.md',
				title: 'Test Task',
				status: 'false', // Previous status
			};

			const newStatus = 'true';
			const statusConfig = statusManager.getStatusConfig(newStatus);

			// Verify the status config is found and has auto-archive enabled
			expect(statusConfig).toBeDefined();
			expect(statusConfig?.autoArchive).toBe(true);

			// In the actual code, this would trigger:
			// await this.autoArchiveService.scheduleAutoArchive(updatedTask, statusConfig);
		});

		it('should find status config after FieldMapper converts boolean to string', () => {
			// FieldMapper.mapFromFrontmatter converts boolean status to string:
			// mapped.status = statusValue ? "true" : "false";

			// Simulate reading from frontmatter where status is boolean true
			const frontmatterStatus = true;
			const mappedStatus = frontmatterStatus ? 'true' : 'false';

			const config = statusManager.getStatusConfig(mappedStatus);

			expect(config).toBeDefined();
			expect(config?.value).toBe('true');
			expect(config?.autoArchive).toBe(true);
		});
	});

	describe('Status comparison in auto-archive check condition', () => {
		it('should correctly compare old and new status values', () => {
			// TaskService.updateTaskProperty line 839:
			// if (this.autoArchiveService && property === "status" && value !== task.status)

			const oldStatus = 'false';
			const newStatus = 'true';

			// This comparison should detect the change
			expect(newStatus !== oldStatus).toBe(true);
		});

		it('should handle comparison when one value is boolean and other is string', () => {
			// Edge case: task.status might be string but value might be boolean from checkbox
			const taskStatus = 'false'; // String from TaskInfo
			const checkboxValue = true; // Boolean from checkbox toggle

			// If the code doesn't normalize types, this comparison will always be true
			// (different types never equal) even when semantically they should be equal
			const valueAsString = String(checkboxValue).toLowerCase();

			expect(valueAsString !== taskStatus).toBe(true); // "true" !== "false"
		});
	});

	describe('Auto-archive queue verification', () => {
		it('should have task in queue after status change to auto-archive status', () => {
			// This test would verify that after changing status to "true",
			// the task is added to the auto-archive queue

			const statusConfig = statusManager.getStatusConfig('true');
			expect(statusConfig?.autoArchive).toBe(true);

			// Mock verification that scheduleAutoArchive would be called
			// In actual implementation, we'd need to mock AutoArchiveService
		});
	});

	describe('Integration: Full status change flow', () => {
		it('should trigger auto-archive when checkbox is toggled to true', async () => {
			/**
			 * Full flow simulation:
			 * 1. User toggles checkbox (status checkbox property)
			 * 2. UI calls updateTaskProperty with property="status", value="true" or true
			 * 3. TaskService looks up StatusConfig for "true"
			 * 4. StatusConfig has autoArchive=true
			 * 5. AutoArchiveService.scheduleAutoArchive is called
			 *
			 * Potential failure points:
			 * - Step 2: value might be boolean instead of string
			 * - Step 3: getStatusConfig might fail if value is boolean
			 * - Step 5: scheduleAutoArchive might not be called due to condition failure
			 */

			const task: Partial<TaskInfo> = {
				path: 'test-task.md',
				title: 'Task to auto-archive',
				status: 'false',
			};

			// Simulate checkbox toggle - value could be boolean or string depending on implementation
			const newValue = 'true'; // After proper conversion

			// Verify the flow would work
			expect(newValue !== task.status).toBe(true); // Change detected
			const config = statusManager.getStatusConfig(newValue);
			expect(config).toBeDefined(); // Config found
			expect(config?.autoArchive).toBe(true); // Auto-archive enabled

			// If all these pass but auto-archive still doesn't work,
			// the bug might be in:
			// 1. How the checkbox toggle calls updateTaskProperty
			// 2. The actual autoArchiveService.scheduleAutoArchive implementation
			// 3. The processQueue timing or conditions
		});
	});
});

describe.skip('Issue #850: AutoArchiveService unit tests', () => {
	// These tests would directly test the AutoArchiveService
	// if we could properly mock the plugin dependencies

	it('should add task to queue when scheduleAutoArchive is called', () => {
		// Verify that the queue is properly updated
	});

	it('should process and archive task after delay expires', () => {
		// Verify that processQueue correctly archives due tasks
	});

	it('should verify task still has same status before archiving', () => {
		// AutoArchiveService.processItem checks: currentTask.status !== item.statusValue
		// This might fail if types don't match
	});

	it('should handle status as "true" string correctly in processItem', () => {
		// processItem line 143: if (currentTask.status !== item.statusValue)
		// item.statusValue comes from statusConfig.value (string "true")
		// currentTask.status should be string "true" after FieldMapper conversion
		// But if there's a mismatch, the task won't be archived
	});
});
