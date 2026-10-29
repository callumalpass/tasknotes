import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import type { ParsedSpan } from "tasknotes-nlp-core";

/**
 * Marks the parts of natural language input that the parser recognised, such as
 * dates, tags and recurrence, with a class per kind (`tn-nlp-highlight--due`).
 */
export function createNLPHighlight(getSpans: (text: string) => ParsedSpan[]): Extension {
	const build = (view: EditorView): DecorationSet => {
		const builder = new RangeSetBuilder<Decoration>();
		const text = view.state.doc.toString();
		if (!text.trim()) return builder.finish();

		let spans: ParsedSpan[];
		try {
			spans = getSpans(text);
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
				})
			);
			lastEnd = span.end;
		}
		return builder.finish();
	};

	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = build(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged) this.decorations = build(update.view);
			}
		},
		{ decorations: (plugin) => plugin.decorations }
	);
}
