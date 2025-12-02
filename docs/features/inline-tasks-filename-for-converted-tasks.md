# Inline Tasks Filename For Converted Tasks

Configure custom filenames for converted inline tasks using dynamic filename templates.

**Important**: This feature only changes the **file name**, not the **task name**. The task name always comes from the text you write in your task.

Set the custom filename template in **Settings → TaskNotes → Features → Enable Custom File Name** (toggle ON) and enter your template in the text field below.

## Quick Start

There are two ways to use variables in filename templates:

- **`{{variable}}`** - Simple substitution for straightforward cases
- **`${...}`** - JavaScript expressions for complex logic

**Examples:**

**Simple priority-based filename:**

```
Task: - [ ] Buy groceries !high
Template: {{priority}}-{{title}}
Result:
  - File name: high-Buy groceries.md
  - Task name in frontmatter: "Buy groceries"
```

**Extract project from tags (advanced):**

```
Task: - [ ] Do chores #project/Personal
Template: ${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'task'}-{{title}}
Result:
  - File name: Personal-Do chores.md
  - Task name in frontmatter: "Do chores"
```

---

## Important: Filename vs Task Name

**The custom filename feature only changes the file name - it does NOT change the task name.**

When you write a task like:
```
- [ ] Buy groceries !high
```

And use a template like `{{priority}}-{{title}}`:

- **File name**: `high-Buy groceries.md` (customized by template)
- **Task name**: "Buy groceries" (remains as you wrote it)

The task name comes from the actual text you write in your task. The filename template only determines how the file is named on disk. Inside the note, the frontmatter will contain `title: Buy groceries` - your original task text without any template formatting.

This is different from the default behavior where the title is stored in the filename and removed from frontmatter.

---

## Basic Templates (Using `{{variable}}`)

Use double curly braces for simple variable substitution. Variables are replaced with their text values.

### How It Works

Put variable names in `{{double curly braces}}` and they'll be replaced with their values:

- `{{year}}` becomes `2025`
- `{{priority}}` becomes `high`
- `{{title}}` becomes `Buy groceries`

### Common Use Cases

**Priority prefix:**

```
Task: - [ ] Important meeting !high
Template: {{priority}}-{{title}}
Result: high-Important meeting.md
```

**Date-based filename:**

```
Task: - [ ] Weekly review
Template: {{date}}-{{title}}
Result: 2025-11-28-Weekly review.md
```

**Timestamp filename:**

```
Task: - [ ] Quick note
Template: {{timestamp}}-{{title}}
Result: 2025-11-28-143025-Quick note.md
```

**Status indicator:**

```
Task: - [ ] Draft proposal *in-progress
Template: ({{status}}) {{title}}
Result: (in-progress) Draft proposal.md
```

**Note**: Square brackets `[` `]` are removed from filenames for filesystem safety. Use parentheses `(` `)` instead.

**Zettelkasten style:**

```
Task: - [ ] Research topic
Template: {{zettel}}-{{title}}
Result: 2511281m8n-Research topic.md
```

### Available Variables

**Date & Time (Always Available):**

| Variable             | Example Output      | Description         |
| -------------------- | ------------------- | ------------------- |
| `{{year}}`           | `2025`              | Full year           |
| `{{month}}`          | `11`                | Month (01-12)       |
| `{{day}}`            | `28`                | Day (01-31)         |
| `{{date}}`           | `2025-11-28`        | Full date           |
| `{{quarter}}`        | `4`                 | Quarter (1-4)       |
| `{{monthName}}`      | `November`          | Month name          |
| `{{monthNameShort}}` | `Nov`               | Short month         |
| `{{dayName}}`        | `Thursday`          | Day name            |
| `{{dayNameShort}}`   | `Thu`               | Short day           |
| `{{week}}`           | `48`                | Week number         |
| `{{time}}`           | `143025`            | HHMMSS              |
| `{{timestamp}}`      | `2025-11-28-143025` | Full timestamp      |
| `{{zettel}}`         | `2511281m8n`        | Zettelkasten ID     |
| `{{hour}}`           | `14`                | Hour                |
| `{{minute}}`         | `30`                | Minute              |
| `{{second}}`         | `25`                | Second              |

**Task Properties (Available During Creation):**

