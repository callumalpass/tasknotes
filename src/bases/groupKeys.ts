import { uiData } from "../i18n/dataText";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";

// These strings are persisted in existing Bases column orders and used by mutation,
// coercion and neighbour lookup. They are identities, never translated labels.
export const NONE_GROUP_KEY = uiData("None", "Persisted empty group identity; shared by grouping, movement and ordering");
export const TRUE_GROUP_KEY = uiData("True", "Stable boolean group identity; coerced to frontmatter true");
export const FALSE_GROUP_KEY = uiData("False", "Stable boolean group identity; coerced to frontmatter false");

/** Call at display boundaries only; never use the result in a map or write plan. */
export function groupKeyLabel(key: string): string {
	switch (key) {
		case NONE_GROUP_KEY:
			return uiText(msg({ message: "None", context: "bases/basesValueConversion: formatBasesGroupKeyValue display" }));
		case TRUE_GROUP_KEY:
			return uiText(msg({ message: "True", context: "bases/basesValueConversion: formatBasesGroupKeyValue display" }));
		case FALSE_GROUP_KEY:
			return uiText(msg({ message: "False", context: "bases/basesValueConversion: formatBasesGroupKeyValue display" }));
		default:
			return key;
	}
}
