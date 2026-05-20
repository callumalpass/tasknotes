/**
 * Reproduction tests for Issue #1639: Task link overlay doesn't respect
 * "disable overlay for aliased tasks" setting in reading mode.
 *
 * Bug: When "Task link overlay" and "Disable overlay for aliased links" are
 * both enabled, aliased task links still show the overlay in reading mode.
 * Live preview mode correctly hides the overlay for aliased links.
 *
 * Root cause:
 * - `src/editor/ReadingModeTaskLinkProcessor.ts` lines 167-175 check for aliases
 *   by comparing `linkEl.textContent` against `originalLinkPath` and `taskInfo.title`.
 * - In reading mode, Obsidian renders `[[task|My Alias]]` as:
 *   `<a class="internal-link" href="task">My Alias</a>`
 * - The `originalLinkPath` is derived from `href` (e.g., "task") and the
 *   `textContent` is "My Alias".
 * - The check `currentText !== originalLinkPath && currentText !== taskInfo.title`
 *   can fail when the task title matches the alias text, or when path resolution
 *   alters the link path format.
 *
 * Related files:
 * - src/editor/ReadingModeTaskLinkProcessor.ts (alias detection logic, lines 167-175)
 * - src/editor/TaskLinkOverlay.ts (live preview mode, works correctly)
 */

import { describe, expect, it } from "@jest/globals";
import {
	consumeReadingModeSourceLink,
	parseReadingModeSourceLinks,
	shouldSkipReadingModeTaskLinkOverlay,
	type ReadingModeSourceLinkCursor,
} from "../../../src/editor/ReadingModeTaskLinkProcessor";

describe("Issue #1639: Task link overlay ignores alias setting in reading mode", () => {
	it("uses reading-mode source text to detect explicit wikilink aliases", () => {
		const links = parseReadingModeSourceLinks(
			[
				"[[Tasks/My Task|My Task]]",
				"[[Tasks/My Task]]",
				"![[Tasks/Embedded Task|Embedded Alias]]",
			].join("\n")
		);
		const cursor: ReadingModeSourceLinkCursor = { index: 0 };

		const aliased = consumeReadingModeSourceLink(links, cursor, "Tasks/My Task.md");
		const plain = consumeReadingModeSourceLink(links, cursor, "Tasks/My Task");

		expect(aliased).toEqual({
			target: "Tasks/My Task",
			hasAlias: true,
		});
		expect(plain).toEqual({
			target: "Tasks/My Task",
			hasAlias: false,
		});
	});

	it("consumes repeated links to the same task in source order", () => {
		const links = parseReadingModeSourceLinks(
			[
				"[[Tasks/My Task|Custom Alias]]",
				"[[Tasks/My Task|My Task]]",
				"[[Tasks/My Task]]",
			].join("\n")
		);
		const cursor: ReadingModeSourceLinkCursor = { index: 0 };

		expect(consumeReadingModeSourceLink(links, cursor, "My Task")?.hasAlias).toBe(
			true
		);
		expect(consumeReadingModeSourceLink(links, cursor, "My Task")?.hasAlias).toBe(
			true
		);
		expect(consumeReadingModeSourceLink(links, cursor, "My Task")?.hasAlias).toBe(
			false
		);
	});

	it("skips an explicitly aliased reading-mode link even when the alias matches the task title", () => {
		const shouldSkip = shouldSkipReadingModeTaskLinkOverlay({
			disableOverlayOnAlias: true,
			hasExplicitAlias: true,
			linkText: "My Task",
			originalLinkPath: "Tasks/My Task",
			taskTitle: "My Task",
		});

		expect(shouldSkip).toBe(true);
	});

	it("keeps non-aliased reading-mode links eligible for overlay", () => {
		const shouldSkip = shouldSkipReadingModeTaskLinkOverlay({
			disableOverlayOnAlias: true,
			hasExplicitAlias: false,
			linkText: "My Task",
			originalLinkPath: "Tasks/My Task",
			taskTitle: "My Task",
		});

		expect(shouldSkip).toBe(false);
	});

	it("keeps generated markdown filename labels eligible for overlay", () => {
		const shouldSkip = shouldSkipReadingModeTaskLinkOverlay({
			disableOverlayOnAlias: true,
			hasExplicitAlias: false,
			linkText: "task-202601051431",
			originalLinkPath: "../../tasks/2026/01/task-202601051431.md",
			taskPath: "tasks/2026/01/task-202601051431.md",
			taskTitle: "Write release notes",
		});

		expect(shouldSkip).toBe(false);
	});

	it("keeps the legacy fallback for custom rendered link text when source metadata is unavailable", () => {
		const shouldSkip = shouldSkipReadingModeTaskLinkOverlay({
			disableOverlayOnAlias: true,
			hasExplicitAlias: false,
			linkText: "Custom Name",
			originalLinkPath: "Tasks/My Task",
			taskTitle: "My Task",
		});

		expect(shouldSkip).toBe(true);
	});
});
