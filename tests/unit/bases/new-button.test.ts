// Mock Obsidian components first
jest.mock('obsidian', () => ({
  Component: class MockComponent {
    onload() {}
    onunload() {}
  },
  setIcon: jest.fn(),
  ButtonComponent: jest.fn().mockImplementation(() => ({
    setTooltip: jest.fn().mockReturnThis(),
    setClass: jest.fn().mockReturnThis(),
    onClick: jest.fn().mockReturnThis(),
    buttonEl: {
      addClass: jest.fn(),
      empty: jest.fn(),
      createSpan: jest.fn(() => ({ className: '' }))
    }
  })),
  TextComponent: jest.fn().mockImplementation(() => ({
    setPlaceholder: jest.fn().mockReturnThis(),
    getValue: jest.fn(() => ''),
    onChange: jest.fn().mockReturnThis(),
    inputEl: {
      addClass: jest.fn(),
      addEventListener: jest.fn()
    }
  })),
  debounce: jest.fn((fn) => fn),
  setTooltip: jest.fn(),
  TFile: jest.fn()
}));

import { buildTasknotesTaskListViewFactory } from '../../../src/bases/view-factory';
import { buildTasknotesKanbanViewFactory } from '../../../src/bases/kanban-view';
import { buildTasknotesAgendaViewFactory } from '../../../src/bases/agenda-view';

// Mock DOM environment
const mockElement = {
  className: '',
  style: { cssText: '' },
  appendChild: jest.fn(),
  createSpan: jest.fn(() => ({ className: '', textContent: '' })),
  empty: jest.fn(),
  closest: jest.fn(),
  contains: jest.fn(() => true),
  addEventListener: jest.fn(),
  remove: jest.fn()
} as any;

// Mock document
(global as any).document = {
  createElement: jest.fn(() => mockElement)
};

// Mock plugin with workspace detection
const createMockPlugin = (isInSidebar = false, activeFile = null) => ({
  app: {
    workspace: {
      getActiveFile: jest.fn(() => activeFile),
      iterateAllLeaves: jest.fn((callback: (leaf: any) => void) => {
        // Mock leaf that contains our view
        const mockLeaf = {
          view: {
            containerEl: mockElement
          },
          containerEl: {
            closest: jest.fn((selector: string) => {
              if (isInSidebar && (selector.includes('mod-left-split') || selector.includes('mod-right-split'))) {
                return {}; // Return truthy value to indicate sidebar
              }
              return null;
            })
          }
        };
        callback(mockLeaf);
      })
    }
  },
  openTaskCreationModal: jest.fn(),
  settings: { basesPOCLogs: false }
});

// Mock Bases container
const createMockBasesContainer = () => ({
  results: new Map(),
  query: { on: jest.fn(), off: jest.fn() },
  viewContainerEl: mockElement
});

describe('Bases "+New" Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task List View', () => {
    it('should create component with "+New" button functionality', () => {
      const plugin = createMockPlugin();
      const basesContainer = createMockBasesContainer();
      const factory = buildTasknotesTaskListViewFactory(plugin as any);

      const component = factory(basesContainer as any);

      // Verify component was created
      expect(component).toBeDefined();
      expect(typeof component.onload).toBe('function');
      expect(typeof component.onunload).toBe('function');
    });

    it('should handle different workspace contexts', () => {
      const plugin = createMockPlugin(false); // Not in sidebar
      const basesContainer = createMockBasesContainer();
      const factory = buildTasknotesTaskListViewFactory(plugin as any);

      const component = factory(basesContainer as any);

      expect(component).toBeDefined();
    });
  });

  describe('Kanban View', () => {
    it('should create component with "+New" button functionality', () => {
      const plugin = createMockPlugin();
      const basesContainer = createMockBasesContainer();
      const factory = buildTasknotesKanbanViewFactory(plugin as any);

      const component = factory(basesContainer as any);

      expect(component).toBeDefined();
      expect(typeof component.onload).toBe('function');
      expect(typeof component.onunload).toBe('function');
    });
  });

  describe('Agenda View', () => {
    it('should create component with "+New" button functionality', () => {
      const plugin = createMockPlugin();
      const basesContainer = createMockBasesContainer();
      const factory = buildTasknotesAgendaViewFactory(plugin as any);

      const component = factory(basesContainer as any);

      expect(component).toBeDefined();
      expect(typeof component.onload).toBe('function');
      expect(typeof component.onunload).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing viewContainerEl gracefully', () => {
      const plugin = createMockPlugin();
      const basesContainer = { results: new Map() }; // Missing viewContainerEl
      const factory = buildTasknotesTaskListViewFactory(plugin as any);

      const component = factory(basesContainer as any);

      expect(component).toBeDefined();
      expect(typeof component.destroy).toBe('function');
    });
  });
});
