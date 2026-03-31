/**
 * Reproduction test for Issue #1630: Task cards do not respect "Readable line length"
 *
 * Bug Description:
 * When using the Minimal theme with "Readable line length" enabled in Obsidian,
 * TaskNotes task card containers span the full editor/pane width instead of
 * inheriting the constrained content column. The card aligns to the far left
 * margin instead of centering with the rest of the note's content.
 *
 * Root Cause Hypothesis:
 * The task card container element uses width: 100% relative to the editor leaf
 * rather than inheriting the inline content flow. Obsidian/Minimal theme expresses
 * the line-length constraint via --file-line-width CSS variable on .cm-content,
 * but the plugin's card wrapper may not respect this variable or may be positioned
 * outside the constrained content column (e.g., as a block-level element that
 * stretches to the full leaf width).
 *
 * Key locations:
 * - styles/task-card-bem.css (outermost task card wrapper styles)
 * - styles/base.css (task card container positioning)
 */

jest.mock('obsidian');

describe('Issue #1630: Task card readable line length', () => {
  it.skip('reproduces issue #1630: task card container should not exceed --file-line-width', () => {
    // Simulate the CSS variable approach used by Minimal theme
    // The readable line length is set via --file-line-width (e.g., 700px)
    const fileLineWidth = 700; // px, typical Minimal theme value
    const editorPaneWidth = 1343; // px, from the reporter's screenshot

    // A correctly-constrained card should not be wider than fileLineWidth
    // Simulate a container that uses width: 100% of the editor pane (the bug):
    const buggyCardWidth = editorPaneWidth; // stretches to full pane width

    // Correctly constrained card should be at most fileLineWidth:
    expect(buggyCardWidth).toBeLessThanOrEqual(fileLineWidth);
    // ^ Fails: buggyCardWidth (1343) > fileLineWidth (700), demonstrating the bug
  });

  it.skip('reproduces issue #1630: task card should inherit content column centering', () => {
    // The card should be centered within the editor, not left-aligned to the pane edge.
    // Simulate positioning: if the pane is 1343px and the content column is 700px,
    // the left margin should be (1343 - 700) / 2 = 321.5px to center it.

    const editorPaneWidth = 1343;
    const fileLineWidth = 700;
    const expectedLeftOffset = (editorPaneWidth - fileLineWidth) / 2; // ~321px

    // Bug: card is rendered with left offset of 0 (aligned to pane left edge)
    const buggyLeftOffset = 0;

    expect(buggyLeftOffset).toBeGreaterThan(0);
    // ^ Fails: left offset is 0, demonstrating the card does not center correctly
  });
});
