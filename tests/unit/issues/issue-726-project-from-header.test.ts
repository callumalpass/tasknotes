/**
 * Tests for Issue #726: Assign task project from parent header when converting task
 *
 * Feature Request Description:
 * When converting a checkbox task to a TaskNote, automatically assign a project
 * based on the parent markdown header the task falls under. This is useful for
 * users who organize tasks under headers in daily notes, where the header often
 * represents a project or category.
 *
 * User Example:
 * ```markdown
 * # 2025-09-24
 *
 * ## [[Project A]]
 *
 * - [ ] I will convert this to a task
 * ```
 * When converting the task, it should automatically get "[[Project A]]" as its project.
 *
 * Key Requirements:
 * 1. New setting to enable "Auto-assign parent header as project"
 * 2. Find the closest markdown header above the task line
 * 3. Extract the header text and use it as the project
 * 4. Handle wikilinks in headers (e.g., ## [[Project A]])
 * 5. Should work with different header levels (##, ###, etc.)
 * 6. Should integrate with existing project assignment logic in InstantTaskConvertService
 *
 * Current behavior:
 * - Projects can be assigned from: default settings, parent note, NLP parsing
 * - See src/services/InstantTaskConvertService.ts:603-630 (project assignment logic)
 * - No logic exists to find parent markdown headers
 *
 * Relevant code locations:
 * - src/services/InstantTaskConvertService.ts - createTaskFile method, project assignment
 * - src/types/settings.ts - TaskCreationDefaults interface
 * - Obsidian's metadataCache.getFileCache(file)?.headings for header detection
 */

import { describe, it, expect } from "@jest/globals";

// Mock interface matching the heading cache structure from Obsidian
interface MockHeading {
	heading: string;
	level: number;
	position: {
		start: { line: number; col: number; offset: number };
		end: { line: number; col: number; offset: number };
	};
}

// Mock interface for the proposed setting
interface MockTaskCreationDefaults {
	useParentNoteAsProject: boolean;
	useParentHeaderAsProject?: boolean; // NEW: proposed setting
	defaultProjects: string;
}

/**
 * Find the closest parent heading above a given line number
 */
function findParentHeading(
	headings: MockHeading[],
	lineNumber: number
): MockHeading | null {
	// Filter headings that are above the current line
	const headingsAbove = headings.filter(
		(h) => h.position.start.line < lineNumber
	);

	if (headingsAbove.length === 0) {
		return null;
	}

	// Return the closest heading (last one before the line)
	return headingsAbove[headingsAbove.length - 1];
}

/**
 * Extract project name from a heading, handling wikilinks
 */
function extractProjectFromHeading(heading: string): string {
	// Check if heading contains a wikilink like [[Project A]]
	const wikilinkMatch = heading.match(/\[\[([^\]]+)\]\]/);
	if (wikilinkMatch) {
		// Return the full wikilink format for consistency with existing project handling
		return `[[${wikilinkMatch[1]}]]`;
	}

	// Otherwise, return the heading text as-is (could be used as project name)
	return heading.trim();
}

