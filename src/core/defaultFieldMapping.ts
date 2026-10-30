import { DEFAULT_FIELD_MAPPING as MODEL_DEFAULT_FIELD_MAPPING } from "@tasknotes/model/mapping";
import type { FieldMapping } from "../types";

/** Default frontmatter property for a pending moved recurring occurrence's original rule date. */
export const DEFAULT_RECURRENCE_ORIGINAL_DATE_PROPERTY = "recurrence_original_date";

export const DEFAULT_FIELD_MAPPING: FieldMapping = {
	...MODEL_DEFAULT_FIELD_MAPPING,
	recurrenceOriginalDate: DEFAULT_RECURRENCE_ORIGINAL_DATE_PROPERTY,
};
