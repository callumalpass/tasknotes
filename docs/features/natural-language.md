# Natural Language Processing

TaskNotes includes intelligent natural language processing that can parse task descriptions written in plain English and extract structured task data. This feature enables quick task creation using familiar, conversational language.

## Core NLP Engine

### Parser Implementation

The natural language parser uses the Chrono-node library for date and time parsing, combined with custom pattern-based extraction for TaskNotes-specific elements.

### Supported Input Types

**Single Line**: Complete task description on one line
**Multi-Line**: Title line with additional detail lines below
**Mixed Format**: Combination of structured elements and free-form text

## Syntax Support

### Tags and Contexts

**Tags**: Use `#tag-name` syntax to assign Obsidian tags to tasks
- Example: `#project-alpha #urgent`
- Supports multi-word tags with hyphens or underscores

**Contexts**: Use `@context-name` syntax to assign contexts
- Example: `@home @computer @phone`
- Contexts represent locations, tools, or required resources

### Priority Levels

The parser recognizes priority keywords (configurable in settings):

**Default Priority Words**:
- "urgent" - highest priority
- "high" - high priority  
- "normal" - normal priority
- "low" - lowest priority

**Custom Priorities**: Priority recognition adapts to your configured priority system

### Status Assignment

Status keywords are recognized based on your configured status system:

**Common Status Words**:
- "open" - ready to start
- "in-progress" - currently working
- "done" - completed
- "cancelled" - no longer needed
- "waiting" - blocked or waiting

### Date and Time Parsing

**Due Dates**: Use phrases like:
- "due tomorrow"
- "deadline Friday"
- "by next week"
- "due January 15th"

**Scheduled Dates**: Use phrases like:
- "scheduled for Monday"
- "start on Tuesday"
- "begin next month"
- "work on this Friday"

**Time Specifications**: Include specific times:
- "tomorrow at 3pm"
- "Friday at 9:30 AM"
- "Monday morning at 8"

### Time Estimates

**Format Support**: Multiple time estimate formats are recognized:
- "2h" or "2 hours"
- "30min" or "30 minutes"
- "1h30m" or "1 hour 30 minutes"
- "45 minutes"

### Recurrence Patterns

**Simple Patterns**:
- "daily" - every day
- "weekly" - every week
- "monthly" - every month
- "yearly" - every year

**Day-Specific**:
- "every Monday"
- "every Friday"
- "every other Tuesday"

**Complex Patterns**:
- "every 2 weeks"
- "every 3 days"
- "monthly on the 15th"

## Parser Examples

### Basic Task Creation

**Input**: `Buy groceries tomorrow at 3pm @home #errands high priority`

**Parsed Result**:
- Title: "Buy groceries"
- Due Date: Tomorrow at 3:00 PM
- Context: @home
- Tag: #errands
- Priority: High

### Complex Task with Details

**Input**: 
```
Prepare quarterly report due Friday #work high priority
- Gather sales data from last quarter
- Create charts and visualizations
- Review with team before submission
```

**Parsed Result**:
- Title: "Prepare quarterly report"
- Due Date: This Friday
- Tag: #work
- Priority: High
- Details: Multi-line description included in task body

### Recurring Task

**Input**: `Team standup every Monday at 9am @office #meetings`

**Parsed Result**:
- Title: "Team standup"
- Recurrence: Every Monday at 9:00 AM
- Context: @office
- Tag: #meetings

## Advanced Features

### Date Range Handling

**Range Recognition**: Phrases like "from Monday to Friday" are processed
**Duration Calculation**: Multi-day tasks are handled appropriately
**Conflict Resolution**: Ambiguous dates are resolved using context

### Trigger Word Detection

**Explicit Assignment**: Words like "due", "deadline", "scheduled" trigger specific date field assignment
**Implicit Parsing**: Dates without trigger words are assigned based on context
**Priority Resolution**: Multiple date references are resolved based on semantic importance

### Validation and Cleanup

**Data Validation**: Parsed data is validated before task creation
**Error Handling**: Invalid or ambiguous input is handled gracefully
**Fallback Processing**: Unrecognized elements are preserved in the task title or description

## Integration with Task Creation

### Modal Integration

The natural language parser integrates with task creation modals, allowing you to type conversational tasks and have the fields automatically populated.

## Performance and Accuracy

### Processing Speed

**Real-Time Parsing**: Natural language processing occurs in real-time for immediate feedback
**Efficient Patterns**: Optimized regex patterns for fast text processing
**Minimal Dependencies**: Lightweight parser implementation

### Accuracy Considerations

**Context Dependency**: Parser accuracy improves with clear, structured input
**Ambiguity Handling**: System makes reasonable assumptions for ambiguous input
**Learning Opportunity**: Users quickly learn effective input patterns

### Error Recovery

**Graceful Degradation**: Unparseable elements don't prevent task creation
**Partial Parsing**: Successfully parsed elements are used even if others fail
**User Feedback**: Clear indication of what was successfully parsed
