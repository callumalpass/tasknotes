import {
	BasesEntry,
	BasesQueryResult,
	type App,
	type BasesPropertyId,
	type BasesViewConfig,
	type TFile,
} from "obsidian";
import { getSubtasksViewName } from "../templates/defaultBasesFiles";

type SubtaskViewConfig = Pick<BasesViewConfig, "getSort">;

interface SubtaskSortQuery {
	getViewConfig(name: string): SubtaskViewConfig | null;
}

interface BasesEmbed {
	loadQuery(): Promise<SubtaskSortQuery>;
	controller: {
		query: SubtaskSortQuery;
		buildBasesContext(): unknown;
	};
}

interface BasesEmbedRegistry {
	getEmbedCreator(file: TFile): ((
		context: { app: App; containerEl: HTMLElement; sourcePath: string; linktext: string },
		file: TFile
	) => BasesEmbed) | null;
}

// Obsidian exposes the result and entry types but keeps creation of a query
// context (including formulas and the parent note's `this`) inside the embed.
const QueryEntry = BasesEntry as unknown as new (context: unknown, file: TFile) => BasesEntry;
const SortedQueryResult = BasesQueryResult as unknown as new (
	app: App,
	config: SubtaskViewConfig & { getLimit(): number },
	properties: BasesPropertyId[],
	entries: BasesEntry[]
) => BasesQueryResult;

export async function sortSubtaskFilesByRelationshipsView(
	app: App,
	base: TFile,
	parent: TFile,
	subtasks: TFile[]
): Promise<string[] | undefined> {
	const { embedRegistry } = app as unknown as { embedRegistry?: BasesEmbedRegistry };
	const createEmbed = embedRegistry?.getEmbedCreator?.(base);
	if (!createEmbed) return;

	// Keep the embed unloaded. The sort applies only to the known subtasks, so
	// there is no need to render a view, scan the vault or apply its filters.
	const containerEl = activeWindow.createDiv();
	const embed = createEmbed({ app, containerEl, sourcePath: parent.path, linktext: base.path }, base);
	const query = await embed.loadQuery();
	const view = query.getViewConfig(getSubtasksViewName()) ?? query.getViewConfig("Subtasks");
	const sort = view?.getSort();
	if (!sort?.length) return;

	embed.controller.query = query;
	const context = embed.controller.buildBasesContext();
	const entries = subtasks.map((file) => new QueryEntry(context, file));
	const result = new SortedQueryResult(
		app,
		{ getSort: () => sort, getLimit: () => 0 },
		sort.map(({ property }) => property),
		entries
	);
	return result.data.map((entry) => entry.file.path);
}
