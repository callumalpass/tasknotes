import { msg } from "@lingui/core/macro";
import type { I18nService } from "../i18n";
import type { CollectionTimezoneOffer } from "../services/MdbaseSpecService";
import { showNotice } from "./notifications";

export function showCollectionTimezoneNotice(
	i18n: Pick<I18nService, "translate">,
	offer: CollectionTimezoneOffer
): () => void {
	const fragment = createFragment();
	const message = fragment.createEl("p");
	message.textContent = i18n.translate(msg({
		message: "Set a time zone for this mdbase collection. Times without an offset will be read in that zone.",
		context: "mdbaseTimezone.offer",
	}));
	const useZone = fragment.createEl("button");
	useZone.textContent = i18n.translate(msg({ message: "Use {zone}", context: "mdbaseTimezone.use" }), { zone: offer.zone });
	useZone.type = "button";
	fragment.appendText(" ");
	const dismiss = fragment.createEl("button");
	dismiss.textContent = i18n.translate(msg({ message: "Dismiss", context: "mdbaseTimezone.dismiss" }));
	dismiss.type = "button";

	const notice = showNotice(fragment, 0);
	const finish = () => {
		notice.hide();
		offer.dismiss();
	};
	dismiss.addEventListener("click", (event) => {
		event.stopPropagation();
		finish();
	});
	notice.containerEl?.addEventListener("click", finish);
	useZone.addEventListener("click", (event) => {
		event.stopPropagation();
		useZone.disabled = true;
		void offer.use().then(finish, (error: unknown) => {
			useZone.disabled = false;
			offer.reportError(error);
		});
	});
	return () => notice.hide();
}
