import { configureThemeColorInput } from "../../../src/settings/components/CardComponent";

describe("Issue #1922: timeblock theme color inputs keep native picker", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	function createAttachedColorTextInput(value: string): HTMLInputElement {
		const container = document.createElement("div");
		const input = document.createElement("input");
		input.value = value;
		container.appendChild(input);
		document.body.appendChild(container);
		return input;
	}

	function getNativePicker(input: HTMLInputElement): HTMLInputElement {
		const picker = input.nextElementSibling;
		expect(picker).toBeInstanceOf(HTMLInputElement);
		expect(picker?.classList.contains("tasknotes-theme-color-picker")).toBe(true);
		expect((picker as HTMLInputElement).type).toBe("color");
		return picker as HTMLInputElement;
	}

	it("adds a native picker next to the text field while keeping theme-color suggestions", () => {
		const input = createAttachedColorTextInput("#8B5CF6");

		configureThemeColorInput(input);

		const picker = getNativePicker(input);
		expect(input.type).toBe("text");
		expect(input.classList.contains("tasknotes-theme-color-text-input")).toBe(true);
		expect(input.getAttribute("list")).toBe("tasknotes-theme-color-options");
		expect(document.getElementById("tasknotes-theme-color-options")).not.toBeNull();
		expect(picker.value).toBe("#8b5cf6");
	});

	it("writes native picker selections back to the text input", () => {
		const input = createAttachedColorTextInput("#8b5cf6");
		const inputListener = jest.fn();
		const changeListener = jest.fn();
		input.addEventListener("input", inputListener);
		input.addEventListener("change", changeListener);
		configureThemeColorInput(input);
		const picker = getNativePicker(input);

		picker.value = "#123abc";
		picker.dispatchEvent(new Event("input", { bubbles: true }));

		expect(input.value).toBe("#123abc");
		expect(inputListener).toHaveBeenCalledTimes(1);
		expect(changeListener).toHaveBeenCalledTimes(1);
	});

	it("syncs manual hex edits into the native picker without clobbering theme tokens", () => {
		const input = createAttachedColorTextInput("accent");
		configureThemeColorInput(input);
		const picker = getNativePicker(input);

		expect(picker.value).toBe("#6366f1");

		input.value = "#abc";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(picker.value).toBe("#aabbcc");

		input.value = "red";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(input.value).toBe("red");
		expect(picker.value).toBe("#aabbcc");
	});

	it("does not duplicate the native picker when the input is configured again", () => {
		const input = createAttachedColorTextInput("#8b5cf6");

		configureThemeColorInput(input);
		configureThemeColorInput(input);

		expect(
			input.parentElement?.querySelectorAll(".tasknotes-theme-color-picker")
		).toHaveLength(1);
	});
});
