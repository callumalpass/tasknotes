# Issue #789: Folder Path Truncation Bug

## Problem Understanding

**Issue:** The path fields for "Default tasks folder" and "Archive folder" allow entering long paths, but sometimes lose characters at the end of the path when saving.

**Example:**
- Input: `0 System/004 Plugin Data/TaskNotes/Archive`
- Saved: `0 System/004 Plugin Data/TaskNotes/Archi`

**Reported Behavior:**
- The user reports it doesn't seem to be strictly about length (not a 40-char limit)
- Sometimes chars are lost at the end of the path
- This causes tasks to be created in wrong paths

## Test File Location

**File:** `/home/calluma/projects/tasknotes/tests/unit/issues/issue-789-folder-path-truncation.test.ts`

**How to Run:**
```bash
npm test -- issue-789-folder-path-truncation.test.ts
```

The test demonstrates:
1. How debounce with `immediate=true` blocks rapid subsequent calls
2. How this can cause data loss when multiple onChange events occur in quick succession
3. How a trailing debounce (immediate=false) would prevent this issue

## Root Cause Analysis

The bug is caused by the debounce implementation with `immediate=true` in the settings tab:

### Relevant Code Locations

1. **TaskNotesSettingTab.ts:22**
   ```typescript
   private debouncedSave = debounce(() => this.plugin.saveSettings(), 500, true);
   ```
   - Uses debounce with `immediate=true`
   - This causes the save to execute immediately on the first onChange
   - Then blocks subsequent saves for 500ms

2. **settingHelpers.ts:67-94** - `createTextSetting` function
   - Lines 74-80: Handles debounced vs immediate onChange
   - The text settings pass the user's setValue function directly to onChange
   - When debounceMs is NOT set, onChange fires immediately for each character typed

3. **generalTab.ts:29-39** - Default tasks folder setting
   ```typescript
   createTextSetting(container, {
       name: translate("settings.general.taskStorage.defaultFolder.name"),
       getValue: () => plugin.settings.tasksFolder,
       setValue: async (value: string) => {
           plugin.settings.tasksFolder = value;
           save(); // <- calls debouncedSave
       },
   });
   ```

4. **generalTab.ts:54-64** - Archive folder setting
   ```typescript
   createTextSetting(container, {
       name: translate("settings.general.taskStorage.archiveFolder.name"),
       getValue: () => plugin.settings.archiveFolder,
       setValue: async (value: string) => {
           plugin.settings.archiveFolder = value;
           save(); // <- calls debouncedSave
       },
   });
   ```

5. **main.ts:1200-1208** - saveSettings function
   ```typescript
   async saveSettings() {
       const data = (await this.loadData()) || {};
       const settingsKeys = Object.keys(DEFAULT_SETTINGS) as (keyof TaskNotesSettings)[];
       for (const key of settingsKeys) {
           data[key] = this.settings[key];
       }
       await this.saveData(data);
   }
   ```

### How the Bug Occurs

**Scenario 1: Quick Typing**
1. User types quickly: "Archive" → each character triggers onChange
2. First onChange saves immediately (due to immediate=true)
3. Subsequent onChange events are blocked for 500ms
4. Only partial path gets saved

**Scenario 2: Paste + Autocomplete**
1. User pastes or uses autocomplete: "Archi" → onChange fired
2. Save happens immediately with incomplete path
3. Autocomplete finishes: "Archive" → onChange fired
4. Blocked by debounce cooldown, never saved

**Scenario 3: Browser Autofill**
1. Browser autofills field with partial text
2. onChange fires, saves immediately
3. Browser finishes autofilling
4. Final onChange is blocked

## Proposed Solutions

### Solution 1: Use Trailing Debounce (Recommended)

**Change:** Switch from `immediate=true` to `immediate=false` in the debounce call.

**Implementation:**
```typescript
// In src/settings/TaskNotesSettingTab.ts:22
private debouncedSave = debounce(() => this.plugin.saveSettings(), 500, false);
// Or simply omit the third parameter (defaults to false)
private debouncedSave = debounce(() => this.plugin.saveSettings(), 500);
```

