import { ProgressService } from "../../../src/services/ProgressService";
import { TaskInfo, ProgressInfo } from "../../../src/types";

describe("ProgressService", () => {
	let service: ProgressService;

	beforeEach(() => {
		service = new ProgressService();
	});

	describe("calculateProgress", () => {
		it("should return null when task has no details", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
			};

			const result = service.calculateProgress(task);
			expect(result).toBeNull();
		});

		it("should return null when details is empty", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: "",
			};

			const result = service.calculateProgress(task);
			expect(result).toBeNull();
		});

		it("should return null when details has no checkboxes", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: "Some text without checkboxes",
			};

			const result = service.calculateProgress(task);
			expect(result).toBeNull();
		});

		it("should count only top-level checkboxes (no indentation)", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [ ] Task 1
- [x] Task 2
  - [ ] Subtask 1 (should not be counted)
  - [x] Subtask 2 (should not be counted)
- [ ] Task 3`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(3);
			expect(result?.completed).toBe(1);
			expect(result?.percentage).toBe(33);
		});

		it("should calculate progress correctly for all completed", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [x] Task 1
- [x] Task 2
- [x] Task 3`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(3);
			expect(result?.completed).toBe(3);
			expect(result?.percentage).toBe(100);
		});

		it("should calculate progress correctly for none completed", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(3);
			expect(result?.completed).toBe(0);
			expect(result?.percentage).toBe(0);
		});

		it("should handle uppercase X in checkboxes", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [X] Task 1
- [x] Task 2
- [ ] Task 3`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(3);
			expect(result?.completed).toBe(2);
			expect(result?.percentage).toBe(67);
		});

		it("should handle numbered lists", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `1. [ ] Task 1
2. [x] Task 2
3. [ ] Task 3`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(3);
			expect(result?.completed).toBe(1);
			expect(result?.percentage).toBe(33);
		});

		it("should handle mixed bullet types", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [ ] Task 1
* [x] Task 2
+ [ ] Task 3`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(3);
			expect(result?.completed).toBe(1);
			expect(result?.percentage).toBe(33);
		});

		it("should ignore indented checkboxes", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [ ] Task 1
  - [x] Subtask 1
    - [x] Sub-subtask
- [x] Task 2`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(2);
			expect(result?.completed).toBe(1);
			expect(result?.percentage).toBe(50);
		});

		it("should round percentage correctly", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [x] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Task 4
- [ ] Task 5`,
			};

			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
			expect(result?.total).toBe(5);
			expect(result?.completed).toBe(1);
			expect(result?.percentage).toBe(20);
		});

		it("should cache results for same task and details", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [x] Task 1
- [ ] Task 2`,
			};

			const result1 = service.calculateProgress(task);
			const result2 = service.calculateProgress(task);

			expect(result1).toEqual(result2);
			expect(result1).not.toBeNull();
		});

		it("should recalculate when details change", () => {
			const task1: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [x] Task 1
- [ ] Task 2`,
			};

			const task2: TaskInfo = {
				...task1,
				details: `- [x] Task 1
- [x] Task 2`,
			};

			const result1 = service.calculateProgress(task1);
			const result2 = service.calculateProgress(task2);

			expect(result1?.completed).toBe(1);
			expect(result2?.completed).toBe(2);
		});
	});

	describe("clearCache", () => {
		it("should clear all cached progress", () => {
			const task: TaskInfo = {
				title: "Test Task",
				status: "open",
				priority: "normal",
				path: "test.md",
				archived: false,
				details: `- [x] Task 1`,
			};

			service.calculateProgress(task);
			service.clearCache();

			// Cache should be cleared, but result should still be correct
			const result = service.calculateProgress(task);
			expect(result).not.toBeNull();
		});
	});

	describe("clearCacheForTask", () => {
		it("should clear cache for specific task only", () => {
			const task1: TaskInfo = {
				title: "Test Task 1",
				status: "open",
				priority: "normal",
				path: "test1.md",
				archived: false,
				details: `- [x] Task 1`,
			};

			const task2: TaskInfo = {
				title: "Test Task 2",
				status: "open",
				priority: "normal",
				path: "test2.md",
				archived: false,
				details: `- [x] Task 2`,
			};

			service.calculateProgress(task1);
			service.calculateProgress(task2);

			service.clearCacheForTask("test1.md");

			// task2 should still be cached, task1 should be recalculated
			const result1 = service.calculateProgress(task1);
			const result2 = service.calculateProgress(task2);

			expect(result1).not.toBeNull();
			expect(result2).not.toBeNull();
		});
	});
});
