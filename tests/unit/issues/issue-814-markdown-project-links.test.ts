/**
 * Test for issue #814: Markdown-project links aren't recognized on Project note
 *
 * Bug Description:
 * Tasks with markdown-style project links like `[z Test Project](z%20Test%20Project.md)`
 * are not being recognized as subtasks on the Project note, even though the links work
 * and are properly displayed on the task note itself.
 *
 * Expected Behavior:
 * - Tasks with markdown links in the projects field should appear in project's Subtasks
 * - Tasks should show the project in the Edit Task modal
 * - Both wikilink [[Project]] and markdown [Project](path) formats should work
 */

import { TFile } from 'obsidian';

describe('Issue #814: Markdown project links not recognized', () => {
    let mockPlugin: any;
    let mockApp: any;
    let mockMetadataCache: any;
    let mockFileCache: any;
    let projectSubtasksService: any;

    beforeEach(() => {
        // Mock file cache for a task with markdown-style project link
        mockFileCache = {
            frontmatter: {
                projects: [
                    '[z Test Project](z%20Test%20Project.md)' // Markdown-style link
                ]
            }
        };

        // Mock metadata cache
        mockMetadataCache = {
            getFileCache: jest.fn().mockReturnValue(mockFileCache),
            getFirstLinkpathDest: jest.fn((linkpath: string, sourcePath: string) => {
                // Simulate Obsidian's link resolution - all test paths resolve to 'z Test Project.md'
                // This simulates how Obsidian resolves relative paths and different link formats
                const file = new TFile();
                file.path = 'z Test Project.md';
                return file;
            }),
            resolvedLinks: {
                'test-task.md': {
                    'z Test Project.md': 1
                }
            }
        };

        // Mock Obsidian app
        mockApp = {
            metadataCache: mockMetadataCache,
            vault: {
                getAbstractFileByPath: jest.fn((path: string) => {
                    if (path === 'test-task.md') {
                        const file = new TFile();
                        file.path = 'test-task.md';
                        return file;
                    }
                    if (path === 'z Test Project.md') {
                        const file = new TFile();
                        file.path = 'z Test Project.md';
                        return file;
                    }
                    return null;
                })
            }
        };

        // Mock field mapper
        const mockFieldMapper = {
            toUserField: jest.fn((field: string) => {
                const mapping: Record<string, string> = {
                    'projects': 'projects'
                };
                return mapping[field] || field;
            })
        };

        // Mock plugin
        mockPlugin = {
            app: mockApp,
            fieldMapper: mockFieldMapper
        };

        // Import ProjectSubtasksService
        const { ProjectSubtasksService } = require('../../../src/services/ProjectSubtasksService');
        projectSubtasksService = new ProjectSubtasksService(mockPlugin);
    });

    describe('isLinkFromProjectsField', () => {
        it('should recognize wikilink format project references (existing behavior)', async () => {
            // Update mock to use wikilink format
            mockFileCache.frontmatter.projects = ['[[z Test Project]]'];

            // Call the private method via the public getTasksLinkedToProject
            const projectFile = new TFile();
            projectFile.path = 'z Test Project.md';

            // Mock cacheManager
            mockPlugin.cacheManager = {
                getTaskInfo: jest.fn().mockResolvedValue({
                    path: 'test-task.md',
                    title: 'Test task',
                    status: 'todo',
                    projects: ['[[z Test Project]]']
                })
            };

            const tasks = await projectSubtasksService.getTasksLinkedToProject(projectFile);

            // Should find the task with wikilink format
            expect(tasks).toHaveLength(1);
            expect(tasks[0].path).toBe('test-task.md');
        });

        it('should recognize markdown link format project references (FAILING - Bug #814)', async () => {
            // This is the failing case from the bug report
            mockFileCache.frontmatter.projects = ['[z Test Project](z%20Test%20Project.md)'];

            const projectFile = new TFile();
            projectFile.path = 'z Test Project.md';

            // Mock cacheManager
            mockPlugin.cacheManager = {
                getTaskInfo: jest.fn().mockResolvedValue({
                    path: 'test-task.md',
                    title: 'Test task',
                    status: 'todo',
                    projects: ['[z Test Project](z%20Test%20Project.md)']
                })
            };

            const tasks = await projectSubtasksService.getTasksLinkedToProject(projectFile);

            // BUG: This currently fails because isLinkFromProjectsField only checks for wikilinks
            // It should find the task, but it doesn't
            expect(tasks).toHaveLength(1);
            expect(tasks[0].path).toBe('test-task.md');
        });

        it('should recognize markdown links with URL-encoded spaces', async () => {
            // Test various markdown link formats that could appear
            const testCases = [
                '[z Test Project](z%20Test%20Project.md)',
                '[z Test Project](z Test Project.md)',
                '[Project Name](../../projects/Project%20Name.md)',
                '[Car Maintenance](../../projects/Car%20Maintenance.md)'
            ];

            for (const projectLink of testCases) {
                mockFileCache.frontmatter.projects = [projectLink];

                const projectFile = new TFile();
                projectFile.path = 'z Test Project.md';

                mockPlugin.cacheManager = {
                    getTaskInfo: jest.fn().mockResolvedValue({
                        path: 'test-task.md',
                        title: 'Test task',
                        status: 'todo',
                        projects: [projectLink]
                    })
                };

                const tasks = await projectSubtasksService.getTasksLinkedToProject(projectFile);

                expect(tasks).toHaveLength(1);
            }
        });
    });

    describe('Project link detection in frontmatter', () => {
        it('should detect both wikilink and markdown link formats', () => {
            const { parseLinkToPath } = require('../../../src/utils/linkUtils');

            // Test wikilink format
            const wikilink = '[[z Test Project]]';
            const wikilinkPath = parseLinkToPath(wikilink);
            expect(wikilinkPath).toBe('z Test Project');

            // Test markdown format with URL-encoded space
            const markdownLink = '[z Test Project](z%20Test%20Project.md)';
            const markdownPath = parseLinkToPath(markdownLink);
            expect(markdownPath).toBe('z Test Project.md');

            // Test markdown format with regular space
            const markdownLinkSpace = '[z Test Project](z Test Project.md)';
            const markdownPathSpace = parseLinkToPath(markdownLinkSpace);
            expect(markdownPathSpace).toBe('z Test Project.md');
        });
    });
});
