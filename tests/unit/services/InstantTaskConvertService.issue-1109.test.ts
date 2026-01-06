/**
 * InstantTaskConvertService Issue #1109 Tests
 *
 * Bug: Instant Task Convert breaks links
 *
 * When converting a checklist item containing markdown links or wikilinks
 * to a TaskNote, the links are destroyed due to filename sanitization
 * removing brackets and special characters.
 *
 * Example from issue:
 * Before: `- [ ] Alfred: Make quick way to change display resolution ([Resolution Changer](https://alfred.app/workflows/firefingers21/resolution-changer/))`
 * After:  `- [[Alfred Make quick way to change display resolution (Resolution Changer(httpsalfred.appworkflowsfirefingers21resolution-changer))-3]]`
 *
 * Root cause:
 * TaskService.sanitizeTitleForFilename (line 63-96) and filenameGenerator.sanitizeForFilename
 * both use this regex: .replace(/[<>:"/\\|?*#[\]]/g, "")
 * This strips [], which destroys markdown link syntax [text](url) and wikilinks [[note]].
 * The sanitized title is stored in frontmatter, so the link information is completely lost.
 *
 * Expected behavior:
 * 1. Links should be preserved in the task body
 * 2. Link display text should be kept in the title (without the URL)
 */

import { sanitizeForFilename } from '../../../src/utils/filenameGenerator';

/**
 * Tests documenting Issue #1109: Instant Task Convert breaks links
 *
 * These tests verify that the sanitization functions strip link syntax,
 * demonstrating the bug. The skipped tests document the expected behavior
 * once the bug is fixed.
 */
describe('InstantTaskConvertService - Issue #1109: Link Preservation', () => {
	/**
	 * These tests directly test sanitizeForFilename to demonstrate
	 * how it destroys link syntax - this is the root cause of the bug.
	 */
	describe('sanitizeForFilename destroys links (documenting the bug)', () => {
		it('strips markdown link brackets, destroying the link syntax', () => {
			// The exact example from the issue
			const input =
				'Alfred: Make quick way to change display resolution ([Resolution Changer](https://alfred.app/workflows/firefingers21/resolution-changer/))';

			const result = sanitizeForFilename(input);

			// Brackets are stripped, URL is mangled
			expect(result).not.toContain('[');
			expect(result).not.toContain(']');
			// URL slashes are removed because / is stripped
			expect(result).not.toContain('https://');

			// What we actually get (documenting the broken output)
			expect(result).toContain('Resolution Changer');
			expect(result).toContain('httpsalfred.appworkflowsfirefingers21resolution-changer');
		});

		it('strips wikilink double brackets', () => {
			const input = 'Review [[Meeting Notes 2024-01-15]]';

			const result = sanitizeForFilename(input);

			// Double brackets are stripped
			expect(result).not.toContain('[[');
			expect(result).not.toContain(']]');

			// The note name is preserved but no longer a valid link
			expect(result).toBe('Review Meeting Notes 2024-01-15');
		});

		it('strips wikilink with alias', () => {
			const input = 'Follow up on [[projects/Q1 Planning|Q1 Planning]]';

			const result = sanitizeForFilename(input);

			// Brackets, pipe, and slashes are all stripped
			expect(result).not.toContain('[[');
			expect(result).not.toContain(']]');
			expect(result).not.toContain('|');

			// Path is mangled - slashes removed, link structure destroyed
			// The result is: "Follow up on projectsQ1 PlanningQ1 Planning"
			expect(result).toContain('projectsQ1 Planning');
		});

		it('mangles URLs in markdown links', () => {
			const input = 'Check [docs](https://example.com/path?query=1)';

			const result = sanitizeForFilename(input);

			// URL is completely mangled
			expect(result).not.toContain('https://');
			expect(result).not.toContain('?'); // Query string symbol stripped
		});

		it('handles multiple links by destroying all of them', () => {
			const input = 'See [[Note A]] and [Link](https://example.com)';

			const result = sanitizeForFilename(input);

			// All link syntax destroyed
			expect(result).not.toContain('[[');
			expect(result).not.toContain('[');
			expect(result).not.toContain('https://');
		});
	});

	/**
	 * These tests document what the expected behavior SHOULD be after the fix.
	 * They are skipped until the fix is implemented.
	 */
	describe('Expected behavior after fix (skipped until implemented)', () => {
		it.skip('should extract markdown link display text for title, preserve URL in body', () => {
			// When fixed, we should have a function that:
			// 1. Extracts markdown links from the title
			// 2. Replaces [text](url) with just "text" in the title
			// 3. Preserves the full [text](url) in the task body/details

			const input =
				'Alfred: Make quick way to change display resolution ([Resolution Changer](https://alfred.app/workflows/firefingers21/resolution-changer/))';

			// Expected title (with link display text preserved, URL removed)
			const expectedTitle =
				'Alfred: Make quick way to change display resolution (Resolution Changer)';

			// Expected body/details (should contain the full link)
			const expectedLinkInBody =
				'[Resolution Changer](https://alfred.app/workflows/firefingers21/resolution-changer/)';

			// TODO: Implement extractLinksFromTitle function that returns { cleanTitle, links }
		});

		it.skip('should preserve wikilinks in task body', () => {
			const input = 'Review [[Meeting Notes 2024-01-15]]';

			// For wikilinks, the expected behavior could be:
			// Title: "Review Meeting Notes 2024-01-15" (display text only)
			// Body: Contains the wikilink [[Meeting Notes 2024-01-15]]

			// TODO: Implement wikilink extraction
		});

		it.skip('should handle multiple mixed link types', () => {
			const input = 'See [[Project Notes]] and [external docs](https://docs.example.com)';

			// Expected title: "See Project Notes and external docs"
			// Expected body: Should contain both links

			// TODO: Implement mixed link extraction
		});
	});
});
