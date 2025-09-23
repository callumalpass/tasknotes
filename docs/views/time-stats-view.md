# Time Statistics View

The Time Statistics view provides a way to aggregate and view the total estimated time for tasks over different periods. This is useful for understanding your planned workload and for reporting purposes.

## Opening the View

You can open the Time Statistics view in a few ways:

- **Ribbon Icon**: Click the hourglass icon in the left ribbon.
- **Command Palette**: Open the command palette and search for "Open Time Stats View".

## Features

The view provides a simple interface to calculate the total `timeEstimate` for tasks within a specified date range.

### Quick Ranges

Quickly calculate the total time estimate for predefined ranges:

- **Daily**: Sum of `timeEstimate` for all tasks due or scheduled for the current day.
- **Weekly**: Sum of `timeEstimate` for the current week.
- **Monthly**: Sum of `timeEstimate` for the current month.
- **Yearly**: Sum of `timeEstimate` for the current year.

### Custom Range

You can also select a custom date range:

1.  Use the date pickers to select a **start date** and an **end date**.
2.  Click the **Fetch** button.

The view will display the total estimated time for all tasks that are due or scheduled within that inclusive range.

### Result

The total aggregated time is displayed in a human-readable format (e.g., "X hours and Y minutes").
