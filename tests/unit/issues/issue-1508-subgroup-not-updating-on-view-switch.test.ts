/**
 * Issue #1508: sub-group not updating in task lists when changing to a different view
 *
 * Reproduction summary:
 * 1. Task list opens with default Bases view (subGroup = "priority")
 * 2. User switches to another Bases view (subGroup = "project")
 * 3. Task list keeps grouping by "priority" instead of updating to "project"
 *
 * Root cause in current implementation:
 * TaskListView.render() only calls readViewOptions() while configLoaded === false.
 * After the first successful read, view-specific options (like subGroup) are not
 * re-read when Bases swaps to a different view config.
 */

describe('Issue #1508 - subgroup should refresh when switching views', () => {
	type MockConfig = {
		getAsPropertyId: (key: string) => string | null;
		get: (key: string) => unknown;
	};

	/**
	 * Mirrors the relevant TaskListView logic from src/bases/TaskListView.ts:
	 * - readViewOptions() updates subGroupPropertyId and configLoaded
	 * - render() only re-reads config while configLoaded is false (buggy gate)
	 */
	class MockTaskListViewConfigLifecycle {
		public subGroupPropertyId: string | null = null;
		public enableSearch = false;
		public configLoaded = false;
		public config: MockConfig | null = null;

		constructor(config: MockConfig) {
			this.config = config;
		}

		readViewOptions(): void {
			if (!this.config || typeof this.config.get !== 'function') return;

			this.subGroupPropertyId = this.config.getAsPropertyId('subGroup');
			const enableSearchValue = this.config.get('enableSearch');
			this.enableSearch = (enableSearchValue as boolean) ?? false;
			this.configLoaded = true;
		}

		renderWithCurrentBug(): void {
			if (!this.configLoaded && this.config) {
				this.readViewOptions();
			}
		}
	}

	function createConfig(subGroup: string | null, enableSearch = false): MockConfig {
		return {
			getAsPropertyId: (key: string) => (key === 'subGroup' ? subGroup : null),
			get: (key: string) => (key === 'enableSearch' ? enableSearch : undefined),
		};
	}

	it.skip('reproduces issue #1508', () => {
		const defaultViewConfig = createConfig('priority');
		const alternateViewConfig = createConfig('project');
		const view = new MockTaskListViewConfigLifecycle(defaultViewConfig);

		// Initial render uses the default view config
		view.renderWithCurrentBug();
		expect(view.subGroupPropertyId).toBe('priority');

		// Bases switches to another view with a different sub-group property
		view.config = alternateViewConfig;
		view.renderWithCurrentBug();

		// Observed buggy behavior: subgroup stays stale from the original view
		expect(view.subGroupPropertyId).toBe('priority');

		// Expected behavior: subgroup should reflect the active view config
		expect(view.subGroupPropertyId).toBe('project');
	});
});
