/**
 * Issue #1590: [Bug] API Doesn't Allow for Setting Dependencies
 *
 * The HTTP API documentation (https://tasknotes.dev/HTTP_API/#create-task)
 * is missing the blockedBy and blocking fields from the optional fields list.
 *
 * This issue reports that these dependency fields may not be supported by the
 * API handler when creating or updating tasks.
 *
 * Investigation findings:
 * 1. The TaskCreationData interface extends Partial<TaskInfo>, which includes blockedBy
 * 2. The FieldMapper.mapToFrontmatter() method properly handles blockedBy serialization
 * 3. However, TaskService.createTask() builds completeTaskData explicitly and does NOT
 *    include the blockedBy field (lines 324-345 in TaskService.ts)
 * 4. As a result, blockedBy passed via the API is never included in the task frontmatter
 *
 * Root cause:
 * - In TaskService.createTask(), the completeTaskData object is built manually and
 *   only includes specific fields. The blockedBy field from taskData is never
 *   copied to completeTaskData, so it's lost before being passed to mapToFrontmatter.
 *
 * This is both:
 * - A documentation issue: blockedBy/blocking not documented as optional API fields
 * - An implementation bug: blockedBy is not forwarded through the task creation flow
 *
 * Affected files:
 * - src/services/TaskService.ts (lines 324-345): completeTaskData construction
 * - src/api/TasksController.ts (lines 139-159): createTask endpoint
 * - docs/HTTP_API.md (lines 171-181): missing blockedBy in optional fields
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1590
 */

import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from '../obsidian';
import * as http from 'http';

let app: ObsidianApp;

