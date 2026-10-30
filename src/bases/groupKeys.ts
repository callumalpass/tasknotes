import { isBasesEmptyPlaceholderValue } from "./basesValueKinds";
import { uiData } from "../i18n/dataText";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";

// These strings are persisted in existing Bases column orders and used by mutation,
// coercion and neighbour lookup. They are identities, never translated labels.
export const NONE_GROUP_KEY = uiData("None", "Persisted empty group identity; shared by grouping, movement and ordering");
export const TRUE_GROUP_KEY = uiData("True", "Stable boolean group identity; coerced to frontmatter true");
export const FALSE_GROUP_KEY = uiData("False", "Stable boolean group identity; coerced to frontmatter false");

type GroupLabelSource = { propertyType?: string | null; values?: readonly unknown[] };

/** Ambiguous text identities are user data unless raw values/schema prove otherwise. */
export function groupKeyLabel(key: string, source: GroupLabelSource = {}): string {
	const empty = !!source.values?.length && source.values.every(value => value === null || value === undefined || value === "" || (typeof value === "object" && value.constructor?.name === "NullValue") || isBasesEmptyPlaceholderValue(value));
	const boolean = ["boolean", "checkbox"].includes(source.propertyType || "") || (!!source.values?.length && source.values.every(value => typeof value === "boolean" || (value !== null && typeof value === "object" && value.constructor?.name === "BooleanValue")));
	if (!(key === NONE_GROUP_KEY ? empty : boolean)) return key;
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
