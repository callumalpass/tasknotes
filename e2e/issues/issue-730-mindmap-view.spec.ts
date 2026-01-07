/**
 * Issue #730: [FR] Mindmap view for child/parent relations
 *
 * Feature Request Description:
 * A "Mindmap" view that visualizes links between Tasks, showing parent/child
 * relationships as chains relative to a specified property (e.g., Projects,
 * blockedBy dependencies).
 *
 * Use Case Examples:
 * 1. Mindmapping on Projects:
 *    - Column 1: Tasks with no Parent Projects
 *    - Column 2: Tasks whose parent Project is in Column 1
 *    - Lines trace connections between children and parents
 *    - Recursive visualization of Projects → SubTasks → SubTasks' subtasks
 *
 * 2. Mindmapping on blockedBy:
 *    - Column 1: Tasks with no blockedBy dependencies
 *    - Column 2: Tasks blocked by tasks in Column 1
 *    - Visualize task order needed to complete blocked tasks
 *
 * Current state:
 * - Views exist for Calendar, Kanban, TaskList, MiniCalendar, Agenda
 * - No graph/mindmap visualization of task relationships
 * - Dependency relationships are tracked via DependencyCache service
 * - Project references are tracked via ProjectSubtasksService
 *
 * Implementation considerations:
 * - New view class: MindmapView extending BasesViewBase
 * - Visualization library needed (D3.js, Cytoscape.js, Mermaid, or custom SVG)
 * - Graph data transformation from TaskInfo[] to nodes/edges
 * - Handle DAGs (Directed Acyclic Graphs), not just trees
 * - Handle cycles in dependency graph
 * - Root selection strategy (no-dependency tasks, user-selected, etc.)
 * - Performance with large task counts (100+ nodes)
 * - Multiple relationship type support (blockedBy vs project hierarchy)
 *
 * Affected areas:
 * - src/bases/ (new MindmapView.ts)
 * - src/bases/registration.ts (view registration)
 * - src/utils/DependencyCache.ts (data source for blocking relationships)
 * - src/utils/ProjectSubtasksService.ts (data source for project hierarchy)
 * - styles/ (new mindmap-view.css)
 * - src/i18n/resources/ (translation keys)
 * - package.json (new visualization library dependency)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/730
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #730: Mindmap view for child/parent relations', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Mindmap view availability', () => {
    test.fixme('reproduces issue #730 - mindmap view should be available as a Bases view type', async () => {
      /**
       * The mindmap view should be registered as a Bases view type,
       * accessible when creating or configuring a Base.
       *
       * Expected behavior:
       * - "TaskNotes Mindmap" appears in the view type selector
       * - View can be selected and configured
       * - View icon is visible in the view type list
       *
       * Currently: Mindmap view does not exist; only Calendar, Kanban, Task List, etc.
       */
      const page = app.page;

      // Open the Bases plugin or a Base
      await runCommand(page, 'Bases: Create new base');
      await page.waitForTimeout(2000);

      // Look for view type selector
      const viewTypeSelector = page.locator('.bases-view-type-selector, [data-view-type]');

      if (await viewTypeSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for mindmap option
        const mindmapOption = page.locator('text=/mindmap/i, [data-view-type="tasknotesMindmap"]');
        const hasMindmap = await mindmapOption.isVisible({ timeout: 2000 }).catch(() => false);

        console.log(`Mindmap view option available: ${hasMindmap}`);

        // After implementation: expect(hasMindmap).toBe(true);
      }

      // Cancel base creation
      await page.keyboard.press('Escape');
    });

    test.fixme('reproduces issue #730 - mindmap view should be openable via command', async () => {
      /**
       * Users should be able to open a mindmap view via the command palette.
       *
       * Expected behavior:
       * - Command "TaskNotes: Open mindmap" or similar exists
       * - Executing the command opens/creates a mindmap view
       * - View displays in a leaf pane
       */
      const page = app.page;

      // Try to open mindmap view via command
      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(1500);

      // Look for mindmap view container
      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      const viewExists = await mindmapView.isVisible({ timeout: 2000 }).catch(() => false);

      console.log(`Mindmap view visible: ${viewExists}`);

      // After implementation: expect(viewExists).toBe(true);
    });
  });

  test.describe('Project hierarchy mindmapping', () => {
    test.fixme('reproduces issue #730 - should show tasks with no parent projects in first column', async () => {
      /**
       * When mindmapping by Projects, the first "column" should display
       * all tasks that have no parent Projects.
       *
       * Expected behavior:
       * - Tasks without a projects[] reference appear in column 1
       * - These are "root" nodes in the visualization
       * - Each task node is clickable/interactive
       *
       * Relationship: Uses ProjectSubtasksService data
       */
      const page = app.page;

      // Open mindmap view with Project grouping
      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Configure grouping property to "Projects" if needed
        const groupingSelector = page.locator('.mindmap-view__grouping-selector');
        if (await groupingSelector.isVisible({ timeout: 1000 }).catch(() => false)) {
          await groupingSelector.selectOption({ label: 'Projects' });
          await page.waitForTimeout(1000);
        }

        // Look for root nodes (column 1)
        const rootColumn = page.locator('.mindmap-view__column--root, [data-depth="0"]');
        const rootNodes = page.locator('.mindmap-view__node--root');

        const hasRootColumn = await rootColumn.isVisible({ timeout: 2000 }).catch(() => false);
        const rootNodeCount = await rootNodes.count();

        console.log(`Root column visible: ${hasRootColumn}`);
        console.log(`Root node count: ${rootNodeCount}`);

        // After implementation:
        // - Verify root column contains tasks without parent projects
        // - Each root node represents a task
      }
    });

    test.fixme('reproduces issue #730 - should show child tasks in subsequent columns', async () => {
      /**
       * When a task references a project, it should appear in the column
       * after its parent project, with a connecting line.
       *
       * Expected behavior:
       * - Column 2 shows tasks whose parent Project is in Column 1
       * - Column 3 shows tasks whose parent is in Column 2
       * - Recursive visualization continues as needed
       * - Lines/edges connect parent and child nodes
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for multi-column structure
        const columns = page.locator('.mindmap-view__column');
        const columnCount = await columns.count();

        console.log(`Number of columns: ${columnCount}`);

        // Look for connecting lines/edges
        const edges = page.locator('.mindmap-view__edge, .mindmap-view__line, svg line, svg path');
        const edgeCount = await edges.count();

        console.log(`Number of connecting edges: ${edgeCount}`);

        // After implementation:
        // - Verify multiple columns exist for deep hierarchies
        // - Verify edges connect parent/child nodes
        // expect(columnCount).toBeGreaterThan(1);
      }
    });

    test.fixme('reproduces issue #730 - should trace lines between parent and child nodes', async () => {
      /**
       * Lines should be traced between children and their parent tasks
       * to clearly visualize the relationships.
       *
       * Expected behavior:
       * - Visual lines/edges connect related nodes
       * - Lines are styled distinctly (color, thickness)
       * - Direction of relationship is clear (parent → child)
       * - Lines update when view is scrolled or nodes are moved
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for SVG or canvas-based edge rendering
        const svgContainer = page.locator('.mindmap-view svg, .mindmap-view canvas');
        const hasSvg = await svgContainer.isVisible({ timeout: 2000 }).catch(() => false);

        console.log(`Has SVG/Canvas for edges: ${hasSvg}`);

        if (hasSvg) {
          // Check for edge elements
          const edges = page.locator('svg line, svg path[class*="edge"]');
          const edgeCount = await edges.count();

          console.log(`Edge count: ${edgeCount}`);

          // After implementation:
          // - Verify edges are rendered
          // - Verify edges connect to node elements
          // expect(edgeCount).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Blocking relationship mindmapping', () => {
    test.fixme('reproduces issue #730 - should show tasks with no blockedBy in first column', async () => {
      /**
       * When mindmapping by blockedBy relationships, the first column
       * shows tasks that don't have any blockedBy dependencies.
       *
       * Expected behavior:
       * - Tasks with empty blockedBy[] appear in column 1
       * - These represent tasks that can be started immediately
       * - Visualization uses DependencyCache data
       *
       * Relationship: Uses DependencyCache.getBlockingTaskPaths()
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Configure grouping to blockedBy
        const groupingSelector = page.locator('.mindmap-view__grouping-selector');
        if (await groupingSelector.isVisible({ timeout: 1000 }).catch(() => false)) {
          await groupingSelector.selectOption({ label: 'Blocked By' });
          await page.waitForTimeout(1000);
        }

        // First column should contain unblocked tasks
        const unblockedNodes = page.locator('[data-depth="0"], .mindmap-view__node--unblocked');
        const unblockedCount = await unblockedNodes.count();

        console.log(`Unblocked task count in first column: ${unblockedCount}`);

        // After implementation:
        // - Verify these tasks have no blockedBy dependencies
        // - Verify they appear in the leftmost column
      }
    });

    test.fixme('reproduces issue #730 - should show blocked tasks linked to their blockers', async () => {
      /**
       * Tasks that are blocked should appear after their blocking tasks,
       * with lines showing the blocking relationship.
       *
       * Expected behavior:
       * - Task B blocked by Task A appears in column after Task A
       * - Edge connects from Task A to Task B
       * - Edge styling may indicate blocking relationship type
       * - Can assess task order needed to complete blocked tasks
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find blocked task nodes (depth > 0)
        const blockedNodes = page.locator('[data-depth]:not([data-depth="0"]), .mindmap-view__node--blocked');
        const blockedCount = await blockedNodes.count();

        console.log(`Blocked task count: ${blockedCount}`);

        // Find blocking edges
        const blockingEdges = page.locator('.mindmap-view__edge--blocking, [data-edge-type="blocking"]');
        const blockingEdgeCount = await blockingEdges.count();

        console.log(`Blocking edge count: ${blockingEdgeCount}`);

        // After implementation:
        // - Verify blocked tasks appear in correct columns
        // - Verify edges connect blockers to blocked tasks
      }
    });

    test.fixme('reproduces issue #730 - should visualize blocking chains for dependency analysis', async () => {
      /**
       * The mindmap should allow users to assess which tasks block which,
       * and the order needed to complete blocked tasks.
       *
       * Expected behavior:
       * - Multi-level blocking chains are visible (A blocks B blocks C)
       * - User can trace the path from a blocked task to its root blockers
       * - Blocking complexity is visually apparent
       * - May show aggregate metrics (e.g., "blocks 5 tasks")
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Check for deep hierarchy (column depth > 2)
        const deepNodes = page.locator('[data-depth="2"], [data-depth="3"]');
        const deepNodeCount = await deepNodes.count();

        console.log(`Deep hierarchy node count (depth 2+): ${deepNodeCount}`);

        // Look for blocking chain indicators
        const chainIndicator = page.locator('.mindmap-view__chain-indicator, [data-blocks-count]');
        const hasChainIndicators = await chainIndicator.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Has blocking chain indicators: ${hasChainIndicators}`);

        // After implementation:
        // - Verify chains can be traced visually
        // - Verify depth reflects blocking complexity
      }
    });
  });

  test.describe('Interaction and navigation', () => {
    test.fixme('reproduces issue #730 - clicking a node should open the task', async () => {
      /**
       * Clicking on a task node in the mindmap should open that task
       * for viewing or editing.
       *
       * Expected behavior:
       * - Single click opens task in a modal or navigates to the file
       * - Right-click shows context menu with additional actions
       * - Keyboard navigation between nodes is supported
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find a task node
        const taskNode = page.locator('.mindmap-view__node').first();

        if (await taskNode.isVisible({ timeout: 2000 }).catch(() => false)) {
          const nodeTitle = await taskNode.textContent();
          console.log(`Clicking on node: ${nodeTitle}`);

          await taskNode.click();
          await page.waitForTimeout(1000);

          // Check if task was opened (modal or file)
          const taskModal = page.locator('.task-edit-modal, .modal');
          const modalOpened = await taskModal.isVisible({ timeout: 2000 }).catch(() => false);

          console.log(`Task modal opened: ${modalOpened}`);

          if (modalOpened) {
            await page.keyboard.press('Escape');
          }
        }
      }
    });

    test.fixme('reproduces issue #730 - should support zoom and pan controls', async () => {
      /**
       * Large mindmaps should support zoom and pan for navigation.
       *
       * Expected behavior:
       * - Mouse wheel or pinch-to-zoom adjusts zoom level
       * - Click-and-drag pans the view
       * - Zoom controls (buttons) may be visible
       * - Reset/fit-to-screen option available
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for zoom controls
        const zoomControls = page.locator('.mindmap-view__zoom-controls, [data-action="zoom-in"], [data-action="zoom-out"]');
        const hasZoomControls = await zoomControls.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Has zoom controls: ${hasZoomControls}`);

        // Try wheel zoom
        await mindmapView.hover();
        await page.mouse.wheel(0, -100); // Zoom in
        await page.waitForTimeout(500);

        // Look for transform changes (SVG transform or CSS transform)
        const container = page.locator('.mindmap-view__canvas, .mindmap-view svg');
        if (await container.isVisible({ timeout: 1000 }).catch(() => false)) {
          const transform = await container.getAttribute('transform') ?? await container.evaluate(el => {
            return window.getComputedStyle(el).transform;
          });

          console.log(`Transform after wheel zoom: ${transform}`);
        }

        // After implementation:
        // - Verify zoom level changes
        // - Verify pan works
        // - Verify reset/fit-to-screen option
      }
    });

    test.fixme('reproduces issue #730 - should support collapsing/expanding branches', async () => {
      /**
       * Users should be able to collapse/expand branches of the mindmap
       * to focus on specific areas.
       *
       * Expected behavior:
       * - Nodes with children have expand/collapse toggle
       * - Collapsing hides all descendants
       * - Collapsed state may be indicated visually
       * - May show count of hidden descendants
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find a node with children (collapse toggle)
        const expandableNode = page.locator('.mindmap-view__node--has-children, [data-children-count]:not([data-children-count="0"])');

        if (await expandableNode.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          const collapseToggle = expandableNode.first().locator('.mindmap-view__collapse-toggle, .collapse-chevron');

          if (await collapseToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Get current visible node count
            const initialNodeCount = await page.locator('.mindmap-view__node').count();

            // Click to collapse
            await collapseToggle.click();
            await page.waitForTimeout(500);

            // Get new visible node count
            const collapsedNodeCount = await page.locator('.mindmap-view__node').count();

            console.log(`Nodes before collapse: ${initialNodeCount}, after: ${collapsedNodeCount}`);

            // After implementation:
            // expect(collapsedNodeCount).toBeLessThan(initialNodeCount);
          }
        }
      }
    });
  });

  test.describe('Configuration options', () => {
    test.fixme('reproduces issue #730 - should allow selecting the relationship property', async () => {
      /**
       * Users should be able to choose which relationship property to
       * visualize (Projects, blockedBy, or custom properties).
       *
       * Expected behavior:
       * - Dropdown/selector for relationship property
       * - Options include: Projects, Blocked By, and any link-type custom fields
       * - Changing selection re-renders the mindmap
       * - Selection persists in view configuration
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for grouping/relationship selector in view options
        const viewOptions = page.locator('.mindmap-view__options, .bases-view-options');

        if (await viewOptions.isVisible({ timeout: 2000 }).catch(() => false)) {
          const propertySelector = viewOptions.locator('select, .dropdown');

          if (await propertySelector.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Get available options
            const options = await propertySelector.locator('option').allTextContents();
            console.log(`Available relationship properties: ${options.join(', ')}`);

            // After implementation:
            // - Verify Projects and Blocked By are available
            // - Verify changing selection updates the view
          }
        }
      }
    });

    test.fixme('reproduces issue #730 - should allow filtering which tasks are shown', async () => {
      /**
       * Users should be able to filter the mindmap to show only certain
       * tasks (e.g., by status, tag, or search).
       *
       * Expected behavior:
       * - Filter options in view configuration
       * - Search box to filter by task title
       * - Status filter (show only incomplete, etc.)
       * - Filtered-out nodes and their edges are hidden
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for search/filter options
        const searchBox = page.locator('.mindmap-view__search, .search-box');
        const hasSearchBox = await searchBox.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Has search box: ${hasSearchBox}`);

        // Look for filter toggles (hide completed, etc.)
        const filterToggle = page.locator('.mindmap-view__filter, [data-filter]');
        const hasFilters = await filterToggle.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Has filter toggles: ${hasFilters}`);

        // After implementation:
        // - Verify search filters nodes
        // - Verify status filters work
      }
    });

    test.fixme('reproduces issue #730 - should support different layout algorithms', async () => {
      /**
       * Users may want different layout styles for the mindmap
       * (hierarchical, force-directed, radial, etc.).
       *
       * Expected behavior:
       * - Layout selector in view options
       * - Options: Hierarchical (columns), Force-directed, Radial
       * - Changing layout re-renders the visualization
       * - Layout algorithm handles DAGs gracefully
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for layout selector
        const layoutSelector = page.locator('.mindmap-view__layout-selector, [data-layout-type]');

        if (await layoutSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
          const options = await layoutSelector.locator('option, [role="option"]').allTextContents();
          console.log(`Available layouts: ${options.join(', ')}`);

          // After implementation:
          // - Verify multiple layout options exist
          // - Verify changing layout re-renders view
        }
      }
    });
  });

  test.describe('Edge cases and performance', () => {
    test.fixme('reproduces issue #730 - should handle circular dependencies gracefully', async () => {
      /**
       * If tasks have circular blockedBy relationships (A blocks B blocks A),
       * the mindmap should handle this gracefully without infinite loops.
       *
       * Expected behavior:
       * - Cycles are detected during graph building
       * - Cycle nodes may be highlighted or annotated
       * - View does not hang or crash
       * - User is informed of the cycle
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // If there are cycles, look for cycle indicators
        const cycleIndicator = page.locator('.mindmap-view__cycle-warning, [data-has-cycle]');
        const hasCycleWarning = await cycleIndicator.isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Has cycle warning: ${hasCycleWarning}`);

        // Verify the view hasn't crashed
        const isResponsive = await mindmapView.isVisible({ timeout: 1000 });
        console.log(`View still responsive: ${isResponsive}`);

        // After implementation:
        // - Verify cycles don't cause infinite loops
        // - Verify cycle detection works
      }
    });

    test.fixme('reproduces issue #730 - should handle tasks with multiple parents', async () => {
      /**
       * A task may reference multiple projects or be blocked by multiple tasks.
       * The mindmap should handle this DAG structure (not just trees).
       *
       * Expected behavior:
       * - Task appears once in the visualization
       * - Multiple edges connect to multiple parents
       * - Or task is duplicated with clear indication
       * - Layout handles multi-parent gracefully
       */
      const page = app.page;

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Look for nodes with multiple incoming edges
        const multiParentNodes = page.locator('[data-parent-count]:not([data-parent-count="1"])');
        const multiParentCount = await multiParentNodes.count();

        console.log(`Nodes with multiple parents: ${multiParentCount}`);

        // Check if edges converge on a single node
        // (Implementation-specific: SVG path analysis)

        // After implementation:
        // - Verify multi-parent tasks are rendered correctly
        // - Verify all parent relationships are visible
      }
    });

    test.fixme('reproduces issue #730 - should perform well with large task counts', async () => {
      /**
       * With 100+ tasks, the mindmap should remain responsive.
       *
       * Expected behavior:
       * - Rendering completes in reasonable time (<3 seconds)
       * - Scrolling/panning remains smooth (>30fps)
       * - May use virtualization or progressive rendering
       * - Option to limit displayed nodes
       */
      const page = app.page;

      const startTime = Date.now();

      await runCommand(page, 'TaskNotes: Open mindmap');
      await page.waitForTimeout(2000);

      const mindmapView = page.locator('.mindmap-view, .tasknotes-mindmap');
      if (await mindmapView.isVisible({ timeout: 5000 }).catch(() => false)) {
        const renderTime = Date.now() - startTime;
        console.log(`Initial render time: ${renderTime}ms`);

        // Count rendered nodes
        const nodeCount = await page.locator('.mindmap-view__node').count();
        console.log(`Rendered node count: ${nodeCount}`);

        // Test pan responsiveness
        const panStart = Date.now();
        await mindmapView.hover();
        await page.mouse.down();
        await page.mouse.move(100, 0);
        await page.mouse.up();
        const panTime = Date.now() - panStart;

        console.log(`Pan operation time: ${panTime}ms`);

        // After implementation:
        // expect(renderTime).toBeLessThan(3000);
        // expect(panTime).toBeLessThan(100);
      }
    });
  });
});
