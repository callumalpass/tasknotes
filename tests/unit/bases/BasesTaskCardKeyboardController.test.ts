import { Scope } from "obsidian";
import { BasesTaskCardKeyboardController } from "../../../src/bases/BasesTaskCardKeyboardController";
import { normalizeTaskListShortcutMap } from "../../../src/bases/taskListKeyboardActions";
import { executeBasesTaskCardAction } from "../../../src/bases/basesTaskCardActions";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);
jest.mock("../../../src/bases/basesTaskCardActions", () => ({
	executeBasesTaskCardAction: jest.fn().mockResolvedValue(undefined),
}));

const mockedExecuteAction = executeBasesTaskCardAction as jest.MockedFunction<
	typeof executeBasesTaskCardAction
>;

const proto = BasesTaskCardKeyboardController.prototype as any;

function createMockPlugin(activeLeafChangeHandlers: Array<(leaf: unknown) => void> = []) {
	return {
		app: {
			workspace: {
				on: (event: string, cb: (leaf: unknown) => void) => {
					if (event === "active-leaf-change") activeLeafChangeHandlers.push(cb);
					return {};
				},
				getMostRecentLeaf: () => null,
			},
			keymap: { pushScope: jest.fn(), popScope: jest.fn() },
			scope: {},
		},
		settings: { taskListShortcuts: {}, taskListUserFieldShortcuts: {} },
	};
}

function createMockComponent() {
	return {
		registerDomEvent: (
			el: HTMLElement | Document,
			type: string,
			cb: EventListener,
			capture?: boolean
		) => {
			el.addEventListener(type, cb, capture);
		},
		registerEvent: () => {},
		register: () => {},
	};
}

describe("BasesTaskCardKeyboardController construction", () => {
	it("restores remembered card focus when its workspace leaf is activated", () => {
		jest.useFakeTimers();
		const activeLeafChangeHandlers: Array<(leaf: unknown) => void> = [];
		const plugin = createMockPlugin(activeLeafChangeHandlers);
		const component = createMockComponent();

		const leafContainer = document.createElement("div");
		const containerEl = document.createElement("div");
		const rootElement = document.createElement("div");
		leafContainer.append(containerEl);
		containerEl.append(rootElement);
		document.body.appendChild(leafContainer);

		const controller = new BasesTaskCardKeyboardController(
			component as any,
			rootElement,
			containerEl,
			plugin as any,
			{
				isActionSupported: () => false,
				buildViewContext: () => {
					throw new Error("not used in this test");
				},
			}
		);
		const restoreFocusedElement = jest.spyOn(
			controller.focusController,
			"restoreFocusedElement"
		);

		activeLeafChangeHandlers[0]?.({ view: { containerEl: leafContainer } });
		jest.runAllTimers();

		expect(restoreFocusedElement).toHaveBeenCalled();
		jest.useRealTimers();
	});

	it("gates Shift+Arrow range-select behind input ownership, ignoring plain arrow keys", () => {
		const plugin = createMockPlugin([]);
		const component = createMockComponent();
		const containerEl = document.createElement("div");
		const rootElement = document.createElement("div");
		const card = document.createElement("div");
		card.className = "task-card";
		card.dataset.taskPath = "a.md";
		rootElement.append(card);
		containerEl.append(rootElement);
		document.body.appendChild(containerEl);

		const controller = new BasesTaskCardKeyboardController(
			component as any,
			rootElement,
			containerEl,
			plugin as any,
			{
				isActionSupported: () => false,
				buildViewContext: () => {
					throw new Error("not used in this test");
				},
			}
		);

		const shiftArrow = new KeyboardEvent("keydown", {
			key: "ArrowDown",
			shiftKey: true,
			bubbles: true,
		});
		Object.defineProperty(shiftArrow, "target", { value: card });
		expect(controller.canHandleSelectionKeyDown(shiftArrow)).toBe(true);

		const plainArrow = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
		Object.defineProperty(plainArrow, "target", { value: card });
		expect(controller.canHandleSelectionKeyDown(plainArrow)).toBe(false);
	});

	it("registers keydown routing on the root during the capture phase", () => {
		const plugin = createMockPlugin([]);
		const containerEl = document.createElement("div");
		const rootElement = document.createElement("div");
		containerEl.append(rootElement);
		document.body.appendChild(containerEl);
		const registerDomEvent = jest.fn((el: HTMLElement | Document, type: string, cb: EventListener, capture?: boolean) => {
			el.addEventListener(type, cb, capture);
		});
		const component = { registerDomEvent, registerEvent: () => {}, register: () => {} };

		new BasesTaskCardKeyboardController(component as any, rootElement, containerEl, plugin as any, {
			isActionSupported: () => false,
			buildViewContext: () => ({} as any),
		});

		expect(registerDomEvent).toHaveBeenCalledWith(rootElement, "keydown", expect.any(Function), true);
		expect(registerDomEvent).toHaveBeenCalledWith(rootElement, "mousemove", expect.any(Function));
	});
});

