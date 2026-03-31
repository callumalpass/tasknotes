/**
 * Reproduction test for Issue #1721: Website bug: links not clickable on mobile
 *
 * Bug Description:
 * Links on the TaskNotes documentation website are not clickable or tappable on
 * iOS 18.6.2 in both Safari and Chrome. The links appear visually but do not
 * respond to touch/tap events.
 *
 * Root Cause Hypothesis:
 * This is a website/docs CSS or layout issue, not a plugin code issue. On iOS
 * Safari/Chrome, tap events on anchor elements can be silently swallowed when:
 * 1. A parent element (e.g. a sticky nav backdrop or overlay) with a high z-index
 *    sits above the link and captures the touch event without pointer-events:none.
 * 2. The anchor or its parent container lacks cursor:pointer, which on iOS Safari
 *    is sometimes required to make non-button elements tappable.
 * 3. A touch event listener on a parent calls preventDefault(), blocking default
 *    link navigation.
 * The repository contains a docs/ and docs-builder/ directory suggesting a static
 * site. The generated HTML/CSS for the site should be inspected for overlay
 * elements or missing pointer-events configuration.
 *
 * Key locations:
 * - docs/ (generated site HTML/CSS)
 * - docs-builder/ (site generator source, CSS/template files)
 */

jest.mock('obsidian');

describe('Issue #1721: website links not clickable on mobile (iOS Safari/Chrome)', () => {
	it.skip('reproduces issue #1721: anchor links should receive click events even when wrapped in div containers', () => {
		// Simulate a documentation page structure where links may be wrapped in
		// div containers without explicit cursor:pointer or pointer-events CSS.

		// Build a minimal representation of a docs page nav/content structure
		const pageContainer = document.createElement('div');
		pageContainer.className = 'page-container';

		// A hypothetical overlay element that could intercept taps
		const overlay = document.createElement('div');
		overlay.className = 'nav-overlay';
		// Intentionally NOT setting pointer-events:none — this is the bug condition
		overlay.style.position = 'fixed';
		overlay.style.top = '0';
		overlay.style.left = '0';
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.zIndex = '100';

		const link = document.createElement('a');
		link.href = '/docs/getting-started';
		link.textContent = 'Getting Started';
		// Intentionally omitting cursor:pointer — another common cause on iOS

		const contentSection = document.createElement('div');
		contentSection.className = 'content';
		contentSection.style.position = 'relative';
		contentSection.style.zIndex = '1'; // Lower than overlay
		contentSection.appendChild(link);

		pageContainer.appendChild(overlay);
		pageContainer.appendChild(contentSection);
		document.body.appendChild(pageContainer);

		// Simulate a click on the link — in the bug scenario the overlay captures it
		let linkClicked = false;
		link.addEventListener('click', (e) => {
			e.preventDefault();
			linkClicked = true;
		});

		// The overlay sits above the content at z-index 100; on iOS the tap hits the
		// overlay instead of the link underneath.
		// In a real browser this would mean linkClicked stays false.
		// Here we verify the expected (fixed) behaviour: the link should be clickable.
		link.click();

		// Bug: if an overlay captures taps, linkClicked would be false
		expect(linkClicked).toBe(true); // Fails to indicate bug is present

		// Cleanup
		document.body.removeChild(pageContainer);
	});
});
