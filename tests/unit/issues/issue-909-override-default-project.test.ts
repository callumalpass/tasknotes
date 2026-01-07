/**
 * Tests for Issue #909: Override "Default Project" When Project is Entered
 *
 * Feature Request Description:
 * Add the ability to have "overridable" default projects that are automatically
 * removed when a user manually assigns a different project. This differs from
 * the current behavior where default projects are only applied when no project
 * is provided.
 *
 * User Example:
 * - User sets "Homework" as an overridable default project
 * - When creating a task without specifying a project: task gets "Homework"
 * - When creating a task with "+Study": task gets only "Study", NOT "Homework"
 *
 * Key Requirements:
 * 1. New setting for "overridable default projects" (separate from always-applied defaults)
 * 2. Overridable defaults are removed when user manually specifies a project
 * 3. Regular defaults can still be applied alongside manual projects
 * 4. Should work in Task Creation Modal, instant conversion, and NLP parsing
 *
 * Current behavior:
 * - Default projects are only applied if taskData.projects is empty
 * - See src/services/TaskService.ts:573-579 (applyTaskCreationDefaults)
 *
 * Relevant code locations:
 * - src/services/TaskService.ts - applyTaskCreationDefaults method
 * - src/modals/TaskCreationModal.ts - Modal initialization with defaults
 * - src/services/InstantTaskConvertService.ts - Inline task conversion
 * - src/types/settings.ts - TaskCreationDefaults interface
 * - src/settings/tabs/taskProperties/projectsPropertyCard.ts - Settings UI
 */

import { describe, it, expect } from "@jest/globals";

// Mock interface matching TaskCreationDefaults structure
interface MockTaskCreationDefaults {
	defaultProjects: string; // Current behavior: comma-separated list, only applied if no projects
	overridableDefaultProjects?: string; // NEW: comma-separated list, replaced when user specifies projects
	useParentNoteAsProject: boolean;
}

// Mock interface matching TaskCreationData
interface MockTaskCreationData {
	description: string;
	projects?: string[];
	userSpecifiedProjects?: boolean; // Flag to indicate user explicitly provided projects
}

/**
 * Current behavior: Apply defaults only when no projects provided
 * This is how TaskService.ts:573-579 currently works
 */
function applyCurrentDefaults(
	taskData: MockTaskCreationData,
	defaults: MockTaskCreationDefaults
): MockTaskCreationData {
	const result = { ...taskData };

	// Current behavior: only apply if not provided
	if (!result.projects && defaults.defaultProjects) {
		result.projects = defaults.defaultProjects
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p);
	}

	return result;
}

/**
 * Proposed behavior: Support both overridable and always-applied defaults
 * Overridable defaults are removed when user explicitly specifies projects
 */
function applyProposedDefaults(
	taskData: MockTaskCreationData,
	defaults: MockTaskCreationDefaults
): MockTaskCreationData {
	const result = { ...taskData };

	// If user specified projects, don't apply overridable defaults
	if (result.userSpecifiedProjects && defaults.overridableDefaultProjects) {
		// User's projects replace overridable defaults
		// result.projects already contains user's selection
	} else if (!result.projects) {
		// No projects specified - apply overridable defaults
		if (defaults.overridableDefaultProjects) {
			result.projects = defaults.overridableDefaultProjects
				.split(",")
				.map((p) => p.trim())
				.filter((p) => p);
		}
	}

	// Always-applied defaults (existing behavior for defaultProjects)
	// These are added regardless of user selection
	if (defaults.defaultProjects) {
		const alwaysApplied = defaults.defaultProjects
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p);

		if (!result.projects) {
			result.projects = alwaysApplied;
		} else {
			// Add always-applied defaults to existing projects (avoid duplicates)
			for (const proj of alwaysApplied) {
				if (!result.projects.includes(proj)) {
					result.projects.push(proj);
				}
			}
		}
	}

	return result;
}