// Helper to make HTTP requests to the TaskNotes API
async function apiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080, // Default TaskNotes API port
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test.describe('Issue #1590: API dependencies (blockedBy) support', () => {
  test.beforeAll(async () => {
    app = await launchObsidian();
  });

  test.afterAll(async () => {
    if (app) {
      await closeObsidian(app);
    }
  });

  test.fixme('reproduces issue #1590 - blockedBy field should be set when creating task via API', async () => {
    /**
     * Bug: When creating a task via POST /api/tasks with a blockedBy field,
     * the blockedBy data is not persisted to the task's frontmatter.
     *
     * Current behavior:
     * - API accepts the request with blockedBy in the body
     * - Task is created successfully
     * - blockedBy is NOT present in the created task's frontmatter
     *
     * Expected behavior:
     * - blockedBy should be serialized and stored in the task's frontmatter
     *
     * Root cause:
     * - TaskService.createTask() at lines 324-345 builds completeTaskData
     *   without including the blockedBy field from taskData
     * - The field is therefore never passed to FieldMapper.mapToFrontmatter()
     */
    const page = app.page;

    // First, create a task that will be the blocker
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.modal');
    const titleInput = modal.locator('input[placeholder*="title"], input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('API Blocker Task 1590');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Now try to create a task via API with blockedBy set
    try {
      const response = await apiRequest('POST', '/tasks', {
        title: 'API Blocked Task 1590',
        blockedBy: [
          {
            uid: '[[API Blocker Task 1590]]',
            reltype: 'FINISHTOSTART',
          }
        ],
      });

      console.log('API create task response:', JSON.stringify(response.data, null, 2));

      if (response.status === 201 && response.data.success) {
        const createdTask = (response.data as { data?: { blockedBy?: unknown } }).data;

        // Check if blockedBy is present in the response
        const hasBlockedBy = createdTask?.blockedBy !== undefined;
        console.log('Created task has blockedBy in response:', hasBlockedBy);

        if (!hasBlockedBy) {
          console.log('BUG REPRODUCED: blockedBy was sent in request but not present in created task');
        }

        // Verify by reading the task back
        if (createdTask && 'path' in createdTask) {
          const taskPath = (createdTask as { path: string }).path;
          const encodedPath = encodeURIComponent(taskPath);
          const getResponse = await apiRequest('GET', `/tasks/${encodedPath}`);

          if (getResponse.status === 200 && getResponse.data.success) {
            const fetchedTask = (getResponse.data as { data?: { blockedBy?: unknown } }).data;
            const fetchedHasBlockedBy = fetchedTask?.blockedBy !== undefined;
            console.log('Fetched task has blockedBy:', fetchedHasBlockedBy);

            if (!fetchedHasBlockedBy) {
              console.log('BUG CONFIRMED: blockedBy not persisted in task frontmatter');
            }
          }
        }
      }
    } catch (error) {
      // API might not be enabled - this is expected in some test environments
      console.log('API request failed (API may not be enabled):', error);
    }
  });

  test.fixme('reproduces issue #1590 - blockedBy should be settable via PUT /api/tasks/:id', async () => {
    /**
     * Bug: When updating a task via PUT /api/tasks/:id with a blockedBy field,
     * the blockedBy data may not be properly updated.
     *
     * This test verifies that the update path also has the issue.
     *
     * Note: The update path (TaskService.updateTask) may have different handling
     * than the create path, so this tests both scenarios.
     */
    const page = app.page;

    // Create a task without blockedBy first
    await runCommand(page, 'TaskNotes: Create task');
    await page.waitForTimeout(1000);

    const modal = page.locator('.modal');
    const titleInput = modal.locator('input[placeholder*="title"], input[aria-label*="title"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill('API Task To Be Blocked 1590');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }

    try {
      // List tasks to find the one we just created
      const listResponse = await apiRequest('GET', '/tasks?limit=10');

      if (listResponse.status === 200 && listResponse.data.success) {
        const tasks = ((listResponse.data as { data?: { tasks?: Array<{ path: string; title: string }> } }).data?.tasks) || [];
        const targetTask = tasks.find((t) => t.title?.includes('API Task To Be Blocked 1590'));

        if (targetTask) {
          const encodedPath = encodeURIComponent(targetTask.path);

          // Try to update the task with blockedBy
          const updateResponse = await apiRequest('PUT', `/tasks/${encodedPath}`, {
            blockedBy: [
              {
                uid: '[[API Blocker Task 1590]]',
                reltype: 'FINISHTOSTART',
              }
            ],
          });

          console.log('API update task response:', JSON.stringify(updateResponse.data, null, 2));

          if (updateResponse.status === 200 && updateResponse.data.success) {
            const updatedTask = (updateResponse.data as { data?: { blockedBy?: unknown } }).data;
            const hasBlockedBy = updatedTask?.blockedBy !== undefined;

            console.log('Updated task has blockedBy:', hasBlockedBy);

            if (!hasBlockedBy) {
              console.log('BUG REPRODUCED: blockedBy update via PUT not applied');
            }
          }
        }
      }
    } catch (error) {
      console.log('API request failed (API may not be enabled):', error);
    }
  });

  test.fixme('reproduces issue #1590 - documentation should list blockedBy as optional field', async () => {
    /**
     * Documentation gap: The HTTP API documentation at
     * https://tasknotes.dev/HTTP_API/#create-task does not list blockedBy
     * or blocking as optional fields for task creation.
     *
     * Current documentation (docs/HTTP_API.md lines 171-181):
     * - priority
     * - status
     * - due
     * - scheduled
     * - tags
     * - projects
     * - contexts
     * - details
     * - timeEstimate
     *
     * Missing from documentation:
     * - blockedBy - Array of TaskDependency objects
     * - recurrence - RRULE string for recurring tasks
     * - reminders - Array of reminder settings
     *
     * Note: 'blocking' is a computed field (derived from other tasks' blockedBy)
     * and should NOT be settable via the API. Only blockedBy should be documented.
     */

    // This test documents the documentation gap
    // The actual fix would be to update docs/HTTP_API.md to include blockedBy

    console.log('Documentation gap identified:');
    console.log('- docs/HTTP_API.md lines 171-181 should include blockedBy as optional field');
    console.log('- Example format for blockedBy:');
    console.log('  blockedBy: [{ uid: "[[Task Name]]", reltype: "FINISHTOSTART" }]');
  });
});
