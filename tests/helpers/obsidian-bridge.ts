import * as Runtime from "obsidian-test-mocks/obsidian";

export * from "obsidian-test-mocks/obsidian";

let fallbackApp = stabilizeApp(Runtime.App.createConfigured__());

function stabilizeApp(app: Runtime.App): Runtime.App {
	const appRecord = app as unknown as { renderContext?: Record<string, never> };
	appRecord.renderContext = {};
	return app;
}

function stabilizeStrictProxy<T extends object>(value: T): T {
	const record = value as Record<string, unknown>;
	record.$$typeof = undefined;
	record.asymmetricMatch = undefined;
	record.nodeType = undefined;
	return value;
}

type RuntimeMenuItem = ReturnType<typeof Runtime.MenuItem.create__>;

type TestMenuItem = RuntimeMenuItem & {
	dom: HTMLElement;
	domEl: HTMLElement;
	submenu?: TestMenu;
	setTitle: jest.MockedFunction<RuntimeMenuItem["setTitle"]>;
	setIcon: jest.MockedFunction<RuntimeMenuItem["setIcon"]>;
	onClick: jest.MockedFunction<RuntimeMenuItem["onClick"]>;
	setChecked: jest.MockedFunction<RuntimeMenuItem["setChecked"]>;
	setDisabled: jest.MockedFunction<RuntimeMenuItem["setDisabled"]>;
	setIsLabel: jest.MockedFunction<RuntimeMenuItem["setIsLabel"]>;
	setSection: jest.MockedFunction<RuntimeMenuItem["setSection"]>;
	setSubmenu: jest.MockedFunction<RuntimeMenuItem["setSubmenu"]>;
	setWarning: jest.MockedFunction<RuntimeMenuItem["setWarning"]>;
};

type TestMenu = Runtime.Menu & {
	items?: unknown[];
	addItem: jest.MockedFunction<Runtime.Menu["addItem"]>;
	addSeparator: jest.MockedFunction<Runtime.Menu["addSeparator"]>;
	showAtMouseEvent: jest.MockedFunction<Runtime.Menu["showAtMouseEvent"]>;
	showAtPosition: jest.MockedFunction<Runtime.Menu["showAtPosition"]>;
	show: jest.Mock;
	hide: jest.MockedFunction<Runtime.Menu["hide"]>;
	close: jest.MockedFunction<Runtime.Menu["close"]>;
	onHide: jest.MockedFunction<Runtime.Menu["onHide"]>;
};

const wrappedMenus = new WeakSet<object>();
const wrappedMenuItems = new WeakSet<object>();
const runtimeButtonOnClick = Runtime.ButtonComponent.prototype.onClick;
const runtimeButtonSetTooltip = Runtime.ButtonComponent.prototype.setTooltip;
Runtime.ButtonComponent.prototype.onClick = function onClick(
	this: Runtime.ButtonComponent,
	callback: (evt: MouseEvent) => unknown
) {
	const result = runtimeButtonOnClick.call(this, callback);
	this.buttonEl.addEventListener("click", callback as EventListener);
	return result;
};
Runtime.ButtonComponent.prototype.setTooltip = function setTooltip(
	this: Runtime.ButtonComponent,
	tooltip: string,
	options?: unknown
) {
	const result = runtimeButtonSetTooltip.call(this, tooltip, options as never);
	this.buttonEl.title = tooltip;
	this.buttonEl.setAttribute("data-tooltip", tooltip);
	return result;
};

function currentVault() {
	const globalApp = (globalThis as { app?: unknown }).app;
	if (globalApp) {
		try {
			return Runtime.App.fromOriginalType__(globalApp as never).vault;
		} catch {
			// Fall back to an isolated app when global app is not a runtime proxy.
		}
	}
	return fallbackApp.vault;
}

const AppFacade = function App(files: Record<string, string> = {}) {
	fallbackApp = Runtime.App.createConfigured__({ files });
	return stabilizeStrictProxy(stabilizeApp(fallbackApp));
} as unknown as typeof Runtime.App & {
	new (files?: Record<string, string>): Runtime.App;
};
Object.setPrototypeOf(AppFacade, Runtime.App);
AppFacade.prototype = Runtime.App.prototype;
export { AppFacade as App };

