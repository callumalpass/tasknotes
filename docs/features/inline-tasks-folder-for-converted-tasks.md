# Inline Task Folder For Converted Tasks

Configure where converted inline tasks are saved using dynamic folder templates.

Set the folder template in **Settings → TaskNotes → Features → Inline Task Convert Folder**.

## Quick Start

There are two ways to use variables in folder templates:

- **`{{variable}}`** - Simple substitution for straightforward cases
- **`${...}`** - JavaScript expressions for complex logic

**Examples:**

**Simple date-based organization:**

```
Task: - [ ] Buy groceries
Template: Tasks/{{year}}/{{month}}
Result: Tasks/2025/11/Buy groceries.md
```

**Extract project from tags (advanced):**

```
Task: - [ ] Do chores #project/Personal
Template: (4) Projects/${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'Inbox'}/Tasks
Result: (4) Projects/Personal/Tasks/Do chores.md
```

---

##Basic Templates (Using `{{variable}}`)

Use double curly braces for simple variable substitution. Variables are replaced with their text values.

### How It Works

Put variable names in `{{double curly braces}}` and they'll be replaced with their values:

- `{{year}}` becomes `2025`
- `{{priority}}` becomes `high`
- `{{tags}}` becomes `work/urgent` (arrays automatically join with `/`)

### Common Use Cases

**Date-based organization:**

```
Task: - [ ] Weekly review
Template: {{year}}/{{month}}
Result: 2025/11/Weekly review.md
```

**Priority-based folders:**

```
Task: - [ ] Important meeting !high
Template: Tasks/{{priority}}
Result: Tasks/high/Important meeting.md
```

**Status-based folders:**

```
Task: - [ ] Draft proposal *in-progress
Template: {{year}}/{{status}}
Result: 2025/in-progress/Draft proposal.md
```

**Using tags (auto-joined):**

```
Task: - [ ] Review code #work #urgent
Template: Projects/{{tags}}
Result: Projects/work/urgent/Review code.md
```

**Multi-level organization:**

```
Task: - [ ] Q4 planning !high
Template: {{year}}/Q{{quarter}}/{{priority}}
Result: 2025/Q4/high/Q4 planning.md
```

### Available Variables

**Date & Time (Always Available):**

| Variable             | Example Output      | Description    |
| -------------------- | ------------------- | -------------- |
| `{{year}}`           | `2025`              | Full year      |
| `{{month}}`          | `11`                | Month (01-12)  |
| `{{day}}`            | `28`                | Day (01-31)    |
| `{{date}}`           | `2025-11-28`        | Full date      |
| `{{quarter}}`        | `4`                 | Quarter (1-4)  |
| `{{monthName}}`      | `November`          | Month name     |
| `{{monthNameShort}}` | `Nov`               | Short month    |
| `{{dayName}}`        | `Thursday`          | Day name       |
| `{{dayNameShort}}`   | `Thu`               | Short day      |
| `{{week}}`           | `48`                | Week number    |
| `{{time}}`           | `143025`            | HHMMSS         |
| `{{timestamp}}`      | `2025-11-28-143025` | Full timestamp |
| `{{hour}}`           | `14`                | Hour           |
| `{{minute}}`         | `30`                | Minute         |
| `{{second}}`         | `25`                | Second         |

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

**Array Properties (Auto-Join with `/`):**

**Important:** These automatically join multiple values with `/`

| Variable       | Example Output      | Notes                                                                                       |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `{{tags}}`     | `work/urgent`       | From #tag syntax. If you have `["work", "urgent"]`, outputs `"work/urgent"`                 |
| `{{contexts}}` | `office/computer`   | From @context syntax. If you have `["office", "computer"]`, outputs `"office/computer"`     |
| `{{projects}}` | `ProjectA/ProjectB` | From +project syntax. If you have `["ProjectA", "ProjectB"]`, outputs `"ProjectA/ProjectB"` |

**Example:**

```
Task: - [ ] Write report @office @computer
Using {{contexts}} outputs: "office/computer"
Result: office/computer/Write report.md
```

---

# Advanced Templates (Using `${...}`)

Use JavaScript expressions for complex logic and transformations. All variables are available as JavaScript values.