describe("BasesTaskCardKeyboardController.handleActionKeyDown", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("claims a recognized shortcut when the task card owns focus", () => {
		const mockThis = {
			plugin: { settings: {} },
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			focusController: { getFocusedPathForEvent: jest.fn(() => "focused.md") },
			inputOwnershipController: { noteOverlayOpening: jest.fn() },
			buildActionContext: () => ({} as any),
		};
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });
		const stopPropagation = jest.spyOn(event, "stopPropagation");

		proto.handleActionKeyDown.call(mockThis, event, false);

		expect(event.defaultPrevented).toBe(true);
		expect(stopPropagation).toHaveBeenCalled();
		expect(mockedExecuteAction).toHaveBeenCalledWith("edit-due", "focused.md", expect.anything());
	});

	it("routes configured Gmail-style navigation through the focus controller", () => {
		const moveFocus = jest.fn();
		const event = new KeyboardEvent("keydown", { key: "j", cancelable: true });
		const mockThis = {
			plugin: {
				settings: {
					taskListShortcuts: {
						"navigate-next": ["j"],
						"navigate-previous": ["k"],
					},
				},
			},
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			focusController: {
				getFocusedPathForEvent: jest.fn(() => "focused.md"),
				moveFocus,
			},
		};

		proto.handleActionKeyDown.call(mockThis, event, false);

		expect(moveFocus).toHaveBeenCalledWith(event, "next");
		expect(mockedExecuteAction).not.toHaveBeenCalled();
	});

	it("records an overlay before opening a user-field editor so focus can be restored", () => {
		const noteOverlayOpening = jest.fn();
		const mockThis = {
			plugin: {
				settings: {
					taskListShortcuts: normalizeTaskListShortcutMap({}),
					taskListUserFieldShortcuts: { effort: ["q"] },
				},
			},
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			focusController: { getFocusedPathForEvent: jest.fn(() => "focused.md") },
			inputOwnershipController: { noteOverlayOpening },
			buildActionContext: () => ({} as any),
		};
		const event = new KeyboardEvent("keydown", { key: "q", cancelable: true });

		proto.handleActionKeyDown.call(mockThis, event, false);

		expect(noteOverlayOpening).toHaveBeenCalledTimes(1);
		expect(mockedExecuteAction).toHaveBeenCalledWith(
			"edit-user-field:effort",
			"focused.md",
			expect.anything()
		);
	});

	it.each([
		["g", "jump-first", "first"],
		["G", "jump-last", "last"],
	] as const)(
		"routes configured boundary key %s through the focus controller",
		(key, action, direction) => {
			const moveFocus = jest.fn();
			const event = new KeyboardEvent("keydown", { key, cancelable: true });
			const mockThis = {
				plugin: {
					settings: {
						taskListShortcuts: {
							[action]: [key.toLowerCase()],
						},
					},
				},
				options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
				focusController: {
					getFocusedPathForEvent: jest.fn(() => "focused.md"),
					moveFocus,
				},
			};

			proto.handleActionKeyDown.call(mockThis, event, false);

			expect(moveFocus).toHaveBeenCalledWith(event, direction);
		}
	);

	it.each([
		["Enter", { shiftKey: true }, "open-task-notes"],
		["s", { shiftKey: true }, "edit-scheduled"],
		["#", { shiftKey: true }, "add-tags"],
		["@", { shiftKey: true }, "add-context"],
		["+", { shiftKey: true }, "add-project"],
		["Delete", { ctrlKey: true }, "delete-tasks"],
		["Delete", { metaKey: true }, "delete-tasks"],
	] as const)("allows the modifier chord %s after action recognition", (keyValue, modifiers, action) => {
		const getFocusedPathForEvent = jest.fn(() => "focused.md");
		const mockThis = {
			plugin: { settings: {} },
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			focusController: { getFocusedPathForEvent },
			inputOwnershipController: { noteOverlayOpening: jest.fn() },
			buildActionContext: () => ({} as any),
		};
		const event = new KeyboardEvent("keydown", {
			key: keyValue,
			cancelable: true,
			...modifiers,
		});

		proto.handleActionKeyDown.call(mockThis, event, false);

		expect(getFocusedPathForEvent).toHaveBeenCalledWith(event, true, false);
		expect(event.defaultPrevented).toBe(true);
		expect(mockedExecuteAction).toHaveBeenCalledWith(action, "focused.md", expect.anything());
	});

	it("does not claim shortcuts when an interactive control owns focus", () => {
		const mockThis = {
			plugin: { settings: {} },
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			focusController: { getFocusedPathForEvent: jest.fn(() => null) },
		};
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });

		proto.handleActionKeyDown.call(mockThis, event, false);

		expect(event.defaultPrevented).toBe(false);
		expect(mockedExecuteAction).not.toHaveBeenCalled();
	});

	it("routes a shortcut from the active view shell through remembered task focus", () => {
		const getFocusedPathForEvent = jest.fn(() => "remembered.md");
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });
		const mockThis = {
			plugin: { settings: {} },
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			focusController: { getFocusedPathForEvent },
			inputOwnershipController: { noteOverlayOpening: jest.fn() },
			buildActionContext: () => ({} as any),
		};

		proto.handleActionKeyDown.call(mockThis, event, true);

		expect(getFocusedPathForEvent).toHaveBeenCalledWith(event, true, true);
		expect(mockedExecuteAction).toHaveBeenCalledWith("edit-due", "remembered.md", expect.anything());
	});

	it("routes a prevented modifier chord from the active view shell", () => {
		const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true, cancelable: true });
		event.preventDefault();
		const mockThis = {
			plugin: {
				settings: {
					taskListShortcuts: { "select-all": ["mod+a"] },
				},
			},
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			focusController: { getFocusedPathForEvent: jest.fn(() => null) },
			inputOwnershipController: { noteOverlayOpening: jest.fn() },
			buildActionContext: () => ({} as any),
		};

		proto.handleActionKeyDown.call(mockThis, event, true);

		expect(mockedExecuteAction).toHaveBeenCalledWith("select-all", null, expect.anything());
	});

	it("leaves an unsupported action untouched so the key can reach Obsidian's own commands", () => {
		const mockThis = {
			plugin: { settings: {} },
			options: { isActionSupported: () => false, buildViewContext: () => ({} as any) },
			focusController: { getFocusedPathForEvent: jest.fn(() => "focused.md") },
		};
		const event = new KeyboardEvent("keydown", { key: "d", cancelable: true });

		const handled = proto.handleActionKeyDown.call(mockThis, event, false);

		expect(handled).toBe(false);
		expect(event.defaultPrevented).toBe(false);
		expect(mockedExecuteAction).not.toHaveBeenCalled();
	});
});

