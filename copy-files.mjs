#!/usr/bin/env node

import { copyFile, mkdir, access, constants, readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current script directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// Default copy destination - the e2e-vault in this repo
// Can be overridden with OBSIDIAN_PLUGIN_PATH environment variable or .copy-files.local file
const defaultPath = join(__dirname, 'tasknotes-e2e-vault', '.obsidian', 'plugins', 'tasknotes');
const LOCAL_OVERRIDE_FILE = '.copy-files.local';
let copyPath = process.env.OBSIDIAN_PLUGIN_PATH || defaultPath;
try {
    const local = await readFile(LOCAL_OVERRIDE_FILE, 'utf8');
    const trimmed = local.trim();
    if (trimmed) copyPath = trimmed;
} catch (_) {
    // no local override
}

// Files to copy after build
const files = ['main.js', 'styles.css', 'manifest.json'];

async function copyFiles() {
    try {
        // Resolve the destination path
        const destPath = resolve(copyPath);
        
        // Ensure the directory exists (including nested)
        await mkdir(destPath, { recursive: true });
        
        // Check each file exists before copying
        const copyPromises = files.map(async (file) => {
            try {
                await access(file, constants.F_OK);
                const destFile = join(destPath, file);
                await copyFile(file, destFile);
                console.log(`✅ Copied ${file}`);
            } catch (err) {
                if (err && err.code === 'ENOENT') {
                    // Differentiate between missing source and missing destination path
                    try {
                        await access(file, constants.F_OK);
                    } catch {
                        console.warn(`⚠️  Warning: source file ${file} not found, skipping`);
                        return;
                    }
                    console.warn(`⚠️  Warning: destination path missing for ${file}. Attempting to create…`);
                    await mkdir(destPath, { recursive: true });
                    const destFileRetry = join(destPath, file);
                    await copyFile(file, destFileRetry);
                    console.log(`✅ Copied ${file} (after creating destination)`);
                } else {
                    throw new Error(`Failed to copy ${file}: ${err?.message || err}`);
                }
            }
        });
        
        await Promise.all(copyPromises);
        console.log(`✅ Files copied to: ${destPath}`);
    } catch (error) {
        console.error('❌ Failed to copy files:', error.message);
        process.exit(1);
    }
}

copyFiles();