| Variable           | Example Output         | Notes            |
| ------------------ | ---------------------- | ---------------- |
| `{{title}}`        | `Buy groceries`        | Always available |
| `{{status}}`       | `in-progress`          | Always available |
| `{{priority}}`     | `high`                 | Always available |
| `{{due}}`          | `2025-12-01`           | If set           |
| `{{scheduled}}`    | `2025-11-28`           | If set           |
| `{{recurrence}}`   | `FREQ=DAILY`           | If recurring     |
| `{{timeEstimate}}` | `60`                   | Minutes, if set  |
| `{{archived}}`     | `false`                | Always available |
| `{{dateCreated}}`  | `2025-11-28T14:30:25Z` | Always available |
| `{{dateModified}}` | `2025-11-28T14:30:25Z` | Always available |

**Array Properties:**

**Note:** These do NOT auto-join in filename templates (unlike folder templates). Arrays are converted to comma-separated values.

| Variable       | Example Output | Notes                      |
| -------------- | -------------- | -------------------------- |
| `{{tags}}`     | `work,urgent`  | From #tag syntax           |
| `{{contexts}}` | `office`       | From @context syntax       |
| `{{projects}}` | `ProjectA`     | From +project syntax       |

---

## Advanced Templates (Using `${...}`)

Use JavaScript expressions for complex logic and transformations. All variables are available as JavaScript values.

### How It Works

Put JavaScript code in `${curly braces with dollar sign}`:

- Variables work like normal JavaScript
- Arrays stay as arrays (use array methods)
- Use array methods like `.find()`, `.filter()`, `.includes()`
- Return values are converted to strings

### Common Use Cases

**Extract project from tags:**

```
Task: - [ ] Do chores #project/Personal
Template: ${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'task'}-{{title}}
Result: Personal-Do chores.md

Task: - [ ] Random task (no project tag)
Result: task-Random task.md
```

**Priority-based prefix:**

```
Task: - [ ] Fix critical bug !high
Template: ${priority === 'high' ? 'URGENT' : priority === 'medium' ? 'NORMAL' : 'LATER'}-{{title}}
Result: URGENT-Fix critical bug.md

Task: - [ ] Update docs !low
Result: LATER-Update docs.md
```

**Check if tag exists:**

```
Task: - [ ] Review PR #work
Template: ${tags.includes('work') ? 'WORK' : 'PERSONAL'}-{{title}}
Result: WORK-Review PR.md
```

**Get first context:**

```
Task: - [ ] Call client @office @phone
Template: ${contexts && contexts.length > 0 ? contexts[0] : 'general'}-{{title}}
Result: office-Call client.md

Task: - [ ] General task (no context)
Result: general-General task.md
```

**Combine priority and date:**

```
Task: - [ ] Q4 planning !high
Template: ${priority === 'high' ? 'P1' : 'P2'}-{{year}}Q{{quarter}}-{{title}}
Result: P1-2025Q4-Q4 planning.md
```

**Multiple conditions:**

```
Task: - [ ] Emergency fix !high #urgent
Template: ${priority === 'high' && tags.includes('urgent') ? 'CRITICAL' : 'NORMAL'}-{{title}}
Result: CRITICAL-Emergency fix.md
```

**Filter and transform tags:**

```
Task: - [ ] Planning #area-dev #area-ops
Template: ${tags.filter(t => t.startsWith('area-')).map(t => t.replace('area-', '')).join('-')}-{{title}}
Result: dev-ops-Planning.md
```

**Extract category from nested tags:**

```
Task: - [ ] Meeting notes #meeting/weekly #team/engineering
Template: ${tags.find(t => t.startsWith('meeting/'))?.split('/')[1] || 'general'}-{{title}}
Result: weekly-Meeting notes.md
```

### Safe Navigation

Always check if arrays exist before using them:

```javascript
${tags && tags.length > 0 ? tags[0] : 'default'}
${contexts?.length > 0 ? contexts[0] : 'general'}
```

### Available Variables

**All Date & Time Variables (String Type):**

| Variable         | Example             | Description         |
| ---------------- | ------------------- | ------------------- |
| `year`           | `2025`              | Full year           |
| `month`          | `11`                | Month (01-12)       |
| `day`            | `28`                | Day (01-31)         |
| `date`           | `2025-11-28`        | Full date           |
| `monthName`      | `November`          | Month name          |
| `monthNameShort` | `Nov`               | Short month         |
| `dayName`        | `Thursday`          | Day name            |
| `dayNameShort`   | `Thu`               | Short day           |
| `week`           | `48`                | Week number         |
| `quarter`        | `4`                 | Quarter (1-4)       |
| `time`           | `143025`            | HHMMSS              |
| `timestamp`      | `2025-11-28-143025` | Full timestamp      |
| `zettel`         | `2511281m8n`        | Zettelkasten ID     |
| `hour`           | `14`                | Hour                |
| `minute`         | `30`                | Minute              |
| `second`         | `25`                | Second              |

