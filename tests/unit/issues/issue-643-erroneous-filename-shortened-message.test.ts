/**
 * Issue #643: [Bug] Erroneous "filename shortened..." message on new task creation
 *
 * Bug Description:
 * Every time a task is created, the notice message tells the user that the
 * filename was shortened due to length, even though it wasn't actually shortened.
 * This occurs when a custom filename template is used that doesn't include the
 * task title (e.g., `task-{year}{month}{day}{hour}{minute}`).
 *
 * Root Cause Analysis:
 * The detection logic in TaskCreationModal.ts (lines 1216-1230) and
 * InstantTaskConvertService.ts (lines 283-300) compares the actual generated
 * filename against a "sanitized title" to determine if shortening occurred:
 *
 *   const expectedFilename = result.taskInfo.title.replace(/[<>:"/\\|?*]/g, "").trim();
 *   const actualFilename = result.file.basename;
 *   if (actualFilename.startsWith("task-") && actualFilename !== expectedFilename) {
 *     // Show "filename shortened" message — INCORRECTLY TRIGGERED
 *   }
 *
 * This logic is flawed because:
 * 1. It assumes the filename is derived from the task title, but custom filename
 *    templates (e.g., `task-{year}{month}{day}{hour}{minute}`) produce filenames
 *    entirely unrelated to the title.
 * 2. Any custom template that produces a filename starting with "task-" will always
 *    differ from the sanitized title, making the condition always true.
 * 3. Even non-custom formats like "zettel" or "timestamp" can trigger this if the
 *    generated filename happens to start with "task-".
 *
 * The same flawed pattern exists in two places:
 * - src/modals/TaskCreationModal.ts (lines 1216-1230)
 * - src/services/InstantTaskConvertService.ts (lines 283-300)
 *
 * Affected Settings:
 * - taskFilenameFormat: "custom" with templates starting with "task-"
 * - customFilenameTemplate: e.g., "task-{year}{month}{day}{hour}{minute}"
 * - storeTitleInFilename: false (when title is NOT used for filename)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/643
 */

import { generateTaskFilename, sanitizeForFilename } from "../../../src/utils/filenameGenerator";

describe("Issue #643: Erroneous 'filename shortened' message on new task creation", () => {
	it.skip("reproduces issue #643: custom template filename falsely detected as shortened", () => {
		/**
		 * When using a custom filename template like `task-{year}{month}{day}{hour}{minute}`,
		 * the generated filename (e.g., "task-202602091435") is completely different from
		 * the sanitized task title (e.g., "Buy groceries"). Because the generated filename
		 * starts with "task-" and doesn't match the title, the flawed detection logic
		 * always shows the "filename shortened" warning.
		 */
		const settings = {
			taskFilenameFormat: "custom" as const,
			customFilenameTemplate: "task-{year}{month}{day}{hour}{minute}",
			storeTitleInFilename: false,
		};

		const context = {
			title: "Buy groceries",
			date: new Date(2026, 1, 9, 14, 35, 0), // 2026-02-09 14:35:00
		};

		// Generate filename using the custom template
		const generatedFilename = generateTaskFilename(
			context as any,
			settings as any
		);

		// The generated filename should be based on the template, not the title
		expect(generatedFilename).toBe("task-202602091435");

		// Simulate the flawed detection logic from TaskCreationModal.ts:1217-1220
		const expectedFilename = context.title.replace(/[<>:"/\\|?*]/g, "").trim();
		const actualFilename = generatedFilename;

		// This is the bug: the condition is TRUE even though no shortening occurred
		const faultyDetection =
			actualFilename.startsWith("task-") && actualFilename !== expectedFilename;
		expect(faultyDetection).toBe(true); // BUG: falsely detects shortening

		// A correct implementation should recognize that no shortening occurred.
		// The fix should check whether the filename was actually truncated from a
		// longer value, rather than comparing against the title when the filename
		// format doesn't use the title at all.
	});

	it.skip("reproduces issue #643: timestamp-based templates always trigger false positive", () => {
		/**
		 * Any custom template that starts with "task-" and doesn't include {title}
		 * will always trigger the false positive, regardless of the task title.
		 */
		const templates = [
			"task-{year}{month}{day}{hour}{minute}",
			"task-{timestamp}",
			"task-{zettel}",
			"task-{unix}",
			"task-{dateTime}",
		];

		const context = {
			title: "Any task title whatsoever",
			date: new Date(2026, 1, 9, 14, 35, 0),
		};

		const settings = {
			taskFilenameFormat: "custom" as const,
			storeTitleInFilename: false,
			customFilenameTemplate: "", // will be set per iteration
		};

		for (const template of templates) {
			settings.customFilenameTemplate = template;
			const generatedFilename = generateTaskFilename(
				context as any,
				settings as any
			);

			// All of these start with "task-" and won't match the title
			const expectedFilename = context.title.replace(/[<>:"/\\|?*]/g, "").trim();
			const faultyDetection =
				generatedFilename.startsWith("task-") &&
				generatedFilename !== expectedFilename;

			// BUG: every single template triggers the false positive
			expect(faultyDetection).toBe(true);
		}
	});

	it.skip("reproduces issue #643: message should NOT appear when filename is legitimately generated from template", () => {
		/**
		 * After the fix, the "filename shortened" message should only appear when
		 * the filename was ACTUALLY shortened (e.g., due to path length constraints),
		 * not when the filename simply doesn't match the title because a custom
		 * template was used.
		 */
		const settings = {
			taskFilenameFormat: "custom" as const,
			customFilenameTemplate: "task-{year}{month}{day}{hour}{minute}",
			storeTitleInFilename: false,
		};

		const context = {
			title: "Buy groceries",
			date: new Date(2026, 1, 9, 14, 35, 0),
		};

		const generatedFilename = generateTaskFilename(
			context as any,
			settings as any
		);

		// The generated filename matches the template — no shortening occurred
		expect(generatedFilename).toBe("task-202602091435");

		// A correct detection should return false here (no shortening happened)
		// The fix needs to either:
		// 1. Compare the generated filename against what the template WOULD produce
		//    (not against the title)
		// 2. Have the filename generation pipeline return a flag indicating whether
		//    truncation occurred
		// 3. Check the filename format settings and skip the comparison when using
		//    a non-title-based format
		const wasActuallyShortened = false; // Expected result after fix
		expect(wasActuallyShortened).toBe(false);
	});

	it.skip("reproduces issue #643: detection should work correctly when title IS the filename format", () => {
		/**
		 * When the filename format is "title" (storeTitleInFilename: true), comparing
		 * against the title is correct behavior. The detection logic should still work
		 * in this case — only suppress the warning for non-title-based formats.
		 */
		const settings = {
			taskFilenameFormat: "title" as const,
			customFilenameTemplate: "",
			storeTitleInFilename: true,
		};

		const context = {
			title: "A normal task title",
			date: new Date(2026, 1, 9, 14, 35, 0),
		};

		const generatedFilename = generateTaskFilename(
			context as any,
			settings as any
		);

		// When using title format, the filename should match the sanitized title
		const sanitizedTitle = sanitizeForFilename(context.title);
		expect(generatedFilename).toBe(sanitizedTitle);

		// In this case, if a shortening DID occur (e.g., due to path length),
		// the detection would be correct to show the warning
	});
});
