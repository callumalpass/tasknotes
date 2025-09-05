import type TaskNotesPlugin from '../main';
import { parseFrontMatterAliases } from 'obsidian';
import { scoreMultiword } from '../utils/fuzzyMatch';
import { parseDisplayFieldsRow } from '../utils/projectAutosuggestDisplayFieldsParser';

export interface FileSuggestionItem {
  insertText: string;   // usually basename
  displayText: string;  // "basename [title: ... | aliases: ...]"
  score: number;
}

export const FileSuggestHelper = {
  async suggest(plugin: TaskNotesPlugin, query: string, limit = 20): Promise<FileSuggestionItem[]> {
    const run = async () => {
      const files = plugin?.app?.vault?.getMarkdownFiles ? plugin.app.vault.getMarkdownFiles() : [];
      const items: FileSuggestionItem[] = [];

      // Collect additional searchable properties from settings rows (|s flag)
      const rows: string[] = (plugin.settings?.projectAutosuggest?.rows ?? []).slice(0, 3);
      const extraProps = new Set<string>();
      for (const row of rows) {
        try {
          const tokens = parseDisplayFieldsRow(row);
          for (const t of tokens) {
            if ((t as any).searchable && !t.property.startsWith('literal:')) {
              extraProps.add(t.property);
            }
          }
        } catch {/* ignore parse errors */}
      }
      const qLower = (query || '').toLowerCase();

      // Get filtering settings
      const requiredTags = plugin.settings?.projectAutosuggest?.requiredTags ?? [];
      const includeFolders = plugin.settings?.projectAutosuggest?.includeFolders ?? [];

      for (const file of files) {
        const cache = plugin.app.metadataCache.getFileCache(file);

        // Apply tag filtering - use native Obsidian API
        if (requiredTags.length > 0) {
          // Get tags from both native tag detection and frontmatter
          const nativeTags = cache?.tags?.map(t => t.tag.replace('#', '')) || [];
          const frontmatterTags = cache?.frontmatter?.tags || [];
          const allTags = [
            ...nativeTags,
            ...(Array.isArray(frontmatterTags) ? frontmatterTags : [frontmatterTags].filter(Boolean))
          ];
          
          // Check if file has ANY of the required tags
          const hasRequiredTag = requiredTags.some(reqTag => allTags.includes(reqTag));
          if (!hasRequiredTag) {
            continue; // Skip this file
          }
        }

        // Apply folder filtering
        if (includeFolders.length > 0) {
          const isInIncludedFolder = includeFolders.some(folder => 
            file.path.startsWith(folder) || file.path.startsWith(folder + '/')
          );
          if (!isInIncludedFolder) {
            continue; // Skip this file
          }
        }

        // Gather fields
        const basename = file.basename;
        let title = '';
        if (cache?.frontmatter) {
          const mapped = plugin.fieldMapper.mapFromFrontmatter(cache.frontmatter, file.path, plugin.settings.storeTitleInFilename);
          title = typeof mapped.title === 'string' ? mapped.title : '';
        }
        const aliases = cache?.frontmatter ? parseFrontMatterAliases(cache.frontmatter) || [] : [];

        // Compute score: keep best among fields to rank the file
        let bestScore = 0;
        bestScore = Math.max(bestScore, scoreMultiword(query, basename) + 15); // basename weight
        if (title) bestScore = Math.max(bestScore, scoreMultiword(query, title) + 5);
        if (Array.isArray(aliases)) {
          for (const a of aliases) {
            if (typeof a === 'string') {
              bestScore = Math.max(bestScore, scoreMultiword(query, a));
            }
          }
        }

        // Additional searchable properties (IN ADDITION TO defaults)
        if (extraProps.size > 0) {
          const fm = cache?.frontmatter || {};
          for (const prop of extraProps) {
            let val = '';
            if (prop === 'file.path') {
              val = file.path;
            } else if (prop === 'file.parent') {
              // @ts-ignore parent typing on TFile
              val = (file.parent?.path || '') as string;
            } else if (prop === 'file.basename') {
              val = basename; // already default, but harmless
            } else if (prop === 'title') {
              val = title; // already default
            } else if (prop === 'aliases') {
              const aList = Array.isArray(aliases) ? aliases.filter(a => typeof a === 'string') : [];
              val = aList.join(' ');
            } else {
              const raw = (fm as any)[prop];
              if (raw != null) {
                if (Array.isArray(raw)) val = raw.filter(x => typeof x === 'string').join(' ');
                else if (typeof raw === 'object') val = JSON.stringify(raw);
                else if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') val = String(raw);
              }
            }
            if (val) {
              const s = scoreMultiword(query, val);
              const inc = s > 0 ? s : (val.toLowerCase().includes(qLower) ? 30 : 0);
              if (inc > 0) bestScore = Math.max(bestScore, inc);
            }
          }
        }

        if (bestScore > 0) {
          // Build display
          const extras: string[] = [];
          if (title && title !== basename) extras.push(`title: ${title}`);
          const aliasList = Array.isArray(aliases) ? aliases.filter(a => typeof a === 'string') : [];
          if (aliasList.length) extras.push(`aliases: ${aliasList.join(', ')}`);
          const display = extras.length ? `${basename} [${extras.join(' | ')}]` : basename;

          items.push({ insertText: basename, displayText: display, score: bestScore });
        }
      }

      // Sort and cap
      items.sort((a, b) => b.score - a.score);
      // Deduplicate by insertText (basename)
      const out: FileSuggestionItem[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        if (seen.has(it.insertText)) continue;
        out.push(it);
        seen.add(it.insertText);
        if (out.length >= limit) break;
      }
      return out;
    };

    const debounceMs = plugin.settings?.suggestionDebounceMs ?? 0;
    if (!debounceMs) {
      return run();
    }

    return new Promise<FileSuggestionItem[]>((resolve) => {
      const anyPlugin = plugin as unknown as { __fileSuggestTimer?: number };
      if (anyPlugin.__fileSuggestTimer) {
        clearTimeout(anyPlugin.__fileSuggestTimer);
      }
      anyPlugin.__fileSuggestTimer = setTimeout(async () => {
        const results = await run();
        resolve(results);
      }, debounceMs) as unknown as number;
    });
  }
};

