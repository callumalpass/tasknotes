import { FieldMapping, TaskInfo } from '../types';
import { validateCompleteInstances } from '../utils/dateUtils';

/**
 * Service for mapping between internal field names and user-configured property names
 */
export class FieldMapper {
    constructor(private mapping: FieldMapping) {}

    /**
     * Convert internal field name to user's property name
     */
    toUserField(internalName: keyof FieldMapping): string {
        return this.mapping[internalName];
    }
    /**
     * Normalize arbitrary title-like values to a string.
     * - string: return as-is
     * - number/boolean: String(value)
     * - array: join elements stringified with ', '
     * - object: return empty string (unsupported edge case)
     */
    private normalizeTitle(val: unknown): string | undefined {
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val.map(v => String(v)).join(', ');
        if (val === null || val === undefined) return undefined;
        if (typeof val === 'object') return '';
        return String(val);
    }



    /**
     * Convert frontmatter object using mapping to internal task data
     */
    mapFromFrontmatter(frontmatter: any, filePath: string, storeTitleInFilename?: boolean): Partial<TaskInfo> {
        if (!frontmatter) return {};

        const mapped: Partial<TaskInfo> = {
            path: filePath
        };

        // Map each field if it exists in frontmatter
        if (frontmatter[this.mapping.title] !== undefined) {
            const rawTitle = frontmatter[this.mapping.title];
            const normalized = this.normalizeTitle(rawTitle);
            if (normalized !== undefined) {
                mapped.title = normalized;
            }
        } else if (storeTitleInFilename) {
            const filename = filePath.split('/').pop()?.replace('.md', '');
            if (filename) {
                mapped.title = filename;
            }
        }

        if (frontmatter[this.mapping.status] !== undefined) {
            const statusValue = frontmatter[this.mapping.status];
            // Handle boolean status values (convert back to string for internal use)
            if (typeof statusValue === 'boolean') {
                mapped.status = statusValue ? 'true' : 'false';
            } else {
                mapped.status = statusValue;
            }
        }

        if (frontmatter[this.mapping.priority] !== undefined) {
            mapped.priority = frontmatter[this.mapping.priority];
        }

        if (frontmatter[this.mapping.due] !== undefined) {
            mapped.due = frontmatter[this.mapping.due];
        }

        if (frontmatter[this.mapping.scheduled] !== undefined) {
            mapped.scheduled = frontmatter[this.mapping.scheduled];
        }

        if (frontmatter[this.mapping.contexts] !== undefined) {
            const contexts = frontmatter[this.mapping.contexts];
            // Ensure contexts is always an array
            mapped.contexts = Array.isArray(contexts) ? contexts : [contexts];
        }

        if (frontmatter[this.mapping.projects] !== undefined) {
            const projects = frontmatter[this.mapping.projects];
            // Ensure projects is always an array
            mapped.projects = Array.isArray(projects) ? projects : [projects];
        }

        if (frontmatter[this.mapping.timeEstimate] !== undefined) {
            mapped.timeEstimate = frontmatter[this.mapping.timeEstimate];
        }

        if (frontmatter[this.mapping.completedDate] !== undefined) {
            mapped.completedDate = frontmatter[this.mapping.completedDate];
        }

        if (frontmatter[this.mapping.recurrenceField] !== undefined) {
            mapped.recurrenceField = frontmatter[this.mapping.recurrenceField];
        }

        if (frontmatter[this.mapping.recurrence] !== undefined) {
            mapped.recurrence = frontmatter[this.mapping.recurrence];
        }

        if (frontmatter[this.mapping.dateCreated] !== undefined) {
            mapped.dateCreated = frontmatter[this.mapping.dateCreated];
        }

        if (frontmatter[this.mapping.dateModified] !== undefined) {
            mapped.dateModified = frontmatter[this.mapping.dateModified];
        }

        if (frontmatter[this.mapping.timeEntries] !== undefined) {
            mapped.timeEntries = frontmatter[this.mapping.timeEntries];
        }

        if (frontmatter[this.mapping.completeInstances] !== undefined) {
            // Validate and clean the complete_instances array
            mapped.complete_instances = validateCompleteInstances(frontmatter[this.mapping.completeInstances]);
        }

        if (frontmatter[this.mapping.icsEventId] !== undefined) {
            const icsEventId = frontmatter[this.mapping.icsEventId];
            // Ensure icsEventId is always an array
            mapped.icsEventId = Array.isArray(icsEventId) ? icsEventId : [icsEventId];
        }

        if (frontmatter[this.mapping.reminders] !== undefined) {
            const reminders = frontmatter[this.mapping.reminders];
            // Ensure reminders is always an array
            mapped.reminders = Array.isArray(reminders) ? reminders : [reminders];
        }

        // Handle tags array (includes archive tag)
        if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
            mapped.tags = frontmatter.tags;
            mapped.archived = frontmatter.tags.includes(this.mapping.archiveTag);
        }