describe("Issue #909: Override Default Project When Project is Entered", () => {
	describe("Current behavior verification", () => {
		it("should apply default projects when no projects are provided", () => {
			const defaults: MockTaskCreationDefaults = {
				defaultProjects: "[[Homework]]",
				useParentNoteAsProject: false,
			};

			const taskData: MockTaskCreationData = {
				description: "Complete math worksheet",
			};

			const result = applyCurrentDefaults(taskData, defaults);

			expect(result.projects).toEqual(["[[Homework]]"]);
		});

		it("should NOT apply default projects when projects are provided", () => {
			const defaults: MockTaskCreationDefaults = {
				defaultProjects: "[[Homework]]",
				useParentNoteAsProject: false,
			};

			const taskData: MockTaskCreationData = {
				description: "Study for exam",
				projects: ["[[Study]]"],
			};

			const result = applyCurrentDefaults(taskData, defaults);

			// Current behavior: default NOT applied because projects array exists
			expect(result.projects).toEqual(["[[Study]]"]);
		});

		it("should support multiple default projects", () => {
			const defaults: MockTaskCreationDefaults = {
				defaultProjects: "[[Homework]], [[School]]",
				useParentNoteAsProject: false,
			};

			const taskData: MockTaskCreationData = {
				description: "Complete assignment",
			};

			const result = applyCurrentDefaults(taskData, defaults);

			expect(result.projects).toEqual(["[[Homework]]", "[[School]]"]);
		});
	});

	describe("Proposed overridable defaults behavior", () => {
		it.skip("should apply overridable defaults when no projects specified - reproduces issue #909", () => {
			// This test documents the requested behavior:
			// Overridable defaults should be applied when user doesn't specify projects

			const defaults: MockTaskCreationDefaults = {
				defaultProjects: "", // No always-applied defaults
				overridableDefaultProjects: "[[Homework]]",
				useParentNoteAsProject: false,
			};

			const taskData: MockTaskCreationData = {
				description: "Complete math worksheet",
				userSpecifiedProjects: false,
			};

			const result = applyProposedDefaults(taskData, defaults);

			expect(result.projects).toEqual(["[[Homework]]"]);
		});

		it.skip("should NOT apply overridable defaults when user specifies a project - reproduces issue #909", () => {
			// Key feature: User explicitly adding a project should override defaults
			// Example from issue: User wants "Homework" by default, but "Study"
			// should replace it when explicitly specified

			const defaults: MockTaskCreationDefaults = {
				defaultProjects: "",
				overridableDefaultProjects: "[[Homework]]",
				useParentNoteAsProject: false,
			};

			const taskData: MockTaskCreationData = {
				description: "Study for exam",
				projects: ["[[Study]]"],
				userSpecifiedProjects: true,
			};

			const result = applyProposedDefaults(taskData, defaults);

			// Overridable default "Homework" should NOT be present
			expect(result.projects).toEqual(["[[Study]]"]);
			expect(result.projects).not.toContain("[[Homework]]");
		});

		it.skip("should allow mixing overridable and always-applied defaults - reproduces issue #909", () => {
			// Users might want some defaults that are always applied
			// and others that are only applied when no project is specified

			const defaults: MockTaskCreationDefaults = {
				defaultProjects: "[[Personal]]", // Always applied
				overridableDefaultProjects: "[[Homework]]", // Overridable
				useParentNoteAsProject: false,
			};

			const taskData: MockTaskCreationData = {
				description: "Study for exam",
				projects: ["[[Study]]"],
				userSpecifiedProjects: true,
			};

			const result = applyProposedDefaults(taskData, defaults);

			// "Homework" overridden, but "Personal" always applied
			expect(result.projects).toContain("[[Study]]");
			expect(result.projects).toContain("[[Personal]]");
			expect(result.projects).not.toContain("[[Homework]]");
		});

		it.skip("should apply both types of defaults when no project specified - reproduces issue #909", () => {
			const defaults: MockTaskCreationDefaults = {
				defaultProjects: "[[Personal]]",
				overridableDefaultProjects: "[[Homework]]",
				useParentNoteAsProject: false,
			};

			const taskData: MockTaskCreationData = {
				description: "Complete assignment",
				userSpecifiedProjects: false,
			};

			const result = applyProposedDefaults(taskData, defaults);

			// Both defaults should be applied
			expect(result.projects).toContain("[[Homework]]");
			expect(result.projects).toContain("[[Personal]]");
		});
	});

	describe("Settings interface for overridable defaults", () => {
		it.skip("should support new overridableDefaultProjects setting - reproduces issue #909", () => {
			// The feature request suggests a distinct section or checkbox
			// for default projects that are overridden upon manual assignment

			// Proposed settings structure
			interface ProposedTaskCreationDefaults {
				// Existing
				defaultProjects: string; // Always applied (current behavior)
				useParentNoteAsProject: boolean;
				// New
				overridableDefaultProjects: string; // Replaced when user specifies projects
			}

			const defaults: ProposedTaskCreationDefaults = {
				defaultProjects: "",
				overridableDefaultProjects: "[[Homework]]",
				useParentNoteAsProject: false,
			};

			// Verify the interface allows the new setting
			expect(defaults.overridableDefaultProjects).toBe("[[Homework]]");
		});

		it.skip("should provide UI to distinguish between default types - reproduces issue #909", () => {
			// The issue mentions "a distinct section (or checkbox beside, or something)"
			// for default projects that are overridden

			// Possible UI approaches:
			// 1. Separate input field for "Overridable Default Projects"
			// 2. Checkbox next to each default project: "Override when project specified"
			// 3. Radio button: "Default projects are: Always applied / Overridable"

			// This test documents the UI requirement exists
			const settingsUIElements = {
				defaultProjectsInput: true, // Existing
				overridableDefaultProjectsInput: true, // New - separate field approach
				// OR
				projectOverrideCheckbox: true, // New - checkbox approach
			};

			expect(settingsUIElements.overridableDefaultProjectsInput || settingsUIElements.projectOverrideCheckbox).toBe(
				true
			);
		});
	});

	describe("Integration with Task Creation Modal", () => {
		it.skip("should track whether user explicitly specified projects - reproduces issue #909", () => {
			// TaskCreationModal needs to track if user added projects manually
			// vs relying on defaults

			// Scenario 1: User opens modal, doesn't touch projects, submits
			const noUserInteraction = {
				projectFieldTouched: false,
				projectsFromForm: [],
			};

			// Scenario 2: User opens modal, adds a project, submits
			const userAddedProject = {
				projectFieldTouched: true,
				projectsFromForm: ["[[Study]]"],
			};

			// The modal should pass this information to the task creation flow
			expect(noUserInteraction.projectFieldTouched).toBe(false);
			expect(userAddedProject.projectFieldTouched).toBe(true);
		});
	});

	describe("Integration with NLP parsing", () => {
		it.skip("should detect project in natural language input - reproduces issue #909", () => {
			// When user types "+Study" in NLP input, this should count as
			// "user specified projects" and override defaults

			const nlpInput = "Complete assignment +Study due:tomorrow";

			// Mock NLP detection
			const hasProjectToken = nlpInput.includes("+") && /\+\S+/.test(nlpInput);

			expect(hasProjectToken).toBe(true);
			// When project detected in NLP, overridable defaults should not apply
		});

		it.skip("should apply overridable defaults when no project in NLP input - reproduces issue #909", () => {
			const nlpInput = "Complete assignment due:tomorrow";

			const hasProjectToken = nlpInput.includes("+") && /\+\S+/.test(nlpInput);

			expect(hasProjectToken).toBe(false);
			// When no project in NLP, overridable defaults should apply
		});
	});

	describe("Integration with Instant Task Convert", () => {
		it.skip("should apply overridable defaults during checkbox conversion - reproduces issue #909", () => {
			// InstantTaskConvertService should use the same override logic
			// when converting checkboxes to tasks

			// Scenario: User converts "- [ ] Study for exam" to a task
			// No project in the checkbox text, so overridable defaults should apply

			const checkboxText = "- [ ] Study for exam";
			const hasProjectInText = checkboxText.includes("+[[") || /\+\w+/.test(checkboxText);

			expect(hasProjectInText).toBe(false);
			// Overridable defaults should be applied
		});

		it.skip("should respect project in checkbox text during conversion - reproduces issue #909", () => {
			// If the checkbox has a project reference, override defaults

			const checkboxText = "- [ ] Study for exam +[[Study]]";
			const hasProjectInText = checkboxText.includes("+[[");

			expect(hasProjectInText).toBe(true);
			// Overridable defaults should NOT be applied
		});
	});
});

