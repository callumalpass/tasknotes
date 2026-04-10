/**
 * Reproduction tests for issue #1693.
 *
 * Reported behavior:
 * - Bang (!) negation on date properties in Bases formula expressions does
 *   not work as expected. `!due` does not evaluate as truthy when due is
 *   empty/null. Users must use `.isEmpty()` instead.
 */

describe('Issue #1693: Bang negation on date properties in base formulas', () => {
	it.skip('reproduces issue #1693 - bang negation on empty date property', () => {
		// Simulate how date property values might be represented in the Bases
		// formula context. If empty dates are passed as empty strings or
		// wrapper objects rather than null/undefined, ! won't work as expected.

		// Possible representations of an empty date property:
		const emptyDateAsNull = null;
		const emptyDateAsUndefined = undefined;
		const emptyDateAsEmptyString = '';
		const emptyDateAsObject = {}; // Possible Bases Value wrapper

		// JavaScript truthiness with bang:
		expect(!emptyDateAsNull).toBe(true);       // Works correctly
		expect(!emptyDateAsUndefined).toBe(true);   // Works correctly
		expect(!emptyDateAsEmptyString).toBe(true);  // Works correctly
		expect(!emptyDateAsObject).toBe(false);      // BUG: empty object is truthy

		// If Bases provides date values as objects (even when empty),
		// the bang operator will always evaluate to false.
		// This means `if (!due && !scheduled, ...)` would never match
		// the "both empty" case if dates are represented as objects.

		// The .isEmpty() method would check the internal value correctly,
		// which is why the workaround works.
	});
});
