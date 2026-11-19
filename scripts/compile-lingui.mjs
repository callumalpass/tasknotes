import gates from "./lib/catalogue-gates.cjs";
if (process.argv.length !== 2) throw new Error("Strict catalogue checks accept no bypass flags");
gates.prepareStrictCatalogues();
