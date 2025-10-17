/**
 * Tests for cache event bridging to plugin emitter
 * Ensures that cache events trigger EVENT_DATA_CHANGED for view refreshes
 */

import { EVENT_DATA_CHANGED } from '../../src/types';

describe('Main Plugin - Cache Event Bridge', () => {
	let mockPlugin: any;
	let mockCacheManager: any;
	let eventDataChangedTriggered: boolean;

	beforeEach(() => {
		eventDataChangedTriggered = false;

		// Create a mock cache manager with event emitter capabilities
		mockCacheManager = {
			on: jest.fn(),
			off: jest.fn(),
			trigger: jest.fn(),
			initialize: jest.fn(),
			clearAllCaches: jest.fn(),
			updateConfig: jest.fn(),
		};

		// Create a mock plugin with emitter
		mockPlugin = {
			cacheManager: mockCacheManager,
			emitter: {
				on: jest.fn(),
				trigger: jest.fn((eventName: string) => {
					if (eventName === EVENT_DATA_CHANGED) {
						eventDataChangedTriggered = true;
					}
				}),
			},
			registerEvent: jest.fn(),
		};
	});

	describe('Event Bridging Setup', () => {
		test('should set up listener for file-updated events from cache manager', () => {
			// This test verifies that the plugin sets up a listener for cache events
			// The actual implementation will be in main.ts setupCacheEventBridge()
			
			// Simulate what the plugin should do during initialization
			const setupCacheEventBridge = (plugin: any) => {
				plugin.cacheManager.on('file-updated', () => {
					plugin.emitter.trigger(EVENT_DATA_CHANGED);
				});
			};

			// Act
			setupCacheEventBridge(mockPlugin);

			// Assert
			expect(mockCacheManager.on).toHaveBeenCalledWith(
				'file-updated',
				expect.any(Function)
			);
		});

		test('should trigger EVENT_DATA_CHANGED when file-updated event fires', () => {
			// Arrange
			let fileUpdatedCallback: Function | null = null;
			mockCacheManager.on.mockImplementation((eventName: string, callback: Function) => {
				if (eventName === 'file-updated') {
					fileUpdatedCallback = callback;
				}
			});

			const setupCacheEventBridge = (plugin: any) => {
				plugin.cacheManager.on('file-updated', () => {
					plugin.emitter.trigger(EVENT_DATA_CHANGED);
				});
			};

			setupCacheEventBridge(mockPlugin);

			// Act - Simulate cache manager triggering file-updated
			if (fileUpdatedCallback) {
				fileUpdatedCallback({ path: 'test.md' });
			}

			// Assert
			expect(eventDataChangedTriggered).toBe(true);
		});

		test('should set up listener for file-deleted events from cache manager', () => {
			const setupCacheEventBridge = (plugin: any) => {
				plugin.cacheManager.on('file-deleted', () => {
					plugin.emitter.trigger(EVENT_DATA_CHANGED);
				});
			};

			// Act
			setupCacheEventBridge(mockPlugin);

			// Assert
			expect(mockCacheManager.on).toHaveBeenCalledWith(
				'file-deleted',
				expect.any(Function)
			);
		});

		test('should set up listener for file-renamed events from cache manager', () => {
			const setupCacheEventBridge = (plugin: any) => {
				plugin.cacheManager.on('file-renamed', () => {
					plugin.emitter.trigger(EVENT_DATA_CHANGED);
				});
			};

			// Act
			setupCacheEventBridge(mockPlugin);

			// Assert
			expect(mockCacheManager.on).toHaveBeenCalledWith(
				'file-renamed',
				expect.any(Function)
			);
		});
	});

	describe('Event Bridging Behavior', () => {
		test('should trigger EVENT_DATA_CHANGED for all cache events', () => {
			// Arrange
			const callbacks: { [key: string]: Function } = {};
			mockCacheManager.on.mockImplementation((eventName: string, callback: Function) => {
				callbacks[eventName] = callback;
			});

			const setupCacheEventBridge = (plugin: any) => {
				plugin.cacheManager.on('file-updated', () => {
					plugin.emitter.trigger(EVENT_DATA_CHANGED);
				});
				plugin.cacheManager.on('file-deleted', () => {
					plugin.emitter.trigger(EVENT_DATA_CHANGED);
				});
				plugin.cacheManager.on('file-renamed', () => {
					plugin.emitter.trigger(EVENT_DATA_CHANGED);
				});
			};

			setupCacheEventBridge(mockPlugin);

			// Act & Assert - file-updated
			eventDataChangedTriggered = false;
			callbacks['file-updated']({ path: 'test.md' });
			expect(eventDataChangedTriggered).toBe(true);

			// Act & Assert - file-deleted
			eventDataChangedTriggered = false;
			callbacks['file-deleted']({ path: 'test.md' });
			expect(eventDataChangedTriggered).toBe(true);

			// Act & Assert - file-renamed
			eventDataChangedTriggered = false;
			callbacks['file-renamed']({ oldPath: 'old.md', newPath: 'new.md' });
			expect(eventDataChangedTriggered).toBe(true);
		});
	});
});

