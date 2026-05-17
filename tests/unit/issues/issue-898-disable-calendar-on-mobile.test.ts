/**
 * Issue #898: Setting to disable calendar integration on mobile
 *
 * Test that calendar integration can be disabled on mobile devices
 * to prevent long loading delays when syncing calendars with years of events.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/898
 */

import { Platform } from '../../__mocks__/obsidian';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';
import { isCalendarIntegrationDisabledOnMobile } from '../../../src/utils/calendarIntegration';

// Store original Platform values to restore after tests
const originalIsMobile = Platform.isMobile;
const originalIsDesktop = Platform.isDesktop;

describe('Issue #898: Disable calendar integration on mobile', () => {
  afterEach(() => {
    // Restore original Platform values
    Platform.isMobile = originalIsMobile;
    Platform.isDesktop = originalIsDesktop;
  });

  describe('Settings schema', () => {
    it('has a disableCalendarOnMobile setting defined', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('disableCalendarOnMobile');
    });

    it('defaults disableCalendarOnMobile to false', () => {
      // Default should be false so existing users are not affected
      expect(DEFAULT_SETTINGS.disableCalendarOnMobile).toBe(false);
    });
  });

  describe('Calendar initialization behavior', () => {
    it('should skip calendar service initialization on mobile when disableCalendarOnMobile is true', () => {
      // Simulate mobile environment
      Platform.isMobile = true;
      Platform.isDesktop = false;

      const settings = {
        ...DEFAULT_SETTINGS,
        disableCalendarOnMobile: true,
        enableGoogleCalendar: true,
        enableMicrosoftCalendar: true,
      };

      const result = !isCalendarIntegrationDisabledOnMobile(settings, Platform.isMobile);

      expect(result).toBe(false);
    });

    it('should initialize calendar services on mobile when disableCalendarOnMobile is false', () => {
      // Simulate mobile environment
      Platform.isMobile = true;
      Platform.isDesktop = false;

      const settings = {
        ...DEFAULT_SETTINGS,
        disableCalendarOnMobile: false,
        enableGoogleCalendar: true,
        enableMicrosoftCalendar: true,
      };

      const result = !isCalendarIntegrationDisabledOnMobile(settings, Platform.isMobile);

      expect(result).toBe(true);
    });

    it('should always initialize calendar services on desktop regardless of disableCalendarOnMobile setting', () => {
      // Simulate desktop environment
      Platform.isMobile = false;
      Platform.isDesktop = true;

      const settings = {
        ...DEFAULT_SETTINGS,
        disableCalendarOnMobile: true, // Should be ignored on desktop
        enableGoogleCalendar: true,
        enableMicrosoftCalendar: true,
      };

      const result = !isCalendarIntegrationDisabledOnMobile(settings, Platform.isMobile);

      expect(result).toBe(true);
    });
  });

  describe('ICS subscription behavior on mobile', () => {
    it('should also skip ICS subscription service initialization when calendar is disabled on mobile', () => {
      Platform.isMobile = true;
      Platform.isDesktop = false;

      const settings = {
        ...DEFAULT_SETTINGS,
        disableCalendarOnMobile: true,
      };

      // ICS subscriptions are part of calendar integration and should also be skipped
      const result = !isCalendarIntegrationDisabledOnMobile(settings, Platform.isMobile);

      expect(result).toBe(false);
    });
  });

  describe('Settings sync consideration', () => {
    /**
     * The user's use case involves syncing settings between desktop and mobile.
     * The disableCalendarOnMobile setting should be respected on mobile even when
     * calendar settings (enableGoogleCalendar, enableMicrosoftCalendar) are synced
     * from desktop where they are enabled.
     */
    it('should respect disableCalendarOnMobile even when enableGoogleCalendar is synced as true', () => {
      Platform.isMobile = true;
      Platform.isDesktop = false;

      // This simulates settings synced from desktop
      const syncedSettings = {
        ...DEFAULT_SETTINGS,
        enableGoogleCalendar: true, // Synced from desktop where it's enabled
        enableMicrosoftCalendar: true, // Synced from desktop where it's enabled
        enabledGoogleCalendars: ['calendar1@google.com', 'calendar2@google.com'],
        enabledMicrosoftCalendars: ['calendar1@outlook.com'],
        disableCalendarOnMobile: true, // User specifically set this to prevent mobile loading issues
      };

      const result =
        !isCalendarIntegrationDisabledOnMobile(syncedSettings, Platform.isMobile) &&
        (syncedSettings.enableGoogleCalendar || syncedSettings.enableMicrosoftCalendar);

      expect(result).toBe(false);
    });
  });
});
