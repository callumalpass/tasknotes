import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// --- Configuration ---
const SOURCE_LOCALE = 'en';
const RESOURCES_DIR = path.resolve('src/i18n/resources');
const MANIFEST_PATH = path.resolve('i18n.manifest.json');
const STATE_PATH = path.resolve('i18n.state.json');

// --- Helper Functions ---

/** Flattens a nested translation object into a single-level key-value map. */
function flatten(tree, prefix = '') {
    const entries = {};
    for (const [key, value] of Object.entries(tree)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
            entries[fullKey] = value;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(entries, flatten(value, fullKey));
        }
    }
    return entries;
}

/** Hashes a string using SHA1. */
function hash(str) {
    return crypto.createHash('sha1').update(str, 'utf8').digest('hex');
}

/** Dynamically imports a .ts file by converting it to a temporary .mjs file. */
async function loadLocaleModule(locale) {
    const filePath = path.join(RESOURCES_DIR, `${locale}.ts`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Locale file not found: ${filePath}`);
    }

    // Read the TypeScript file
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove imports (they won't work in our simple conversion)
    content = content.replace(/^import\s+.*?;$/gm, '');

    // Remove type exports at the end
    content = content.replace(/export\s+type\s+.*?;$/gm, '');

    // Convert TypeScript export to ES module format that Node can import
    // Replace "export const locale = {" with "export default {"
    content = content.replace(
        new RegExp(`export\\s+const\\s+${locale}\\s*:\\s*\\w+\\s*=\\s*`, 'g'),
        'export default '
    );

    // Also handle the case without type annotation
    content = content.replace(
        new RegExp(`export\\s+const\\s+${locale}\\s*=\\s*`, 'g'),
        'export default '
    );

    // Write to temporary .mjs file
    const tempPath = path.join(RESOURCES_DIR, `.${locale}.temp.mjs`);
    fs.writeFileSync(tempPath, content);

    try {
        // Import the temporary file with cache busting - need absolute path with file:// protocol
        const absolutePath = path.resolve(tempPath);
        const module = await import(`file://${absolutePath}?v=${Date.now()}`);
        return module.default;
    } finally {
        // Clean up temporary file
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
}

/** Loads and flattens a locale file. */
async function getLocaleMap(locale) {
    try {
        const module = await loadLocaleModule(locale);
        return flatten(module);
    } catch (error) {
        console.error(`Error loading locale "${locale}":`, error.message);
        return {};
    }
}

/** Safely reads a JSON file. */
function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`Error parsing JSON file ${filePath}:`, error.message);
        return {};
    }
}

/** Writes a JSON file with standardized formatting. */
function saveJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

/** Gets all available locale files. */
function getAvailableLocales() {
    if (!fs.existsSync(RESOURCES_DIR)) {
        console.error(`Resources directory not found: ${RESOURCES_DIR}`);
        return [];
    }

    return fs.readdirSync(RESOURCES_DIR)
        .filter(file => file.endsWith('.ts') && !file.startsWith('.'))
        .map(file => path.basename(file, '.ts'));
}

// --- Commands ---

function normalizeStateEntry(entry) {
    if (!entry) {
        return { source: '', translation: '' };
    }

    if (typeof entry === 'string') {
        return { source: entry, translation: '' };
    }

    if (typeof entry === 'object') {
        return {
            source: entry.source ?? '',
            translation: entry.translation ?? ''
        };
    }

    return { source: '', translation: '' };
}

/** `sync`: Updates manifest and state files. */
async function sync() {
    console.log('Syncing i18n files...');

    // 1. Update Manifest from source locale
    const sourceMap = await getLocaleMap(SOURCE_LOCALE);
    if (Object.keys(sourceMap).length === 0) {
        console.error(`❌ Error: Could not load source locale "${SOURCE_LOCALE}". Check that the file exists and exports valid data.`);
        process.exit(1);
    }

    const newManifest = {};
    for (const key in sourceMap) {
        newManifest[key] = hash(sourceMap[key]);
    }
    saveJson(MANIFEST_PATH, newManifest);
    console.log(`✓ Generated manifest from "${SOURCE_LOCALE}.ts" with ${Object.keys(newManifest).length} keys.`);

    // 2. Update State file for all other locales
    const allLocales = getAvailableLocales();
    const otherLocales = allLocales.filter(l => l !== SOURCE_LOCALE);

    if (otherLocales.length === 0) {
        console.log('ℹ️  No other locale files found. Only manifest updated.');
        return;
    }

    const currentState = loadJson(STATE_PATH);
    const newState = {};

    for (const locale of otherLocales) {
        console.log(`Processing locale: ${locale}`);
        newState[locale] = {};
        const translationMap = await getLocaleMap(locale);

        for (const key in newManifest) {
            const sourceHash = newManifest[key];
            const translatedValue = translationMap[key];

            if (translatedValue === undefined) {
                // Key is missing from translation file
                newState[locale][key] = null;
                continue;
            }

            const translationHash = hash(translatedValue);
            const previousEntry = normalizeStateEntry(currentState[locale]?.[key]);

            let confirmedSource = previousEntry.source;

            if (previousEntry.source === sourceHash) {
                confirmedSource = sourceHash;
            } else if (previousEntry.translation && previousEntry.translation !== translationHash) {
                confirmedSource = sourceHash;
            } else if (!previousEntry.source) {
                confirmedSource = sourceHash;
            }

            newState[locale][key] = {
                source: confirmedSource,
                translation: translationHash
            };
        }
    }
    saveJson(STATE_PATH, newState);
    console.log(`✓ Updated state for locales: ${otherLocales.join(', ')}.`);
    console.log('\nSync complete. Review and commit the updated i18n files.');
}

