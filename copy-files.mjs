#!/usr/bin/env node

import { copyFile, mkdir, access, constants } from 'fs/promises';
import { join, resolve } from 'path';

// Default copy destination - can be overridden with OBSIDIAN_PLUGIN_PATH environment variable
const defaultPath = '/mnt/c/Users/Admin/Documents/testvault/test/.obsidian/plugins/tasknotes';
const copyPath = process.env.OBSIDIAN_PLUGIN_PATH || defaultPath;

// Files to copy after build
const files = ['main.js', 'styles.css', 'manifest.json'];

async function copyFiles() {
    try {
        // Resolve the destination path
        const destPath = resolve(copyPath);
        
        // Create the directory if it doesn't exist
      
        
        // Check each file exists before copying
        const copyPromises = files.map(async (file) => {
            try {
                await access(file, constants.F_OK);
                const destFile = join(destPath, file);
                await copyFile(file, destFile);
                console.log(`✅ Copied ${file}`);
            } catch (err) {
                if (err.code === 'ENOENT') {
                    console.warn(`⚠️  Warning: ${file} not found, skipping`);
                } else {
                    throw new Error(`Failed to copy ${file}: ${err.message}`);
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