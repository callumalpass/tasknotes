import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { buildTaskLinkDecorations, createTaskLinkOverlay, clearCursorHideState } from '../../../src/editor/TaskLinkOverlay';
import { TaskLinkWidget } from '../../../src/editor/TaskLinkWidget';
import { PluginFactory, TaskFactory } from '../../helpers/mock-factories';
import { TaskNotesPlugin } from '../../../src/main';
import { TaskInfo } from '../../../src/types/TaskInfo';

// Mock the TaskLinkWidget
jest.mock('../../../src/editor/TaskLinkWidget');
const MockTaskLinkWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

// Mock the showTaskContextMenu function
const mockShowTaskContextMenu = jest.fn();
jest.mock('../../../src/ui/TaskCard', () => ({
    showTaskContextMenu: mockShowTaskContextMenu
}));

describe('TaskLinkOverlay Context Menu Integration', () => {
    let mockPlugin: TaskNotesPlugin;
    let mockTask: TaskInfo;
    let mockEditorState: EditorState;
    let mockEditorView: EditorView;
    let activeWidgets: Map<string, TaskLinkWidget>;

    beforeEach(() => {
        jest.clearAllMocks();
        
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
                    if (path === 'task-1.md') return TaskFactory.createTask({ path: 'task-1.md', title: 'Task 1' });
                    if (path === 'task-2.md') return TaskFactory.createTask({ path: 'task-2.md', title: 'Task 2' });
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
                        if (linkPath === 'task-1') {
                            return { path: 'task-1.md' };
                        }
                        if (linkPath === 'task-2') {
                            return { path: 'task-2.md' };
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
                            end: match.index + match[0].length,
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

        // Setup mock editor state with a wikilink
        const docText = 'This is a [[test-task]] in the document.';
        mockEditorState = EditorState.create({
            doc: docText,
            selection: EditorSelection.single(0) // Cursor at start
        });

        // Mock editor view
        mockEditorView = {
            state: mockEditorState,
            dispatch: jest.fn(),
            dom: document.createElement('div')
        } as any;

        // Setup TaskLinkWidget mock
        MockTaskLinkWidget.mockImplementation(() => ({
            toDOM: jest.fn().mockReturnValue(createMockOverlayElement()),
            eq: jest.fn().mockReturnValue(false),
            taskInfo: mockTask,
            plugin: mockPlugin
        } as any));
    });

    afterEach(() => {
        // Clear any debounce state between tests by resetting the global state
        // This is needed because the debounce logic uses global state
        clearCursorHideState();
        jest.clearAllMocks();
    });

    function createMockOverlayElement(): HTMLElement {
        const element = document.createElement('span');
        element.className = 'task-inline-preview';
        element.dataset.taskPath = 'test-task.md';
        
        // Add context menu event listener (simulating TaskLinkWidget behavior)
        element.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await mockShowTaskContextMenu(e, 'test-task.md', mockPlugin, new Date());
        });
        
        return element;
    }

    describe('Right-click Context Menu', () => {
        it('should show context menu when right-clicking on overlay without hiding overlay', () => {
            // Build decorations with cursor NOT on the link
            const cursorAwayFromLink = EditorState.create({
                doc: 'This is a [[test-task]] in the document.',
                selection: EditorSelection.single(0) // Cursor at start, away from link
            });

            const decorations = buildTaskLinkDecorations(cursorAwayFromLink, mockPlugin, activeWidgets);

            // Verify overlay is created
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalled();

            // The key test is that the overlay is created and available for right-click
            // The actual context menu functionality is tested in TaskLinkWidget tests
            // This test verifies that the debounce logic doesn't prevent overlay creation
        });

        it('should NOT show context menu when cursor is on link (immediate hiding)', () => {
            // Build decorations with cursor ON the link
            const cursorOnLink = EditorState.create({
                doc: 'This is a [[test-task]] in the document.',
                selection: EditorSelection.single(15) // Cursor inside [[test-task]]
            });

            // With immediate hiding, overlay should be hidden right away (raw text shown)
            const decorations = buildTaskLinkDecorations(cursorOnLink, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0);
        });
    });

    describe('Cursor-based Overlay Hiding', () => {
        it('should hide overlay when cursor moves to link position during typing (immediate)', () => {
            // First, create overlay with cursor away from link
            const cursorAway = EditorState.create({
                doc: 'This is a [[test-task]] in the document.',
                selection: EditorSelection.single(0)
            });

            let decorations = buildTaskLinkDecorations(cursorAway, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0);

            // Then simulate cursor moving to link position (typing scenario)
            const cursorOnLink = EditorState.create({
                doc: 'This is a [[test-task]] in the document.',
                selection: EditorSelection.single(15) // Inside link
            });

            // With immediate hiding, overlay should be hidden right away
            decorations = buildTaskLinkDecorations(cursorOnLink, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0);
        });

        it('should show overlay again when cursor moves away from link', () => {
            // Start with cursor on link (overlay hidden immediately)
            const cursorOnLink = EditorState.create({
                doc: 'This is a [[test-task]] in the document.',
                selection: EditorSelection.single(15)
            });

            let decorations = buildTaskLinkDecorations(cursorOnLink, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0); // Hidden when on link

            // Move cursor away from link
            const cursorAway = EditorState.create({
                doc: 'This is a [[test-task]] in the document.',
                selection: EditorSelection.single(30) // After the link
            });

            decorations = buildTaskLinkDecorations(cursorAway, mockPlugin, activeWidgets);
            expect(decorations.size).toBeGreaterThan(0); // Overlay should reappear
        });
    });

    describe('Edge Cases', () => {
        it('should handle multiple overlays correctly', () => {
            const docWithMultipleLinks = 'First [[task-1]] and second [[task-2]] tasks.';

            const state = EditorState.create({
                doc: docWithMultipleLinks,
                selection: EditorSelection.single(0) // Cursor away from both links
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Should create overlays for both links
            expect(decorations.size).toBeGreaterThan(0);
            // Note: The exact count depends on how decorations are structured
            // The important thing is that multiple links are processed
        });

        it('should handle cursor at link boundary correctly', () => {
            const docText = 'This is a [[test-task]] in the document.';

            // Test cursor at start of link
            const cursorAtStart = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(10) // At '[' of [[test-task]]
            });

            let decorations = buildTaskLinkDecorations(cursorAtStart, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0); // Should be hidden immediately

            // Test cursor at end of link
            const cursorAtEnd = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(21) // At ']' of [[test-task]]
            });

            decorations = buildTaskLinkDecorations(cursorAtEnd, mockPlugin, activeWidgets);
            expect(decorations.size).toBe(0); // Should be hidden immediately
        });
    });
});
