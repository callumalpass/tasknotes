import { observeTranslation } from "../../helpers/real-i18n";
import { convertBasesGroupKeyToString } from "../../../src/bases/basesValueConversion";
import { valueToKanbanGroupString, valueToKanbanListGroupKeys, applyKanbanColumnOrder, findKanbanStatusConfigForGroupKey } from "../../../src/bases/kanbanGrouping";
import { stringifyTaskListGroupValue, groupTasksByTaskListSubProperty } from "../../../src/bases/taskListGrouping";
import { groupKeyLabel } from "../../../src/bases/groupKeys";
import { applyGroupPropertyMutation } from "../../../src/bases/groupPropertyMutation";
import { applyKanbanCreationDefault } from "../../../src/bases/kanbanCreationDefaults";
import { coerceGroupKeyToPropertyType } from "../../../src/bases/propertyValueCoercion";
import { DEFAULT_STATUSES } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";

afterEach(() => observeTranslation("en"));

describe.each(["en", "de", "ru"])("locale-stable group data in %s", locale => {
  beforeEach(() => observeTranslation(locale));
  it.each([null, undefined, "", [], { constructor: { name: "NullValue" }, toString: () => "" }])("uses one empty identity for %p in every producer", value => {
    expect(convertBasesGroupKeyToString(value)).toBe("None");
    expect(valueToKanbanGroupString(value)).toBe("None");
    expect(stringifyTaskListGroupValue(value)).toBe("None");
  });
  it("translates only labels and leaves list-empty and boolean identities stable", () => {
    expect(valueToKanbanListGroupKeys([null, "", "work"])).toEqual(["work"]);
    expect(valueToKanbanListGroupKeys([null, ""])).toEqual(["None"]);
    for (const produce of [convertBasesGroupKeyToString, valueToKanbanGroupString, stringifyTaskListGroupValue]) {
      expect(produce(true)).toBe("True");
      expect(produce(false)).toBe("False");
      expect(coerceGroupKeyToPropertyType(produce(true), "boolean")).toBe(true);
      expect(coerceGroupKeyToPropertyType(produce(false), "boolean")).toBe(false);
    }
    if (locale !== "en") expect(groupKeyLabel("None", { values: [null] })).not.toBe("None");
    expect(groupKeyLabel("user-authored")).toBe("user-authored");
    for (const text of ["None", "True", "False"]) {
      expect(groupKeyLabel(text)).toBe(text);
      expect(groupKeyLabel(text, { propertyType: "text", values: [text] })).toBe(text);
    }
    if (locale !== "en") {
      expect(groupKeyLabel("True", { propertyType: "checkbox" })).not.toBe("True");
      expect(groupKeyLabel("False", { values: [false] })).not.toBe("False");
    }
    expect(groupKeyLabel("None", { values: [null, "None"] })).toBe("None");
    if (locale !== "en") expect(groupKeyLabel("None", { values: [{ icon: "lucide-file-question" }] })).not.toBe("None");
    expect(groupKeyLabel("None", { values: [{ icon: "lucide-file-question", data: "None" }] })).toBe("None");
    expect(findKanbanStatusConfigForGroupKey("None", DEFAULT_STATUSES, value => value)).toBeUndefined();
  });
  it("clears scalar/list frontmatter on drop and never writes translated labels", () => {
    for (const produce of [convertBasesGroupKeyToString, valueToKanbanGroupString, stringifyTaskListGroupValue]) {
      for (const isList of [false, true]) {
        const frontmatter: Record<string, unknown> = { group: isList ? ["work"] : "work" };
        applyGroupPropertyMutation({ frontmatter, property: "group", sourceValue: "work", targetValue: produce(null), isList, coerceValue: (_key, value) => value });
        expect(frontmatter).toEqual({});
      }
      const frontmatter: Record<string, unknown> = {};
      applyGroupPropertyMutation({ frontmatter, property: "flag", sourceValue: null, targetValue: produce(true), isList: false, coerceValue: (_key, value) => coerceGroupKeyToPropertyType(value, "boolean") });
      expect(frontmatter).toEqual({ flag: true });
    }
  });
  it("creates from empty/boolean columns using metadata, not labels", () => {
    const frontmatter = {};
    const options = { frontmatter, propertyId: "note.status", groupKey: valueToKanbanGroupString(null), propertyMapper: { basesToUserProperty: (value: string) => value.replace(/^note\./, "") }, fieldMapper: { toUserField: (value: string) => value }, isListTypeProperty: () => false, coerceGroupKeyForFrontmatter: (_key: string, value: string) => coerceGroupKeyToPropertyType(value, "boolean") };
    applyKanbanCreationDefault(options);
    expect(frontmatter).toEqual({});
    applyKanbanCreationDefault({ ...options, groupKey: valueToKanbanGroupString(true) });
    expect(frontmatter).toEqual({ status: true });
  });
  it("keeps saved order and Task List subgroup/collapse identities across switches", () => {
    const columnOrders = { "note.flag": ["False", "None", "True"] };
    const snapshot = JSON.stringify(columnOrders);
    for (const language of ["en", "de", "ru", "en"]) {
      observeTranslation(language);
      const actualKeys = [null, true, false].map(valueToKanbanGroupString);
      expect(applyKanbanColumnOrder({ groupBy: "note.flag", actualKeys, columnOrders, hideEmptyColumns: true, pinnedColumns: [], isPriorityField: () => false, isStatusField: () => false, getPriorityWeight: () => 0, findStatusConfig: () => undefined })).toEqual(["False", "None", "True"]);
      const task = { path: "Task.md" } as TaskInfo;
      expect([...groupTasksByTaskListSubProperty([task], "note.flag", new Map([[task.path, { flag: null }]])).keys()]).toEqual(["None"]);
    }
    expect(JSON.stringify(columnOrders)).toBe(snapshot);
  });
});
