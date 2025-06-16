import { parseYaml } from 'obsidian';
import * as YAML from 'yaml';

/**
 * A simple cache for YAML parsing results
 * This helps avoid repeated parsing of the same frontmatter
 */
export class YAMLCache {
    private static cache: Map<string, {
        data: any;
        timestamp: number;
    }> = new Map();
    
    private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL for parsed YAML
    private static readonly MAX_CACHE_SIZE = 100; // Maximum number of entries to keep in cache
    
    /**
     * Parse YAML content with caching
     * 
     * @param content The YAML content to parse
     * @param cacheKey A unique key for caching, typically the file path
     * @returns The parsed YAML object
     */
    public static parse(content: string, cacheKey: string): any {
        // Clean cache occasionally
        this.cleanupCache();
        
        const now = Date.now();
        const cached = this.cache.get(cacheKey);
        
        // Use cached value if available and not expired
        if (cached && now - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        
        // Otherwise parse and cache the result
        try {
            const result = parseYaml(content);
            
            this.cache.set(cacheKey, {
                data: result,
                timestamp: now
            });
            
            return result;
        } catch (e) {
            console.error('Error parsing YAML content:', e);
            return null;
        }
    }
    
    /**
     * Extract and parse frontmatter from a markdown file with caching
     * 
     * @param content The full markdown content
     * @param cacheKey A unique key for caching, typically the file path
     * @returns The parsed frontmatter object or null if none found
     */
    public static extractFrontmatter(content: string, cacheKey: string): any {
        if (!content.startsWith('---')) {
            return null;
        }
        
        const endOfFrontmatter = content.indexOf('---', 3);
        if (endOfFrontmatter === -1) {
            return null;
        }
        
        const frontmatter = content.substring(3, endOfFrontmatter);
        return this.parse(frontmatter, cacheKey);
    }
    
    /**
     * Clear the cache for a specific key
     * 
     * @param cacheKey The key to clear from cache
     */
    public static clearCacheEntry(cacheKey: string): void {
        this.cache.delete(cacheKey);
    }
    
    /**
     * Clear the entire cache
     */
    public static clearCache(): void {
        this.cache.clear();
    }
    
    /**
     * Clean up expired cache entries and reduce cache size if needed
     */
    private static cleanupCache(): void {
        const now = Date.now();
        
        // Remove expired entries
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        }
        
        // If still too many entries, remove oldest ones
        if (this.cache.size > this.MAX_CACHE_SIZE) {
            const entries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const entriesToRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
            for (const [key] of entriesToRemove) {
                this.cache.delete(key);
            }
        }
    }
}