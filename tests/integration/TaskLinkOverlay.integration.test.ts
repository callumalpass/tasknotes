import { EditorState, EditorSelection } from '@codemirror/state';
import { buildTaskLinkDecorations, clearCursorHideState } from '../../src/editor/TaskLinkOverlay';
import { TaskLinkWidget } from '../../src/editor/TaskLinkWidget';
import { PluginFactory, TaskFactory } from '../helpers/mock-factories';
import { TaskNotesPlugin } from '../../src/main';
import { TaskInfo } from '../../src/types/TaskInfo';

// Mock the TaskLinkWidget
jest.mock('../../src/editor/TaskLinkWidget');
const MockTaskLinkWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

describe('TaskLinkOverlay Integration Tests', () => {
    let mockPlugin: TaskNotesPlugin;
    let mockTask: TaskInfo;
    let activeWidgets: Map<string, TaskLinkWidget>;

    beforeEach(() => {
        jest.clearAllMocks();
        clearCursorHideState();
        
        // Create mock task
        mockTask = TaskFactory.createTask({
            path: 'test-task.md',
            title: 'Test Task',
            status: 'todo'
        });

        // Create mock plugin
        mockPlugin = PluginFactory.createMockPlugin({
            settings: {
                enableTaskLinkOverlay: true,
                overlayHideDelay: 150
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
                    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
                    const links = [];
                    let match;
                    
                    while ((match = wikilinkRegex.exec(text)) !== null) {
                        links.push({
                            match: match[0],
                            start: match.index,
                            end: match.index + match[0].length,
                            type: 'wikilink'
                        });
                    }
                    
                    return links;
                })
            }
        });

        // Create active widgets map
        activeWidgets = new Map();

        // Setup TaskLinkWidget mock
        MockTaskLinkWidget.mockImplementation(() => ({
            toDOM: jest.fn().mockReturnValue(createMockOverlayElement()),
            eq: jest.fn().mockReturnValue(false),
            taskInfo: mockTask,
            plugin: mockPlugin
        } as any));
    });

    function createMockOverlayElement(): HTMLElement {
        const element = document.createElement('span');
        element.className = 'task-inline-preview';
        element.dataset.taskPath = 'test-task.md';
        
        // Add context menu event listener (simulating TaskLinkWidget behavior)
        element.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Mock context menu behavior
        });
        
        return element;
    }

    describe('Complete User Experience', () => {
        it('should hide overlay immediately when cursor moves to link boundary', () => {
            const docText = 'This is a [[test-task]] in the document.';
            
            // User types and cursor ends up on link boundary
            const cursorOnLink = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10) // At first [ of [[test-task]]
            });

            // Overlay should be hidden immediately (raw text shown)
            const decorations = buildTaskLinkDecorations(cursorOnLink, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0);

            // No widget should be created when overlay is hidden
            expect(MockTaskLinkWidget).not.toHaveBeenCalled();
        });

        it('should provide immediate feedback when cursor approaches link', () => {
            const docText = 'This is a [[test-task]] in the document.';
            
            // Test cursor approaching link from left
            const positions = [8, 9, 10]; // approaching [[test-task]]

            positions.forEach((pos, index) => {
                const state = EditorState.create({
                    doc: docText,
                    selection: EditorSelection.single(pos)
                });

                const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

                if (pos < 10) {
                    // Before link boundary - overlay visible
                    expect(decorations.size).toBeGreaterThan(0);
                } else {
                    // At link boundary - overlay hidden (raw text shown)
                    expect(decorations.size).toBe(0);
                }
            });
        });

        it('should show overlay again when cursor moves away from link', () => {
            const docText = 'This is a [[test-task]] in the document.';
            
            // Cursor moves away from link
            const cursorAway = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(30) // After the link
            });

            // Overlay should be visible
            const decorations = buildTaskLinkDecorations(cursorAway, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0);
        });

        it('should handle rapid cursor movements with immediate feedback', () => {
            const docText = 'This is a [[test-task]] in the document.';
            
            // Simulate rapid cursor movements with immediate, predictable feedback
            const testCases = [
                { pos: 8, expected: 'visible', desc: 'before link' },
                { pos: 10, expected: 'hidden', desc: 'at start of link' },
                { pos: 15, expected: 'hidden', desc: 'inside link' },
                { pos: 21, expected: 'hidden', desc: 'at end of link' },
                { pos: 25, expected: 'visible', desc: 'after link' }
            ];

            testCases.forEach(({ pos, expected, desc }) => {
                const state = EditorState.create({
                    doc: docText,
                    selection: EditorSelection.single(pos)
                });

                const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

                // Immediate, predictable behavior based on cursor position
                if (expected === 'visible') {
                    expect(decorations.size).toBeGreaterThan(0);
                } else {
                    expect(decorations.size).toBe(0);
                }
            });
        });

        it('should respect immediate mode settings', () => {
            // Set immediate mode (any value > 0)
            mockPlugin.settings.overlayHideDelay = 300;

            const docText = 'This is a [[test-task]] in the document.';

            const cursorOnLink = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10) // At link boundary
            });

            // With immediate mode, overlay should be hidden at boundary
            const decorations = buildTaskLinkDecorations(cursorOnLink, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0);
        });

        it('should use legacy mode when delay is set to 0', () => {
            // Set delay to 0 (legacy mode)
            mockPlugin.settings.overlayHideDelay = 0;

            const docText = 'This is a [[test-task]] in the document.';

            // In legacy mode, overlay is only hidden when cursor is strictly inside link
            const cursorAtBoundary = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10) // At first [
            });

            // With legacy mode, overlay should be visible at boundary
            let decorations = buildTaskLinkDecorations(cursorAtBoundary, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0);

            // But hidden when strictly inside
            const cursorInside = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(15) // Inside link
            });

            decorations = buildTaskLinkDecorations(cursorInside, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle malformed wikilinks gracefully', () => {
            const docText = 'This has [[malformed and [[test-task]] links.';
            
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            // Should not throw errors and should process valid links
            expect(() => {
                const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);
                expect(decorations.size).toBeGreaterThanOrEqual(0);
            }).not.toThrow();
        });

        it('should handle empty document gracefully', () => {
            const state = EditorState.create({
                doc: '',
                selection: EditorSelection.single(0)
            });

            expect(() => {
                const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);
                expect(decorations.size).toBe(0);
            }).not.toThrow();
        });

        it('should handle cursor at document boundaries', () => {
            const docText = '[[test-task]]';
            
            // Cursor at start
            let state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            expect(() => {
                buildTaskLinkDecorations(state, mockPlugin, activeWidgets);
            }).not.toThrow();

            // Cursor at end
            state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(docText.length)
            });

            expect(() => {
                buildTaskLinkDecorations(state, mockPlugin, activeWidgets);
            }).not.toThrow();
        });
    });
});
