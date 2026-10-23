import { format, type FormatOptions } from "date-fns";
import { enUS, fr, de, es, ja, ko, ptBR, ru, zhCN } from "date-fns/locale";
import { uiLocale } from "./runtime";

const dateLocales = { en: enUS, fr, de, es, ja, ko, pt: ptBR, ru, zh: zhCN };

/** Presentation only. ISO keys, RRULEs, filenames and configured template tokens stay stable. */
export function formatUIDate(date: Date | number | string, pattern: string, options?: FormatOptions): string {
	const locale = dateLocales[uiLocale().split("-")[0] as keyof typeof dateLocales] ?? enUS;
	return format(date, pattern, { ...options, locale });
}

/** Existing filename/template expressions deliberately retain English across UI switches. */
export function formatStableDate(date: Date | number | string, pattern: string, options?: FormatOptions): string {
	return format(date, pattern, { ...options, locale: enUS });
}

export function uiNumber(value: number, options?: Intl.NumberFormatOptions): string {
	return new Intl.NumberFormat(uiLocale(), options).format(value);
}

export function uiPercent(value: number): string {
	return uiNumber(value / 100, { style: "percent", maximumFractionDigits: 0 });
}

export function uiDuration(minutes: number): string {
	// Match Intl's display precision before decomposition, avoiding "1 hr 60 min".
	const rounded = Math.round(minutes * 1000) / 1000;
	const hours = Math.trunc(rounded / 60);
	const remainder = rounded % 60;
	const unit = (value: number, unit: string) => uiNumber(value, { style: "unit", unit, unitDisplay: "short" });
	const parts = hours === 0 ? [unit(remainder, "minute")] : remainder === 0
		? [unit(hours, "hour")] : [unit(hours, "hour"), unit(remainder, "minute")];
	return new Intl.ListFormat(uiLocale(), { style: "narrow", type: "unit" }).format(parts);
}
