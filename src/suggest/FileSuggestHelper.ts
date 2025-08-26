import type TaskNotesPlugin from '../main';
import { parseFrontMatterAliases, TFile } from 'obsidian';
import { scoreMultiword } from '../utils/fuzzyMatch';

export interface FileSuggestionItem {
  insertText: string;   // usually basename
  displayText: string;  // "basename [title: ... | aliases: ...]"
  score: number;
}

export const FileSuggestHelper = {
  async suggest(plugin: TaskNotesPlugin, query: string, limit = 20): Promise<FileSuggestionItem[]> {
    const files = plugin.app.vault.getMarkdownFiles();
    const items: FileSuggestionItem[] = [];

    for (const file of files) {
      const cache = plugin.app.metadataCache.getFileCache(file);

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
  }
};