**All Task Properties:**

| Variable       | Type    | Example                | Notes            |
| -------------- | ------- | ---------------------- | ---------------- |
| `title`        | string  | `Buy groceries`        | Always available |
| `status`       | string  | `in-progress`          | Always available |
| `priority`     | string  | `high`                 | Always available |
| `due`          | string  | `2025-12-01`           | If set           |
| `scheduled`    | string  | `2025-11-28`           | If set           |
| `details`      | string  | `Task description`     | If provided      |
| `recurrence`   | string  | `FREQ=DAILY`           | If recurring     |
| `timeEstimate` | number  | `60`                   | Minutes, if set  |
| `archived`     | boolean | `false`                | Always available |
| `dateCreated`  | string  | `2025-11-28T14:30:25Z` | Always available |
| `dateModified` | string  | `2025-11-28T14:30:25Z` | Always available |

**Array Properties (Stay as Arrays):**

**Important:** Unlike `{{variable}}` syntax, arrays remain as JavaScript arrays

| Variable   | Type     | Example                  | Notes                                                       |
| ---------- | -------- | ------------------------ | ----------------------------------------------------------- |
| `tags`     | string[] | `["work", "urgent"]`     | From #tag syntax. Use `.find()`, `.filter()`, `.includes()` |
| `contexts` | string[] | `["office", "computer"]` | From @context syntax                                        |
| `projects` | string[] | `["ProjectA"]`           | From +project syntax                                        |

**Array methods you can use:**

- `tags.includes('work')` - Check if tag exists
- `tags.find(t => t.startsWith('project/'))` - Find specific tag
- `tags.filter(t => t.startsWith('prefix'))` - Filter tags
- `tags[0]` - Get first tag
- `tags.length` - Count tags
- `tags.join('-')` - Join with separator

---

## Practical Examples

### Example 1: Project-Based Organization

```
Task: - [ ] Write documentation #project/Kinross
Template: ${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'Inbox'}-{{title}}
Result: Kinross-Write documentation.md
```

### Example 2: Priority Indicator

```
Task: - [ ] Fix bug !high
Template: ${priority === 'high' ? '!!' : priority === 'medium' ? '!' : ''}-{{title}}
Result: !!-Fix bug.md
```

### Example 3: Date + Priority Combination

```
Task: - [ ] Weekly review !high
Template: {{date}}-${priority === 'high' ? 'PRIORITY' : 'normal'}-{{title}}
Result: 2025-11-28-PRIORITY-Weekly review.md
```

### Example 4: Context-Based Prefix

```
Task: - [ ] Call client @phone
Template: ${contexts && contexts[0] ? `[${contexts[0].toUpperCase()}]` : ''} {{title}}
Result: [PHONE] Call client.md
```

### Example 5: Team/Area Routing

```
Task: - [ ] Code review #team/frontend
Template: ${tags.find(t => t.startsWith('team/'))?.split('/')[1]?.toUpperCase() || 'GENERAL'}-{{title}}
Result: FRONTEND-Code review.md
```

---

## Best Practices

1. **Start Simple** - Use `{{variable}}` for straightforward cases
2. **Test First** - Try your template with a test task before committing
3. **Handle Undefined** - Always check arrays exist: `${tags && tags.length > 0 ? ... : 'default'}`
4. **Keep Names Short** - Long filenames can cause issues on some systems
5. **Use Defaults** - Provide fallback values with `|| 'default'` syntax
6. **Sanitization** - Filenames are automatically sanitized for filesystem safety

## Error Handling

- **JavaScript errors** fall back to title-based filename (check console for details)
- **Undefined variables** in `{{}}` syntax are left as empty strings
- **Empty arrays** in `{{}}` syntax become empty strings
- **Filenames** are automatically sanitized (removes invalid characters)
- **Empty template** behaves as if feature is disabled (uses default naming)

## Configuration Steps

1. Open **Settings → TaskNotes → Features**
2. Scroll to **Inline Task Convert** section
3. Toggle ON **Enable Custom File Name**
4. Enter your template in the **Custom File Name** text field
5. Test with a sample task to verify behavior

## Combining with Folder Templates

You can use both folder templates and filename templates together:

**Folder Template:**
```
(4) Projects/${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'Inbox'}/Tasks
```

**Filename Template:**
```
{{priority}}-{{title}}
```

**Result:**
```
Task: - [ ] Do chores #project/Personal !high
Creates: (4) Projects/Personal/Tasks/high-Do chores.md
Title in frontmatter: "Do chores"
```

This gives you complete control over both the folder structure and filename format for converted tasks.
