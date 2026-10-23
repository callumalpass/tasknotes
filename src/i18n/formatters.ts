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
	const hours = Math.floor(minutes / 60);
	const remainder = Math.round(minutes % 60);
	const unit = (value: number, unit: string) => uiNumber(value, { style: "unit", unit, unitDisplay: "short" });
	return hours > 0 ? `${unit(hours, "hour")} ${unit(remainder, "minute")}` : unit(Math.round(minutes), "minute");
}
