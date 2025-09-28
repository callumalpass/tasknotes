import { NLPLanguageConfig } from "./types";

/**
 * Swedish language configuration for Natural Language Processing
 * Translated patterns for Swedish-speaking users
 */
export const svConfig: NLPLanguageConfig = {
	code: "sv",
	name: "Svenska",
	chronoLocale: "sv",

	dateTriggers: {
		due: ["förfaller", "deadline", "måste vara klar", "senast", "till", "innan"],
		scheduled: ["schemalagd", "planerad för", "börja", "arbeta med", "den", "på"],
	},

	recurrence: {
		frequencies: {
			daily: ["dagligen", "varje dag", "alla dagar", "per dag"],
			weekly: ["veckovis", "varje vecka", "alla veckor", "per vecka"],
			monthly: ["månadsvis", "varje månad", "alla månader", "per månad"],
			yearly: ["årligen", "varje år", "alla år", "per år"],
		},

		every: ["varje", "alla", "var"],
		other: ["annan", "annat", "andra"],

		weekdays: {
			monday: ["måndag"],
			tuesday: ["tisdag"],
			wednesday: ["onsdag"],
			thursday: ["torsdag"],
			friday: ["fredag"],
			saturday: ["lördag"],
			sunday: ["söndag"],
		},

		pluralWeekdays: {
			monday: ["måndagar"],
			tuesday: ["tisdagar"],
			wednesday: ["onsdagar"],
			thursday: ["torsdagar"],
			friday: ["fredagar"],
			saturday: ["lördagar"],
			sunday: ["söndagar"],
		},

		ordinals: {
			first: ["första"],
			second: ["andra"],
			third: ["tredje"],
			fourth: ["fjärde"],
			last: ["sista"],
		},

		periods: {
			day: ["dag", "dagar"],
			week: ["vecka", "veckor"],
			month: ["månad", "månader"],
			year: ["år"],
		},
	},

	timeEstimate: {
		hours: ["t", "tim", "timme", "timmar", "h"],
		minutes: ["m", "min", "minut", "minuter"],
	},

	fallbackStatus: {
		open: ["att göra", "öppen", "kvar", "todo", "väntande"],
		inProgress: ["pågående", "arbetar", "gör", "i process", "under arbete"],
		done: ["klar", "färdig", "slutförd", "avslutad", "gjord"],
		cancelled: ["avbruten", "inställd", "avbokad"],
		waiting: ["väntar", "blockerad", "pausad", "vilande"],
	},

	fallbackPriority: {
		urgent: ["brådskande", "kritisk", "högsta", "akut", "omedelbar"],
		high: ["hög", "viktig", "förhöjd", "prioriterad"],
		normal: ["normal", "medel", "standard", "vanlig"],
		low: ["låg", "mindre", "minimal", "obetydlig"],
	},
};
