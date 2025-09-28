import { NLPLanguageConfig } from "./types";

/**
 * German language configuration for Natural Language Processing
 * Translated patterns for German-speaking users
 */
export const deConfig: NLPLanguageConfig = {
	code: "de",
	name: "Deutsch",
	chronoLocale: "de", // chrono-node has partial German support

	dateTriggers: {
		due: ["fällig", "termin", "abgabe", "deadline", "bis zum", "bis"],
		scheduled: ["geplant für", "geplant am", "beginnen am", "anfangen am", "arbeiten an", "am"],
	},

	recurrence: {
		frequencies: {
			daily: ["täglich", "jeden Tag", "alle Tage", "tagaus tagein"],
			weekly: ["wöchentlich", "jede Woche", "alle Wochen"],
			monthly: ["monatlich", "jeden Monat", "alle Monate"],
			yearly: ["jährlich", "jedes Jahr", "alle Jahre"],
		},

		every: ["jede", "jeden", "jedes", "alle"],
		other: ["andere", "anderen", "anderes"],

		weekdays: {
			monday: ["montag"],
			tuesday: ["dienstag"],
			wednesday: ["mittwoch"],
			thursday: ["donnerstag"],
			friday: ["freitag"],
			saturday: ["samstag"],
			sunday: ["sonntag"],
		},

		pluralWeekdays: {
			monday: ["montags"],
			tuesday: ["dienstags"],
			wednesday: ["mittwochs"],
			thursday: ["donnerstags"],
			friday: ["freitags"],
			saturday: ["samstags"],
			sunday: ["sonntags"],
		},

		ordinals: {
			first: ["erste", "ersten", "erster"],
			second: ["zweite", "zweiten", "zweiter"],
			third: ["dritte", "dritten", "dritter"],
			fourth: ["vierte", "vierten", "vierter"],
			last: ["letzte", "letzten", "letzter"],
		},

		periods: {
			day: ["tag", "tage"],
			week: ["woche", "wochen"],
			month: ["monat", "monate"],
			year: ["jahr", "jahre"],
		},
	},

	timeEstimate: {
		hours: ["h", "std", "stunde", "stunden"],
		minutes: ["m", "min", "minute", "minuten"],
	},

	fallbackStatus: {
		open: ["offen", "zu erledigen", "ausstehend", "todo"],
		inProgress: ["in bearbeitung", "wird bearbeitet", "läuft", "in arbeit"],
		done: ["erledigt", "fertig", "abgeschlossen", "gemacht"],
		cancelled: ["abgebrochen", "storniert", "abgesagt"],
		waiting: ["wartend", "warten", "blockiert", "pausiert"],
	},

	fallbackPriority: {
		urgent: ["dringend", "eilig", "kritisch", "sofort", "höchste"],
		high: ["hoch", "hohe", "wichtig", "prioritär"],
		normal: ["normal", "mittel", "mittlere", "standard"],
		low: ["niedrig", "niedrige", "gering", "geringe"],
	},
};
