import {
	bindTaskModalTitleInput,
	createTaskModalTitleTextarea,
	normalizeTaskModalTitleValue,
	resizeTaskModalTitleTextarea,
	setTaskModalTitleTextareaCssProps,
} from "../../../src/modals/taskModalTitleInput";

describe("taskModalTitleInput", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("creates a single-line textarea with accessibility attributes and focus guard wiring", () => {
		const container = document.createElement("div");
		const onChange = jest.fn();
		const attachFocusScrollGuard = jest.fn();

		const input = createTaskModalTitleTextarea({
			container,
			className: "title-input",
			placeholder: "Task title",
			value: "Initial title",
			onChange,
			attachFocusScrollGuard,
		});

		expect(input.tagName).toBe("TEXTAREA");
		expect(input.classList.contains("title-input")).toBe(true);
		expect(input.placeholder).toBe("Task title");
		expect(input.value).toBe("Initial title");
		expect(input.rows).toBe(1);
		expect(input.spellcheck).toBe(true);
		expect(input.getAttribute("aria-label")).toBe("Task title");
		expect(container.querySelector("textarea")).toBe(input);
		expect(attachFocusScrollGuard).toHaveBeenCalledWith(input);
	});

	it("prevents plain Enter in title textareas but allows submit shortcuts", () => {
		const input = createTaskModalTitleTextarea({
			container: document.createElement("div"),
			className: "title-input",
			placeholder: "Task title",
			value: "",
			onChange: jest.fn(),
		});

		const plainEnter = new KeyboardEvent("keydown", {
			key: "Enter",
			bubbles: true,
			cancelable: true,
		});
		const ctrlEnter = new KeyboardEvent("keydown", {
			key: "Enter",
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});

		input.dispatchEvent(plainEnter);
		input.dispatchEvent(ctrlEnter);

		expect(plainEnter.defaultPrevented).toBe(true);
		expect(ctrlEnter.defaultPrevented).toBe(false);
	});

	it("normalizes multiline input before updating modal state", () => {
		const input = document.createElement("textarea");
		const onChange = jest.fn();
		bindTaskModalTitleInput(input, {
			value: "Before",
			onChange,
		});

		input.value = "Alpha \n\n Beta\nGamma";
		input.dispatchEvent(new Event("input", { bubbles: true }));

		expect(input.value).toBe("Alpha Beta Gamma");
		expect(onChange).toHaveBeenCalledWith("Alpha Beta Gamma");
		expect(normalizeTaskModalTitleValue("One\n Two")).toBe("One Two");
	});

	it("resizes textarea height with overflow when content exceeds three lines", () => {
		const input = document.createElement("textarea");
		input.style.lineHeight = "20px";
		input.style.paddingTop = "2px";
		input.style.paddingBottom = "2px";
		input.style.borderTopWidth = "0px";
		input.style.borderBottomWidth = "0px";
		Object.defineProperty(input, "scrollHeight", {
			configurable: true,
			value: 120,
		});

		resizeTaskModalTitleTextarea(input);

		expect(input.style.getPropertyValue("--tn-task-modal-title-height")).toBe("64px");
		expect(input.style.getPropertyValue("--tn-task-modal-title-overflow-y")).toBe("auto");
	});

	it("writes CSS props through Obsidian setCssProps when available", () => {
		const input = document.createElement("textarea");
		input.setCssProps = jest.fn();

		setTaskModalTitleTextareaCssProps(input, {
			"--tn-task-modal-title-height": "auto",
		});

		expect(input.setCssProps).toHaveBeenCalledWith({
			"--tn-task-modal-title-height": "auto",
		});
	});
});
