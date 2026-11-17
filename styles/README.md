# CSS Build System

This directory contains the modular CSS source files for the TaskNotes plugin. The main `styles.css` file is generated from these source files during the build process.

## File Structure

### Core System Files
- `variables.css` - CSS custom properties and design system variables
- `utilities.css` - Utility classes for layout, spacing, typography, and states
- `base.css` - Basic styles, animations, card components, and layout
- `components.css` - Reusable UI components, utilities, and modals

### BEM Component Files (NEW)
- `task-card-bem.css` - BEM TaskCard component with proper scoping
- `note-card-bem.css` - BEM NoteCard component with proper scoping
- `filter-bar-bem.css` - BEM FilterBar component with proper scoping
- `modal-bem.css` - BEM Modal components with proper scoping

### View-Specific Files (NEW)
- `task-list-view.css` - BEM TaskListView component
- `calendar-view.css` - BEM CalendarView component
- `kanban-view.css` - BEM KanbanView component
- `agenda-view.css` - BEM AgendaView component
- `notes-view.css` - BEM NotesView component
- `pomodoro-view.css` - BEM PomodoroView component
- `settings-view.css` - BEM SettingsView component

### Legacy Files (Remaining)
- `pomodoro.css` - Pomodoro view specific styles (to be deprecated)
- `settings.css` - Settings page styles (to be deprecated)
- `tasks-legacy.css` - Legacy task styles for backwards compatibility

### Documentation Files
- `index.css` - Documentation file (not included in build)
- `README.md` - This documentation file
- `UTILITIES.md` - Utility class documentation
- `UTILITY-USAGE-GUIDE.md` - Guide for using utility classes

## Development Workflow

### Making Changes
1. Edit the appropriate CSS file in this directory
2. Run `npm run build-css` to regenerate the main `styles.css` file
3. Test your changes in the application
4. Commit your changes to the source files (the generated `styles.css` is ignored by git)

### Build Commands
- `npm run build-css` - Build CSS only
- `npm run dev` - Build CSS + start development server
- `npm run build` - Build CSS + full production build

### File Loading Order
The CSS files are concatenated in dependency order:
1. `variables.css` (CSS custom properties - loaded first)
2. `utilities.css` (utility classes)
3. `base.css` (foundational styles)
4. `task-card-bem.css` (BEM TaskCard component)
5. `note-card-bem.css` (BEM NoteCard component)
6. `filter-bar-bem.css` (BEM FilterBar component)
7. `modal-bem.css` (BEM Modal components)
8. View-specific BEM files (task-list-view, calendar-view, kanban-view, etc.)
9. `components.css` (general components)
10. Legacy files (`pomodoro.css`, `settings.css`)

## CI/CD Process

The GitHub Actions workflow automatically:
1. Builds the CSS from source files during release
2. Includes the generated `styles.css` in the release artifacts
3. Ensures the plugin has all necessary files for distribution

## Important Notes

- **Never edit `styles.css` directly** - it will be overwritten during builds
- The `styles.css` file is **not tracked in git** - only source files are committed
- All CSS variables should be defined in `variables.css`
- Follow the existing patterns and naming conventions
- Use CSS custom properties (variables) instead of hardcoded values
- Test changes across different views (Calendar, Tasks, Kanban, etc.)

## Troubleshooting

If styles aren't updating:
1. Run `npm run build-css` to regenerate the CSS
2. Check that your changes are in the correct source file
3. Verify the build completed without errors
4. Clear browser cache if testing in development

If the build fails:
1. Check the console output for specific error messages
2. Verify all CSS files exist and are readable
3. Check for syntax errors in your CSS
4. Ensure file paths in `build-css.mjs` are correct