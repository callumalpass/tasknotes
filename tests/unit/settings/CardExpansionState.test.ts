import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from "../../helpers/real-i18n";
import { msg } from "@lingui/core/macro";
import { App } from 'obsidian';
import type TaskNotesPlugin from '../../../src/main';
import { TaskNotesSettingTab } from '../../../src/settings/TaskNotesSettingTab';
import { createCard } from '../../../src/settings/components/CardComponent';

const collapsedClass = 'tasknotes-settings__card--collapsed';

describe('Settings card expansion across rebuilds', () => {
  let tab: TaskNotesSettingTab;
  let save: jest.Mock;
  let onCollapseChange: jest.Mock;

  const card = (id: string, parent = tab.containerEl) =>
    parent.querySelector<HTMLElement>(`[data-card-id="${id}"]`)!;
  const toggle = (element: HTMLElement) =>
    element.querySelector<HTMLElement>(':scope > .tasknotes-settings__card-header')!.click();

  beforeEach(() => {
    save = jest.fn();
    onCollapseChange = jest.fn();
    const plugin = {
      saveSettings: save,
      registerEvent: jest.fn(),
      i18n: { on: jest.fn(), translate: mockObserveTranslation() },
    } as unknown as TaskNotesPlugin;
    tab = new TaskNotesSettingTab({} as App, plugin);
    const render = (container: HTMLElement) => {
      // Like the real property renderers, build nested content while detached.
      for (const id of ['status', 'priority']) {
        const nested = document.createElement('div');
        createCard(nested, {
          id: 'shared-id', collapsible: true, defaultCollapsed: true,
          header: { primaryText: 'Value' }, onCollapseChange,
        });
        createCard(container, {
          id, collapsible: true, defaultCollapsed: true,
          header: { primaryText: id },
          content: { sections: [{ rows: [{ label: '', input: nested }] }] },
        });
      }
      createCard(container, {
        id: 'initially-open', collapsible: true, defaultCollapsed: false,
        header: { primaryText: 'Initially open' },
      });
    };
    jest.spyOn(tab as any, 'getTabConfigurations').mockReturnValue([
      { id: 'general', nameKey: msg({ message: "General", context: "settings.tabs.general" }), renderFn: render },
      { id: 'task-properties', nameKey: msg({ message: "Task properties", context: "settings.tabs.taskProperties" }), renderFn: render },
    ]);
    tab.display();
  });

  it('restores nested cards even if the host clears the old DOM before rendering', () => {
    toggle(card('status'));
    toggle(card('shared-id', card('status')));
    tab.containerEl.empty();
    tab.display();

    expect(card('status').classList.contains(collapsedClass)).toBe(false);
    const child = card('shared-id', card('status'));
    expect(child.classList.contains(collapsedClass)).toBe(false);
    expect(child.querySelector<HTMLElement>('.tasknotes-settings__card-header')!.title)
      .toBe('Collapse card');
    expect(card('priority').classList.contains(collapsedClass)).toBe(true);
    expect(card('shared-id', card('priority')).classList.contains(collapsedClass)).toBe(true);
    expect(onCollapseChange).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('remembers explicit collapse as well as expansion', () => {
    toggle(card('initially-open'));
    toggle(card('status'));
    toggle(card('status'));
    tab.display();
    expect(card('initially-open').classList.contains(collapsedClass)).toBe(true);
    expect(card('status').classList.contains(collapsedClass)).toBe(true);
  });

  it('keeps tab namespaces separate and restores lazily rendered tabs', () => {
    toggle(card('status'));
    (tab as any).switchTab('task-properties');
    const properties = tab.containerEl.querySelector<HTMLElement>('#settings-tab-task-properties')!;
    expect(card('status', properties).classList.contains(collapsedClass)).toBe(true);
    tab.display(); // only task-properties is rendered now
    (tab as any).switchTab('general');
    const general = tab.containerEl.querySelector<HTMLElement>('#settings-tab-general')!;
    expect(card('status', general).classList.contains(collapsedClass)).toBe(false);
  });

  it('restores through the Obsidian setting-definition render callback', () => {
    toggle(card('status'));
    const definition = tab.getSettingDefinitions()[0] as any;
    const settingEl = document.createElement('div');
    tab.containerEl.empty();
    tab.containerEl.appendChild(settingEl);
    definition.render({ settingEl });
    expect(card('status').classList.contains(collapsedClass)).toBe(false);
  });

  it('does not share state with a new settings-tab instance', () => {
    toggle(card('status'));
    const freshTab = new TaskNotesSettingTab({} as App, tab.plugin);
    jest.spyOn(freshTab as any, 'getTabConfigurations')
      .mockReturnValue((tab as any).getTabConfigurations());
    freshTab.display();
    expect(card('status', freshTab.containerEl).classList.contains(collapsedClass)).toBe(true);
  });
});
