import { App } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { renderStatusPropertyCard } from "../../../src/settings/tabs/taskProperties/statusPropertyCard";
import { setCardCollapsed } from "../../../src/settings/components/CardComponent";
import { observeTranslation } from "../../helpers/real-i18n";

it("keeps status inputs mounted on identifier blur while updating workflow references", () => {
	const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as typeof DEFAULT_SETTINGS;
	const [first, second] = settings.customStatuses;
	second.nextStatus = first.value;
	const save = jest.fn();
	const plugin = { app: new App(), settings } as unknown as TaskNotesPlugin;
	const container = document.body.createDiv();
	try {
		renderStatusPropertyCard(container, plugin, save, observeTranslation("en"));
		const property = container.querySelector<HTMLElement>('[data-card-id="property-status"]')!;
		setCardCollapsed(property, false);
		const cards = property.querySelectorAll<HTMLElement>(".tasknotes-statuses-container > .tasknotes-settings__card");
		const card = cards[0];
		setCardCollapsed(card, false);
		const inputs = card.querySelectorAll<HTMLInputElement>('input[type="text"]');
		const valueInput = inputs[0];
		const labelInput = inputs[1];
		valueInput.focus();
		valueInput.value = "renamed-status";
		valueInput.dispatchEvent(new Event("input"));
		labelInput.focus();
		valueInput.dispatchEvent(new Event("change"));
		expect(valueInput.isConnected).toBe(true);
		expect(labelInput.isConnected).toBe(true);
		expect(document.activeElement).toBe(labelInput);
		expect(card.classList.contains("tasknotes-settings__card--collapsed")).toBe(false);
		expect(second.nextStatus).toBe("renamed-status");
		const nextSelect = cards[1].querySelector<HTMLSelectElement>("select")!;
		expect(nextSelect.value).toBe("renamed-status");
		expect(nextSelect.selectedOptions[0].textContent).toBe(first.label);
		labelInput.value = "Saved label";
		labelInput.dispatchEvent(new Event("input"));
		expect(first.label).toBe("Saved label");
		expect(save).toHaveBeenCalled();
	} finally {
		container.remove();
	}
});
