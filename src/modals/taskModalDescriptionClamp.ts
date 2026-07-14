const DEFAULT_MAX_HEIGHT_PX = 120;

export interface TaskModalDescriptionClampOptions {
	editorContainer: HTMLElement;
	translate: (key: string) => string;
	maxHeightPx?: number;
}

export interface TaskModalDescriptionClampController {
	destroy: () => void;
	refresh: () => void;
}

export function attachTaskModalDescriptionClamp(
	options: TaskModalDescriptionClampOptions
): TaskModalDescriptionClampController {
	const maxHeight = options.maxHeightPx ?? DEFAULT_MAX_HEIGHT_PX;
	const wrapper = options.editorContainer.closest(".tn-task-modal__markdown-editor--details");
	if (!wrapper?.instanceOf(HTMLElement)) {
		return { destroy: () => undefined, refresh: () => undefined };
	}

	wrapper.classList.add("tn-task-modal__details--clampable");

	const toggleButton = activeDocument.createElement("button");
	toggleButton.type = "button";
	toggleButton.className = "tn-task-modal__details-toggle mod-cta";
	toggleButton.hidden = true;
	wrapper.insertAdjacentElement("afterend", toggleButton);

	let expanded = false;

	const setExpanded = (nextExpanded: boolean): void => {
		expanded = nextExpanded;
		wrapper.classList.toggle("tn-task-modal__details--expanded", expanded);
		toggleButton.textContent = expanded
			? options.translate("modals.task.detailsShowLess")
			: options.translate("modals.task.detailsShowMore");
	};

	const refresh = (): void => {
		if (expanded) {
			toggleButton.hidden = false;
			return;
		}

		wrapper.style.maxHeight = `${maxHeight}px`;
		const overflows = wrapper.scrollHeight > wrapper.clientHeight + 1;
		wrapper.style.removeProperty("max-height");
		toggleButton.hidden = !overflows;
	};

	toggleButton.addEventListener("click", () => {
		setExpanded(!expanded);
	});

	const resizeObserver =
		typeof ResizeObserver !== "undefined"
			? new ResizeObserver(() => {
					refresh();
				})
			: null;

	resizeObserver?.observe(wrapper);
	window.setTimeout(refresh, 0);
	window.setTimeout(refresh, 250);

	return {
		destroy: () => {
			resizeObserver?.disconnect();
			toggleButton.remove();
			wrapper.classList.remove(
				"tn-task-modal__details--clampable",
				"tn-task-modal__details--expanded"
			);
		},
		refresh,
	};
}
