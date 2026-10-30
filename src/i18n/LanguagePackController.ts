import type { I18nService } from "./I18nService";
import type { LanguagePackLoader } from "./LanguagePackLoader";

/** Keeps slow downloads from overriding a newer language selection. */
export class LanguagePackController {
	private selection = 0;
	private disposed = false;

	constructor(
		private readonly i18n: I18nService,
		private readonly loader: LanguagePackLoader
	) {}

	async setLocale(requested: string): Promise<boolean> {
		if (this.disposed) return false;
		const selection = ++this.selection;
		const locale = this.i18n.getPreferredLocale(requested);
		if (!this.i18n.hasLocale(locale)) {
			try {
				const messages = await this.loader.load(locale);
				if (this.disposed) return false;
				this.i18n.registerLocale(locale, messages);
			} catch (error) {
				if (this.disposed || selection !== this.selection) return false;
				throw error;
			}
		}
		if (this.disposed || selection !== this.selection) return false;
		this.i18n.setLocale(locale);
		return true;
	}

	dispose(): void {
		this.disposed = true;
		this.selection++;
	}
}
