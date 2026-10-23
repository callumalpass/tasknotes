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
