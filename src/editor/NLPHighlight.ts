import {
	Prec,
	RangeSetBuilder,
	StateEffect,
	StateField,
	type EditorState,
	type Extension,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	keymap,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import type { ParsedSpan } from "tasknotes-nlp-core";
import type { NLPTextRange } from "../services/NaturalLanguageParser";

const releaseSpan = StateEffect.define<NLPTextRange>();
const releasedSpans = StateField.define<readonly NLPTextRange[]>({
	create: () => [],
	update(spans, transaction) {
		if (transaction.docChanged && spans.length > 0) {
			const changes = transaction.changes;
			spans = spans.flatMap(({ start, end }) => {
				let edited = false;
				changes.iterChangedRanges((from, to) => {
					// Insertions at either edge belong to the surrounding text.
					if (from < end && to > start) edited = true;
				});
				return edited
					? []
					: [{ start: changes.mapPos(start, 1), end: changes.mapPos(end, -1) }];
			});
		}
		for (const effect of transaction.effects) {
			if (effect.is(releaseSpan)) spans = [...spans, effect.value];
		}
		return spans;
	},
});

export function getReleasedNLPSpans(state: EditorState): readonly NLPTextRange[] {
	return state.field(releasedSpans, false) ?? [];
}

/**
 * Marks the parts of natural language input that the parser recognised, such as
 * dates, tags and recurrence, with a class per kind (`tn-nlp-highlight--due`).
 */
export function createNLPHighlight(
	getSpans: (text: string, released: readonly NLPTextRange[]) => ParsedSpan[],
	onInputChange: (state: EditorState) => void
): Extension {
	const build = (state: EditorState): DecorationSet => {
		const builder = new RangeSetBuilder<Decoration>();
		const text = state.doc.toString();
		if (!text.trim()) return builder.finish();

		let spans: ParsedSpan[];
		try {
			spans = getSpans(text, getReleasedNLPSpans(state));
		} catch {
			return builder.finish();
		}

		let lastEnd = 0;
		for (const span of [...spans].sort((a, b) => a.start - b.start)) {
			// RangeSetBuilder needs sorted, non-overlapping ranges here.
			if (span.start < lastEnd || span.end <= span.start || span.end > text.length) continue;
			builder.add(
				span.start,
				span.end,
				Decoration.mark({
					class: `tn-nlp-highlight tn-nlp-highlight--${span.kind}`,
					attributes: { spellcheck: "false" },
				})
			);
			lastEnd = span.end;
		}
		return builder.finish();
	};

	const highlight = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = build(view.state);
			}

			update(update: ViewUpdate) {
				if (inputChanged(update)) this.decorations = build(update.state);
			}
		},
		{ decorations: (plugin) => plugin.decorations }
	);

	return [
		releasedSpans,
		highlight,
		Prec.highest(
			keymap.of([
				{
					key: "Backspace",
					run: (view) => {
						const { main, ranges } = view.state.selection;
						if (
							ranges.length !== 1 ||
							!main.empty ||
							view.state.readOnly ||
							view.composing
						) {
							return false;
						}

						let span: NLPTextRange | undefined;
						view.plugin(highlight)?.decorations.between(
							main.head,
							main.head,
							(start, end) => {
								if (end === main.head) span = { start, end };
							}
						);
						if (!span) return false;

						view.dispatch({ effects: releaseSpan.of(span) });
						return true;
					},
				},
			])
		),
		EditorView.updateListener.of((update) => {
			if (inputChanged(update)) onInputChange(update.state);
		}),
	];
}

function inputChanged(update: ViewUpdate): boolean {
	return (
		update.docChanged ||
		getReleasedNLPSpans(update.startState) !== getReleasedNLPSpans(update.state)
	);
}