/** `verify`: Checks for stale or missing translations. */
async function verify() {
    console.log('Verifying i18n status...');
    const manifest = loadJson(MANIFEST_PATH);
    const state = loadJson(STATE_PATH);

    if (Object.keys(manifest).length === 0) {
        console.error('❌ Error: No manifest found. Run "npm run i18n:sync" first.');
        process.exit(1);
    }

    const staleTranslations = [];
    const missingTranslations = [];
    const localeStats = {};

    for (const locale in state) {
        localeStats[locale] = { total: 0, translated: 0, stale: 0 };

        for (const key in manifest) {
            const sourceHash = manifest[key];
            const entry = normalizeStateEntry(state[locale]?.[key]);

            localeStats[locale].total++;

            if (!state[locale]?.[key] || !entry.translation) {
                missingTranslations.push({ locale, key });
            } else if (entry.source !== sourceHash) {
                staleTranslations.push({ locale, key });
                localeStats[locale].stale++;
            } else {
                localeStats[locale].translated++;
            }
        }
    }

    // Print statistics
    console.log('\n📊 Translation Statistics:');
    for (const [locale, stats] of Object.entries(localeStats)) {
        const percentage = Math.round((stats.translated / stats.total) * 100);
        console.log(`  ${locale}: ${stats.translated}/${stats.total} (${percentage}%) up-to-date, ${stats.stale} stale`);
    }

    const hasIssues = staleTranslations.length > 0 || missingTranslations.length > 0;

    if (missingTranslations.length > 0) {
        console.error('\n❌ Missing translations:');
        const byLocale = {};
        missingTranslations.forEach(({ locale, key }) => {
            if (!byLocale[locale]) byLocale[locale] = [];
            byLocale[locale].push(key);
        });

        for (const [locale, keys] of Object.entries(byLocale)) {
            console.error(`  [${locale}] ${keys.length} missing keys:`);
            keys.slice(0, 10).forEach(key => console.error(`    - ${key}`));
            if (keys.length > 10) {
                console.error(`    ... and ${keys.length - 10} more`);
            }
        }
    }

    if (staleTranslations.length > 0) {
        console.error('\n⚠️  Stale translations (source text changed):');
        const byLocale = {};
        staleTranslations.forEach(({ locale, key }) => {
            if (!byLocale[locale]) byLocale[locale] = [];
            byLocale[locale].push(key);
        });

        for (const [locale, keys] of Object.entries(byLocale)) {
            console.error(`  [${locale}] ${keys.length} stale keys:`);
            keys.slice(0, 10).forEach(key => console.error(`    - ${key}`));
            if (keys.length > 10) {
                console.error(`    ... and ${keys.length - 10} more`);
            }
        }
    }

    if (!hasIssues) {
        console.log('\n✅ All translations are up-to-date.');
        process.exit(0);
    } else {
        console.error(`\nPlease update translations and run 'npm run i18n:sync' to mark them as current.`);
        process.exit(1);
    }
}

/** `status`: Shows a summary of translation status without failing. */
async function status() {
    console.log('Translation Status Report');
    console.log('========================');

    const manifest = loadJson(MANIFEST_PATH);
    const state = loadJson(STATE_PATH);

    if (Object.keys(manifest).length === 0) {
        console.log('No manifest found. Run "npm run i18n:sync" to generate.');
        return;
    }

    console.log(`Source locale: ${SOURCE_LOCALE}`);
    console.log(`Total keys: ${Object.keys(manifest).length}`);

    if (Object.keys(state).length === 0) {
        console.log('No translation state found. Run "npm run i18n:sync" to generate.');
        return;
    }

    console.log('\nTranslation Coverage:');
    for (const locale in state) {
        let translated = 0;
        let stale = 0;
        const total = Object.keys(manifest).length;

        for (const key in manifest) {
            const sourceHash = manifest[key];
            const entry = normalizeStateEntry(state[locale]?.[key]);

            if (entry.translation) {
                if (entry.source === sourceHash) {
                    translated++;
                } else {
                    stale++;
                }
            }
        }

        const percentage = Math.round((translated / total) * 100);
        const stalePercentage = Math.round((stale / total) * 100);
        console.log(`  ${locale}: ${percentage}% translated, ${stalePercentage}% stale`);
    }
}

// --- Main Execution ---
const command = process.argv[2];

(async () => {
    try {
        if (command === 'sync') {
            await sync();
        } else if (command === 'verify') {
            await verify();
        } else if (command === 'status') {
            await status();
        } else {
            console.error(`Unknown command: ${command}`);
            console.error('Available commands:');
            console.error('  sync   - Update manifest and state files');
            console.error('  verify - Check for missing or stale translations (fails on issues)');
            console.error('  status - Show translation status summary (non-failing)');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack);
        }
        process.exit(1);
    }
})();
