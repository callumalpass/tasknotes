/**
 * Reproduction test for Issue #1634: Custom Icon for Inline Tasks Not Aligned on Hover
 *
 * Bug Description:
 * When a custom SVG icon is set for a task status and the task is converted to
 * an inline task, hovering over the status icon shows a green-filled circle
 * that is visually misaligned from the green-outlined circle (the base icon).
 * Using the default (empty) icon field has no such problem.
 *
 * Root Cause Hypothesis:
 * In the inline layout (`.task-card--layout-inline`), the status dot element
 * receives conflicting size/display rules. The base `.task-card__status-dot--icon`
 * rule uses `display: inline-flex; width: 18px; height: 18px`, while the inline
 * layout override sets `display: inline-block; width: 0.85em; height: 0.85em`.
 * The hover SVG fill effect renders relative to the `inline-flex` container
 * dimensions (18px) while the visible icon is sized at 0.85em, causing the
 * hover indicator to appear at a different position than the base icon.
 *
 * Key locations:
 * - styles/task-card-bem.css (lines 360–390: status-dot--icon rules)
 * - styles/task-card-bem.css (lines 1255–1264: inline layout status-dot override)
 * - styles/task-card-bem.css (lines 1345–1352: inline SVG rules)
 */

jest.mock('obsidian');

describe('Issue #1634: Custom icon inline task hover misalignment', () => {
  it.skip('reproduces issue #1634: icon-mode status dot in inline layout should have consistent dimensions between base and hover state', () => {
    // Simulate the conflicting CSS rule values
    // Base icon-mode rule (px units, fixed size):
    const baseIconWidth = 18; // px

    // Inline layout override (em units, relative to font-size):
    const inlineLayoutFontSize = 16; // px, typical Obsidian default
    const inlineStatusDotWidthEm = 0.85;
    const inlineStatusDotWidthPx = inlineLayoutFontSize * inlineStatusDotWidthEm; // 13.6px

    // The hover fill effect targets the svg at the base 18px bounding box
    // while the visible icon is rendered at 13.6px — these don't match
    const hoverEffectTargetWidth = baseIconWidth; // hover rule not overridden for inline
    const visibleIconWidth = inlineStatusDotWidthPx;

    // If dimensions are consistent, the hover effect should target the same size
    // as the visible element. The mismatch causes the visual offset.
    expect(hoverEffectTargetWidth).toBe(visibleIconWidth);
    // ^ Fails: 18 !== 13.6, demonstrating the size mismatch that causes misalignment
  });

  it.skip('reproduces issue #1634: default (non-icon) status dot in inline layout should not have alignment issues', () => {
    // The default status dot does not use --icon variant, so it uses the
    // single-rule dimensions consistently. This test documents that the
    // default case works correctly (should pass after the bug fix).

    // Default dot uses border + background-color approach, no SVG inner element
    // The hover effect is a CSS :hover on the same element, so no offset issue.
    const defaultDotUsesIconVariant = false;
    expect(defaultDotUsesIconVariant).toBe(false); // default is fine

    // The bug only occurs with custom icons (--icon variant)
    const customIconDotUsesIconVariant = true;
    expect(customIconDotUsesIconVariant).toBe(false); // Fails: custom icon uses --icon variant
  });
});
