import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { BaseController } from "./BaseController";
import TaskNotesPlugin from "../main";
import { OAuthService } from "../services/OAuthService";
import { ICSSubscriptionService } from "../services/ICSSubscriptionService";
import { CalendarProviderRegistry } from "../services/CalendarProvider";
import { OAuthProvider } from "../types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
	async getCalendars(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/google")
	async getGoogleCalendars(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const data = await this.getProviderDetails("google");
			this.sendResponse(res, 200, this.successResponse(data));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/microsoft")
	async getMicrosoftCalendars(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const data = await this.getProviderDetails("microsoft");
			this.sendResponse(res, 200, this.successResponse(data));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/subscriptions")
	async getSubscriptions(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/calendars/events")
	async getEvents(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || "", true);
			const params = parsedUrl.query;

			const startDate = params.start ? new Date(params.start as string) : null;
			const endDate = params.end ? new Date(params.end as string) : null;

			const result = collectCalendarEvents(
				this.calendarProviderRegistry,
				this.icsSubscriptionService,
				{ start: startDate, end: endDate }
			);

			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private async getProvidersOverview(): Promise<any[]> {
		const providers: any[] = [];

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

	private async getProviderDetails(provider: OAuthProvider): Promise<any> {
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
