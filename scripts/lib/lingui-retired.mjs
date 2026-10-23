// These placeholders are technical data, never translations. Labels/descriptions
// next to them remain messages. Keep reruns from reintroducing the retired IDs.
export const technicalDataConcepts = new Set([
  "settings.defaults.bodyTemplate.bodyTemplateFile.placeholder",
  "settings.defaults.bodyTemplate.occurrenceBodyTemplateFile.placeholder",
  "settings.taskProperties.taskStatuses.placeholders.value",
  "settings.taskProperties.taskStatuses.placeholders.icon",
  "settings.taskProperties.taskPriorities.placeholders.value",
  "settings.taskProperties.taskPriorities.placeholders.icon",
  "settings.taskProperties.customUserFields.placeholders.propertyKey",
  "settings.integrations.calendarSubscriptions.defaultNoteTemplate.placeholder",
  "settings.integrations.autoExport.filePath.placeholder",
  "settings.integrations.httpApi.authToken.placeholder",
  "settings.integrations.webhooks.modals.add.url.placeholder",
  "modals.icsNoteCreation.templatePathPlaceholder",
]);

// Fragment concepts now map to whole messages. Never reuse a fragment's target
// translation for the new sentence; translator handoff starts with empty targets.
const jsonHelp = {
  message: "<0>.json files:</0> Templates with <1>{example}</1>",
  context: "webhook JSON template help",
};
const emptyHelp = {
  message: "<0>Leave empty:</0> Send raw data",
  context: "webhook untransformed payload help",
};
export const legacyConceptReplacements = {
  "settings.integrations.webhooks.modals.add.transformHelp.jsonFiles": jsonHelp,
  "settings.integrations.webhooks.modals.add.transformHelp.jsonDescription": jsonHelp,
  "settings.integrations.webhooks.modals.add.transformHelp.leaveEmpty": emptyHelp,
  "settings.integrations.webhooks.modals.add.transformHelp.leaveEmptyDescription": emptyHelp,
};