describe("Issue #726: Assign task project from parent header when converting task", () => {
	describe("Finding parent heading", () => {
		it.skip("should find the closest heading above the task line - reproduces issue #726", () => {
			// Document structure:
			// Line 0: # 2025-09-24
			// Line 1: (empty)
			// Line 2: ## [[Project A]]
			// Line 3: (empty)
			// Line 4: - [ ] Task under Project A

			const headings: MockHeading[] = [
				{
					heading: "2025-09-24",
					level: 1,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 12, offset: 12 },
					},
				},
				{
					heading: "[[Project A]]",
					level: 2,
					position: {
						start: { line: 2, col: 0, offset: 14 },
						end: { line: 2, col: 16, offset: 30 },
					},
				},
			];

			const taskLine = 4;
			const parentHeading = findParentHeading(headings, taskLine);

			expect(parentHeading).not.toBeNull();
			expect(parentHeading!.heading).toBe("[[Project A]]");
			expect(parentHeading!.level).toBe(2);
		});

		it.skip("should return null when no heading exists above the task - reproduces issue #726", () => {
			// Document structure:
			// Line 0: - [ ] Task with no header above

			const headings: MockHeading[] = [];
			const taskLine = 0;

			const parentHeading = findParentHeading(headings, taskLine);

			expect(parentHeading).toBeNull();
		});

		it.skip("should find the most recent heading when multiple exist - reproduces issue #726", () => {
			// Document structure:
			// Line 0: # Daily Note
			// Line 1: ## [[Project A]]
			// Line 2: - [ ] Task A
			// Line 3: ## [[Project B]]
			// Line 4: - [ ] Task B (this one)

			const headings: MockHeading[] = [
				{
					heading: "Daily Note",
					level: 1,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 12, offset: 12 },
					},
				},
				{
					heading: "[[Project A]]",
					level: 2,
					position: {
						start: { line: 1, col: 0, offset: 13 },
						end: { line: 1, col: 16, offset: 29 },
					},
				},
				{
					heading: "[[Project B]]",
					level: 2,
					position: {
						start: { line: 3, col: 0, offset: 45 },
						end: { line: 3, col: 16, offset: 61 },
					},
				},
			];

			const taskLine = 4; // Task B
			const parentHeading = findParentHeading(headings, taskLine);

			expect(parentHeading).not.toBeNull();
			expect(parentHeading!.heading).toBe("[[Project B]]");
		});

		it.skip("should handle nested heading structures - reproduces issue #726", () => {
			// Document structure:
			// Line 0: # Main Project
			// Line 1: ## Sub-section
			// Line 2: ### Specific Task Area
			// Line 3: - [ ] Task

			const headings: MockHeading[] = [
				{
					heading: "Main Project",
					level: 1,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 14, offset: 14 },
					},
				},
				{
					heading: "Sub-section",
					level: 2,
					position: {
						start: { line: 1, col: 0, offset: 15 },
						end: { line: 1, col: 14, offset: 29 },
					},
				},
				{
					heading: "Specific Task Area",
					level: 3,
					position: {
						start: { line: 2, col: 0, offset: 30 },
						end: { line: 2, col: 22, offset: 52 },
					},
				},
			];

			const taskLine = 3;
			const parentHeading = findParentHeading(headings, taskLine);

			// Returns the closest heading (### level), not necessarily the project-level header
			expect(parentHeading).not.toBeNull();
			expect(parentHeading!.heading).toBe("Specific Task Area");
			expect(parentHeading!.level).toBe(3);
		});
	});

	describe("Extracting project from heading", () => {
		it.skip("should extract wikilink from heading - reproduces issue #726", () => {
			const heading = "[[Project A]]";
			const project = extractProjectFromHeading(heading);

			expect(project).toBe("[[Project A]]");
		});

		it.skip("should extract wikilink with display text - reproduces issue #726", () => {
			// Wikilink format: [[actual-link|display text]]
			const heading = "[[project-a|Project A Display]]";
			const project = extractProjectFromHeading(heading);

			// Should preserve the link target, not display text
			expect(project).toBe("[[project-a|Project A Display]]");
		});

		it.skip("should use plain heading text when no wikilink - reproduces issue #726", () => {
			const heading = "Work Tasks";
			const project = extractProjectFromHeading(heading);

			expect(project).toBe("Work Tasks");
		});

		it.skip("should handle heading with mixed content - reproduces issue #726", () => {
			// Heading like "Tasks for [[Project A]]"
			const heading = "Tasks for [[Project A]]";
			const project = extractProjectFromHeading(heading);

			// Should extract just the wikilink
			expect(project).toBe("[[Project A]]");
		});

		it.skip("should handle empty heading gracefully - reproduces issue #726", () => {
			const heading = "";
			const project = extractProjectFromHeading(heading);

			expect(project).toBe("");
		});
	});

	describe("Settings interface for parent header as project", () => {
		it.skip("should support new useParentHeaderAsProject setting - reproduces issue #726", () => {
			// Proposed settings structure
			interface ProposedTaskCreationDefaults {
				useParentNoteAsProject: boolean; // Existing
				useParentHeaderAsProject: boolean; // NEW
				defaultProjects: string;
			}

			const defaults: ProposedTaskCreationDefaults = {
				useParentNoteAsProject: false,
				useParentHeaderAsProject: true,
				defaultProjects: "",
			};

			expect(defaults.useParentHeaderAsProject).toBe(true);
		});

		it.skip("should allow combining parent header and parent note as project - reproduces issue #726", () => {
			// User might want both the file AND the header as projects
			const defaults: MockTaskCreationDefaults = {
				useParentNoteAsProject: true,
				useParentHeaderAsProject: true,
				defaultProjects: "",
			};

			expect(defaults.useParentNoteAsProject).toBe(true);
			expect(defaults.useParentHeaderAsProject).toBe(true);
		});
	});

	describe("Integration with InstantTaskConvertService", () => {
		it.skip("should add parent header project when enabled - reproduces issue #726", () => {
			// Simulating the project assignment flow from InstantTaskConvertService

			const settings: MockTaskCreationDefaults = {
				useParentNoteAsProject: false,
				useParentHeaderAsProject: true,
				defaultProjects: "",
			};

			const headings: MockHeading[] = [
				{
					heading: "[[Project A]]",
					level: 2,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 16, offset: 16 },
					},
				},
			];

			const taskLine = 2;
			const projectsArray: string[] = [];

			// Proposed logic to add to InstantTaskConvertService.createTaskFile
			if (settings.useParentHeaderAsProject) {
				const parentHeading = findParentHeading(headings, taskLine);
				if (parentHeading) {
					const project = extractProjectFromHeading(parentHeading.heading);
					if (project) {
						projectsArray.push(project);
					}
				}
			}

			expect(projectsArray).toContain("[[Project A]]");
		});

		it.skip("should not add header project when disabled - reproduces issue #726", () => {
			const settings: MockTaskCreationDefaults = {
				useParentNoteAsProject: false,
				useParentHeaderAsProject: false, // Disabled
				defaultProjects: "",
			};

			const headings: MockHeading[] = [
				{
					heading: "[[Project A]]",
					level: 2,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 16, offset: 16 },
					},
				},
			];

			const taskLine = 2;
			const projectsArray: string[] = [];

			if (settings.useParentHeaderAsProject) {
				const parentHeading = findParentHeading(headings, taskLine);
				if (parentHeading) {
					const project = extractProjectFromHeading(parentHeading.heading);
					if (project) {
						projectsArray.push(project);
					}
				}
			}

			expect(projectsArray).toHaveLength(0);
		});

		it.skip("should combine header project with other projects - reproduces issue #726", () => {
			const settings: MockTaskCreationDefaults = {
				useParentNoteAsProject: true,
				useParentHeaderAsProject: true,
				defaultProjects: "[[Always Applied]]",
			};

			const headings: MockHeading[] = [
				{
					heading: "[[Header Project]]",
					level: 2,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 20, offset: 20 },
					},
				},
			];

			const taskLine = 2;
			const parentNote = "[[Daily Note 2025-09-24]]";
			const projectsArray: string[] = [];

			// Simulate existing project assignment logic
			if (settings.defaultProjects) {
				projectsArray.push(
					...settings.defaultProjects.split(",").map((p) => p.trim())
				);
			}

			if (settings.useParentNoteAsProject) {
				projectsArray.push(parentNote);
			}

			// NEW: Header-based project
			if (settings.useParentHeaderAsProject) {
				const parentHeading = findParentHeading(headings, taskLine);
				if (parentHeading) {
					const project = extractProjectFromHeading(parentHeading.heading);
					if (project && !projectsArray.includes(project)) {
						projectsArray.push(project);
					}
				}
			}

			expect(projectsArray).toContain("[[Always Applied]]");
			expect(projectsArray).toContain("[[Daily Note 2025-09-24]]");
			expect(projectsArray).toContain("[[Header Project]]");
			expect(projectsArray).toHaveLength(3);
		});

		it.skip("should not duplicate project if header matches existing - reproduces issue #726", () => {
			const settings: MockTaskCreationDefaults = {
				useParentNoteAsProject: false,
				useParentHeaderAsProject: true,
				defaultProjects: "[[Project A]]", // Same as header
			};

			const headings: MockHeading[] = [
				{
					heading: "[[Project A]]",
					level: 2,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 16, offset: 16 },
					},
				},
			];

			const taskLine = 2;
			const projectsArray: string[] = [];

			if (settings.defaultProjects) {
				projectsArray.push(
					...settings.defaultProjects.split(",").map((p) => p.trim())
				);
			}

			if (settings.useParentHeaderAsProject) {
				const parentHeading = findParentHeading(headings, taskLine);
				if (parentHeading) {
					const project = extractProjectFromHeading(parentHeading.heading);
					// Avoid duplicates
					if (project && !projectsArray.includes(project)) {
						projectsArray.push(project);
					}
				}
			}

			expect(projectsArray).toEqual(["[[Project A]]"]);
			expect(projectsArray).toHaveLength(1); // No duplicate
		});
	});

	describe("Edge cases", () => {
		it.skip("should handle task on same line as heading - reproduces issue #726", () => {
			// Unusual but possible: task on the same line number as heading
			// In this case, don't use the heading on the same line
			const headings: MockHeading[] = [
				{
					heading: "Project",
					level: 2,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 10, offset: 10 },
					},
				},
			];

			const taskLine = 0; // Same line as heading
			const parentHeading = findParentHeading(headings, taskLine);

			// Should not include heading on same line
			expect(parentHeading).toBeNull();
		});

		it.skip("should handle date-only headers gracefully - reproduces issue #726", () => {
			// User might have date headers that shouldn't be projects
			const heading = "2025-09-24";
			const project = extractProjectFromHeading(heading);

			// Returns the date as project - user would need to filter this
			// or implementation could have option to skip date-only headers
			expect(project).toBe("2025-09-24");
		});

		it.skip("should handle special characters in heading - reproduces issue #726", () => {
			const heading = "[[Project: Alpha & Beta (Phase 1)]]";
			const project = extractProjectFromHeading(heading);

			expect(project).toBe("[[Project: Alpha & Beta (Phase 1)]]");
		});

		it.skip("should handle very long headings - reproduces issue #726", () => {
			const heading = "[[" + "A".repeat(200) + "]]";
			const project = extractProjectFromHeading(heading);

			expect(project).toBe(heading);
		});
	});

	describe("Header level filtering (future enhancement)", () => {
		it.skip("should support filtering by header level - reproduces issue #726", () => {
			// Future enhancement: allow users to specify which header levels to use
			// e.g., "Only use ## headers as projects"

			interface HeaderLevelFilter {
				minLevel: number;
				maxLevel: number;
			}

			const filter: HeaderLevelFilter = {
				minLevel: 2,
				maxLevel: 2, // Only ## headers
			};

			const headings: MockHeading[] = [
				{
					heading: "Daily Note",
					level: 1,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 12, offset: 12 },
					},
				},
				{
					heading: "[[Project A]]",
					level: 2,
					position: {
						start: { line: 1, col: 0, offset: 13 },
						end: { line: 1, col: 16, offset: 29 },
					},
				},
				{
					heading: "Sub-task area",
					level: 3,
					position: {
						start: { line: 2, col: 0, offset: 30 },
						end: { line: 2, col: 17, offset: 47 },
					},
				},
			];

			const taskLine = 3;

			// Filter headings by level
			const filteredHeadings = headings.filter(
				(h) => h.level >= filter.minLevel && h.level <= filter.maxLevel
			);
			const parentHeading = findParentHeading(filteredHeadings, taskLine);

			expect(parentHeading).not.toBeNull();
			expect(parentHeading!.heading).toBe("[[Project A]]");
			expect(parentHeading!.level).toBe(2);
		});
	});
});
