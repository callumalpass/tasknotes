# TaskNotes Timezone Quick Reference

## 🚀 Quick Cheat Sheet

### Today's Date
```typescript
// ✅ DO
import { getTodayLocal, getTodayString } from '@/utils/dateUtils';
const today = getTodayLocal();        // Date object
const todayStr = getTodayString();    // "YYYY-MM-DD"

// ❌ DON'T
const today = new Date();             // Has time component!
```

### Format for Storage
```typescript
// ✅ DO
import { formatDateForStorage } from '@/utils/dateUtils';
const dateStr = formatDateForStorage(date);

// ❌ DON'T
import { format } from 'date-fns';
const dateStr = format(date, 'yyyy-MM-dd');
```

### Parse Date Strings
```typescript
// ✅ DO
import { parseDateAsLocal } from '@/utils/dateUtils';
const date = parseDateAsLocal('2025-01-21');  // For date-only

// ❌ DON'T
const date = new Date('2025-01-21');          // May be UTC!
```

### Complete a Task
```typescript
// ✅ DO
const completionDate = formatDateForStorage(getTodayLocal());
task.complete_instances.push(completionDate);

// ❌ DON'T
task.complete_instances.push(format(new Date(), 'yyyy-MM-dd'));
```

## 📋 Copy-Paste Templates

### Import Block
```typescript
import { 
  getTodayLocal, 
  getTodayString, 
  formatDateForStorage, 
  parseDateAsLocal 
} from '@/utils/dateUtils';
```

### Common Patterns
```typescript
// Check if overdue
const isOverdue = task.scheduled < getTodayString();

// Get date 7 days from now
const futureDate = new Date(getTodayLocal());
futureDate.setDate(futureDate.getDate() + 7);
const futureDateStr = formatDateForStorage(futureDate);

// Calendar date selection
const handleDateSelect = (date: Date) => {
  const dateStr = formatDateForStorage(date);
  // Use dateStr for storage/display
};
```

## ⚠️ Red Flags in Code Review

1. Direct use of `format(date, 'yyyy-MM-dd')`
2. `new Date()` when you just need today's date
3. Manual UTC conversion for RRule operations
4. Mixing different date formatting methods
5. `new Date(dateString)` without parseDate functions

## 💡 Remember

**Local dates for users, UTC handled internally for RRule**

When in doubt: `formatDateForStorage()` + `getTodayLocal()`