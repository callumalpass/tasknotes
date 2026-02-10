import { EditorState, EditorSelection } from '@codemirror/state';
import { buildTaskLinkDecorations } from '../../../src/editor/TaskLinkOverlay';
import { TaskLinkWidget } from '../../../src/editor/TaskLinkWidget';
import { PluginFactory, TaskFactory } from '../../helpers/mock-factories';
import { TaskNotesPlugin } from '../../../src/main';
import { TaskInfo } from '../../../src/types/TaskInfo';

// Mock the TaskLinkWidget
jest.mock('../../../src/editor/TaskLinkWidget');
const MockTaskLinkWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

describe('Issue #1567 - Inline task card display inconsistent on cache miss', () => {
    let mockPlugin: TaskNotesPlugin;
    let mockTask: TaskInfo;
    let activeWidgets: Map<string, TaskLinkWidget>;
    let lastKnownWidgets: Map<string, TaskLinkWidget>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockTask = TaskFactory.createTask({
            path: 'test-task.md',
            title: 'Test Task',
            status: 'todo'
        });

        mockPlugin = PluginFactory.createMockPlugin({
            settings: {
                enableTaskLinkOverlay: true
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
                        file: { path: 'current-file.md' }
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

        activeWidgets = new Map();
        lastKnownWidgets = new Map();

        MockTaskLinkWidget.mockImplementation((taskInfo: TaskInfo) => ({
            toDOM: jest.fn().mockReturnValue(document.createElement('span')),
            eq: jest.fn().mockImplementation((other: any) => other?.taskInfo === taskInfo),
            taskInfo,
            plugin: mockPlugin
        } as any));
    });

    describe('Reproduction: cache miss causes widget to disappear', () => {
        it('should show fallback widget when cache returns null but lastKnownWidgets has entry', () => {
            const docText = 'Link to [[test-task]] in doc.';

            // First pass: cache hit populates lastKnownWidgets
            const state1 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            const decos1 = buildTaskLinkDecorations(state1, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);
            expect(decos1.size).toBe(1);
            expect(lastKnownWidgets.has('test-task.md')).toBe(true);

            // Simulate cache invalidation
            (mockPlugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);

            // Second pass: cache miss but fallback kicks in
            activeWidgets.clear();
            const state2 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            const decos2 = buildTaskLinkDecorations(state2, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);
            expect(decos2.size).toBe(1);
        });

        it('should replace fallback widget when cache repopulates', () => {
            const docText = 'Link to [[test-task]] in doc.';

            // First pass: populate lastKnownWidgets
            const state1 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state1, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);

            // Simulate cache miss
            (mockPlugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
            activeWidgets.clear();

            const state2 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state2, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);

            // Cache comes back with updated task
            const updatedTask = TaskFactory.createTask({
                path: 'test-task.md',
                title: 'Updated Task',
                status: 'done'
            });
            (mockPlugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockImplementation((path: string) => {
                if (path === 'test-task.md') return updatedTask;
                return null;
            });
            activeWidgets.clear();

            const state3 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            const decos3 = buildTaskLinkDecorations(state3, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);
            expect(decos3.size).toBe(1);

            // The widget should have been created with the updated task info
            const lastCall = MockTaskLinkWidget.mock.calls[MockTaskLinkWidget.mock.calls.length - 1];
            expect(lastCall[0]).toBe(updatedTask);
        });
    });

    describe('Cursor overlap with fallback widget', () => {
        it('should hide fallback widget when cursor overlaps link range', () => {
            const docText = 'Link to [[test-task]] in doc.';

            // First pass: populate lastKnownWidgets
            const state1 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state1, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);

            // Simulate cache miss
            (mockPlugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
            activeWidgets.clear();

            // Cursor inside the link range
            const linkStart = docText.indexOf('[[');
            const state2 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(linkStart + 3) // inside [[test-task]]
            });
            const decos2 = buildTaskLinkDecorations(state2, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);
            expect(decos2.size).toBe(0);
        });
    });

    describe('lastKnownWidgets population', () => {
        it('should populate lastKnownWidgets on successful cache hit', () => {
            const docText = 'Link to [[test-task]] in doc.';

            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);

            expect(lastKnownWidgets.has('test-task.md')).toBe(true);
            expect(lastKnownWidgets.get('test-task.md')).toBeDefined();
        });

        it('should not populate lastKnownWidgets when cache returns null initially', () => {
            const docText = 'Link to [[test-task]] in doc.';

            // Cache returns null from the start
            (mockPlugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);

            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);

            expect(lastKnownWidgets.has('test-task.md')).toBe(false);
        });
    });

    describe('Backward compatibility', () => {
        it('should produce no decoration on cache miss when lastKnownWidgets is not passed', () => {
            const docText = 'Link to [[test-task]] in doc.';

            // First pass with lastKnownWidgets to populate it (simulates normal use)
            const state1 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state1, mockPlugin, activeWidgets, 'current-file.md');
            expect(activeWidgets.size).toBe(1);

            // Simulate cache miss
            (mockPlugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
            activeWidgets.clear();

            // Without lastKnownWidgets param — no fallback, no decoration
            const state2 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            const decos = buildTaskLinkDecorations(state2, mockPlugin, activeWidgets, 'current-file.md');
            expect(decos.size).toBe(0);
        });

        it('should work correctly when lastKnownWidgets is undefined', () => {
            const docText = 'Link to [[test-task]] in doc.';

            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            const decos = buildTaskLinkDecorations(state, mockPlugin, activeWidgets, 'current-file.md', undefined);
            expect(decos.size).toBe(1);
        });
    });

    describe('activeWidgets integration with fallback', () => {
        it('should insert fallback widget into activeWidgets at current position key', () => {
            const docText = 'Link to [[test-task]] in doc.';

            // First pass: populate
            const state1 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state1, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);

            // Simulate cache miss
            (mockPlugin.cacheManager.getCachedTaskInfoSync as jest.Mock).mockReturnValue(null);
            activeWidgets.clear();

            // Second pass with fallback
            const state2 = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });
            buildTaskLinkDecorations(state2, mockPlugin, activeWidgets, 'current-file.md', lastKnownWidgets);

            // The fallback widget should be inserted into activeWidgets for eq() to work
            const linkStart = docText.indexOf('[[');
            const linkEnd = docText.indexOf(']]') + 2;
            const expectedKey = `test-task.md-${linkStart}-${linkEnd}`;
            expect(activeWidgets.has(expectedKey)).toBe(true);
        });
    });
});
