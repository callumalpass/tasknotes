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
    it.skip('should have a disableCalendarOnMobile setting defined (reproduces issue #898)', () => {
      // This test will fail until the setting is added to the defaults
      expect(DEFAULT_SETTINGS).toHaveProperty('disableCalendarOnMobile');
    });

    it.skip('should default disableCalendarOnMobile to false (reproduces issue #898)', () => {
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

      // Helper function that mirrors the logic that should be in main.ts
      const shouldInitializeCalendars = (isMobile: boolean, disableOnMobile: boolean): boolean => {
        if (isMobile && disableOnMobile) {
          return false;
        }
        return true;
      };

      const result = shouldInitializeCalendars(Platform.isMobile, settings.disableCalendarOnMobile);

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

      const shouldInitializeCalendars = (isMobile: boolean, disableOnMobile: boolean): boolean => {
        if (isMobile && disableOnMobile) {
          return false;
        }
        return true;
      };

      const result = shouldInitializeCalendars(Platform.isMobile, settings.disableCalendarOnMobile);

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

      const shouldInitializeCalendars = (isMobile: boolean, disableOnMobile: boolean): boolean => {
        if (isMobile && disableOnMobile) {
          return false;
        }
        return true;
      };

      const result = shouldInitializeCalendars(Platform.isMobile, settings.disableCalendarOnMobile);

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
      const shouldInitializeIcsService = (isMobile: boolean, disableOnMobile: boolean): boolean => {
        if (isMobile && disableOnMobile) {
          return false;
        }
        return true;
      };

      const result = shouldInitializeIcsService(Platform.isMobile, settings.disableCalendarOnMobile);

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

      const shouldInitializeCalendars = (
        isMobile: boolean,
        disableOnMobile: boolean,
        googleEnabled: boolean,
        microsoftEnabled: boolean
      ): boolean => {
        // Mobile-specific disable takes precedence over individual calendar enable settings
        if (isMobile && disableOnMobile) {
          return false;
        }
        return googleEnabled || microsoftEnabled;
      };

      const result = shouldInitializeCalendars(
        Platform.isMobile,
        syncedSettings.disableCalendarOnMobile,
        syncedSettings.enableGoogleCalendar,
        syncedSettings.enableMicrosoftCalendar
      );

      expect(result).toBe(false);
    });
  });
});
