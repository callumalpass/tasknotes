import TaskNotesPlugin from '../../../src/main';
import { TaskNotesSettingTab } from '../../../src/settings/settings';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

// Lightweight DOM test for the settings section

describe('Settings UI - User Fields (optional)', () => {
  test('renders under Field mapping tab with expected controls (multi-field)', async () => {
    // Provide Platform mock expected by settings.ts
    (global as any).Platform = { isMobile: false };

    const app: any = { workspace: { onLayoutReady: (fn: any) => fn() }, metadataCache: {}, vault: {} };
    const plugin = new TaskNotesPlugin(app);
    // inject defaults
    (plugin as any).settings = { ...DEFAULT_SETTINGS };

    const tab = new TaskNotesSettingTab(app, plugin);
    tab.display();

    // Switch to field-mapping tab
    (tab as any).switchTab('field-mapping');

    const container = (tab as any).tabContents['field-mapping'];
    // Heading text may not render in mock; verify controls/descriptions instead
    expect(container.textContent).toContain('User Fields (optional)');
    expect(container.textContent).toContain('Define one or more custom frontmatter properties');
    expect(container.textContent).toContain('Property Name');
    expect(container.textContent).toContain('Display Name');
    expect(container.textContent).toContain('Type');
    expect(container.textContent).toContain('Add field');
  });
});

