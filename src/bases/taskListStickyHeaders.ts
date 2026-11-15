import type { VirtualScroller } from "../utils/VirtualScroller";
import type {
	TaskListHeaderItem,
	TaskListRenderItem,
	TaskListVirtualItem,
} from "./taskListGrouping";

type TaskListStickyHeaderOptions = {
	pin: HTMLElement | null;
	scroller: Pick<VirtualScroller<TaskListVirtualItem>, "getScrollTop" | "getItemOffset"> | null;
	headerIndices: readonly number[];
	items: readonly TaskListVirtualItem[];
	previousKey: string | null;
	createHeader: (item: TaskListHeaderItem) => HTMLElement;
};

export function collectTaskListStickyHeaderIndices(items: readonly TaskListRenderItem[]): number[] {
	const indices: number[] = [];
	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		if (item.type === "primary-header" || item.type === "sub-header") {
			indices.push(index);
		}
	}
	return indices;
}

export function updateTaskListStickyHeader(options: TaskListStickyHeaderOptions): string | null {
	const pin = options.pin;
	const scroller = options.scroller;
	if (!pin || !scroller) return options.previousKey;

	const scrollTop = scroller.getScrollTop();
	let primary: TaskListHeaderItem | undefined;
	let sub: TaskListHeaderItem | undefined;
	const parentHeight = pin.firstElementChild?.getBoundingClientRect().height ?? 0;
	for (const index of options.headerIndices) {
		const item = options.items[index];
		if (!("type" in item)) continue;
		const offset = scroller.getItemOffset(index);
		if (item.type === "primary-header") {
			if (offset >= scrollTop) break;
			primary = item;
			sub = undefined;
		} else if (item.type === "sub-header" && primary && offset < scrollTop + parentHeight) {
			sub = item;
		}
	}
	const headers = [primary, sub].filter((item): item is TaskListHeaderItem => !!item);
	const signature = JSON.stringify(
		headers.map((item) => [
			item.groupKey,
			item.type === "sub-header" ? item.subGroupKey : null,
			item.type === "sub-header" ? item.subGroupTitle : item.groupTitle,
			item.taskCount,
			item.isCollapsed,
		])
	);
	if (signature === options.previousKey) return options.previousKey;
	pin.empty();
	pin.classList.toggle("is-empty", headers.length === 0);
	for (const item of headers) {
		const header = options.createHeader(item);
		header.classList.add("task-list-virtual-sticky-header__group");
		// The in-list header remains the keyboard/AT control. The visual copy
		// supports pointer collapse without taking focus away from the list.
		header.querySelectorAll("button, a").forEach((el) => el.setAttribute("tabindex", "-1"));
		header.addEventListener("mousedown", (event) => event.preventDefault());
		pin.appendChild(header);
	}
	return signature;
}
