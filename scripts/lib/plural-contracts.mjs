import { createRequire } from "node:module";
const requireKit = createRequire(import.meta.resolve("@mdbase-dev/i18n"));
const { parse } = requireKit("@messageformat/parser");

function signature(tokens) {
  return tokens.map(token => token.type === "content" ? token.value : token.type === "octothorpe" ? "#" : token.cases ? signature(token.cases.flatMap(arm => arm.tokens)) : `{${token.arg}}`).join("").replace(/\s+/g, " ").trim();
}
function hasWords(tokens) {
  return tokens.some(token => token.type === "content" ? /\p{L}/u.test(token.value) : token.cases ? token.cases.some(arm => hasWords(arm.tokens)) : false);
}
function choices(tokens) {
  return tokens.flatMap(token => token.cases ? [token, ...token.cases.flatMap(arm => choices(arm.tokens))] : []);
}

/** Consumer guard for the pinned kit's CLDR/partly-English validation gap.
 * Coverage mirrors mdbase-connect e61ab062 packages/i18n/scripts/checks.mjs:
 * require only categories reached by integer counts 0..999, after offset;
 * exact arms match the original count and may exhaust a category's domain.
 * The kit does not export coverage separately. Keep its existing tarball pin
 * and mirror this small rule here, retaining strict English-source coverage
 * and the plugin's scoped English-arm rejection (the newer kit only warns).
 * This is deliberately conservative: it catches exact English branches, not every
 * possible untranslated sentence. No heuristic can establish translation quality.
 */
export function assertPluralContract(source, target, locale, id = "fixture", exceptions = {}) {
  const english = choices(parse(source));
  for (const choice of choices(parse(target))) {
    if (choice.type !== "plural" && choice.type !== "selectordinal") continue;
    const rules = new Intl.PluralRules(locale === "pt" ? "pt-BR" : locale, {
      type: choice.type === "selectordinal" ? "ordinal" : "cardinal",
    });
    const keys = new Set(choice.cases.map(arm => arm.key));
    for (const count of Array.from({ length: 1000 }, (_, count) => count)) {
      const category = rules.select(count - (choice.pluralOffset ?? 0));
      if (!keys.has(category) && !keys.has(`=${count}`)) throw new Error(`${locale} ${id}: ${choice.arg} missing CLDR ${choice.type} category ${category}`);
    }
    if (locale === "en") continue;
    const peers = english.filter(candidate => candidate.type === choice.type && candidate.arg === choice.arg);
    const sourceArms = new Set(peers.flatMap(peer => peer.cases.map(arm => signature(arm.tokens))));
    for (const arm of choice.cases) {
      const text = signature(arm.tokens);
      // Numeric classifiers and protected syntax aren't language. Exemptions for
      // real identical words must be individually reviewed per locale/ID/argument/key.
      const exception = exceptions[locale]?.[id]?.[`${choice.arg}:${arm.key}`];
      if (hasWords(arm.tokens) && sourceArms.has(text) && !(typeof exception === "string" && exception.trim())) {
        throw new Error(`${locale} ${id}: English ${choice.type} arm ${choice.arg}:${arm.key}: ${text}`);
      }
    }
  }
}
