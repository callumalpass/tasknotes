import { BasesEntry, type Component, type EventRef, type TFile } from "obsidian";
import type TaskNotesPlugin from "../main";

interface RelationshipQueryContext {
	filter?: { test(entry: BasesEntry): boolean };
}

interface RelationshipController {
	viewName: string;
	query: { views: Array<{ name: string; filters?: unknown }> };
	buildBasesContext(filters: unknown): RelationshipQueryContext;
	selectView(name: string): void;
	events: {
		on(name: string, callback: () => void): EventRef;
		offref(ref: EventRef): void;
	};
}

type EmbedComponent = {
	controller?: RelationshipController;
	_children?: EmbedComponent[];
};

const selections = new WeakMap<TaskNotesPlugin, Map<string, string>>();

/** Use the host's filters and formula context, not a second relationship query engine. */
export function firstPopulatedRelationshipView(
	controller: RelationshipController,
	files: TFile[],
	isIgnored: (path: string) => boolean,
	createEntry: (context: RelationshipQueryContext, file: TFile) => BasesEntry
): string | undefined {
	for (const view of controller.query.views) {
		const context = controller.buildBasesContext(view.filters);
		if (files.some((file) => {
			if (isIgnored(file.path)) return false;
			try {
				return !context.filter || context.filter.test(createEntry(context, file));
			} catch {
				return false;
			}
		})) return view.name;
	}
	return undefined;
}

export function initializeRelationshipViewSelection(
	plugin: TaskNotesPlugin,
	notePath: string,
	container: HTMLElement,
	component: Component
): void {
	let initialized = false;
	const initialize = () => {
		if (initialized || !Object.prototype.hasOwnProperty.call(component, "_children")) return;
		const embed = (component as EmbedComponent)._children?.find((child) => Object.prototype.hasOwnProperty.call(child, "controller"));
		const controller = embed?.controller;
		if (!controller?.query?.views || typeof controller.buildBasesContext !== "function") return;
		initialized = true;
		observer.disconnect();
		let remembered = selections.get(plugin);
		if (!remembered) {
			remembered = new Map();
			selections.set(plugin, remembered);
		}
		const explicit = remembered.get(notePath);
		const preferred = explicit && controller.query.views.some((view) => view.name === explicit)
			? explicit
			: firstPopulatedRelationshipView(
				controller,
				plugin.app.vault.getMarkdownFiles(),
				(path) => plugin.app.metadataCache.isUserIgnored(path),
				(context, file) => new (BasesEntry as unknown as new (context: RelationshipQueryContext, file: TFile) => BasesEntry)(context, file)
			);
		if (preferred) controller.selectView(preferred);
		const ref = controller.events.on("view-changed", () => {
			remembered.set(notePath, controller.viewName);
		});
		component.register(() => controller.events.offref(ref));
	};
	const observer = new MutationObserver(initialize);
	observer.observe(container, { childList: true, subtree: true });
	component.register(() => observer.disconnect());
	initialize();
}
