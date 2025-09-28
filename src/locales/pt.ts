import { NLPLanguageConfig } from "./types";

/**
 * Portuguese language configuration for Natural Language Processing
 * Translated patterns for Portuguese-speaking users
 */
export const ptConfig: NLPLanguageConfig = {
	code: "pt",
	name: "Português",
	chronoLocale: "pt",

	dateTriggers: {
		due: ["vencimento", "prazo", "deve estar pronto até", "até", "para", "limite"],
		scheduled: ["programado para", "agendado para", "começar em", "trabalhar em", "em", "no"],
	},

	recurrence: {
		frequencies: {
			daily: ["diário", "diária", "diariamente", "todos os dias", "cada dia", "por dia"],
			weekly: ["semanal", "semanalmente", "toda semana", "todas as semanas", "por semana"],
			monthly: ["mensal", "mensalmente", "todo mês", "todos os meses", "por mês"],
			yearly: ["anual", "anualmente", "todo ano", "todos os anos", "por ano"],
		},

		every: ["todo", "toda", "todos", "todas", "cada"],
		other: ["outro", "outra", "outros", "outras"],

		weekdays: {
			monday: ["segunda", "segunda-feira"],
			tuesday: ["terça", "terça-feira"],
			wednesday: ["quarta", "quarta-feira"],
			thursday: ["quinta", "quinta-feira"],
			friday: ["sexta", "sexta-feira"],
			saturday: ["sábado"],
			sunday: ["domingo"],
		},

		pluralWeekdays: {
			monday: ["segundas", "segundas-feiras"],
			tuesday: ["terças", "terças-feiras"],
			wednesday: ["quartas", "quartas-feiras"],
			thursday: ["quintas", "quintas-feiras"],
			friday: ["sextas", "sextas-feiras"],
			saturday: ["sábados"],
			sunday: ["domingos"],
		},

		ordinals: {
			first: ["primeiro", "primeira"],
			second: ["segundo", "segunda"],
			third: ["terceiro", "terceira"],
			fourth: ["quarto", "quarta"],
			last: ["último", "última"],
		},

		periods: {
			day: ["dia", "dias"],
			week: ["semana", "semanas"],
			month: ["mês", "meses"],
			year: ["ano", "anos"],
		},
	},

	timeEstimate: {
		hours: ["h", "hr", "hora", "horas"],
		minutes: ["m", "min", "minuto", "minutos"],
	},

	fallbackStatus: {
		open: ["a fazer", "pendente", "aberto", "todo", "por fazer"],
		inProgress: ["em andamento", "em progresso", "fazendo", "trabalhando", "executando"],
		done: ["feito", "concluído", "terminado", "finalizado", "completo"],
		cancelled: ["cancelado", "anulado", "suspenso"],
		waiting: ["aguardando", "esperando", "bloqueado", "em espera"],
	},

	fallbackPriority: {
		urgent: ["urgente", "crítico", "crítica", "máximo", "máxima", "prioritário", "prioritária"],
		high: ["alto", "alta", "importante", "elevado", "elevada"],
		normal: ["médio", "média", "normal", "regular", "padrão"],
		low: ["baixo", "baixa", "menor", "mínimo", "mínima"],
	},
};
