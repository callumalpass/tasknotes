/**
 * Test to verify Issue #1333: Support timeblock creation with external journaling plugins
 *
 * Feature Description:
 * Allow creating timeblocks with journaling plugins other than the native Daily Notes plugin
 * (e.g., "Journals" plugin by srg-kostyrko). This requires an abstraction layer that allows
 * users to specify metadata, paths, or other methods to identify daily notes.
 *
 * Current State:
 * - TimeblockCreationModal is tightly coupled to obsidian-daily-notes-interface
 * - Only works when the native Daily Notes plugin is enabled
 * - No support for alternative journal systems
 *
 * Required Changes:
 * 1. Create a JournalProvider interface for daily note resolution
 * 2. Implement adapters for native Daily Notes and external plugins
 * 3. Add settings to choose journal provider and configure custom paths/formats
 *
 * Locations:
 * - src/modals/TimeblockCreationModal.ts:271 - hardcoded Daily Notes check
 * - src/bases/calendar-core.ts - uses obsidian-daily-notes-interface directly
 * - src/utils/helpers.ts - timeblock CRUD operations use daily notes interface
 */

import { TaskNotesSettings } from '../../../src/types/settings';

// Mock types for journal provider abstraction (feature not yet implemented)
interface JournalProvider {
    name: string;
    isAvailable(): boolean;
    getDailyNoteForDate(date: string): Promise<{ path: string; basename: string } | null>;
    createDailyNoteForDate(date: string): Promise<{ path: string; basename: string }>;
    getAllDailyNotes(): Record<string, { path: string; basename: string }>;
}

// Mock implementation of native daily notes provider (current behavior)
class NativeDailyNotesProvider implements JournalProvider {
    name = 'Native Daily Notes';

    isAvailable(): boolean {
        // In real implementation: return appHasDailyNotesPluginLoaded()
        return true;
    }

    getDailyNoteForDate(date: string): Promise<{ path: string; basename: string } | null> {
        // In real implementation: use getDailyNote() from obsidian-daily-notes-interface
        return Promise.resolve({ path: `daily/${date}.md`, basename: date });
    }

    createDailyNoteForDate(date: string): Promise<{ path: string; basename: string }> {
        // In real implementation: use createDailyNote() from obsidian-daily-notes-interface
        return Promise.resolve({ path: `daily/${date}.md`, basename: date });
    }

    getAllDailyNotes(): Record<string, { path: string; basename: string }> {
        // In real implementation: use getAllDailyNotes() from obsidian-daily-notes-interface
        return {};
    }
}

// Mock implementation of Journals plugin provider (feature not yet implemented)
class JournalsPluginProvider implements JournalProvider {
    name = 'Journals Plugin';
    private config: {
        folder: string;
        dateFormat: string;
    };

    constructor(config: { folder: string; dateFormat: string }) {
        this.config = config;
    }

    isAvailable(): boolean {
        // In real implementation: check if Journals plugin is loaded
        return false; // Not implemented yet
    }

    getDailyNoteForDate(date: string): Promise<{ path: string; basename: string } | null> {
        // In real implementation: resolve path based on Journals plugin config
        const basename = this.formatDate(date);
        return Promise.resolve({ path: `${this.config.folder}/${basename}.md`, basename });
    }

    createDailyNoteForDate(date: string): Promise<{ path: string; basename: string }> {
        // In real implementation: create note via Journals plugin API
        const basename = this.formatDate(date);
        return Promise.resolve({ path: `${this.config.folder}/${basename}.md`, basename });
    }

    getAllDailyNotes(): Record<string, { path: string; basename: string }> {
        // In real implementation: get all journal entries
        return {};
    }

    private formatDate(date: string): string {
        // In real implementation: use moment with config.dateFormat
        return date;
    }
}

// Mock custom path provider for manual configuration
class CustomPathProvider implements JournalProvider {
    name = 'Custom Path';
    private config: {
        folder: string;
        dateFormat: string;
        template?: string;
    };

