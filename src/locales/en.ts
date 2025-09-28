import { NLPLanguageConfig } from "./types";

/**
 * English language configuration for Natural Language Processing
 * Based on existing patterns from NaturalLanguageParser.ts
 */
export const enConfig: NLPLanguageConfig = {
	code: "en",
	name: "English",
	chronoLocale: "en",

	dateTriggers: {
		due: ["due", "deadline", "must be done by", "by"],
		scheduled: ["scheduled for", "start on", "begin on", "work on", "on"],
	},

	recurrence: {
		frequencies: {
			daily: ["daily", "every day"],
			weekly: ["weekly", "every week"],
			monthly: ["monthly", "every month"],
			yearly: ["yearly", "annually", "every year"],
		},

		every: ["every"],
		other: ["other"],

		weekdays: {
			monday: ["monday"],
			tuesday: ["tuesday"],
			wednesday: ["wednesday"],
			thursday: ["thursday"],
			friday: ["friday"],
			saturday: ["saturday"],
			sunday: ["sunday"],
		},

		pluralWeekdays: {
			monday: ["mondays"],
			tuesday: ["tuesdays"],
			wednesday: ["wednesdays"],
			thursday: ["thursdays"],
			friday: ["fridays"],
			saturday: ["saturdays"],
			sunday: ["sundays"],
		},

		ordinals: {
			first: ["first"],
			second: ["second"],
			third: ["third"],
			fourth: ["fourth"],
			last: ["last"],
		},

		periods: {
			day: ["day", "days"],
			week: ["week", "weeks"],
			month: ["month", "months"],
			year: ["year", "years"],
		},
	},

	timeEstimate: {
		hours: ["h", "hr", "hrs", "hour", "hours"],
		minutes: ["m", "min", "mins", "minute", "minutes"],
	},

	fallbackStatus: {
		open: ["todo", "to do", "open"],
		inProgress: ["in progress", "in-progress", "doing"],
		done: ["done", "completed", "finished"],
		cancelled: ["cancelled", "canceled"],
		waiting: ["waiting", "blocked", "on hold"],
	},

	fallbackPriority: {
		urgent: ["urgent", "critical", "highest"],
		high: ["high", "important"],
		normal: ["medium", "normal"],
		low: ["low", "minor"],
	},
};