const TFileFacade = function TFile(path = "") {
	return stabilizeStrictProxy(Runtime.TFile.create__(currentVault(), path));
} as unknown as typeof Runtime.TFile & {
	new (path?: string): Runtime.TFile;
};
Object.setPrototypeOf(TFileFacade, Runtime.TFile);
TFileFacade.prototype = Runtime.TFile.prototype;
Object.defineProperty(TFileFacade, Symbol.hasInstance, {
	value(value: unknown) {
		return value instanceof Runtime.TFile;
	},
});
export { TFileFacade as TFile };

const TAbstractFileFacade = function TAbstractFile(path = "") {
	return stabilizeStrictProxy(Runtime.TFile.create__(currentVault(), path));
} as unknown as typeof Runtime.TAbstractFile & {
	new (path?: string): Runtime.TAbstractFile;
};
Object.setPrototypeOf(TAbstractFileFacade, Runtime.TAbstractFile);
TAbstractFileFacade.prototype = Runtime.TAbstractFile.prototype;
Object.defineProperty(TAbstractFileFacade, Symbol.hasInstance, {
	value(value: unknown) {
		return value instanceof Runtime.TAbstractFile;
	},
});
export { TAbstractFileFacade as TAbstractFile };

export const Notice = jest.fn().mockImplementation((message: string | DocumentFragment, timeout?: number) => {
	return new Runtime.Notice(message, timeout);
});

export const requestUrl = jest.fn((request: Parameters<typeof Runtime.requestUrl>[0]) =>
	Runtime.requestUrl(request)
);

const runtimeMarkdownRender = Runtime.MarkdownRenderer.render.bind(Runtime.MarkdownRenderer);
const runtimeMarkdownRenderMarkdown = Runtime.MarkdownRenderer.renderMarkdown.bind(
	Runtime.MarkdownRenderer
);
export const MarkdownRenderer = {
	render: jest.fn(async (app, markdown, element, sourcePath = "", component) => {
		await runtimeMarkdownRender(app, markdown, element, sourcePath, component);
		element.textContent = markdown;
	}),
	renderMarkdown: jest.fn(async (markdown, element, sourcePath = "", component) => {
		await runtimeMarkdownRenderMarkdown(markdown, element, sourcePath, component);
		element.textContent = markdown;
	}),
} as unknown as typeof Runtime.MarkdownRenderer;

export const Menu = jest.fn().mockImplementation(() => {
	return wrapMenu(new Runtime.Menu());
});
(Menu as unknown as { forEvent: jest.Mock }).forEvent = jest.fn((event) =>
	wrapMenu(Runtime.Menu.forEvent(event))
);

function wrapMenu(menuValue: Runtime.Menu): TestMenu {
	const menu = stabilizeStrictProxy(menuValue) as TestMenu;
	if (wrappedMenus.has(menu)) {
		return menu;
	}
	wrappedMenus.add(menu);
	menu.items = menu.items__;
	const originalAddItem = menu.addItem.bind(menu);
	const originalAddSeparator = menu.addSeparator.bind(menu);
	const originalShowAtMouseEvent = menu.showAtMouseEvent.bind(menu);
	const originalShowAtPosition = menu.showAtPosition.bind(menu);
	const originalHide = menu.hide.bind(menu);
	const originalClose = menu.close.bind(menu);
	const originalOnHide = menu.onHide.bind(menu);

	menu.addItem = jest.fn((callback) => {
		const before = menu.items__.length;
		let callbackItem: TestMenuItem | undefined;
		originalAddItem((item) => {
			const runtimeItem = Runtime.MenuItem.fromOriginalType__(item);
			wrapMenuItem(runtimeItem);
			callbackItem = wrapMenuItem(item as unknown as RuntimeMenuItem);
			return callback(item);
		});
		const added = menu.items__[before];
		if (added) {
			const wrappedAdded = wrapMenuItem(added);
			if (callbackItem?.submenu) {
				wrappedAdded.submenu = callbackItem.submenu;
			}
		}
		return menu;
	});
	menu.addSeparator = jest.fn(() => {
		menu.items__.push({ type: "separator" } as never);
		originalAddSeparator();
		return menu;
	});
	menu.showAtMouseEvent = jest.fn((event) => originalShowAtMouseEvent(event));
	menu.showAtPosition = jest.fn((position, doc) => originalShowAtPosition(position, doc));
	menu.show = jest.fn((event: UIEvent) => {
		if (event instanceof MouseEvent) {
			return menu.showAtMouseEvent(event);
		}
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			return menu.showAtPosition({
				x: target.getBoundingClientRect().left,
				y: target.getBoundingClientRect().bottom + 4,
			});
		}
		return menu.showAtPosition({ x: 0, y: 0 });
	});
	menu.hide = jest.fn(() => {
		const result = originalHide();
		originalClose();
		return result;
	});
	menu.close = jest.fn(() => originalClose());
	menu.onHide = jest.fn((callback) => originalOnHide(callback));
	return menu;
}

