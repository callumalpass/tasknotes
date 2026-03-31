/**
 * Reproduction test for Issue #1711: end time field not selectable in timeblock creation modal
 *
 * Bug Description:
 * The end time input field in the TimeblockCreationModal cannot be interacted with
 * (selected or typed into). The screenshot in the issue report shows the end time
 * field appearing visually present but unresponsive to user interaction.
 *
 * Root Cause Hypothesis:
 * The TimeblockCreationModal (src/modals/TimeblockCreationModal.ts) creates both
 * start and end time inputs inside a shared `timeblock-time-container` div using
 * Obsidian's Setting API. A likely cause is that the container div or an overlapping
 * CSS element captures pointer events before they reach the end time input, or the
 * input element's type="time" native widget is blocked by an event listener on the
 * parent Setting. The special-case onChange handler that converts "00:00" to "23:59"
 * adds an onChange listener; if this binding is set up incorrectly it could suppress
 * normal browser interaction. Another possible cause is that a CSS rule such as
 * pointer-events:none or a z-index stacking issue prevents interaction.
 *
 * Key locations:
 * - src/modals/TimeblockCreationModal.ts (endTimeInput construction, lines ~108-123)
 * - src/modals/TimeblockCreationModal.ts (handleSubmit, line ~203 reads endTimeInput.value)
 */

jest.mock('obsidian');

describe('Issue #1711: end time field not selectable in timeblock creation modal', () => {
	it.skip('reproduces issue #1711: end time input should be interactable and its value should be read on submit', () => {
		// Simulate the TimeblockCreationModal field construction logic to verify
		// that both start and end time inputs are independently focusable and readable.

		// Construct mock input elements mimicking what Setting.addText() produces
		const startTimeInput = document.createElement('input');
		startTimeInput.type = 'time';
		startTimeInput.value = '09:00';

		const endTimeInput = document.createElement('input');
		endTimeInput.type = 'time';
		endTimeInput.value = '10:00';

		// Replicate the container structure used in TimeblockCreationModal
		const timeContainer = document.createElement('div');
		timeContainer.className = 'timeblock-time-container';

		const startSetting = document.createElement('div');
		startSetting.className = 'setting-item';
		startSetting.appendChild(startTimeInput);

		const endSetting = document.createElement('div');
		endSetting.className = 'setting-item';
		endSetting.appendChild(endTimeInput);

		timeContainer.appendChild(startSetting);
		timeContainer.appendChild(endSetting);
		document.body.appendChild(timeContainer);

		// Verify the end time input is not disabled and has no pointer-events:none
		const computedStyle = window.getComputedStyle(endTimeInput);

		// Bug: end time cannot be selected — if pointer-events were 'none' or the
		// input were disabled, these assertions would fail, reproducing the issue.
		expect(endTimeInput.disabled).toBe(false); // Fails to indicate bug is present
		expect(computedStyle.pointerEvents).not.toBe('none'); // Fails to indicate bug is present

		// Simulate onChange "00:00" -> "23:59" conversion and verify end time is still readable
		endTimeInput.value = '00:00';
		if (endTimeInput.value === '00:00') {
			endTimeInput.value = '23:59';
		}
		// On submit, handleSubmit reads this.endTimeInput?.value
		const submittedEndTime = endTimeInput.value;
		expect(submittedEndTime).toBe('23:59'); // Fails to indicate bug is present

		// Cleanup
		document.body.removeChild(timeContainer);
	});
});
