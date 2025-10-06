/**
 * Test for issue #440: Support relative (markdown) links in inline replacement
 *
 * Feature Request:
 * Currently, only Wikilink-style links (`[[task-202508181001]]`) are replaced inline.
 * The feature request asks to extend this to Markdown-style links like:
 * `[task-202508181001](../../../GTD/tasks/task-202508181001.md)`
 *
 * Expected Behavior:
 * - Markdown links to task files should be detected and replaced with inline task previews
 * - Both wikilink [[task]] and markdown [task](path.md) formats should work
 * - Inline replacement should work in both Live Preview and Reading Mode
 */

import { EditorState, EditorSelection } from '@codemirror/state';
import { buildTaskLinkDecorations } from '../../../src/editor/TaskLinkOverlay';
import { TaskLinkWidget } from '../../../src/editor/TaskLinkWidget';
import { PluginFactory, TaskFactory } from '../../helpers/mock-factories';
import { TaskNotesPlugin } from '../../../src/main';
import { TaskInfo } from '../../../src/types/TaskInfo';

// Mock the TaskLinkWidget
jest.mock('../../../src/editor/TaskLinkWidget');
const MockTaskLinkWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

describe('Issue #440: Markdown link inline replacement', () => {
    let mockPlugin: TaskNotesPlugin;
    let mockTask: TaskInfo;
    let activeWidgets: Map<string, TaskLinkWidget>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock task
        mockTask = TaskFactory.createTask({
            path: 'GTD/tasks/task-202508181001.md',
            title: 'Buy groceries',
            status: 'todo'
        });

        // Create mock plugin
        mockPlugin = PluginFactory.createMockPlugin({
            settings: {
                enableTaskLinkOverlay: true
            },
            cacheManager: {
                ...PluginFactory.createMockPlugin().cacheManager,
                getCachedTaskInfoSync: jest.fn().mockImplementation((path: string) => {
                    if (path === 'GTD/tasks/task-202508181001.md') return mockTask;
                    return null;
                })
            },
            app: {
                workspace: {
                    getActiveViewOfType: jest.fn().mockReturnValue({
                        file: {
                            path: 'notes/weekly/2025-10-05.md'
                        }
                    })
                },
                metadataCache: {
                    getFirstLinkpathDest: jest.fn().mockImplementation((linkPath: string, sourcePath: string) => {
                        // Simulate resolving relative path
                        if (linkPath === '../../../GTD/tasks/task-202508181001.md') {
                            return { path: 'GTD/tasks/task-202508181001.md' };
                        }
                        if (linkPath === 'GTD/tasks/task-202508181001.md') {
                            return { path: 'GTD/tasks/task-202508181001.md' };
                        }
                        if (linkPath === 'task-202508181001') {
                            return { path: 'GTD/tasks/task-202508181001.md' };
                        }
                        return null;
                    })
                }
            },
            taskLinkDetectionService: {
                findWikilinks: jest.fn().mockImplementation((text: string) => {
                    const links = [];

                    // Find wikilinks: [[link]]
                    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
                    let match;
                    while ((match = wikilinkRegex.exec(text)) !== null) {
                        links.push({
                            match: match[0],
                            start: match.index,
                            end: match.index + match[0].length,
                            type: 'wikilink'
                        });
                    }

                    // Find markdown links: [text](path)
                    const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
                    while ((match = markdownLinkRegex.exec(text)) !== null) {
                        links.push({
                            match: match[0],
                            start: match.index,
                            end: match.index + match[0].length,
                            type: 'markdown'
                        });
                    }

                    return links.sort((a, b) => a.start - b.start);
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
        element.dataset.taskPath = 'GTD/tasks/task-202508181001.md';
        element.textContent = 'Buy groceries';
        return element;
    }

    describe('Wikilink inline replacement (existing behavior)', () => {
        it('should replace wikilinks with task previews', () => {
            const docText = 'Today I need to [[task-202508181001]] for dinner.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Should create decoration for wikilink
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalled();
        });
    });

    describe('Markdown link inline replacement (NEW - Issue #440)', () => {
        it('should replace markdown links with relative paths', () => {
            const docText = 'Today I need to [task-202508181001](../../../GTD/tasks/task-202508181001.md) for dinner.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // FAILING: Currently markdown links are not replaced inline
            // This should create decoration for markdown link
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalled();
        });

        it('should replace markdown links with absolute paths', () => {
            const docText = 'Task: [task-202508181001](GTD/tasks/task-202508181001.md)';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Should create decoration for markdown link
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalled();
        });

        it('should use markdown link text as display text', () => {
            const docText = 'Check [Buy groceries task](../../../GTD/tasks/task-202508181001.md) later.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Should create decoration and use "Buy groceries task" as display text
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalledWith(
                mockTask,
                mockPlugin,
                expect.stringContaining('Buy groceries task'),
                'Buy groceries task'
            );
        });

        it('should handle markdown links with URL-encoded spaces', () => {
            const docText = 'Link: [task](GTD/tasks/task%20with%20spaces.md)';

            // Update mock to handle URL-encoded path
            mockPlugin.app.metadataCache.getFirstLinkpathDest = jest.fn().mockImplementation((linkPath: string) => {
                if (linkPath === 'GTD/tasks/task with spaces.md') {
                    return { path: 'GTD/tasks/task with spaces.md' };
                }
                return null;
            });

            mockPlugin.cacheManager.getCachedTaskInfoSync = jest.fn().mockImplementation((path: string) => {
                if (path === 'GTD/tasks/task with spaces.md') {
                    return TaskFactory.createTask({
                        path: 'GTD/tasks/task with spaces.md',
                        title: 'Task with spaces',
                        status: 'todo'
                    });
                }
                return null;
            });

            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Should properly decode URL-encoded path and create decoration
            expect(decorations.size).toBeGreaterThan(0);
        });
    });

    describe('Mixed link formats', () => {
        it('should handle both wikilink and markdown links in same document', () => {
            const docText = 'First [[task-202508181001]] then [another](../tasks/task-2.md).';

            // Add second task to mock
            mockPlugin.cacheManager.getCachedTaskInfoSync = jest.fn().mockImplementation((path: string) => {
                if (path === 'GTD/tasks/task-202508181001.md') return mockTask;
                if (path === 'tasks/task-2.md') {
                    return TaskFactory.createTask({
                        path: 'tasks/task-2.md',
                        title: 'Another task',
                        status: 'todo'
                    });
                }
                return null;
            });

            mockPlugin.app.metadataCache.getFirstLinkpathDest = jest.fn().mockImplementation((linkPath: string) => {
                if (linkPath === 'task-202508181001') {
                    return { path: 'GTD/tasks/task-202508181001.md' };
                }
                if (linkPath === '../tasks/task-2.md') {
                    return { path: 'tasks/task-2.md' };
                }
                return null;
            });

            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Should create decorations for both links
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalledTimes(2);
        });
    });

    describe('Link detection service', () => {
        it('should detect markdown links in text', () => {
            const text = 'Check [task](path.md) and [[another-task]]';
            const links = mockPlugin.taskLinkDetectionService.findWikilinks(text);

            // Should find both markdown and wikilink
            expect(links).toHaveLength(2);

            // First should be markdown link
            expect(links[0].type).toBe('markdown');
            expect(links[0].match).toBe('[task](path.md)');

            // Second should be wikilink
            expect(links[1].type).toBe('wikilink');
            expect(links[1].match).toBe('[[another-task]]');
        });
    });
});
