import type TaskNotesPlugin from "../main";
import { normalizeContextList } from "../components/TaskContextMenu";
import { showTextInputModal } from "./TextInputModal";
import {
	formatTaskModalChipListEditorLabel,
	showTaskModalChipListEditor,
} from "./taskModalChipListEditor";
import {
	formatTaskModalCommaList,
	parseTaskModalCommaList,
} from "./taskModalOrgCounts";
import { sanitizeTags } from "../utils/helpers";

export interface TaskModalPropertyMenuContext {
	plugin: TaskNotesPlugin;
	translate: (key: string, params?: Record<string, string | number>) => string;
	getContexts: () => string;
	setContexts: (value: string) => void;
	getTags: () => string;
	setTags: (value: string) => void;
	getTimeEstimate: () => number;
	setTimeEstimate: (value: number) => void;
	onChange: () => void;
}

function contextsListToString(contexts: string[] | undefined): string {
	if (!contexts?.length) return "";
	return formatTaskModalCommaList(contexts);
}

function tagsStringToList(value: string): string[] {
	return parseTaskModalCommaList(sanitizeTags(value));
}

function tagsListToString(tags: readonly string[]): string {
	if (!tags.length) return "";
	return formatTaskModalCommaList(tags);
}

export async function showTaskModalContextsInput(
	context: TaskModalPropertyMenuContext
): Promise<void> {
	const result = await showTaskModalChipListEditor(
		context.plugin.app,
		context.plugin,
		{
			title: context.translate("modals.task.contextsLabel"),
			placeholder: context.translate("contextMenus.task.organization.addContext"),
			initialValues: parseTaskModalCommaList(context.getContexts()),
			variant: "contexts",
			confirmText: context.translate("common.confirm"),
			cancelText: context.translate("common.cancel"),
			removeItemLabel: (item) =>
				context.translate("modals.task.chipList.removeItem", { item }),
			formatChipLabel: (value) => formatTaskModalChipListEditorLabel("contexts", value),
		},
		parseTaskModalCommaList(context.getContexts())
	);

	if (result === null) return;

	const next = contextsListToString(normalizeContextList(result));
	if (next === context.getContexts()) return;

	context.setContexts(next);
	context.onChange();
}

export async function showTaskModalTagsInput(
	context: TaskModalPropertyMenuContext
): Promise<void> {
	const result = await showTaskModalChipListEditor(
		context.plugin.app,
		context.plugin,
		{
			title: context.translate("modals.task.tagsLabel"),
			placeholder: context.translate("contextMenus.task.addTag"),
			initialValues: tagsStringToList(context.getTags()),
			variant: "tags",
			confirmText: context.translate("common.confirm"),
			cancelText: context.translate("common.cancel"),
			removeItemLabel: (item) =>
				context.translate("modals.task.chipList.removeItem", { item }),
			formatChipLabel: (value) => formatTaskModalChipListEditorLabel("tags", value),
		},
		tagsStringToList(context.getTags())
	);

	if (result === null) return;

	const next = tagsListToString(result);
	if (next === context.getTags()) return;

	context.setTags(next);
	context.onChange();
}

export async function showTaskModalTimeEstimateInput(
	context: TaskModalPropertyMenuContext
): Promise<void> {
	const current = context.getTimeEstimate();
	const input = await showTextInputModal(context.plugin.app, {
		title: context.translate("modals.task.timeEstimateLabel"),
		placeholder: context.translate("modals.task.timeEstimatePlaceholder"),
		initialValue: current > 0 ? String(current) : "",
		confirmText: context.translate("common.confirm"),
		cancelText: context.translate("common.cancel"),
		fitContent: { minCh: 8, maxCh: 12 },
	});

	if (input === null) return;

	const parsed = parseInt(input, 10);
	context.setTimeEstimate(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
	context.onChange();
}