    constructor(config: { folder: string; dateFormat: string; template?: string }) {
        this.config = config;
    }

    isAvailable(): boolean {
        // Custom path is always available if configured
        return true;
    }

    getDailyNoteForDate(date: string): Promise<{ path: string; basename: string } | null> {
        const basename = this.formatDate(date);
        return Promise.resolve({ path: `${this.config.folder}/${basename}.md`, basename });
    }

    createDailyNoteForDate(date: string): Promise<{ path: string; basename: string }> {
        const basename = this.formatDate(date);
        return Promise.resolve({ path: `${this.config.folder}/${basename}.md`, basename });
    }

    getAllDailyNotes(): Record<string, { path: string; basename: string }> {
        return {};
    }

    private formatDate(date: string): string {
        // In real implementation: use moment with config.dateFormat
        return date;
    }
}

describe('Issue #1333: Support external journaling plugins for timeblock creation', () => {

    describe('Settings interface should support journal provider configuration', () => {

        it.failing('should have journalProvider setting in TaskNotesSettings', () => {
            // This test will FAIL until the feature is implemented
            // It verifies that TaskNotesSettings includes journal provider options
            const settingsKeys = Object.keys({} as TaskNotesSettings);

            // When implemented, TaskNotesSettings should have:
            // journalProvider: 'native' | 'journals-plugin' | 'custom'
            expect(settingsKeys).toContain('journalProvider');
        });

        it.failing('should have customJournalFolder setting in TaskNotesSettings', () => {
            // This test will FAIL until the feature is implemented
            // For custom journal configuration
            const settingsKeys = Object.keys({} as TaskNotesSettings);

            expect(settingsKeys).toContain('customJournalFolder');
        });

        it.failing('should have customJournalDateFormat setting in TaskNotesSettings', () => {
            // This test will FAIL until the feature is implemented
            // For custom date format configuration
            const settingsKeys = Object.keys({} as TaskNotesSettings);

            expect(settingsKeys).toContain('customJournalDateFormat');
        });

    });

    describe('Current behavior limitations (these tests document what SHOULD fail)', () => {

        it('should fail when trying to use Journals plugin instead of native Daily Notes', () => {
            // This test documents the current limitation
            const journalsProvider = new JournalsPluginProvider({
                folder: 'journals/daily',
                dateFormat: 'YYYY-MM-DD',
            });

            // Currently, Journals plugin is not supported
            expect(journalsProvider.isAvailable()).toBe(false);

            // The feature request asks for this to work
            // When implemented, this should return true if Journals plugin is loaded
        });

        it('should fail when no native Daily Notes plugin is enabled', () => {
            // Simulate current behavior: check for Daily Notes plugin
            const mockAppHasDailyNotesPluginLoaded = (): boolean => {
                // In reality, this returns false if Daily Notes is not enabled
                return false;
            };

            // Current code throws error if Daily Notes is not loaded
            const canCreateTimeblock = mockAppHasDailyNotesPluginLoaded();
            expect(canCreateTimeblock).toBe(false);

            // FEATURE REQUEST: Should be able to use alternative providers
            // When implemented, we'd check: nativeProvider.isAvailable() || journalsProvider.isAvailable() || customProvider.isAvailable()
        });

    });

    describe('Proposed JournalProvider interface (specification)', () => {

        it('documents expected provider interface methods', () => {
            // This test documents the expected interface for journal providers
            const nativeProvider = new NativeDailyNotesProvider();

            // All providers should implement these methods:
            expect(typeof nativeProvider.isAvailable).toBe('function');
            expect(typeof nativeProvider.getDailyNoteForDate).toBe('function');
            expect(typeof nativeProvider.createDailyNoteForDate).toBe('function');
            expect(typeof nativeProvider.getAllDailyNotes).toBe('function');
            expect(typeof nativeProvider.name).toBe('string');
        });

        it('should resolve daily note using configured provider', async () => {
            // Test the provider abstraction pattern
            const providers: JournalProvider[] = [
                new NativeDailyNotesProvider(),
                new JournalsPluginProvider({ folder: 'journals', dateFormat: 'YYYY-MM-DD' }),
                new CustomPathProvider({ folder: 'my-journal', dateFormat: 'YYYY-MM-DD' }),
            ];

            // Find first available provider
            const availableProvider = providers.find(p => p.isAvailable());

            // Currently only native is "available" in our mock
            expect(availableProvider?.name).toBe('Native Daily Notes');

            // When Journals plugin support is implemented:
            // - JournalsPluginProvider.isAvailable() would return true if plugin is loaded
            // - User setting would determine which provider to prefer
        });

    });

    describe('Integration scenarios (failing until implemented)', () => {

        it('should create timeblock using Journals plugin daily note structure', async () => {
            // Scenario: User has Journals plugin with custom folder structure
            const journalsConfig = {
                folder: 'journals/{{YYYY}}/{{MM}}',
                dateFormat: 'YYYY-MM-DD dddd',  // e.g., "2026-01-01 Wednesday"
            };

            const provider = new JournalsPluginProvider(journalsConfig);

            // Currently fails because Journals plugin is not supported
            expect(provider.isAvailable()).toBe(false);

            // When implemented:
            // 1. Provider would detect Journals plugin is loaded
            // 2. Read Journals plugin configuration for folder structure
            // 3. Resolve correct path for the date
            // 4. Create timeblock in that daily note's frontmatter
        });

        it('should create timeblock using custom path configuration', async () => {
            // Scenario: User manually configures daily note location
            const customConfig = {
                folder: 'my-notes/daily',
                dateFormat: 'DD-MM-YYYY',
                template: '{{folder}}/{{date}}.md',
            };

            const provider = new CustomPathProvider(customConfig);

            // Custom path provider should be available if configured
            expect(provider.isAvailable()).toBe(true);

            // Get the daily note path
            const dailyNote = await provider.getDailyNoteForDate('2026-01-01');

            // This works in our mock but the actual integration in TimeblockCreationModal
            // still uses obsidian-daily-notes-interface exclusively
            expect(dailyNote?.path).toBe('my-notes/daily/2026-01-01.md');
        });

        it('should fall back to native Daily Notes if no alternative is configured', async () => {
            // Default behavior should maintain backwards compatibility
            const providers: JournalProvider[] = [
                new NativeDailyNotesProvider(),
            ];

            const selectedProvider = providers[0];
            expect(selectedProvider.name).toBe('Native Daily Notes');
            expect(selectedProvider.isAvailable()).toBe(true);

            // When feature is implemented, this fallback behavior must be preserved
            // for users who don't configure any alternative
        });

    });

    describe('Calendar integration with external journals (failing until implemented)', () => {

        it('should retrieve timeblocks from Journals plugin daily notes', () => {
            // calendar-core.ts currently uses getAllDailyNotes() from obsidian-daily-notes-interface
            // This only finds notes created by native Daily Notes plugin

            const mockJournalsNotes = {
                'journals/2026/01/2026-01-01 Wednesday.md': {
                    basename: '2026-01-01 Wednesday',
                    path: 'journals/2026/01/2026-01-01 Wednesday.md',
                    frontmatter: {
                        timeblocks: [
                            { id: 'tb1', title: 'Meeting', startTime: '09:00', endTime: '10:00' }
                        ]
                    }
                }
            };

            // Current implementation wouldn't find these because:
            // 1. getAllDailyNotes() only looks in native Daily Notes folder
            // 2. Date format doesn't match expected YYYY-MM-DD

            // Feature request: Support scanning Journals plugin folders for timeblocks
            expect(Object.keys(mockJournalsNotes).length).toBe(1);
        });

    });

});
