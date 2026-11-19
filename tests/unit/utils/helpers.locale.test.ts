import type { App } from "obsidian";
import { observeTranslation } from "../../helpers/real-i18n";
import { extractNoteInfo } from "../../../src/utils/helpers";

afterEach(() => observeTranslation("en"));
it.each(["en", "de", "ru"])("keeps canonical filename fallback independent of %s display copy", locale => {
  observeTranslation(locale);
  const app = {} as App;
  expect(extractNoteInfo(app, "# Heading title", "notes/Untitled.md")?.title).toBe("Heading title");
  // These are user-owned filenames, not localized sentinel states.
  expect(extractNoteInfo(app, "# Heading title", "notes/Unbenannt.md")?.title).toBe("Unbenannt");
  expect(extractNoteInfo(app, "# Heading title", "notes/Без названия.md")?.title).toBe("Без названия");
});
