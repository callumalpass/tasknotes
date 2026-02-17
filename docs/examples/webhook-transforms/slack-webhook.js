/**
 * Slack Webhook Transformation for TaskNotes
 * This file transforms TaskNotes webhook payloads into Slack-compatible format
 */

function transform(payload) {
  const { event, data, timestamp, vault } = payload;
  
  // Helper function to get emoji for event type
  function getEventEmoji(eventType) {
    const emojis = {
      'task.created': ':memo:',
      'task.updated': ':pencil2:',
      'task.completed': ':white_check_mark:',
      'task.deleted': ':wastebasket:',
      'task.archived': ':package:',
      'task.unarchived': ':outbox_tray:',
      'time.started': ':alarm_clock:',
      'time.stopped': ':stop_button:',
      'pomodoro.started': ':tomato:',
      'pomodoro.completed': ':tada:',
      'pomodoro.interrupted': ':pause_button:',
      'reminder.triggered': ':bell:',
      'recurring.instance.completed': ':arrows_counterclockwise:'
    };
    return emojis[eventType] || ':loudspeaker:';
  }
  
  // Helper function to get color for event type (Slack hex colors)
  function getEventColor(eventType) {
    const colors = {
      'task.created': 'good',      // Green
      'task.updated': 'warning',   // Yellow
      'task.completed': 'good',    // Green
      'task.deleted': 'danger',    // Red
      'task.archived': '#36a64f',  // Green
      'time.started': '#00D4AA',   // Teal
      'time.stopped': '#FF6B6B',   // Red
      'pomodoro.completed': '#FFD700', // Gold
      'recurring.instance.completed': '#32CD32' // Lime green
    };
    return colors[eventType] || '#36a64f'; // Default green
  }
  
  // Helper function to format time entries
  function formatTimeSpent(task) {
    if (!task.timeEntries || task.timeEntries.length === 0) {
      return "Not tracked";
    }
    
    const totalMinutes = task.timeEntries.reduce((sum, entry) => {
      if (!entry.startTime) return sum;
      const start = new Date(entry.startTime);
      const end = entry.endTime ? new Date(entry.endTime) : new Date();
      const diffMs = end.getTime() - start.getTime();
      const minutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      return sum + minutes;
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
  
  // Main transformation logic
  switch (event) {
    case 'task.created':
      return {
        text: `${getEventEmoji(event)} New task created: ${data.task.title}`,
        attachments: [
          {
            color: getEventColor(event),
            fields: [
              {
                title: "Status",
                value: data.task.status || "todo",
                short: true
              },
              {
                title: "Priority",
                value: data.task.priority || "normal",
                short: true
              },
              {
                title: "Due Date",
                value: data.task.due || "Not set",
                short: true
              },
              {
                title: "Projects",
                value: data.task.projects?.join(", ") || "None",
                short: true
              }
            ],
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    case 'task.completed':
      return {
        text: `${getEventEmoji(event)} Task completed: *${data.task.title}*`,
        attachments: [
          {
            color: getEventColor(event),
            fields: [
              {
                title: "Time Spent",
                value: formatTimeSpent(data.task),
                short: true
              },
              {
                title: "Completed",
                value: new Date(timestamp).toLocaleDateString(),
                short: true
              }
            ],
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    case 'task.updated':
      let updateText = `${getEventEmoji(event)} Task updated: *${data.task.title}*`;
      let fields = [
        {
          title: "Current Status",
          value: data.task.status || "todo",
          short: true
        }
      ];
      
      if (data.previous && data.previous.status !== data.task.status) {
        updateText = `${getEventEmoji(event)} Task status changed: *${data.task.title}*`;
        fields.unshift({
          title: "Status Change",
          value: `${data.previous.status} → ${data.task.status}`,
          short: false
        });
      }
      
      return {
        text: updateText,
        attachments: [
          {
            color: getEventColor(event),
            fields: fields,
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    case 'time.started':
      return {
        text: `${getEventEmoji(event)} Started working on: *${data.task.title}*`,
        attachments: [
          {
            color: getEventColor(event),
            fields: [
              {
                title: "Priority",
                value: data.task.priority || "normal",
                short: true
              },
              {
                title: "Status",
                value: data.task.status,
                short: true
              }
            ],
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    case 'time.stopped':
      return {
        text: `${getEventEmoji(event)} Stopped working on: *${data.task.title}*`,
        attachments: [
          {
            color: getEventColor(event),
            fields: [
              {
                title: "Total Time Spent",
                value: formatTimeSpent(data.task),
                short: true
              }
            ],
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    case 'pomodoro.completed':
      return {
        text: `${getEventEmoji(event)} Pomodoro completed! Great work! :tada:`,
        attachments: [
          {
            color: getEventColor(event),
            text: data.task ? `Working on: *${data.task.title}*` : "Focus session complete",
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    case 'recurring.instance.completed':
      return {
        text: `${getEventEmoji(event)} Recurring task instance completed: *${data.task.title}*`,
        attachments: [
          {
            color: getEventColor(event),
            fields: [
              {
                title: "Instance Date",
                value: data.date,
                short: true
              },
              {
                title: "Recurrence Pattern",
                value: data.task.recurrence || "Not specified",
                short: true
              },
              {
                title: "Priority",
                value: data.task.priority || "normal",
                short: true
              },
              {
                title: "Total Completed",
                value: `${data.task.complete_instances?.length || 0} instances`,
                short: true
              }
            ],
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    case 'reminder.triggered':
      return {
        text: `${getEventEmoji(event)} Reminder: ${data.message}`,
        attachments: [
          {
            color: '#FFD700', // Gold
            title: data.task.title,
            fields: [
              {
                title: "Due Date",
                value: data.task.due || "Not set",
                short: true
              },
              {
                title: "Priority",
                value: data.task.priority || "normal",
                short: true
              }
            ],
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
      
    default:
      // Fallback for unknown events
      return {
        text: `${getEventEmoji(event)} TaskNotes Event: ${event}`,
        attachments: [
          {
            color: 'good',
            title: "Event Details",
            text: "```" + JSON.stringify(data, null, 2).substring(0, 1000) + "```",
            footer: `TaskNotes • ${vault.name}`,
            ts: Math.floor(new Date(timestamp).getTime() / 1000)
          }
        ]
      };
  }
}