describe("BasesTaskCardKeyboardController.handleKeyDown / handleRootKeyDown", () => {
	it("routes a body-targeted shortcut through remembered task focus after a rerender", () => {
		const canHandleListKeyDown = jest.fn(() => true);
		const getFocusedPathForEvent = jest.fn(() => "remembered.md");
		const event = new KeyboardEvent("keydown", { key: " ", cancelable: true });
		Object.defineProperty(event, "target", { value: document.body });
		const mockThis = {
			inputOwnershipController: { canHandleListKeyDown },
			options: { isActionSupported: () => true, buildViewContext: () => ({} as any) },
			plugin: { settings: {} },
			focusController: { getFocusedPathForEvent },
			buildActionContext: () => ({} as any),
			handleActionKeyDown: proto.handleActionKeyDown,
		};

		proto.handleKeyDown.call(mockThis, event, true);

		expect(canHandleListKeyDown).toHaveBeenCalledWith(event, true);
		expect(getFocusedPathForEvent).toHaveBeenCalledWith(event, true, true);
		expect(mockedExecuteAction).toHaveBeenCalledWith("toggle-select", "remembered.md", expect.anything());
	});

	it("does not discard a prevented chord before shell shortcut routing", () => {
		const root = document.createElement("div");
		const cardAreaElement = document.createElement("div");
		root.appendChild(cardAreaElement);
		const event = new KeyboardEvent("keydown", { key: "c", metaKey: true, cancelable: true });
		Object.defineProperty(event, "target", { value: root });
		event.preventDefault();
		const handleKeyDown = jest.fn();
		const mockThis = { cardAreaElement, handleKeyDown };

		proto.handleRootKeyDown.call(mockThis, event);

		expect(handleKeyDown).toHaveBeenCalledWith(event, true);
	});

	it("routes card chords from the root without using remembered-focus fallback", () => {
		const root = document.createElement("div");
		const cardAreaElement = document.createElement("div");
		const card = document.createElement("div");
		cardAreaElement.appendChild(card);
		root.appendChild(cardAreaElement);
		const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true });
		Object.defineProperty(event, "target", { value: card });
		const handleKeyDown = jest.fn();
		const mockThis = { cardAreaElement, handleKeyDown };

		proto.handleRootKeyDown.call(mockThis, event);

		expect(handleKeyDown).toHaveBeenCalledWith(event, false);
	});
});

