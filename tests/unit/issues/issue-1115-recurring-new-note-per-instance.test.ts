/**
 * Issue #1115 - Option for recurring tasks creating new notes
 *
 * Feature Request: https://github.com/tasknotes/tasknotes/issues/1115
 *
 * Description:
 * The user wants an option for recurring tasks to create a new note for each
 * recurrence, rather than logging all completion dates in a single note.
 * This would allow users to store additional instance-specific information
 * (like training data: weight, time, reps) in each note's properties.
 *
 * Current behavior:
 * - Recurring tasks use a single note with:
 *   - complete_instances: string[] - Array of completion dates (YYYY-MM-DD)
 *   - skipped_instances: string[] - Array of skipped dates
 *   - The same note is reused, with scheduled date updated to next occurrence
 *
 * Requested behavior:
 * - Option to create a NEW note when completing a recurring task instance
 * - The new note would be a "completed instance" of the recurring task
 * - Original recurring note continues with the recurrence rules
 * - Each instance note can have its own properties/metadata
 *
 * Use case from issue:
 * - User wants to track training (exercise) with recurring tasks
 * - Each workout instance should have its own note to record:
 *   - Weight lifted
 *   - Duration/time
 *   - Reps completed
 *   - Notes about the session
 *
 * Implementation considerations:
 * - New setting: "Create new note on recurring completion" (per-task or global)
 * - TaskInfo may need a new field: recurrence_mode: 'log_instances' | 'create_notes'
 * - On completion:
 *   1. Create new note with instance data (completed date, metadata)
 *   2. Link new note to parent recurring task (via blockedBy or custom field)
 *   3. Update parent recurring task's scheduled date to next occurrence
 * - Instance notes should:
 *   - Have status = 'done'
 *   - Reference the parent recurring task
 *   - Include the specific instance date
 *   - Not have recurrence rules (they're one-off completions)
 *
 * Related files:
 * - src/services/TaskService.ts - toggleRecurringTaskComplete method (lines 1788-1981)
 * - src/utils/helpers.ts - RRULE processing, instance generation
 * - src/types.ts - TaskInfo type definition
 * - src/types/settings.ts - Global settings
 * - src/components/RecurrenceContextMenu.ts - Recurrence UI
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// Mock Obsidian dependencies
jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: class MockTFile {},
}));

// Types for test mocks
interface MockTaskInfo {
	path: string;
	title: string;
	status?: string;
	priority?: string;
	due?: string;
	scheduled?: string;
	recurrence?: string; // RRULE string
	recurrence_anchor?: "scheduled" | "completion";
	recurrence_mode?: "log_instances" | "create_notes"; // Proposed new field
	complete_instances?: string[];
	skipped_instances?: string[];
	parentRecurringTask?: string; // Path to parent recurring task (for instances)
	instanceDate?: string; // The specific date this instance represents
	tags?: string[];
	projects?: string[];
	// Custom properties for use cases like training tracking
	[key: string]: unknown;
}

interface MockRecurringTaskSettings {
	defaultRecurrenceMode: "log_instances" | "create_notes";
	instanceNoteTemplate: string; // Template for new instance note names
	instanceNoteFolder: string; // Folder to create instance notes in
	linkInstancesToParent: boolean;
	inheritPropertiesFromParent: string[]; // Which properties to copy to instance
}

describe("Issue #1115 - Option for recurring tasks creating new notes", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2025-03-10T09:00:00"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("New Note Creation Mode", () => {
		it.skip("reproduces issue #1115 - should create new note when completing recurring task in 'create_notes' mode", async () => {
			// Feature: Create a new note for each recurring task instance
			const parentTask: MockTaskInfo = {
				path: "tasks/daily-workout.md",
				title: "Daily Workout",
				status: "open",
				recurrence: "DTSTART:20250301;RRULE:FREQ=DAILY",
				recurrence_anchor: "scheduled",
				recurrence_mode: "create_notes", // New mode
				scheduled: "2025-03-10",
				tags: ["fitness", "routine"],
			};

			// Expected behavior when completing on 2025-03-10:
			// 1. Create new note: "tasks/daily-workout-2025-03-10.md"
			// 2. New note has status: "done", instanceDate: "2025-03-10"
			// 3. New note references parent: parentRecurringTask: "tasks/daily-workout.md"
			// 4. Parent task scheduled updates to 2025-03-11

			const expectedInstanceNote: MockTaskInfo = {
				path: "tasks/daily-workout-2025-03-10.md",
				title: "Daily Workout - 2025-03-10",
				status: "done",
				scheduled: "2025-03-10",
				instanceDate: "2025-03-10",
				parentRecurringTask: "tasks/daily-workout.md",
				tags: ["fitness", "routine"], // Inherited from parent
				// No recurrence field - this is a one-off completed instance
			};

			expect(parentTask.recurrence_mode).toBe("create_notes");
			expect(expectedInstanceNote.parentRecurringTask).toBe(parentTask.path);
			expect(expectedInstanceNote.recurrence).toBeUndefined();
		});

		it.skip("reproduces issue #1115 - should continue using log_instances mode by default", async () => {
			// Feature: Preserve existing behavior as default
			const parentTask: MockTaskInfo = {
				path: "tasks/daily-standup.md",
				title: "Daily Standup",
				status: "open",
				recurrence: "DTSTART:20250301;RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
				scheduled: "2025-03-10",
				complete_instances: ["2025-03-03", "2025-03-04", "2025-03-05"],
				// recurrence_mode not set - defaults to 'log_instances'
			};

			// Expected behavior (current): Add date to complete_instances array
			const expectedAfterCompletion: MockTaskInfo = {
				...parentTask,
				scheduled: "2025-03-11", // Next weekday
				complete_instances: ["2025-03-03", "2025-03-04", "2025-03-05", "2025-03-10"],
			};

			expect(parentTask.recurrence_mode).toBeUndefined();
			expect(expectedAfterCompletion.complete_instances).toContain("2025-03-10");
		});

		it.skip("reproduces issue #1115 - should allow per-task recurrence mode setting", async () => {
			// Feature: Each task can have its own recurrence mode
			const logModeTask: MockTaskInfo = {
				path: "tasks/daily-review.md",
				title: "Daily Review",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "log_instances",
				scheduled: "2025-03-10",
			};

			const createNoteModeTask: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-10",
			};

			// Both modes should be supported on a per-task basis
			expect(logModeTask.recurrence_mode).toBe("log_instances");
			expect(createNoteModeTask.recurrence_mode).toBe("create_notes");
		});
	});

	describe("Instance Note Properties", () => {
		it.skip("reproduces issue #1115 - should allow custom properties on instance notes for training tracking", async () => {
			// Feature: User's use case - tracking training data per workout instance
			const workoutInstance: MockTaskInfo = {
				path: "tasks/workout-2025-03-10.md",
				title: "Workout - 2025-03-10",
				status: "done",
				scheduled: "2025-03-10",
				instanceDate: "2025-03-10",
				parentRecurringTask: "tasks/workout.md",
				// Custom training properties
				weight_lifted: 150, // kg
				duration: 45, // minutes
				reps: 12,
				sets: 4,
				exercise_type: "Squats",
				notes: "Felt strong today, increased weight by 5kg",
				energy_level: "high",
			};

			// Each instance note can store unique data about that specific occurrence
			expect(workoutInstance.weight_lifted).toBe(150);
			expect(workoutInstance.duration).toBe(45);
			expect(workoutInstance.notes).toBeDefined();
		});

		it.skip("reproduces issue #1115 - should inherit specified properties from parent task", async () => {
			// Feature: Copy relevant properties from parent to instance
			const parentTask: MockTaskInfo = {
				path: "tasks/leg-day.md",
				title: "Leg Day",
				recurrence: "RRULE:FREQ=WEEKLY;BYDAY=MO,TH",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-10",
				tags: ["fitness", "legs"],
				projects: ["Health2025"],
				priority: "high",
				// Template properties that might be copied to instances
				default_weight: 100,
				default_sets: 3,
			};

			const settings: Partial<MockRecurringTaskSettings> = {
				inheritPropertiesFromParent: ["tags", "projects", "priority"],
			};

			const expectedInstance: MockTaskInfo = {
				path: "tasks/leg-day-2025-03-10.md",
				title: "Leg Day - 2025-03-10",
				status: "done",
				instanceDate: "2025-03-10",
				parentRecurringTask: "tasks/leg-day.md",
				// Inherited from parent based on settings
				tags: ["fitness", "legs"],
				projects: ["Health2025"],
				priority: "high",
				// Not inherited - user will fill in actual values
				// weight_lifted: undefined,
				// sets_completed: undefined,
			};

			expect(expectedInstance.tags).toEqual(parentTask.tags);
			expect(expectedInstance.projects).toEqual(parentTask.projects);
		});

		it.skip("reproduces issue #1115 - should NOT include recurrence rules in instance notes", async () => {
			// Feature: Instance notes are one-off completed tasks, not recurring
			const instanceNote: MockTaskInfo = {
				path: "tasks/workout-2025-03-10.md",
				title: "Workout - 2025-03-10",
				status: "done",
				instanceDate: "2025-03-10",
				parentRecurringTask: "tasks/workout.md",
			};

			// Instance should not recur - it's a completed snapshot
			expect(instanceNote.recurrence).toBeUndefined();
			expect(instanceNote.recurrence_anchor).toBeUndefined();
			expect(instanceNote.complete_instances).toBeUndefined();
		});
	});

	describe("Parent Task Updates", () => {
		it.skip("reproduces issue #1115 - should update parent task scheduled date after creating instance", async () => {
			// Feature: Parent continues recurring after instance is created
			const parentBefore: MockTaskInfo = {
				path: "tasks/daily-workout.md",
				title: "Daily Workout",
				status: "open",
				recurrence: "DTSTART:20250301;RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-10",
			};

			// After completing on 2025-03-10
			const parentAfter: MockTaskInfo = {
				...parentBefore,
				scheduled: "2025-03-11", // Updated to next occurrence
				// Note: complete_instances is NOT updated in create_notes mode
				// because the instance is tracked via the created note
			};

			expect(parentAfter.scheduled).toBe("2025-03-11");
		});

		it.skip("reproduces issue #1115 - should track created instances via links in parent", async () => {
			// Feature: Parent task could reference its created instances
			const parentWithInstances: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-11", // Next occurrence
				// Optional: track created instances
				// This could be implemented various ways:
				// - Outgoing links in note body
				// - A frontmatter field listing instance paths
				// - Relying on backlinks from instances' parentRecurringTask field
			};

			// Instance notes reference parent via parentRecurringTask
			const instance1: MockTaskInfo = {
				path: "tasks/workout-2025-03-08.md",
				parentRecurringTask: "tasks/workout.md",
				instanceDate: "2025-03-08",
				status: "done",
				title: "Workout - 2025-03-08",
			};

			const instance2: MockTaskInfo = {
				path: "tasks/workout-2025-03-09.md",
				parentRecurringTask: "tasks/workout.md",
				instanceDate: "2025-03-09",
				status: "done",
				title: "Workout - 2025-03-09",
			};

			// All instances link back to the same parent
			expect(instance1.parentRecurringTask).toBe(parentWithInstances.path);
			expect(instance2.parentRecurringTask).toBe(parentWithInstances.path);
		});

		it.skip("reproduces issue #1115 - should handle completion-based recurrence with new note creation", async () => {
			// Feature: Completion-based recurrence + new note per instance
			const parentTask: MockTaskInfo = {
				path: "tasks/weekly-review.md",
				title: "Weekly Review",
				recurrence: "DTSTART:20250303;RRULE:FREQ=WEEKLY",
				recurrence_anchor: "completion",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-10",
			};

			// Complete on 2025-03-10 (3 days after scheduled)
			// Expected:
			// 1. Create instance note for 2025-03-10
			// 2. Update DTSTART to 2025-03-10 (completion date)
			// 3. Calculate next occurrence: 2025-03-17 (1 week from completion)

			const expectedParentAfter: MockTaskInfo = {
				...parentTask,
				recurrence: "DTSTART:20250310;RRULE:FREQ=WEEKLY", // DTSTART updated
				scheduled: "2025-03-17", // Next week from completion
			};

			expect(parentTask.recurrence_anchor).toBe("completion");
			expect(expectedParentAfter.scheduled).toBe("2025-03-17");
		});
	});

	describe("Instance Note Naming", () => {
		it.skip("reproduces issue #1115 - should use configurable template for instance note names", async () => {
			// Feature: Customizable instance note naming
			const settings: MockRecurringTaskSettings = {
				defaultRecurrenceMode: "create_notes",
				instanceNoteTemplate: "{{title}} - {{date}}", // Default template
				instanceNoteFolder: "", // Same folder as parent
				linkInstancesToParent: true,
				inheritPropertiesFromParent: ["tags", "projects"],
			};

			const parentTask: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-10",
			};

			// Template: "{{title}} - {{date}}" -> "Workout - 2025-03-10"
			const expectedPath = "tasks/Workout - 2025-03-10.md";

			expect(settings.instanceNoteTemplate).toBe("{{title}} - {{date}}");
			expect(expectedPath).toContain("2025-03-10");
		});

		it.skip("reproduces issue #1115 - should support custom folder for instance notes", async () => {
			// Feature: Create instance notes in a specific folder
			const settings: Partial<MockRecurringTaskSettings> = {
				instanceNoteFolder: "tasks/completed",
			};

			const parentTask: MockTaskInfo = {
				path: "tasks/recurring/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
			};

			// Instance created in configured folder
			const expectedInstancePath = "tasks/completed/Workout - 2025-03-10.md";

			expect(settings.instanceNoteFolder).toBe("tasks/completed");
			expect(expectedInstancePath).toContain("tasks/completed");
		});

		it.skip("reproduces issue #1115 - should handle naming conflicts when instance note already exists", async () => {
			// Feature: Handle duplicate instance note names
			// Scenario: User manually creates "Workout - 2025-03-10.md" before completing

			const existingNote: MockTaskInfo = {
				path: "tasks/Workout - 2025-03-10.md",
				title: "Workout - 2025-03-10",
				// Some manual content
			};

			// Options when conflict detected:
			// 1. Append number: "Workout - 2025-03-10 (2).md"
			// 2. Use timestamp: "Workout - 2025-03-10T09-30-00.md"
			// 3. Warn user and skip creation
			// 4. Update existing note if it has parentRecurringTask matching

			const alternativePath = "tasks/Workout - 2025-03-10 (2).md";

			expect(existingNote.path).toBe("tasks/Workout - 2025-03-10.md");
			expect(alternativePath).toContain("(2)");
		});
	});

	describe("Settings and Configuration", () => {
		it.skip("reproduces issue #1115 - should provide global default recurrence mode setting", async () => {
			// Feature: Global setting for default recurrence mode
			const settingsExpectations = {
				hasRecurrenceModeDefault: true, // 'log_instances' | 'create_notes'
				hasInstanceNoteTemplate: true,
				hasInstanceNoteFolder: true,
				hasInheritPropertiesOption: true,
			};

			// Default should be 'log_instances' for backward compatibility
			expect(settingsExpectations.hasRecurrenceModeDefault).toBe(true);
		});

		it.skip("reproduces issue #1115 - should allow setting recurrence mode in task creation modal", async () => {
			// Feature: Choose mode when creating recurring task
			const taskCreationOptions = {
				title: "New Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_anchor: "scheduled",
				recurrence_mode: "create_notes", // User selects this option
			};

			expect(taskCreationOptions.recurrence_mode).toBe("create_notes");
		});

		it.skip("reproduces issue #1115 - should allow changing recurrence mode on existing task", async () => {
			// Feature: Switch mode for existing recurring task
			const taskBefore: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "log_instances",
				complete_instances: ["2025-03-01", "2025-03-02", "2025-03-03"],
				scheduled: "2025-03-10",
			};

			// User changes to 'create_notes' mode
			const taskAfter: MockTaskInfo = {
				...taskBefore,
				recurrence_mode: "create_notes",
				// complete_instances preserved for history
			};

			// Future completions will create new notes
			// Past complete_instances remain in the task for historical record

			expect(taskAfter.recurrence_mode).toBe("create_notes");
			expect(taskAfter.complete_instances).toEqual(taskBefore.complete_instances);
		});
	});

	describe("UI Integration", () => {
		it.skip("reproduces issue #1115 - should show instance creation option in completion UI", async () => {
			// Feature: UI indication when completing will create new note
			const taskInCreateMode: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-10",
			};

			// When completing this task, UI should indicate:
			// "Completing this task will create a new note for today's instance"
			// or show option: [Complete (create note)] vs [Complete (log only)]

			expect(taskInCreateMode.recurrence_mode).toBe("create_notes");
		});

		it.skip("reproduces issue #1115 - should provide way to view all instances of a recurring task", async () => {
			// Feature: View all created instance notes
			const parentTask: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
			};

			// Ways to find instances:
			// 1. Backlinks to parent task
			// 2. Search for parentRecurringTask: "tasks/workout.md"
			// 3. Bases query filtering by parentRecurringTask
			// 4. Dedicated "View Instances" button on parent task

			const searchQuery = `parentRecurringTask: "${parentTask.path}"`;

			expect(searchQuery).toContain(parentTask.path);
		});

		it.skip("reproduces issue #1115 - should display instance notes in calendar view", async () => {
			// Feature: Show completed instances on calendar
			const instances: MockTaskInfo[] = [
				{
					path: "tasks/workout-2025-03-08.md",
					title: "Workout - 2025-03-08",
					status: "done",
					scheduled: "2025-03-08",
					instanceDate: "2025-03-08",
					parentRecurringTask: "tasks/workout.md",
				},
				{
					path: "tasks/workout-2025-03-09.md",
					title: "Workout - 2025-03-09",
					status: "done",
					scheduled: "2025-03-09",
					instanceDate: "2025-03-09",
					parentRecurringTask: "tasks/workout.md",
				},
			];

			// Calendar should show these completed instances on their respective dates
			// Potentially with different styling to indicate they're completed instances

			expect(instances.length).toBe(2);
			expect(instances.every((i) => i.status === "done")).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it.skip("reproduces issue #1115 - should handle uncomplete on instance note", async () => {
			// Feature: What happens when user uncompletes an instance note?
			const instanceNote: MockTaskInfo = {
				path: "tasks/workout-2025-03-10.md",
				title: "Workout - 2025-03-10",
				status: "done",
				instanceDate: "2025-03-10",
				parentRecurringTask: "tasks/workout.md",
			};

			// Options when uncompleting:
			// 1. Change status to 'open' (instance becomes a regular task)
			// 2. Delete instance note and re-add date to parent's instances
			// 3. Keep as standalone open task, unlinked from parent
			// 4. Warn user about behavior

			expect(instanceNote.status).toBe("done");
		});

		it.skip("reproduces issue #1115 - should handle deletion of instance note", async () => {
			// Feature: Track or handle when user deletes an instance note
			const parentTask: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
			};

			// If user deletes instance note for 2025-03-10:
			// - Parent task doesn't know the instance existed (no complete_instances tracking)
			// - Data loss for that instance's custom properties
			// - May want to optionally track in complete_instances as backup

			expect(parentTask.recurrence_mode).toBe("create_notes");
		});

		it.skip("reproduces issue #1115 - should handle skipping instance in create_notes mode", async () => {
			// Feature: Skip recurring instance without creating note
			const parentTask: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "create_notes",
				scheduled: "2025-03-10",
				skipped_instances: ["2025-03-08"], // Previously skipped
			};

			// Skip should:
			// 1. NOT create a new note (user didn't complete it)
			// 2. Add to skipped_instances (or not track at all)
			// 3. Advance scheduled to next occurrence

			const afterSkip: MockTaskInfo = {
				...parentTask,
				scheduled: "2025-03-11",
				skipped_instances: ["2025-03-08", "2025-03-10"],
			};

			expect(afterSkip.skipped_instances).toContain("2025-03-10");
		});

		it.skip("reproduces issue #1115 - should handle migration from log_instances to create_notes", async () => {
			// Feature: What happens to existing complete_instances when switching modes?
			const taskWithHistory: MockTaskInfo = {
				path: "tasks/workout.md",
				title: "Workout",
				recurrence: "RRULE:FREQ=DAILY",
				recurrence_mode: "log_instances",
				complete_instances: [
					"2025-03-01",
					"2025-03-02",
					"2025-03-03",
					"2025-03-05",
					"2025-03-06",
				],
				scheduled: "2025-03-10",
			};

			// Options when switching to create_notes:
			// 1. Keep complete_instances as historical record (can't retroactively create notes)
			// 2. Offer to create instance notes for past completions (optional)
			// 3. Clear complete_instances (data loss - not recommended)

			// Most sensible: Keep history, future completions use new mode
			const afterModeSwitch: MockTaskInfo = {
				...taskWithHistory,
				recurrence_mode: "create_notes",
				// complete_instances preserved
			};

			expect(afterModeSwitch.complete_instances?.length).toBe(5);
		});
	});
});

describe("Issue #1115 - User Story Scenarios", () => {
	it.skip("reproduces issue #1115 - training tracking workflow", async () => {
		// Main user story: Track training with recurring tasks and instance-specific data

		// Setup: User creates a recurring workout task
		const workoutTask: MockTaskInfo = {
			path: "tasks/squats.md",
			title: "Squats",
			recurrence: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
			recurrence_mode: "create_notes",
			scheduled: "2025-03-10",
			tags: ["fitness", "legs"],
			// Default/target values
			target_weight: 100,
			target_reps: 10,
			target_sets: 4,
		};

		// Monday workout: User completes and logs specific data
		const mondayInstance: MockTaskInfo = {
			path: "tasks/Squats - 2025-03-10.md",
			title: "Squats - 2025-03-10",
			status: "done",
			instanceDate: "2025-03-10",
			parentRecurringTask: "tasks/squats.md",
			tags: ["fitness", "legs"],
			// Actual workout data
			weight_lifted: 102.5,
			reps_completed: 10,
			sets_completed: 4,
			notes: "Felt strong, increased weight 2.5kg from target",
			energy_level: "high",
			workout_duration: 25,
		};

		// Wednesday workout: Different data
		const wednesdayInstance: MockTaskInfo = {
			path: "tasks/Squats - 2025-03-12.md",
			title: "Squats - 2025-03-12",
			status: "done",
			instanceDate: "2025-03-12",
			parentRecurringTask: "tasks/squats.md",
			tags: ["fitness", "legs"],
			weight_lifted: 100,
			reps_completed: 8,
			sets_completed: 4,
			notes: "Tired today, stuck to target weight, fewer reps",
			energy_level: "low",
			workout_duration: 20,
		};

		// User can now:
		// 1. Query all squat instances to see progress over time
		// 2. Build charts/graphs from instance data
		// 3. Review specific workout details
		// 4. Track personal records

		expect(mondayInstance.weight_lifted).toBeGreaterThan(workoutTask.target_weight!);
		expect(wednesdayInstance.reps_completed).toBeLessThan(workoutTask.target_reps!);
	});

	it.skip("reproduces issue #1115 - weekly review workflow with meeting notes", async () => {
		// Alternative use case: Weekly review with notes for each session

		const weeklyReview: MockTaskInfo = {
			path: "tasks/weekly-review.md",
			title: "Weekly Review",
			recurrence: "RRULE:FREQ=WEEKLY;BYDAY=FR",
			recurrence_mode: "create_notes",
			scheduled: "2025-03-14",
		};

		const reviewInstance: MockTaskInfo = {
			path: "tasks/Weekly Review - 2025-03-14.md",
			title: "Weekly Review - 2025-03-14",
			status: "done",
			instanceDate: "2025-03-14",
			parentRecurringTask: "tasks/weekly-review.md",
			// Review-specific data
			wins: ["Shipped feature X", "Fixed critical bug", "Good team meeting"],
			challenges: ["Blocked on dependency", "Technical debt growing"],
			next_week_priorities: ["Complete code review", "Start new sprint"],
			mood: "positive",
			productivity_score: 8,
		};

		// Each review has its own notes, wins, challenges
		expect(reviewInstance.wins).toHaveLength(3);
		expect(reviewInstance.next_week_priorities).toBeDefined();
	});

	it.skip("reproduces issue #1115 - daily journaling prompt", async () => {
		// Use case: Daily journaling with template questions

		const dailyJournal: MockTaskInfo = {
			path: "tasks/daily-journal.md",
			title: "Daily Journal",
			recurrence: "RRULE:FREQ=DAILY",
			recurrence_mode: "create_notes",
			scheduled: "2025-03-10",
		};

		const journalEntry: MockTaskInfo = {
			path: "tasks/Daily Journal - 2025-03-10.md",
			title: "Daily Journal - 2025-03-10",
			status: "done",
			instanceDate: "2025-03-10",
			parentRecurringTask: "tasks/daily-journal.md",
			// Journal entry data
			grateful_for: "Good weather, productive morning",
			main_accomplishment: "Finished project proposal",
			learned_today: "New TypeScript pattern for type guards",
			tomorrow_focus: "Code review and testing",
		};

		// Each journal entry captures that day's reflections
		expect(journalEntry.grateful_for).toBeDefined();
		expect(journalEntry.learned_today).toBeDefined();
	});
});
