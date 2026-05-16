/**
 * Issue #1508: sub-group not updating in task lists when changing to a different view
 *
 * Reproduction summary:
 * 1. Task list opens with default Bases view (subGroup = "priority")
 * 2. User switches to another Bases view (subGroup = "project")
 * 3. Task list keeps grouping by "priority" instead of updating to "project"
 *
 * Root cause:
 * TaskListView.render() previously only called readViewOptions() while
 * configLoaded === false. After the first successful read, view-specific options
 * like subGroup were not re-read when Bases swapped to a different view config.
 */

describe('Issue #1508 - subgroup should refresh when switching views', () => {
	type MockConfig = {
		getAsPropertyId: (key: string) => string | null;
		get: (key: string) => unknown;
	};

	/**
	 * Mirrors the relevant TaskListView logic from src/bases/TaskListView.ts:
	 * - readViewOptions() updates subGroupPropertyId and configLoaded
	 * - render() re-reads config every time an active config is available
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

		render(): void {
			if (this.config) {
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

	it('refreshes subgroup options after Bases switches views', () => {
		const defaultViewConfig = createConfig('priority');
		const alternateViewConfig = createConfig('project');
		const view = new MockTaskListViewConfigLifecycle(defaultViewConfig);

		// Initial render uses the default view config
		view.render();
		expect(view.subGroupPropertyId).toBe('priority');

		// Bases switches to another view with a different sub-group property
		view.config = alternateViewConfig;
		view.render();

		expect(view.subGroupPropertyId).toBe('project');
	});
});