function wrapMenuItem(item: RuntimeMenuItem): TestMenuItem {
	const record = item as unknown as TestMenuItem;
	if (wrappedMenuItems.has(record)) {
		return record;
	}
	wrappedMenuItems.add(record);
	(record as unknown as Record<string, unknown>).$$typeof = undefined;
	(record as unknown as Record<string, unknown>).asymmetricMatch = undefined;
	(record as unknown as Record<string, unknown>).nodeType = undefined;
	const dom = document.createElement("div");
	record.dom = dom;
	record.domEl = dom;
	record.submenu = undefined;

	if (!jest.isMockFunction(record.setTitle)) {
		const original = record.setTitle.bind(record);
		record.setTitle = jest.fn((title) => original(title)) as TestMenuItem["setTitle"];
	}
	if (!jest.isMockFunction(record.setIcon)) {
		const original = record.setIcon.bind(record);
		record.setIcon = jest.fn((icon) => original(icon)) as TestMenuItem["setIcon"];
	}
	if (!jest.isMockFunction(record.onClick)) {
		const original = record.onClick.bind(record);
		record.onClick = jest.fn((callback) => original(callback)) as TestMenuItem["onClick"];
	}
	if (!jest.isMockFunction(record.setChecked)) {
		const original = record.setChecked.bind(record);
		record.setChecked = jest.fn((checked) => original(checked)) as TestMenuItem["setChecked"];
	}
	if (!jest.isMockFunction(record.setDisabled)) {
		const original = record.setDisabled.bind(record);
		record.setDisabled = jest.fn((disabled) => original(disabled)) as TestMenuItem["setDisabled"];
	}
	if (!jest.isMockFunction(record.setIsLabel)) {
		const original = record.setIsLabel.bind(record);
		record.setIsLabel = jest.fn((isLabel) => original(isLabel)) as TestMenuItem["setIsLabel"];
	}
	if (!jest.isMockFunction(record.setSection)) {
		const original = record.setSection.bind(record);
		record.setSection = jest.fn((section) => original(section)) as TestMenuItem["setSection"];
	}
	if (!jest.isMockFunction(record.setSubmenu)) {
		const original = record.setSubmenu.bind(record);
		record.setSubmenu = jest.fn(() => {
			const submenu = wrapMenu(original());
			record.submenu = submenu;
			return submenu as never;
		}) as TestMenuItem["setSubmenu"];
	}
	if (!jest.isMockFunction(record.setWarning)) {
		const original = record.setWarning.bind(record);
		record.setWarning = jest.fn((isWarning) => original(isWarning)) as TestMenuItem["setWarning"];
	}

	return record;
}

export function setIcon(element: HTMLElement, iconName: string): void {
	Runtime.setIcon(element, iconName as never);
	element.setAttribute("data-icon", iconName);
	element.classList.add("has-icon");
}

export function setTooltip(
	element: HTMLElement,
	tooltip: string,
	options?: { placement?: string }
): void {
	Runtime.setTooltip(element, tooltip, options);
	element.title = tooltip;
	element.setAttribute("data-tooltip", tooltip);
	if (options?.placement) {
		element.setAttribute("data-tooltip-placement", options.placement);
	}
	element.classList.add("has-tooltip");
}