        // Handle time entries
        if (frontmatter.timeEntries !== undefined) {
            mapped.timeEntries = frontmatter.timeEntries;
        }

        return mapped;
    }

    /**
     * Convert internal task data to frontmatter using mapping
     */
    mapToFrontmatter(taskData: Partial<TaskInfo>, taskTag?: string, storeTitleInFilename?: boolean): any {
        const frontmatter: any = {};

        // Map each field if it exists in task data
        if (taskData.title !== undefined) {
            frontmatter[this.mapping.title] = taskData.title;
        }

        if (storeTitleInFilename) {
            delete frontmatter[this.mapping.title];
        }

        if (taskData.status !== undefined) {
            // Coerce boolean-like status strings to actual booleans for compatibility with Obsidian checkbox properties
            const lower = taskData.status.toLowerCase();
            const coercedValue = (lower === 'true' || lower === 'false') ? (lower === 'true') : taskData.status;
            frontmatter[this.mapping.status] = coercedValue;
        }

        if (taskData.priority !== undefined) {
            frontmatter[this.mapping.priority] = taskData.priority;
        }

        if (taskData.due !== undefined) {
            frontmatter[this.mapping.due] = taskData.due;
        }

        if (taskData.scheduled !== undefined) {
            frontmatter[this.mapping.scheduled] = taskData.scheduled;
        }

        if (taskData.contexts !== undefined) {
            frontmatter[this.mapping.contexts] = taskData.contexts;
        }

        if (taskData.projects !== undefined) {
            frontmatter[this.mapping.projects] = taskData.projects;
        }

        if (taskData.timeEstimate !== undefined) {
            frontmatter[this.mapping.timeEstimate] = taskData.timeEstimate;
        }


        if (taskData.completedDate !== undefined) {
            frontmatter[this.mapping.completedDate] = taskData.completedDate;
        }

        if (taskData.recurrenceField !== undefined) {
            frontmatter[this.mapping.recurrenceField] = taskData.recurrenceField;
        }

        if (taskData.recurrence !== undefined) {
            frontmatter[this.mapping.recurrence] = taskData.recurrence;
        }

        if (taskData.dateCreated !== undefined) {
            frontmatter[this.mapping.dateCreated] = taskData.dateCreated;
        }

        if (taskData.dateModified !== undefined) {
            frontmatter[this.mapping.dateModified] = taskData.dateModified;
        }

        if (taskData.timeEntries !== undefined) {
            frontmatter[this.mapping.timeEntries] = taskData.timeEntries;
        }

        if (taskData.complete_instances !== undefined) {
            frontmatter[this.mapping.completeInstances] = taskData.complete_instances;
        }

        if (taskData.icsEventId !== undefined && taskData.icsEventId.length > 0) {
            frontmatter[this.mapping.icsEventId] = taskData.icsEventId;
        }

        if (taskData.reminders !== undefined && taskData.reminders.length > 0) {
            frontmatter[this.mapping.reminders] = taskData.reminders;
        }

        // Handle tags (merge archive status into tags array)
        let tags = taskData.tags ? [...taskData.tags] : [];

        // Ensure task tag is always preserved if provided
        if (taskTag && !tags.includes(taskTag)) {
            tags.push(taskTag);
        }

        if (taskData.archived === true && !tags.includes(this.mapping.archiveTag)) {
            tags.push(this.mapping.archiveTag);
        } else if (taskData.archived === false) {
            tags = tags.filter(tag => tag !== this.mapping.archiveTag);
        }

        if (tags.length > 0) {
            frontmatter.tags = tags;
        }

        // Handle time entries
        if (taskData.timeEntries !== undefined) {
            frontmatter.timeEntries = taskData.timeEntries;
        }

        return frontmatter;
    }

    /**
     * Update mapping configuration
     */
    updateMapping(newMapping: FieldMapping): void {
        this.mapping = newMapping;
    }

    /**
     * Get current mapping
     */
    getMapping(): FieldMapping {
        return { ...this.mapping };
    }

    /**
     * Validate that a mapping has no empty field names
     */
    static validateMapping(mapping: FieldMapping): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        const fields = Object.keys(mapping) as (keyof FieldMapping)[];
        for (const field of fields) {
            if (!mapping[field] || mapping[field].trim() === '') {
                errors.push(`Field "${field}" cannot be empty`);
            }
        }

        // Check for duplicate values
        const values = Object.values(mapping);
        const uniqueValues = new Set(values);
        if (values.length !== uniqueValues.size) {
            errors.push('Field mappings must have unique property names');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}