describe("BasesTaskCardKeyboardController overlay + Scope lifecycle", () => {
	it("defers task-card focus until after Obsidian modal cleanup", () => {
		jest.useFakeTimers();
		try {
			const restoreFocusedElement = jest.fn();
			const resumeAfterOverlayClose = jest.fn();
			const syncShortcutScopeForFocusTarget = jest.fn();
			const mockThis = {
				focusController: { restoreFocusedElement },
				inputOwnershipController: { resumeAfterOverlayClose },
				containerEl: document.createElement("div"),
				syncShortcutScopeForFocusTarget,
				leafActive: true,
				activateShortcutScope: jest.fn(),
			};

			proto.restoreAfterOverlayClose.call(mockThis);

			expect(restoreFocusedElement).not.toHaveBeenCalled();
			jest.runAllTimers();
			expect(restoreFocusedElement).toHaveBeenCalledTimes(1);
			expect(resumeAfterOverlayClose).toHaveBeenCalledTimes(1);
			expect(syncShortcutScopeForFocusTarget).toHaveBeenCalledWith(
				mockThis.containerEl.ownerDocument.activeElement
			);
			expect(mockThis.activateShortcutScope).toHaveBeenCalledTimes(1);
		} finally {
			jest.useRealTimers();
		}
	});

	it("keeps the active view shortcut scope when focus falls back to the body", () => {
		const canOwnKeyboardTarget = jest.fn(() => true);
		const activateShortcutScope = jest.fn();
		const deactivateShortcutScope = jest.fn();
		const mockThis = {
			leafActive: true,
			inputOwnershipController: { canOwnKeyboardTarget },
			activateShortcutScope,
			deactivateShortcutScope,
		};

		proto.syncShortcutScopeForFocusTarget.call(mockThis, document.body);

		expect(canOwnKeyboardTarget).toHaveBeenCalledWith(document.body, true);
		expect(activateShortcutScope).toHaveBeenCalled();
		expect(deactivateShortcutScope).not.toHaveBeenCalled();
	});

	it("pushes an Obsidian child scope for configured view-local chords", () => {
		const registerSpy = jest.spyOn(Scope.prototype, "register");
		const pushScope = jest.fn();
		const popScope = jest.fn();
		const handleKeyDown = jest.fn(() => true);
		const mockThis = {
			shortcutScope: null as Scope | null,
			leafActive: true,
			plugin: {
				settings: {
					taskListShortcuts: normalizeTaskListShortcutMap({
						"select-all": ["Ctrl+B"],
						"copy-task-titles": ["Ctrl+D"],
					}),
				},
				app: {
					scope: {},
					keymap: { pushScope, popScope },
				},
			},
			handleKeyDown,
		};

		proto.activateShortcutScope.call(mockThis);

		expect(pushScope).toHaveBeenCalledTimes(1);
		const scope = mockThis.shortcutScope;
		expect(registerSpy).toHaveBeenCalledWith(["Mod"], "b", expect.any(Function));
		expect(registerSpy).toHaveBeenCalledWith(["Mod"], "d", expect.any(Function));

		const ctrlBHandler = registerSpy.mock.calls.find(
			([modifiers, key]) => modifiers[0] === "Mod" && key === "b"
		)?.[2] as (event: KeyboardEvent) => unknown;
		const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true });
		expect(ctrlBHandler(event)).toBe(false);
		expect(handleKeyDown).toHaveBeenCalledWith(event, true);

		proto.deactivateShortcutScope.call(mockThis);
		expect(popScope).toHaveBeenCalledTimes(1);
		expect(popScope.mock.calls[0][0]).toBe(scope);
		expect(mockThis.shortcutScope).toBeNull();
		registerSpy.mockRestore();
	});

	it("does not claim a scoped chord after the task-list leaf is deactivated", () => {
		const registerSpy = jest.spyOn(Scope.prototype, "register");
		const mockThis = {
			shortcutScope: null as Scope | null,
			leafActive: true,
			plugin: {
				settings: {
					taskListShortcuts: normalizeTaskListShortcutMap({
						"select-all": ["Ctrl+B"],
					}),
				},
				app: {
					scope: {},
					keymap: { pushScope: jest.fn(), popScope: jest.fn() },
				},
			},
			handleKeyDown: jest.fn(() => true),
		};
		proto.activateShortcutScope.call(mockThis);
		const handler = registerSpy.mock.calls.find(
			([modifiers, key]) => modifiers[0] === "Mod" && key === "b"
		)?.[2] as (event: KeyboardEvent) => unknown;
		mockThis.leafActive = false;

		expect(handler(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }))).toBeUndefined();
		expect(mockThis.handleKeyDown).not.toHaveBeenCalled();
		registerSpy.mockRestore();
	});
});
