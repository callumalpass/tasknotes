import { CalendarView } from '../../../src/bases/CalendarView';
import { MiniCalendarView } from '../../../src/bases/MiniCalendarView';
import { BasesViewBase } from '../../../src/bases/BasesViewBase';
import { EventEmitter } from '../../../src/utils/EventEmitter';

jest.mock('../../../src/bases/calendarKeyboard', () => ({
	installCalendarKeyboard: jest.fn(() => ({ destroy: jest.fn() })),
}));

let disposers: Array<() => void> = [];

beforeEach(() => {
	jest.spyOn(BasesViewBase.prototype, 'onload').mockImplementation(() => undefined);
});

afterEach(() => {
	for (const dispose of disposers.reverse()) dispose();
	disposers = [];
	jest.restoreAllMocks();
	document.body.replaceChildren();
});

describe.each([
	['calendar', CalendarView, 'refetchEvents'],
	['mini-calendar', MiniCalendarView, 'render'],
] as const)('%s provider refresh subscriptions', (name, View, refreshMethod) => {
	it.each([
		'icsSubscriptionService', 'googleCalendarService', 'microsoftCalendarService',
		...(name === 'calendar' ? ['ownGoogleCalendarService', 'hostedGoogleCalendarService'] : []),
	])(
		'refreshes on %s changes only while connected and unregisters on unload', (source) => {
			const ownGoogleCalendarService = new EventEmitter();
			const services = {
				icsSubscriptionService: new EventEmitter(),
				googleCalendarService: ownGoogleCalendarService,
				ownGoogleCalendarService,
				hostedGoogleCalendarService: new EventEmitter(),
				microsoftCalendarService: new EventEmitter(),
			};
			const root = document.body.appendChild(document.createElement('div'));
			const refresh = jest.fn().mockResolvedValue(undefined);
			const view = Object.create(View.prototype);
			Object.assign(view, {
				plugin: {
					...services,
					app: { metadataCache: { on: jest.fn(() => ({})) } },
					emitter: { on: jest.fn(() => ({})), offref: jest.fn() },
				},
				rootElement: root,
				readViewOptions: jest.fn(),
				getConfigSnapshot: jest.fn(() => ''),
				getDataSignature: jest.fn(() => ''),
				getControllerViewName: jest.fn(() => ''),
				register: (dispose: () => void) => disposers.push(dispose),
				registerEvent: jest.fn(),
				registerDomEvent: jest.fn(),
				[refreshMethod]: refresh,
			});

			view.onload();
			if (source === 'hostedGoogleCalendarService') {
				view.plugin.googleCalendarService = services.hostedGoogleCalendarService;
			}
			const provider = services[source as keyof typeof services];
			provider.emit('data-changed');
			expect(refresh).toHaveBeenCalledTimes(1);

			root.remove();
			provider.emit('data-changed');
			expect(refresh).toHaveBeenCalledTimes(1);

			for (const dispose of disposers.reverse()) dispose();
			disposers = [];
			document.body.appendChild(root);
			provider.emit('data-changed');
			expect(refresh).toHaveBeenCalledTimes(1);
		}
	);
});
