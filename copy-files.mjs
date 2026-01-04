#!/usr/bin/env node

import { copyFile, mkdir, access, constants, readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// Get current script directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// Default copy destination - the e2e-vault in this repo
const defaultPaths = [
    join(__dirname, 'tasknotes-e2e-vault', '.obsidian', 'plugins', 'tasknotes'),
];

// Can be overridden with OBSIDIAN_PLUGIN_PATH environment variable (single path)
// or .copy-files.local file (one path per line for multiple destinations)
const LOCAL_OVERRIDE_FILE = '.copy-files.local';
let copyPaths = defaultPaths;

// Expand ~ to home directory
const expandTilde = (p) => p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;

if (process.env.OBSIDIAN_PLUGIN_PATH) {
    copyPaths = [process.env.OBSIDIAN_PLUGIN_PATH];
} else {
    try {
        const local = await readFile(LOCAL_OVERRIDE_FILE, 'utf8');
        const paths = local.split('\n').map(p => p.trim()).filter(p => p && !p.startsWith('#')).map(expandTilde);
        if (paths.length > 0) copyPaths = paths;
    } catch (_) {
        // no local override, use defaults
    }
}

// Files to copy after build
const files = ['main.js', 'styles.css', 'manifest.json'];

async function copyToDestination(destPath) {
    // Resolve the destination path
    const resolvedPath = resolve(destPath);

    // Ensure the directory exists (including nested)
    await mkdir(resolvedPath, { recursive: true });

    // Check each file exists before copying
    const copyPromises = files.map(async (file) => {
        try {
            await access(file, constants.F_OK);
            const destFile = join(resolvedPath, file);
            await copyFile(file, destFile);
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
                await mkdir(resolvedPath, { recursive: true });
                const destFileRetry = join(resolvedPath, file);
                await copyFile(file, destFileRetry);
            } else {
                throw new Error(`Failed to copy ${file}: ${err?.message || err}`);
            }
        }
    });

    await Promise.all(copyPromises);
    console.log(`✅ Files copied to: ${resolvedPath}`);
}

async function copyFiles() {
    try {
        for (const destPath of copyPaths) {
            await copyToDestination(destPath);
        }
        console.log(`✅ Copied ${files.length} files to ${copyPaths.length} destination(s)`);
    } catch (error) {
        console.error('❌ Failed to copy files:', error.message);
        process.exit(1);
    }
}

copyFiles();
