import { locales } from "@mdbase-dev/i18n/config";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { compiledCatalogue } from "./compiled-catalogue.mjs";

export const packFormat = "tasknotes-lingui-v1";
export const saveId = generateMessageId("Save", "common.save");
export const helloId = generateMessageId("Hello {name}", "delivery fixture greeting");
// Synthetic locale markers test delivery, not translation quality. Real-pack
// integration below separately exercises all ten authored production catalogues.
export const packFixtures = Object.fromEntries(locales.map(locale => [locale, compiledCatalogue({
  [saveId]: locale === "en" ? "Save" : locale === "fr" ? "Enregistrer" : locale,
  [helloId]: locale === "en" ? "Hello {name}" : locale === "fr" ? "Bonjour {name}" : `${locale}: {name}`,
})]));
export { compiledCatalogue };