**Pros:**
- Simple one-line fix
- Ensures the final value is always saved
- Reduces number of save operations (better for performance)
- Consistent with common debounce patterns (e.g., search inputs)

**Cons:**
- Introduces a 500ms delay before settings are saved
- User might close settings before the save completes
- Changes are not persisted until user stops typing

**Risk Level:** Low - Well-tested pattern

---

### Solution 2: Add Per-Field Debounce for Text Inputs

**Change:** Add debounce directly to text inputs instead of the save function.

**Implementation:**
```typescript
// In src/settings/tabs/generalTab.ts
createTextSetting(container, {
    name: translate("settings.general.taskStorage.defaultFolder.name"),
    getValue: () => plugin.settings.tasksFolder,
    setValue: async (value: string) => {
        plugin.settings.tasksFolder = value;
        save();
    },
    debounceMs: 500, // Add this to problematic fields
});
```

**Pros:**
- More granular control over which fields are debounced
- Save function can remain immediate for other settings
- Can tune debounce time per field type

**Cons:**
- Requires updating multiple field definitions
- Dual debouncing (field + save) might cause confusion
- More code changes required

**Risk Level:** Medium - Requires changes in multiple files

---

### Solution 3: Hybrid Approach - Trailing Debounce with Blur Event Save

**Change:** Use trailing debounce + save on blur/unfocus events.

**Implementation:**
```typescript
// In src/settings/TaskNotesSettingTab.ts
private debouncedSave = debounce(() => this.plugin.saveSettings(), 500, false);

// In settingHelpers.ts - enhance createTextSetting
export function createTextSetting(container: HTMLElement, options: TextSettingOptions): Setting {
    return new Setting(container)
        .setName(options.name)
        .setDesc(options.desc)
        .addText((text) => {
            text.setValue(options.getValue());

            if (options.debounceMs && options.debounceMs > 0) {
                const debouncedSetValue = debounce(options.setValue, options.debounceMs);
                text.onChange(debouncedSetValue);
            } else {
                text.onChange(options.setValue);
            }

            // Add blur event to ensure save on focus loss
            text.inputEl.addEventListener('blur', () => {
                options.setValue(text.getValue());
            });

            // ... rest of the function
        });
}
```

**Pros:**
- Best of both worlds: debounced during typing, immediate on blur
- Guarantees settings are saved when user navigates away
- No data loss risk
- Responsive user experience

**Cons:**
- Most complex solution
- Might save twice in some cases (onChange + blur)
- Requires modification to helper function

**Risk Level:** Medium - More complex but safer

---

## Recommended Approach

**Solution 1: Use Trailing Debounce**

This is the simplest and most reliable fix. The 500ms delay is acceptable for settings that don't need instant persistence. Most users expect some delay in settings panels.

**Why this solution:**
1. **Minimal code change** - One line modification
2. **Proven pattern** - Standard approach used in many applications
3. **Fixes the root cause** - Ensures final value is always saved
4. **Better performance** - Reduces unnecessary save operations
5. **Low risk** - Well-understood behavior

**Additional Improvement:**
Consider reducing the debounce time from 500ms to 300ms for a more responsive feel while still preventing excessive saves.

**Implementation Plan:**
1. Change `TaskNotesSettingTab.ts:22` from `immediate=true` to `immediate=false` (or omit parameter)
2. Test with long folder paths (paste, type quickly, autocomplete scenarios)
3. Verify settings persist correctly when closing the settings panel
4. Consider adding a blur event listener as a safety net (optional)

## Testing Strategy

1. **Manual Testing:**
   - Paste long folder path → verify full path is saved
   - Type quickly → verify complete path is saved
   - Use autocomplete → verify completed path is saved
   - Close settings immediately after typing → verify save completes

2. **Automated Testing:**
   - Run existing test: `npm test -- issue-789-folder-path-truncation.test.ts`
   - Add integration test for settings save behavior
   - Test debounce timing edge cases

3. **Regression Testing:**
   - Verify other text settings still work correctly
   - Test all tabs in settings panel
   - Verify performance hasn't degraded
