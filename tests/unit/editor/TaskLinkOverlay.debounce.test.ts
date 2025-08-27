import { EditorState, EditorSelection } from '@codemirror/state';
import { buildTaskLinkDecorations, clearCursorHideState } from '../../../src/editor/TaskLinkOverlay';
import { TaskLinkWidget } from '../../../src/editor/TaskLinkWidget';
import { PluginFactory, TaskFactory } from '../../helpers/mock-factories';
import { TaskNotesPlugin } from '../../../src/main';
import { TaskInfo } from '../../../src/types/TaskInfo';

// Mock the TaskLinkWidget
jest.mock('../../../src/editor/TaskLinkWidget');
const MockTaskLinkWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

// Note: Using real timers for debounce testing

describe('TaskLinkOverlay Immediate Cursor Detection', () => {
    let mockPlugin: TaskNotesPlugin;
    let mockTask: TaskInfo;
    let activeWidgets: Map<string, TaskLinkWidget>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        
        // Create mock plugin
        mockPlugin = PluginFactory.createMockPlugin({
            settings: {
                enableTaskLinkOverlay: true,
                overlayHideDelay: 150 // Default debounce delay in ms
            },
            cacheManager: {
                ...PluginFactory.createMockPlugin().cacheManager,
                getCachedTaskInfoSync: jest.fn().mockImplementation((path: string) => {
                    if (path === 'test-task.md') return mockTask;
                    return null;
                })
            },
            app: {
                workspace: {
                    getActiveViewOfType: jest.fn().mockReturnValue({
                        file: {
                            path: 'current-file.md'
                        }
                    })
                },
                metadataCache: {
                    getFirstLinkpathDest: jest.fn().mockImplementation((linkPath: string) => {
                        if (linkPath === 'test-task') {
                            return { path: 'test-task.md' };
                        }
                        return null;
                    })
                }
            },
            detectionService: {
                findWikilinks: jest.fn().mockImplementation((text: string) => {
                    // Simple regex to find [[test-task]] pattern
                    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
                    const links = [];
                    let match;

                    while ((match = wikilinkRegex.exec(text)) !== null) {
                        links.push({
                            match: match[0],
                            start: match.index,
                            end: match.index + match[0].length, // End position is exclusive (like real service)
                            type: 'wikilink'
                        });
                    }

                    return links;
                })
            }
        });

        // Create mock task
        mockTask = TaskFactory.createTask({
            path: 'test-task.md',
            title: 'Test Task',
            status: 'todo'
        });

        // Create active widgets map
        activeWidgets = new Map();

        // Setup TaskLinkWidget mock
        MockTaskLinkWidget.mockImplementation(() => ({
            toDOM: jest.fn().mockReturnValue(document.createElement('span')),
            eq: jest.fn().mockReturnValue(false),
            taskInfo: mockTask,
            plugin: mockPlugin
        } as any));
    });

    afterEach(() => {
        // Clear debounce state between tests
        clearCursorHideState();
    });

    describe('Immediate Cursor Detection', () => {
        it('should immediately hide overlay when cursor moves to link boundary', () => {
            const docText = 'This is a [[test-task]] in the document.';
            
            // First, create overlay with cursor away from link
            const cursorAway = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            let decorations = buildTaskLinkDecorations(cursorAway, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalled();

            // Clear the mock to track new calls
            MockTaskLinkWidget.mockClear();

            // Move cursor to link position (at the start of [[test-task]])
            const cursorOnLink = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10) // At the first [ of [[test-task]]
            });

            // Build decorations immediately after cursor move
            decorations = buildTaskLinkDecorations(cursorOnLink, mockPlugin, activeWidgets);

            // Overlay should be hidden immediately (raw text shown)
            expect(decorations.size).toBe(0);
            expect(MockTaskLinkWidget).not.toHaveBeenCalled();
        });

        it('should show overlay when cursor is away from link boundaries', () => {
            const docText = 'This is a [[test-task]] in the document.';

            // Cursor well away from link (before the link starts)
            const cursorBefore = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(5) // Well before [[test-task]]
            });

            let decorations = buildTaskLinkDecorations(cursorBefore, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0);

            // Cursor well after link (after the link ends)
            const cursorAfter = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(25) // Well after [[test-task]]
            });

            decorations = buildTaskLinkDecorations(cursorAfter, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0);
        });

        it('should hide overlay when cursor is at link boundaries', () => {
            const docText = 'This is a [[test-task]] in the document.';
            // For [[test-task]] at positions 10-21:

            // Cursor at start of link (position 10 = first [)
            const cursorAtStart = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10)
            });

            let decorations = buildTaskLinkDecorations(cursorAtStart, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0); // Should be hidden

            // Cursor inside link (position 15 = middle of test-task)
            const cursorInside = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(15)
            });

            decorations = buildTaskLinkDecorations(cursorInside, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0); // Should be hidden

            // Cursor at end of link (position 22 = last ])
            const cursorAtEnd = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(22)
            });

            decorations = buildTaskLinkDecorations(cursorAtEnd, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0); // Should be hidden
        });

        it('should handle cursor movements with immediate feedback', () => {
            const docText = 'This is a [[test-task]] in the document.';

            // Test various cursor positions for immediate, predictable behavior
            // Document: 'This is a [[test-task]] in the document.'
            // Positions: 0123456789012345678901234567890123456789
            // Link [[test-task]] is at positions 10-23 (exclusive), so characters 10-22 (inclusive)
            const testCases = [
                { pos: 5, expected: 'visible', desc: 'before link' },
                { pos: 9, expected: 'visible', desc: 'just before first [' },
                { pos: 10, expected: 'hidden', desc: 'at first [' },
                { pos: 15, expected: 'hidden', desc: 'inside link' },
                { pos: 22, expected: 'hidden', desc: 'at last ]' },
                { pos: 23, expected: 'visible', desc: 'just after last ]' },
                { pos: 30, expected: 'visible', desc: 'well after link' }
            ];

            testCases.forEach(({ pos, expected, desc }) => {
                const state = EditorState.create({
                    doc: docText,
                    selection: EditorSelection.single(pos)
                });

                const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

                if (expected === 'visible') {
                    expect(decorations.size).toBeGreaterThan(0);
                } else {
                    expect(decorations.size).toBe(0);
                }
            });
        });

        it('should respect legacy mode when delay is set to 0', () => {
            // Set delay to 0 for legacy behavior
            mockPlugin.settings.overlayHideDelay = 0;

            const docText = 'This is a [[test-task]] in the document.';

            // In legacy mode, overlay is hidden only when cursor is strictly inside link content
            // Position 10 (first [) should show overlay in legacy mode
            const cursorAtStart = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10)
            });

            let decorations = buildTaskLinkDecorations(cursorAtStart, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0); // Legacy: visible at bracket

            // Position 15 (inside content) should hide overlay in legacy mode
            const cursorInside = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(15)
            });

            decorations = buildTaskLinkDecorations(cursorInside, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0); // Legacy: hidden inside content

            // Position 22 (last ]) should show overlay in legacy mode
            const cursorAtEnd = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(22)
            });

            decorations = buildTaskLinkDecorations(cursorAtEnd, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0); // Legacy: visible at bracket
        });

        it('should use immediate mode when delay is greater than 0', () => {
            // Set delay to 150 (immediate mode)
            mockPlugin.settings.overlayHideDelay = 150;

            const docText = 'This is a [[test-task]] in the document.';

            // In immediate mode, overlay is hidden when cursor touches link boundaries
            const cursorAtStart = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10) // At first [
            });

            // With immediate mode, overlay should be hidden at boundary
            const decorations = buildTaskLinkDecorations(cursorAtStart, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0);
        });
    });
});
