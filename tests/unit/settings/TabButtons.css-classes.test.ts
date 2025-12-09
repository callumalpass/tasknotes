import TaskNotesPlugin from '../../../src/main';
import { TaskNotesSettingTab } from '../../../src/settings/TaskNotesSettingTab';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';
import { createI18nService } from '../../../src/i18n';

// Obsidian's HTMLElement shim exposes appendText and setAttr; add minimal polyfill for jsdom
(HTMLElement.prototype as any).appendText ??= function (text: string) {
  this.appendChild(document.createTextNode(text));
};
(HTMLElement.prototype as any).setAttr ??= function (name: string, value: string) {
  this.setAttribute(name, value);
};

describe('Settings UI - Tab Button CSS Classes', () => {
  let app: any;
  let plugin: TaskNotesPlugin;
  let tab: TaskNotesSettingTab;

  beforeEach(() => {
    // Provide Platform mock expected by settings.ts
    (global as any).Platform = { isMobile: false };

    app = {
      workspace: { onLayoutReady: (fn: any) => fn() },
      metadataCache: {},
      vault: { getConfig: jest.fn().mockReturnValue(false) }
    };
    plugin = new TaskNotesPlugin(app);
    // inject defaults
    (plugin as any).settings = { ...DEFAULT_SETTINGS };
    (plugin as any).i18n = createI18nService();
    (plugin as any).registerEvent = jest.fn();
    (plugin as any).manifest = { version: '0.0.0' };
    (plugin as any).fieldMapper = {
      isPropertyForField: jest.fn(() => false),
      toUserField: jest.fn((field) => field),
      toInternalField: jest.fn((field) => field),
    };

    tab = new TaskNotesSettingTab(app, plugin);
  });

  test('active tab button has required CSS classes for theme compatibility', () => {
    tab.display();

    const activeButton = tab.containerEl.querySelector('#tab-button-general') as HTMLElement;
    expect(activeButton).toBeTruthy();

    // Check for standard Obsidian classes
    expect(activeButton.classList.contains('is-active')).toBe(true);
    expect(activeButton.classList.contains('vertical-tab-nav-item')).toBe(true);

    // Check for existing plugin classes
    expect(activeButton.classList.contains('settings-tab-button')).toBe(true);
    expect(activeButton.classList.contains('settings-view__tab-button')).toBe(true);
    expect(activeButton.classList.contains('active')).toBe(true);
    expect(activeButton.classList.contains('settings-view__tab-button--active')).toBe(true);

    // Check ARIA attributes
    expect(activeButton.getAttribute('aria-selected')).toBe('true');
    expect(activeButton.getAttribute('tabindex')).toBe('0');
  });

  test('inactive tab buttons have vertical-tab-nav-item class but not is-active', () => {
    tab.display();

    const inactiveButton = tab.containerEl.querySelector('#tab-button-appearance') as HTMLElement;
    expect(inactiveButton).toBeTruthy();

    // Should have vertical-tab-nav-item for theme compatibility
    expect(inactiveButton.classList.contains('vertical-tab-nav-item')).toBe(true);

    // Should NOT have active classes
    expect(inactiveButton.classList.contains('is-active')).toBe(false);
    expect(inactiveButton.classList.contains('active')).toBe(false);
    expect(inactiveButton.classList.contains('settings-view__tab-button--active')).toBe(false);

    // Should still have base classes
    expect(inactiveButton.classList.contains('settings-tab-button')).toBe(true);
    expect(inactiveButton.classList.contains('settings-view__tab-button')).toBe(true);

    // Check ARIA attributes
    expect(inactiveButton.getAttribute('aria-selected')).toBe('false');
    expect(inactiveButton.getAttribute('tabindex')).toBe('-1');
  });

  test('switching tabs updates CSS classes correctly', () => {
    tab.display();

    const generalButton = tab.containerEl.querySelector('#tab-button-general') as HTMLElement;
    const appearanceButton = tab.containerEl.querySelector('#tab-button-appearance') as HTMLElement;

    // Initial state: general is active
    expect(generalButton.classList.contains('is-active')).toBe(true);
    expect(generalButton.classList.contains('active')).toBe(true);
    expect(appearanceButton.classList.contains('is-active')).toBe(false);
    expect(appearanceButton.classList.contains('active')).toBe(false);

    // Switch to appearance tab
    (tab as any).switchTab('appearance');

    // After switch: appearance is active, general is not
    expect(generalButton.classList.contains('is-active')).toBe(false);
    expect(generalButton.classList.contains('active')).toBe(false);
    expect(appearanceButton.classList.contains('is-active')).toBe(true);
    expect(appearanceButton.classList.contains('active')).toBe(true);

    // Both should always have vertical-tab-nav-item
    expect(generalButton.classList.contains('vertical-tab-nav-item')).toBe(true);
    expect(appearanceButton.classList.contains('vertical-tab-nav-item')).toBe(true);
  });

  test('all tab buttons have vertical-tab-nav-item class', () => {
    tab.display();

    const allButtons = tab.containerEl.querySelectorAll('.settings-tab-button');
    expect(allButtons.length).toBeGreaterThan(0);

    allButtons.forEach(button => {
      expect(button.classList.contains('vertical-tab-nav-item')).toBe(true);
    });
  });
});
