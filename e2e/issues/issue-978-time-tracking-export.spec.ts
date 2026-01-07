/**
 * Issue #978: [FR] Time Tracking export
 *
 * Feature request to add export functionality for time tracking data,
 * similar to Obsidian Timekeep plugin. Requested export formats:
 * - Markdown table
 * - CSV
 * - PDF
 *
 * Current state:
 * - The plugin has comprehensive time tracking functionality:
 *   - TimeEntry array on tasks with startTime, endTime, description, duration
 *   - API endpoints in TimeTrackingController.ts for start/stop/summary
 *   - Stats view showing time tracking data
 * - Export functionality exists only for ICS (calendar) format via CalendarExportService
 * - No existing support for exporting time tracking data to Markdown/CSV/PDF
 *
 * Implementation approach:
 * - Create new TimeTrackingExportService (following CalendarExportService pattern)
 * - Add export endpoints to TimeTrackingController
 * - Add UI controls for triggering exports (in Stats view or dedicated modal)
 * - Support filtering by date range, project, tags
 *
 * @see https://github.com/callumalpass/tasknotes/issues/978
 * @see https://github.com/jacobtread/obsidian-timekeep (referenced plugin)
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';

let app: ObsidianApp;

test.describe('Issue #978: Time Tracking export', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.describe('Export UI Controls', () => {
    test.fixme(
      'reproduces issue #978 - export button should be available in statistics view',
      async () => {
        /**
         * The statistics view shows time tracking data. It should have an
         * export button/menu to download the displayed data.
         *
         * Expected UI:
         * - Export button/dropdown in the stats view toolbar
         * - Options for Markdown, CSV, PDF formats
         * - Respects current date range filter
         */
        const page = app.page;

        // Open statistics view
        await runCommand(page, 'TaskNotes: Open statistics view');
        await page.waitForTimeout(1000);

        const statsView = page.locator('.tasknotes-stats-view, [data-view-type*="stats"]');
        await expect(statsView).toBeVisible({ timeout: 10000 });

        // Look for export button/controls
        const exportButton = page.locator(
          'button:has-text("Export"), ' +
            '[data-action="export"], ' +
            '.export-button, ' +
            '[aria-label*="export" i], ' +
            '.stats-toolbar button[title*="Export" i]'
        );

        const hasExportButton = await exportButton.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Export button visible in stats view: ${hasExportButton}`);

        // Document expected behavior
        expect(hasExportButton).toBe(true);

        if (hasExportButton) {
          await exportButton.click();
          await page.waitForTimeout(300);

          // Should show format options
          const formatOptions = page.locator(
            '.export-menu, ' + '[role="menu"], ' + '.dropdown-menu, ' + '.export-options'
          );

          const hasFormatMenu = await formatOptions.isVisible({ timeout: 1000 }).catch(() => false);
          console.log(`Export format menu visible: ${hasFormatMenu}`);

          if (hasFormatMenu) {
            // Check for specific format options
            const markdownOption = formatOptions.locator('text=Markdown, text=MD, text=.md');
            const csvOption = formatOptions.locator('text=CSV, text=.csv');
            const pdfOption = formatOptions.locator('text=PDF, text=.pdf');

            console.log(`Markdown option: ${await markdownOption.isVisible().catch(() => false)}`);
            console.log(`CSV option: ${await csvOption.isVisible().catch(() => false)}`);
            console.log(`PDF option: ${await pdfOption.isVisible().catch(() => false)}`);
          }

          await page.keyboard.press('Escape');
        }
      }
    );

    test.fixme(
      'reproduces issue #978 - export command should be available in command palette',
      async () => {
        /**
         * Users should be able to trigger time tracking export via command palette.
         *
         * Expected commands:
         * - "TaskNotes: Export time tracking data"
         * - Opens modal with format selection and date range options
         */
        const page = app.page;

        // Open command palette
        await page.keyboard.press('Control+p');
        await page.waitForTimeout(300);

        const commandPalette = page.locator('.prompt, [role="dialog"]');
        await expect(commandPalette).toBeVisible({ timeout: 5000 });

        // Search for export command
        const searchInput = commandPalette.locator('input');
        await searchInput.fill('export time');
        await page.waitForTimeout(300);

        // Look for time tracking export command
        const exportCommand = commandPalette.locator(
          'text=Export time tracking, ' +
            'text=Export time data, ' +
            'text=Time tracking export, ' +
            '.suggestion-item:has-text("time") >> text=export'
        );

        const hasExportCommand = await exportCommand.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`Time tracking export command available: ${hasExportCommand}`);

        // Document expected behavior
        expect(hasExportCommand).toBe(true);

        await page.keyboard.press('Escape');
      }
    );

    test.fixme(
      'reproduces issue #978 - export modal should allow format and date range selection',
      async () => {
        /**
         * When triggering export, a modal should appear allowing:
         * - Format selection (Markdown table, CSV, PDF)
         * - Date range selection (today, week, month, custom)
         * - Optional filters (project, tags)
         * - Preview of what will be exported
         */
        const page = app.page;

        // Try to open export via command
        await runCommand(page, 'TaskNotes: Export time tracking data');
        await page.waitForTimeout(500);

        const exportModal = page.locator(
          '.export-modal, ' +
            '[data-modal="time-export"], ' +
            '.modal:has-text("Export"), ' +
            '[role="dialog"]:has-text("Export")'
        );

        const hasExportModal = await exportModal.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`Export modal opened: ${hasExportModal}`);

        if (hasExportModal) {
          // Check for format selection
          const formatSelect = exportModal.locator(
            'select[name="format"], ' +
              '[data-field="format"], ' +
              '.format-selector, ' +
              'input[type="radio"][name="format"]'
          );

          const hasFormatSelect = await formatSelect.isVisible({ timeout: 1000 }).catch(() => false);
          console.log(`Format selection available: ${hasFormatSelect}`);

          // Check for date range selection
          const dateRangeSelect = exportModal.locator(
            'select[name="dateRange"], ' +
              '[data-field="dateRange"], ' +
              '.date-range-selector, ' +
              'input[type="radio"][name="period"]'
          );

          const hasDateRangeSelect = await dateRangeSelect
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          console.log(`Date range selection available: ${hasDateRangeSelect}`);

          // Check for export button
          const exportBtn = exportModal.locator(
            'button:has-text("Export"), ' + 'button[type="submit"], ' + '.export-confirm-button'
          );

          const hasExportBtn = await exportBtn.isVisible({ timeout: 1000 }).catch(() => false);
          console.log(`Export confirmation button: ${hasExportBtn}`);

          expect(hasFormatSelect).toBe(true);
          expect(hasDateRangeSelect).toBe(true);
          expect(hasExportBtn).toBe(true);

          await page.keyboard.press('Escape');
        } else {
          // Command might not exist yet
          expect(hasExportModal).toBe(true);
        }
      }
    );
  });

  test.describe('Markdown Table Export', () => {
    test.fixme(
      'reproduces issue #978 - should export time tracking data as Markdown table',
      async () => {
        /**
         * Export to Markdown table format for easy inclusion in notes.
         *
         * Expected output format:
         * | Task | Project | Date | Duration | Description |
         * |------|---------|------|----------|-------------|
         * | Write report | Work | 2026-01-07 | 2h 30m | Initial draft |
         * | Review code | Dev | 2026-01-07 | 1h 15m | PR #123 |
         * | **Total** | | | **3h 45m** | |
         *
         * Features:
         * - Sortable columns
         * - Grouping by project/date (optional)
         * - Summary row with totals
         */
        const page = app.page;

        // Open stats view and trigger markdown export
        await runCommand(page, 'TaskNotes: Open statistics view');
        await page.waitForTimeout(1000);

        const statsView = page.locator('.tasknotes-stats-view, [data-view-type*="stats"]');
        await expect(statsView).toBeVisible({ timeout: 10000 });

        // Find and click export button
        const exportButton = page.locator(
          'button:has-text("Export"), ' + '[data-action="export"], ' + '.export-button'
        );

        if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await exportButton.click();
          await page.waitForTimeout(300);

          // Select Markdown format
          const markdownOption = page.locator(
            'text=Markdown, ' +
              '[data-format="markdown"], ' +
              'button:has-text("Markdown"), ' +
              '.menu-item:has-text("Markdown")'
          );

          if (await markdownOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Listen for clipboard or download
            let exportedContent = '';

            // Check if it copies to clipboard or downloads
            const clipboardPromise = page.evaluate(() => navigator.clipboard.readText());

            await markdownOption.click();
            await page.waitForTimeout(500);

            // Try to get exported content
            try {
              exportedContent = await clipboardPromise;
            } catch {
              console.log('Export may have triggered download instead of clipboard');
            }

            if (exportedContent) {
              console.log('Exported Markdown content:', exportedContent.substring(0, 200));

              // Verify Markdown table format
              const isValidMarkdownTable =
                exportedContent.includes('|') &&
                exportedContent.includes('---') &&
                (exportedContent.includes('Task') ||
                  exportedContent.includes('Duration') ||
                  exportedContent.includes('Time'));

              expect(isValidMarkdownTable).toBe(true);
            }
          }

          await page.keyboard.press('Escape');
        }

        // Document expected behavior
        console.log('Expected: Markdown table export with task details, durations, and totals');
      }
    );

    test.fixme(
      'reproduces issue #978 - Markdown export should support grouping by project',
      async () => {
        /**
         * When exporting to Markdown, users should be able to group entries by project.
         *
         * Expected output format:
         * ## Work
         * | Task | Date | Duration |
         * |------|------|----------|
         * | Write report | 2026-01-07 | 2h 30m |
         * | **Subtotal** | | **2h 30m** |
         *
         * ## Personal
         * | Task | Date | Duration |
         * |------|------|----------|
         * | Exercise | 2026-01-07 | 45m |
         * | **Subtotal** | | **45m** |
         *
         * **Total: 3h 15m**
         */
        const page = app.page;

        // This test documents expected grouping behavior
        console.log(
          'Expected: Markdown export with project grouping option:\n' +
            '- Separate tables per project\n' +
            '- Subtotals per group\n' +
            '- Grand total at end'
        );

        // Would need export UI with grouping option
        expect(true).toBe(false); // Document missing feature
      }
    );
  });

  test.describe('CSV Export', () => {
    test.fixme('reproduces issue #978 - should export time tracking data as CSV', async () => {
      /**
       * Export to CSV format for use in spreadsheets and other tools.
       *
       * Expected CSV structure:
       * Task,Project,Tags,Date,Start Time,End Time,Duration (minutes),Duration (formatted),Description
       * "Write report","Work","writing,docs","2026-01-07","09:00","11:30",150,"2h 30m","Initial draft"
       * "Review code","Dev","code,review","2026-01-07","14:00","15:15",75,"1h 15m","PR #123"
       *
       * Features:
       * - RFC 4180 compliant CSV format
       * - Proper escaping of special characters
       * - Headers included
       * - Duration in both minutes (for calculations) and formatted string
       */
      const page = app.page;

      // Open stats view
      await runCommand(page, 'TaskNotes: Open statistics view');
      await page.waitForTimeout(1000);

      const statsView = page.locator('.tasknotes-stats-view, [data-view-type*="stats"]');
      await expect(statsView).toBeVisible({ timeout: 10000 });

      // Find and click export button
      const exportButton = page.locator(
        'button:has-text("Export"), ' + '[data-action="export"], ' + '.export-button'
      );

      if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await exportButton.click();
        await page.waitForTimeout(300);

        // Select CSV format
        const csvOption = page.locator(
          'text=CSV, ' +
            '[data-format="csv"], ' +
            'button:has-text("CSV"), ' +
            '.menu-item:has-text("CSV")'
        );

        if (await csvOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Set up download listener
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

          await csvOption.click();
          await page.waitForTimeout(500);

          const download = await downloadPromise;

          if (download) {
            const filename = download.suggestedFilename();
            console.log(`Downloaded CSV file: ${filename}`);

            // Verify it's a CSV file
            expect(filename.endsWith('.csv')).toBe(true);

            // Could optionally read and validate content
          } else {
            console.log('No download triggered - feature may not be implemented');
          }
        }

        await page.keyboard.press('Escape');
      }

      // Document expected behavior
      console.log(
        'Expected: CSV export with:\n' +
          '- Task name, project, tags, dates, times, duration\n' +
          '- Proper CSV formatting and escaping\n' +
          '- Headers row'
      );
    });

    test.fixme(
      'reproduces issue #978 - CSV export should handle special characters correctly',
      async () => {
        /**
         * CSV export must properly escape special characters:
         * - Commas in task names: "Task with, comma" -> "Task with, comma"
         * - Quotes in descriptions: 'Said "hello"' -> 'Said ""hello""'
         * - Newlines: Should be escaped or removed
         * - Unicode characters: Should be preserved
         */
        const page = app.page;

        // This test documents CSV escaping requirements
        console.log(
          'CSV escaping requirements:\n' +
            '- Double quotes around fields containing commas\n' +
            '- Escape quotes by doubling them\n' +
            '- Handle newlines in descriptions\n' +
            '- Preserve Unicode characters'
        );

        // Would need task with special characters to test
        expect(true).toBe(false); // Document consideration
      }
    );
  });

  test.describe('PDF Export', () => {
    test.fixme('reproduces issue #978 - should export time tracking data as PDF', async () => {
      /**
       * Export to PDF format for sharing and archiving.
       *
       * Expected PDF features:
       * - Professional layout with header showing date range
       * - Table with time entries
       * - Summary section with totals
       * - Optional: pie chart showing time by project
       * - Optional: bar chart showing time by day
       *
       * Implementation notes:
       * - Could use jsPDF, pdfmake, or similar library
       * - Should respect user's locale for date/time formatting
       */
      const page = app.page;

      // Open stats view
      await runCommand(page, 'TaskNotes: Open statistics view');
      await page.waitForTimeout(1000);

      const statsView = page.locator('.tasknotes-stats-view, [data-view-type*="stats"]');
      await expect(statsView).toBeVisible({ timeout: 10000 });

      // Find and click export button
      const exportButton = page.locator(
        'button:has-text("Export"), ' + '[data-action="export"], ' + '.export-button'
      );

      if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await exportButton.click();
        await page.waitForTimeout(300);

        // Select PDF format
        const pdfOption = page.locator(
          'text=PDF, ' +
            '[data-format="pdf"], ' +
            'button:has-text("PDF"), ' +
            '.menu-item:has-text("PDF")'
        );

        if (await pdfOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          // Set up download listener
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

          await pdfOption.click();
          await page.waitForTimeout(1000); // PDF generation may take longer

          const download = await downloadPromise;

          if (download) {
            const filename = download.suggestedFilename();
            console.log(`Downloaded PDF file: ${filename}`);

            // Verify it's a PDF file
            expect(filename.endsWith('.pdf')).toBe(true);
          } else {
            console.log('No download triggered - feature may not be implemented');
          }
        }

        await page.keyboard.press('Escape');
      }

      // Document expected behavior
      console.log(
        'Expected: PDF export with:\n' +
          '- Professional report layout\n' +
          '- Date range header\n' +
          '- Time entries table\n' +
          '- Summary statistics'
      );
    });

    test.fixme(
      'reproduces issue #978 - PDF export should include visual charts',
      async () => {
        /**
         * PDF export could optionally include visual representations:
         * - Pie chart: Time distribution by project
         * - Bar chart: Time tracked per day
         * - Line chart: Trend over time
         *
         * This matches what Obsidian Timekeep offers.
         */
        const page = app.page;

        // This test documents expected chart features
        console.log(
          'Expected PDF chart options:\n' +
            '- Pie chart for project distribution\n' +
            '- Bar chart for daily breakdown\n' +
            '- Toggle to include/exclude charts'
        );

        expect(true).toBe(false); // Document consideration
      }
    );
  });

  test.describe('Date Range Filtering', () => {
    test.fixme(
      'reproduces issue #978 - export should respect current date range filter',
      async () => {
        /**
         * When exporting, only include time entries within the selected date range.
         *
         * Filter options should include:
         * - Today
         * - This week
         * - This month
         * - Last 7 days
         * - Last 30 days
         * - Custom range (date picker)
         * - All time
         */
        const page = app.page;

        // Open stats view
        await runCommand(page, 'TaskNotes: Open statistics view');
        await page.waitForTimeout(1000);

        const statsView = page.locator('.tasknotes-stats-view, [data-view-type*="stats"]');
        await expect(statsView).toBeVisible({ timeout: 10000 });

        // Find date range filter
        const dateFilter = page.locator(
          '.date-filter, ' +
            '[data-testid="date-range-filter"], ' +
            'button:has-text("Date"), ' +
            'select[name="period"]'
        );

        if (await dateFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dateFilter.click();
          await page.waitForTimeout(300);

          // Check for date range options
          const filterOptions = page.locator(
            'text=Today, text=This week, text=This month, text=Custom'
          );

          const hasFilterOptions = await filterOptions
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          console.log(`Date range filter options available: ${hasFilterOptions}`);

          // Select a specific range
          const thisWeekOption = page.locator(
            'text=This week, ' + '[data-value="week"], ' + 'option[value="week"]'
          );

          if (await thisWeekOption.isVisible({ timeout: 500 }).catch(() => false)) {
            await thisWeekOption.click();
            await page.waitForTimeout(500);

            // Now export should only include this week's data
            console.log('Selected "This week" filter - export should respect this');
          }

          await page.keyboard.press('Escape');
        }

        // Document expected behavior
        console.log('Expected: Export respects active date range filter');
      }
    );

    test.fixme(
      'reproduces issue #978 - export should allow custom date range selection',
      async () => {
        /**
         * Custom date range should allow:
         * - Start date picker
         * - End date picker
         * - Quick presets (last 7/30/90 days)
         */
        const page = app.page;

        // This test documents custom date range requirements
        console.log(
          'Expected custom date range in export:\n' +
            '- Start/end date pickers\n' +
            '- Validation (start < end)\n' +
            '- Quick preset buttons'
        );

        expect(true).toBe(false); // Document consideration
      }
    );
  });

  test.describe('Project and Tag Filtering', () => {
    test.fixme(
      'reproduces issue #978 - export should allow filtering by project',
      async () => {
        /**
         * Users should be able to export time tracking data for specific projects.
         *
         * UI options:
         * - Multi-select dropdown for projects
         * - "All projects" option
         * - Search/filter within project list
         */
        const page = app.page;

        // Open export modal (if it exists)
        await runCommand(page, 'TaskNotes: Export time tracking data');
        await page.waitForTimeout(500);

        const exportModal = page.locator('.modal, [role="dialog"]');

        if (await exportModal.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Look for project filter
          const projectFilter = exportModal.locator(
            'select[name="project"], ' +
              '[data-field="projects"], ' +
              '.project-filter, ' +
              'label:has-text("Project") + select'
          );

          const hasProjectFilter = await projectFilter
            .isVisible({ timeout: 1000 })
            .catch(() => false);
          console.log(`Project filter in export: ${hasProjectFilter}`);

          expect(hasProjectFilter).toBe(true);

          await page.keyboard.press('Escape');
        }

        // Document expected behavior
        console.log(
          'Expected: Export modal with project filter:\n' +
            '- Multi-select for projects\n' +
            '- All projects option\n' +
            '- Export only selected project data'
        );
      }
    );

    test.fixme('reproduces issue #978 - export should allow filtering by tags', async () => {
      /**
       * Users should be able to export time tracking data for specific tags.
       *
       * UI options:
       * - Multi-select for tags
       * - "All tags" option
       * - Tag search/filter
       */
      const page = app.page;

      // This test documents tag filtering requirements
      console.log(
        'Expected: Export with tag filter:\n' +
          '- Multi-select for tags\n' +
          '- Filter tasks by selected tags\n' +
          '- Include tag column in export'
      );

      expect(true).toBe(false); // Document consideration
    });
  });

  test.describe('API Endpoints', () => {
    test.fixme(
      'reproduces issue #978 - API should provide time tracking export endpoints',
      async () => {
        /**
         * The existing TimeTrackingController should be extended with export endpoints:
         *
         * GET /api/time/export?format=csv&period=week
         * GET /api/time/export?format=markdown&from=2026-01-01&to=2026-01-07
         * GET /api/time/export?format=pdf&project=Work
         *
         * Query parameters:
         * - format: csv | markdown | pdf
         * - period: today | week | month | all | custom
         * - from: ISO date (for custom range)
         * - to: ISO date (for custom range)
         * - project: project name filter
         * - tags: comma-separated tag filter
         * - groupBy: none | project | date | tag
         */
        const page = app.page;

        // Test API endpoint via fetch
        const apiResponse = await page.evaluate(async () => {
          try {
            // Assuming the plugin exposes an HTTP API
            const response = await fetch('http://localhost:27123/api/time/export?format=csv', {
              headers: { Authorization: 'Bearer test' },
            });
            return {
              status: response.status,
              contentType: response.headers.get('content-type'),
            };
          } catch (error) {
            return { error: String(error) };
          }
        });

        console.log('API response:', apiResponse);

        // Document expected API behavior
        console.log(
          'Expected API endpoints:\n' +
            '- GET /api/time/export?format=csv\n' +
            '- GET /api/time/export?format=markdown\n' +
            '- GET /api/time/export?format=pdf\n' +
            'With filters: period, from, to, project, tags, groupBy'
        );

        // Would fail until implemented
        if ('error' in apiResponse) {
          console.log('API endpoint not available yet');
        } else {
          expect(apiResponse.status).toBe(200);
        }
      }
    );
  });

  test.describe('Implementation Considerations', () => {
    test.fixme(
      'reproduces issue #978 - export service should follow CalendarExportService pattern',
      async () => {
        /**
         * New TimeTrackingExportService should follow the existing CalendarExportService pattern:
         *
         * Location: src/services/TimeTrackingExportService.ts
         *
         * Static methods:
         * - generateCSVContent(tasks: TaskInfo[], options: ExportOptions): string
         * - generateMarkdownTableContent(tasks: TaskInfo[], options: ExportOptions): string
         * - generatePDFContent(tasks: TaskInfo[], options: ExportOptions): Blob
         * - downloadFile(content: string | Blob, filename: string, mimeType: string): void
         *
         * ExportOptions interface:
         * {
         *   dateRange?: { from: Date, to: Date },
         *   projects?: string[],
         *   tags?: string[],
         *   groupBy?: 'none' | 'project' | 'date' | 'tag',
         *   includeDescriptions?: boolean,
         *   includeTotals?: boolean
         * }
         */
        const page = app.page;

        console.log(
          'Implementation plan:\n' +
            '1. Create TimeTrackingExportService.ts in src/services/\n' +
            '2. Add export methods: CSV, Markdown, PDF\n' +
            '3. Extend TimeTrackingController with export endpoints\n' +
            '4. Add export UI to stats view\n' +
            '5. Add command palette command\n' +
            '6. Add i18n translations'
        );

        expect(true).toBe(false); // Document implementation needed
      }
    );

    test.fixme(
      'reproduces issue #978 - should add translations for export feature',
      async () => {
        /**
         * New i18n strings needed:
         * - "Export time tracking data"
         * - "Select format"
         * - "Markdown table"
         * - "CSV file"
         * - "PDF document"
         * - "Date range"
         * - "Filter by project"
         * - "Filter by tags"
         * - "Include descriptions"
         * - "Include totals"
         * - "Export successful"
         * - "No data to export"
         */
        const page = app.page;

        console.log(
          'Required i18n translations:\n' +
            '- Export UI labels\n' +
            '- Format options\n' +
            '- Filter labels\n' +
            '- Success/error messages\n' +
            'Files: src/i18n/resources/en.ts, de.ts, etc.'
        );

        expect(true).toBe(false); // Document translation work needed
      }
    );
  });
});
