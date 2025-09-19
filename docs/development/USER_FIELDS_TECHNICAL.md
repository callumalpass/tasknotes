# User Fields - Technical Implementation

This document provides technical details about the User Fields feature implementation for developers contributing to TaskNotes.

## Architecture Overview

User Fields extend TaskNotes' filtering system by allowing users to define custom frontmatter properties that become available as filter options across all views.

### Core Components

**Settings Interface** (`src/settings/TaskNotesSettingTab.ts`)
- User field configuration UI in Advanced Settings
- Real-time validation and field management
- Immediate filter option refresh on changes

**Filter Service** (`src/services/FilterService.ts`)
- Dynamic filter option generation for user fields
- Type-aware operator selection based on field type
- Value normalization for different data types

**Filter Utils** (`src/utils/FilterUtils.ts`)
- Validation logic for user field operators
- Evaluation logic for filtering tasks
- Support for all user field types

**String Splitting** (`src/utils/stringSplit.ts`)
- Bracket/quote-aware CSV parsing for list fields
- Preserves wikilinks `[[...]]` and quoted content
- Single-pass O(n) algorithm for performance

## Data Flow

1. **Configuration**: User defines fields in settings with type information
2. **Option Generation**: FilterService generates filter options dynamically
3. **Validation**: FilterUtils validates operator compatibility with field types
4. **Evaluation**: Filter conditions are evaluated against task frontmatter
5. **Normalization**: Values are normalized based on field type before comparison

## Field Type Implementation

### Text Fields
- Direct string comparison
- Case-insensitive matching for contains/does-not-contain
- Empty value handling

### Number Fields
- Numeric extraction from mixed text-number formats
- Supports values like "2-Medium" → extracts `2`
- Full comparison operator support (>, <, >=, <=, =, !=)

### Date Fields
- Natural language date parsing integration
- ISO date format support
- Timezone-aware comparisons

### Boolean Fields
- True/false evaluation
- Checkbox operator support (is-checked, is-not-checked)

### List Fields
- Intelligent comma splitting with `splitListPreservingLinksAndQuotes()`
- Wikilink preservation: `[[Health, Fitness & Mindset]]` treated as single item
- Quote preservation: `"Focus, Deep Work"` treated as single item
- Contains/does-not-contain matching against individual list items

## Performance Considerations

**Caching**: Filter options are cached and only regenerated when user fields change
**Lazy Evaluation**: User field values are only processed when filters are applied
**Efficient Parsing**: String splitting uses single-pass algorithm
**Memory Management**: Normalized values are not stored permanently

## Integration Points

**FilterBar Components**: Automatically receive updated filter options
**View Refreshing**: All view types refresh filter options when user fields change
**Settings Persistence**: User fields are stored in plugin settings with stable IDs
**Type Safety**: TypeScript interfaces ensure type consistency across components

## Testing

Unit tests cover:
- String splitting edge cases with wikilinks and quotes
- Filter normalization for all field types
- Operator validation logic
- Value extraction from mixed formats

Test files:
- `tests/unit/utils/stringSplit.test.ts`
- `tests/unit/services/filterService.userListNormalization.test.ts`

## Extension Points

The User Fields system is designed for extensibility:

**New Field Types**: Add new types by extending the type union and implementing normalization logic
**Custom Operators**: Add operators by updating the FilterOperator type and evaluation logic
**Advanced Parsing**: Extend string splitting for new content formats
**UI Enhancements**: Field configuration UI can be extended with additional options

## Migration and Compatibility

**Backward Compatibility**: Existing filters continue to work unchanged
**Settings Migration**: User fields are optional and don't affect existing configurations
**Field Mapping Integration**: User fields work alongside existing field mapping system
**Plugin Compatibility**: Uses standard frontmatter properties, compatible with other plugins
