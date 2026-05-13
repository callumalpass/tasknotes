import { parseRequestUrl, type HTTPRequestLike, type HTTPResponseLike } from "./httpTypes";
import { BaseController } from "./BaseController";
import TaskNotesPlugin from "../main";
import { OAuthService } from "../services/OAuthService";
import { ICSSubscriptionService } from "../services/ICSSubscriptionService";
import { CalendarProviderRegistry } from "../services/CalendarProvider";
import { OAuthProvider } from "../types";
 
import { Get } from "../utils/OpenAPIDecorators";
import { collectCalendarEvents } from "../utils/calendarUtils";

export class CalendarsController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private oauthService: OAuthService,
		private icsSubscriptionService: ICSSubscriptionService,
		private calendarProviderRegistry: CalendarProviderRegistry
	) {
		super();
	}

	@Get("/api/calendars")
	async getCalendars(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const providers = await this.getProvidersOverview();
			const subscriptions = this.icsSubscriptionService.getSubscriptions();

			this.sendResponse(
				res,
				200,
				this.successResponse({
					providers,
					subscriptions: {
						total: subscriptions.length,
						enabled: subscriptions.filter((s) => s.enabled).length,
					},
				})
			);
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/calendars/google")
	async getGoogleCalendars(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const data = await this.getProviderDetails("google");
			this.sendResponse(res, 200, this.successResponse(data));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/calendars/microsoft")
	async getMicrosoftCalendars(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const data = await this.getProviderDetails("microsoft");
			this.sendResponse(res, 200, this.successResponse(data));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/calendars/subscriptions")
	async getSubscriptions(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const subscriptions = this.icsSubscriptionService.getSubscriptions();

			const subscriptionsWithStatus = subscriptions.map((sub) => ({
				...sub,
				lastFetched: this.icsSubscriptionService.getLastFetched(sub.id) || null,
				lastError: this.icsSubscriptionService.getLastError(sub.id) || null,
			}));

			this.sendResponse(
				res,
				200,
				this.successResponse({
					subscriptions: subscriptionsWithStatus,
				})
			);
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/calendars/events")
	async getEvents(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const params = parseRequestUrl(req).searchParams;

			const start = params.get("start");
			const end = params.get("end");
			const startDate = start ? new Date(start) : null;
			const endDate = end ? new Date(end) : null;

			const result = collectCalendarEvents(
				this.calendarProviderRegistry,
				this.icsSubscriptionService,
				{ start: startDate, end: endDate }
			);

			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	private async getProvidersOverview(): Promise<unknown[]> {
		const providers: unknown[] = [];

		// Google Calendar
		const googleConnected = await this.oauthService.isConnected("google");
		const googleConnection = googleConnected
			? await this.oauthService.getConnection("google")
			: null;
		const googleCalendars = this.plugin.googleCalendarService?.getAvailableCalendars() || [];

		providers.push({
			id: "google",
			name: "Google Calendar",
			connected: googleConnected,
			...(googleConnected && {
				email: googleConnection?.userEmail,
				calendarCount: googleCalendars.length,
			}),
		});

		// Microsoft Calendar
		const microsoftConnected = await this.oauthService.isConnected("microsoft");
		const microsoftConnection = microsoftConnected
			? await this.oauthService.getConnection("microsoft")
			: null;
		const microsoftCalendars =
			this.plugin.microsoftCalendarService?.getAvailableCalendars() || [];

		providers.push({
			id: "microsoft",
			name: "Microsoft Calendar",
			connected: microsoftConnected,
			...(microsoftConnected && {
				email: microsoftConnection?.userEmail,
				calendarCount: microsoftCalendars.length,
			}),
		});

		return providers;
	}

	private async getProviderDetails(provider: OAuthProvider): Promise<unknown> {
		const connected = await this.oauthService.isConnected(provider);
		const connection = connected ? await this.oauthService.getConnection(provider) : null;

		if (!connected) {
			return { connected: false };
		}

		const calendarService =
			provider === "google"
				? this.plugin.googleCalendarService
				: this.plugin.microsoftCalendarService;

		const calendars = calendarService?.getAvailableCalendars() || [];

		return {
			connected: true,
			email: connection?.userEmail,
			connectedAt: connection?.connectedAt,
			calendars,
		};
	}

}
