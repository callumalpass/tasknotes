import { canHoverClaimBasesTaskFocus } from "../../../src/bases/embeddedBasesKeyboard";

describe("embedded Bases keyboard ownership", () => {
	afterEach(() => {
		document.body.empty();
	});

	function createInjectedView(mode: "source" | "reading"): {
		root: HTMLElement;
		editor: HTMLElement | null;
	} {
		const view = document.createElement("div");
		view.className = mode === "source" ? "markdown-source-view" : "markdown-preview-view";
		const editor = mode === "source" ? document.createElement("div") : null;
		if (editor) {
			editor.className = "cm-content";
			editor.setAttribute("contenteditable", "true");
			editor.tabIndex = 0;
			view.appendChild(editor);
		}
		const widget = document.createElement("div");
		widget.className = "tasknotes-relationships-widget";
		const root = document.createElement("div");
		widget.appendChild(root);
		view.appendChild(widget);
		document.body.appendChild(view);
		return { root, editor };
	}

	it("blocks hover while the containing Live Preview editor owns the cursor", () => {
		const { root, editor } = createInjectedView("source");
		editor?.focus();

		expect(canHoverClaimBasesTaskFocus(root)).toBe(false);
	});

	it("allows hover in reading mode", () => {
		const { root } = createInjectedView("reading");

		expect(canHoverClaimBasesTaskFocus(root)).toBe(true);
	});

	it("allows explicit widget focus even in Live Preview", () => {
		const { root } = createInjectedView("source");
		root.tabIndex = 0;
		root.focus();

		expect(canHoverClaimBasesTaskFocus(root)).toBe(true);
	});

	it("does not restrict standalone Agenda, Calendar, or Kanban Bases views", () => {
		const root = document.createElement("div");
		document.body.appendChild(root);

		expect(canHoverClaimBasesTaskFocus(root)).toBe(true);
	});
});
