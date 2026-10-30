import { compileMessageOrThrow } from "@lingui/message-utils/compileMessage";

/** Same JSON-safe ICU arrays as Lingui compilation; never a flat translation tree. */
export function compiledCatalogue(messages) {
  return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(messages).map(([id, text]) => [id, compileMessageOrThrow(text)]))));
}