describe("Edge cases for overridable default projects", () => {
	it.skip("should handle empty overridable defaults gracefully - reproduces issue #909", () => {
		const defaults: MockTaskCreationDefaults = {
			defaultProjects: "[[Personal]]",
			overridableDefaultProjects: "",
			useParentNoteAsProject: false,
		};

		const taskData: MockTaskCreationData = {
			description: "Test task",
		};

		const result = applyProposedDefaults(taskData, defaults);

		// Only always-applied defaults should be present
		expect(result.projects).toEqual(["[[Personal]]"]);
	});

	it.skip("should handle user clearing projects explicitly - reproduces issue #909", () => {
		// If user explicitly removes all projects, this should still count
		// as "user specified" (they specified empty)

		const defaults: MockTaskCreationDefaults = {
			defaultProjects: "",
			overridableDefaultProjects: "[[Homework]]",
			useParentNoteAsProject: false,
		};

		const taskData: MockTaskCreationData = {
			description: "Task with no projects",
			projects: [], // User explicitly cleared
			userSpecifiedProjects: true,
		};

		const result = applyProposedDefaults(taskData, defaults);

		// User cleared projects, so no defaults should be applied
		expect(result.projects).toEqual([]);
	});

	it.skip("should not duplicate projects when same project in defaults and user selection - reproduces issue #909", () => {
		const defaults: MockTaskCreationDefaults = {
			defaultProjects: "[[Personal]]",
			overridableDefaultProjects: "[[Homework]]",
			useParentNoteAsProject: false,
		};

		const taskData: MockTaskCreationData = {
			description: "Personal task",
			projects: ["[[Personal]]"], // Same as always-applied default
			userSpecifiedProjects: true,
		};

		const result = applyProposedDefaults(taskData, defaults);

		// Should not have duplicate [[Personal]]
		const personalCount = result.projects?.filter((p) => p === "[[Personal]]").length ?? 0;
		expect(personalCount).toBe(1);
	});
});
