import { TaskInfo } from '../types';

export interface SearchIndex {
  [path: string]: string[];
}

export function buildSearchIndex(
  tasks: TaskInfo[], 
  options: { getAliases?: (path: string) => string[] } = {}
): SearchIndex {
  const index: SearchIndex = {};
  
  for (const task of tasks) {
    const searchTerms: string[] = [];
    
    // Add path components
    if (task.path) {
      searchTerms.push(task.path);
      searchTerms.push(...task.path.split('/'));
      searchTerms.push(task.path.replace('.md', ''));
    }
    
    // Add title
    if (task.title) {
      searchTerms.push(task.title);
    }
    
    // Add aliases if provided
    if (options.getAliases && task.path) {
      const aliases = options.getAliases(task.path);
      searchTerms.push(...aliases);
    }
    
    // Add contexts, projects, tags
    if (task.contexts) searchTerms.push(...task.contexts);
    if (task.projects) searchTerms.push(...task.projects);
    if (task.tags) searchTerms.push(...task.tags);
    
    index[task.path] = searchTerms;
  }
  
  return index;
}

export function filterTasksBySearch(
  tasks: TaskInfo[], 
  searchIndex: SearchIndex, 
  searchTerm: string
): TaskInfo[] {
  if (!searchTerm || !searchTerm.trim()) {
    return tasks;
  }
  
  const normalizedSearchTerm = searchTerm.toLowerCase().trim();
  
  return tasks.filter(task => {
    const searchTerms = searchIndex[task.path] || [];
    return searchTerms.some(term => 
      term.toLowerCase().includes(normalizedSearchTerm)
    );
  });
}