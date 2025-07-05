import { format } from 'date-fns';
import { parseYaml } from 'obsidian';
// YAML not needed in template processor

export interface TemplateData {
    title: string;
    priority: string;
    status: string;
    contexts: string[];
    tags: string[];
    timeEstimate: number;
    dueDate: string;
    scheduledDate: string;
    details: string;
    parentNote: string;
}

export interface ProcessedTemplate {
    frontmatter: Record<string, any>;
    body: string;
}

/**
 * Process a complete template with frontmatter and body
 */
export function processTemplate(templateContent: string, taskData: TemplateData): ProcessedTemplate {
    const sections = parseTemplateSections(templateContent);
    
    const processedFrontmatter = sections.frontmatter 
        ? processTemplateFrontmatter(sections.frontmatter, taskData)
        : {};
    
    const processedBody = processTemplateBody(sections.body, taskData);
    
    return {
        frontmatter: processedFrontmatter,
        body: processedBody
    };
}

/**
 * Parse template into frontmatter and body sections
 */
function parseTemplateSections(templateContent: string): { frontmatter: string | null; body: string } {
    const lines = templateContent.split('\n');
    
    // Check if template starts with frontmatter
    if (lines[0]?.trim() === '---') {
        // Find the closing ---
        let endIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i]?.trim() === '---') {
                endIndex = i;
                break;
            }
        }
        
        if (endIndex > 0) {
            // Extract frontmatter content (between the --- lines)
            const frontmatterLines = lines.slice(1, endIndex);
            const frontmatter = frontmatterLines.join('\n');
            
            // Extract body content (after the closing ---)
            const bodyLines = lines.slice(endIndex + 1);
            const body = bodyLines.join('\n');
            
            return {
                frontmatter: frontmatter.trim() || null,
                body: body
            };
        }
    }
    
    // No frontmatter found, entire content is body
    return {
        frontmatter: null,
        body: templateContent
    };
}

/**
 * Process template variables in frontmatter
 */
function processTemplateFrontmatter(frontmatterContent: string, taskData: TemplateData): Record<string, any> {
    try {
        // First, process template variables in the raw YAML text
        const processedYamlText = processTemplateVariables(frontmatterContent, taskData);
        
        // Then parse the processed YAML
        const parsedFrontmatter = parseYaml(processedYamlText);
        
        // Return empty object if parsing failed or result is not an object
        if (typeof parsedFrontmatter !== 'object' || parsedFrontmatter === null) {
            console.warn('Template frontmatter did not parse to a valid object');
            return {};
        }
        
        return parsedFrontmatter;
    } catch (error) {
        console.error('Error processing template frontmatter:', error);
        return {};
    }
}

/**
 * Process template variables in body content
 */
function processTemplateBody(bodyContent: string, taskData: TemplateData): string {
    return processTemplateVariables(bodyContent, taskData);
}

/**
 * Process task template variables like {{title}}, {{priority}}, {{status}}, etc.
 * This is the core variable replacement function used by both frontmatter and body processing
 */
function processTemplateVariables(template: string, taskData: TemplateData): string {
    let result = template;
    const now = new Date();
    
    // {{title}} - Task title
    result = result.replace(/\{\{title\}\}/g, taskData.title || '');
    
    // {{priority}} - Task priority
    result = result.replace(/\{\{priority\}\}/g, taskData.priority || '');
    
    // {{status}} - Task status
    result = result.replace(/\{\{status\}\}/g, taskData.status || '');
    
    // {{contexts}} - Task contexts (comma-separated)
    const contexts = Array.isArray(taskData.contexts) ? taskData.contexts.join(', ') : '';
    result = result.replace(/\{\{contexts\}\}/g, contexts);
    
    // {{tags}} - Task tags (comma-separated)
    const tags = Array.isArray(taskData.tags) ? taskData.tags.join(', ') : '';
    result = result.replace(/\{\{tags\}\}/g, tags);
    
    // {{timeEstimate}} - Time estimate in minutes
    result = result.replace(/\{\{timeEstimate\}\}/g, taskData.timeEstimate?.toString() || '');
    
    // {{dueDate}} - Due date
    result = result.replace(/\{\{dueDate\}\}/g, taskData.dueDate || '');
    
    // {{scheduledDate}} - Scheduled date
    result = result.replace(/\{\{scheduledDate\}\}/g, taskData.scheduledDate || '');
    
    // {{details}} - User-provided details/description
    result = result.replace(/\{\{details\}\}/g, taskData.details || '');
    
    // {{parentNote}} - Parent note name/path where task was created
    result = result.replace(/\{\{parentNote\}\}/g, taskData.parentNote ? `\n- ${taskData.parentNote}` : '');
    
    // {{date}} - Current date (basic format only)
    result = result.replace(/\{\{date\}\}/g, format(now, 'yyyy-MM-dd'));
    
    // {{time}} - Current time (basic format only)
    result = result.replace(/\{\{time\}\}/g, format(now, 'HH:mm'));
    
    return result;
}

/**
 * Merge template frontmatter with task frontmatter
 * Template frontmatter takes precedence over default task frontmatter
 */
export function mergeTemplateFrontmatter(
    baseFrontmatter: Record<string, any>, 
    templateFrontmatter: Record<string, any>
): Record<string, any> {
    return {
        ...baseFrontmatter,
        ...templateFrontmatter
    };
}