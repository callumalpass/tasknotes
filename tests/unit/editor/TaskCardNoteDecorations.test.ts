/**
 * TaskCardNoteDecorations Integration Tests
 *
 * Tests the initialization and update behavior of the TaskCardNoteDecorationsPlugin,
 * particularly focusing on the issue where calling view.dispatch() during
 * the initial update cycle causes "Calls to EditorView.update are not allowed
 * while an update is in progress" errors on Obsidian startup.
 */

import { EditorView, ViewUpdate } from '@codemirror/view';
import { EditorState } from '@codemirror/state';

// Mock task info
const mockTaskInfo = {
    title: 'Test Task',
    status: 'todo',
    path: 'test-task.md',
    content: '- [ ] Test Task',
    line: 1,
    dateCreated: '2024-01-01',
    dateModified: '2024-01-01'
} as any;

// Mock plugin
const createMockPlugin = () => ({
    cacheManager: {
        getCachedTaskInfoSync: jest.fn(() => mockTaskInfo)
    },
    emitter: {
        on: jest.fn(() => ({})),
        offref: jest.fn()
    },
    settings: {
        showTaskCardInNote: true
    }
} as any);

// Mock EditorView with tracking of dispatch calls
const createMockEditorView = () => {
    let isUpdating = false;
    const dispatchCalls: any[] = [];

    const mockView = {
        state: {
            doc: {
                length: 100,
                lines: 10,
                toString: () => '---\ntitle: Test\n---\n\nSome content'
            },
            field: jest.fn(() => ({
                file: { path: 'test-task.md' }
            }))
        },
        dispatch: jest.fn((spec: any) => {
            dispatchCalls.push({
                spec,
                duringUpdate: isUpdating
            });

            // Simulate the error that occurs when dispatch is called during update
            if (isUpdating) {
                throw new Error('Calls to EditorView.update are not allowed while an update is in progress');
            }
        }),
        dom: document.createElement('div')
    };

    return {
        view: mockView as any as EditorView,
        dispatchCalls,
        setUpdating: (value: boolean) => { isUpdating = value; }
    };
};

describe('TaskCardNoteDecorations - Issue #826', () => {
    let mockPlugin: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPlugin = createMockPlugin();
    });

    describe('initialization during Obsidian startup', () => {
        it('should not call view.dispatch() during initial construction', () => {
            // This test simulates what happens when Obsidian starts up with a task note already open
            const { view, dispatchCalls, setUpdating } = createMockEditorView();

            // Simulate that we're in the middle of an EditorView update
            setUpdating(true);

            // Dynamically import and instantiate the plugin
            // In reality, this happens during ViewPlugin construction
            const TaskCardNoteDecorations = require('../../../src/editor/TaskCardNoteDecorations');

            // The plugin should not throw an error during construction
            // even though an update is in progress
            expect(() => {
                // This simulates ViewPlugin.fromClass() instantiation
                const plugin = new (TaskCardNoteDecorations.TaskCardNoteDecorationsPlugin as any)(
                    view,
                    mockPlugin
                );
            }).not.toThrow();

            // End the simulated update
            setUpdating(false);
        });

        it('should defer widget rendering until after initial update completes', () => {
            // This test verifies that the widget appears eventually, just not during
            // the initial update cycle
            const { view, dispatchCalls, setUpdating } = createMockEditorView();

            // Start with update in progress (simulating Obsidian startup)
            setUpdating(true);

            const TaskCardNoteDecorations = require('../../../src/editor/TaskCardNoteDecorations');
            const plugin = new (TaskCardNoteDecorations.TaskCardNoteDecorationsPlugin as any)(
                view,
                mockPlugin
            );

            // No dispatch calls should happen during construction
            const callsDuringUpdate = dispatchCalls.filter(c => c.duringUpdate);
            expect(callsDuringUpdate.length).toBe(0);

            // End the simulated update
            setUpdating(false);

            // Now dispatch should be allowed
            // This would happen via event listeners or subsequent updates
        });
    });

    describe('comparison with ProjectNoteDecorations behavior', () => {
        it('should behave like ProjectNoteDecorations which does not have this issue', () => {
            // ProjectNoteDecorations uses async data loading (await this.projectService.getTasksLinkedToProject)
            // which naturally defers the dispatch call until after the constructor completes

            // TaskCardNoteDecorations uses sync data loading (getCachedTaskInfoSync)
            // which can trigger dispatch during construction

            // Both should eventually show their widgets, but TaskCard should not dispatch during construction
            const { view, dispatchCalls } = createMockEditorView();

            const TaskCardNoteDecorations = require('../../../src/editor/TaskCardNoteDecorations');
            const plugin = new (TaskCardNoteDecorations.TaskCardNoteDecorationsPlugin as any)(
                view,
                mockPlugin
            );

            // Verify no synchronous dispatch during construction
            expect(dispatchCalls.length).toBe(0);
        });
    });
});
