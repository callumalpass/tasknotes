import { CalendarView } from '../../../src/bases/CalendarView';
import { MiniCalendarView } from '../../../src/bases/MiniCalendarView';
import { BasesViewBase } from '../../../src/bases/BasesViewBase';
import { EventEmitter } from '../../../src/utils/EventEmitter';

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
] as const)('%s provider refresh subscriptions', (_name, View, refreshMethod) => {
	it.each(['icsSubscriptionService', 'googleCalendarService', 'microsoftCalendarService'])(
		'refreshes on %s changes only while connected and unregisters on unload', (source) => {
			const services = {
				icsSubscriptionService: new EventEmitter(),
				googleCalendarService: new EventEmitter(),
				microsoftCalendarService: new EventEmitter(),
			};
			const root = document.body.appendChild(document.createElement('div'));
			const refresh = jest.fn().mockResolvedValue(undefined);
			const view = Object.create(View.prototype);
			Object.assign(view, {
				plugin: { ...services, emitter: { on: jest.fn(() => ({})), offref: jest.fn() } },
				rootElement: root,
				readViewOptions: jest.fn(),
				getConfigSnapshot: jest.fn(() => ''),
				getDataSignature: jest.fn(() => ''),
				getControllerViewName: jest.fn(() => ''),
				register: (dispose: () => void) => disposers.push(dispose),
				[refreshMethod]: refresh,
			});

			view.onload();
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