### How It Works

Put JavaScript code in `${curly braces with dollar sign}`:

- Variables work like normal JavaScript
- Arrays stay as arrays (don't auto-join)
- Use array methods like `.find()`, `.filter()`, `.includes()`
- Return values are converted to strings

### Common Use Cases

**Extract project from tags:**

```
Task: - [ ] Do chores #project/Personal
Template: (4) Projects/${tags.find(t => t.startsWith('project/'))?.split('/')[1] || 'Inbox'}/Tasks
Result: (4) Projects/Personal/Tasks/Do chores.md

Task: - [ ] Random task (no project tag)
Result: (4) Projects/Inbox/Tasks/Random task.md
```

**Priority-based routing:**

```
Task: - [ ] Fix critical bug !high
Template: Tasks/${priority === 'high' ? 'urgent' : priority === 'medium' ? 'normal' : 'later'}
Result: Tasks/urgent/Fix critical bug.md

Task: - [ ] Update docs !low
Result: Tasks/later/Update docs.md
```

**Get first context:**

```
Task: - [ ] Call client @office @phone
Template: ${contexts && contexts.length > 0 ? contexts[0] : 'inbox'}
Result: office/Call client.md

Task: - [ ] General task (no context)
Result: inbox/General task.md
```

**Check if tag exists:**

```
Task: - [ ] Review PR #work
Template: ${tags.includes('work') ? 'Work' : 'Personal'}
Result: Work/Review PR.md
```

**Filter and transform tags:**

```
Task: - [ ] Planning #project-alpha #project-beta
Template: ${tags.filter(t => t.startsWith('project-')).map(t => t.replace('project-', '')).join('/')}
Result: alpha/beta/Planning.md
```

**Multiple conditions:**

```
Task: - [ ] Emergency fix !high #urgent
Template: ${priority === 'high' && tags.includes('urgent') ? 'critical' : 'normal'}
Result: critical/Emergency fix.md
```

**Date & status combination:**

```
Task: - [ ] Weekly review *in-progress
Template: ${year}/Q${quarter}/${status}
Result: 2025/Q4/in-progress/Weekly review.md
```

**Context with fallback:**

```
Task: - [ ] Write report @office
Template: ${contexts && contexts.length > 0 ? contexts[0] : 'inbox'}
Result: office/Write report.md
```

### Safe Navigation

Always check if arrays exist before using them:

```javascript
${tags && tags.length > 0 ? tags[0] : 'default'}
${contexts?.length > 0 ? contexts[0] : 'inbox'}
```

### Available Variables

**All Date & Time Variables (String Type):**

| Variable         | Example             | Description    |
| ---------------- | ------------------- | -------------- |
| `year`           | `2025`              | Full year      |
| `month`          | `11`                | Month (01-12)  |
| `day`            | `28`                | Day (01-31)    |
| `date`           | `2025-11-28`        | Full date      |
| `monthName`      | `November`          | Month name     |
| `monthNameShort` | `Nov`               | Short month    |
| `dayName`        | `Thursday`          | Day name       |
| `dayNameShort`   | `Thu`               | Short day      |
| `week`           | `48`                | Week number    |
| `quarter`        | `4`                 | Quarter (1-4)  |
| `time`           | `143025`            | HHMMSS         |
| `timestamp`      | `2025-11-28-143025` | Full timestamp |
| `hour`           | `14`                | Hour           |
| `minute`         | `30`                | Minute         |
| `second`         | `25`                | Second         |

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
- `tags.join('/')` - Join with separator

---

**Best Practices**

1. **Start Simple** - Use `{{variable}}` for straightforward cases
2. **Test First** - Try your template with a test task before committing
3. **Handle Undefined** - Always check arrays exist: `${tags && tags.length > 0 ? ... : 'default'}`
4. **Keep Paths Short** - Long folder paths can cause issues on some systems
5. **Use Defaults** - Provide fallback values with `|| 'default'` syntax

**Error Handling**

- **JavaScript errors** return empty string (check console for details)
- **Undefined variables** in `{{}}` syntax are left as-is
- **Empty arrays** in `{{}}` syntax become empty strings
- **Folder names** are automatically sanitized for filesystem safety
