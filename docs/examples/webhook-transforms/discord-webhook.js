/**
 * Discord Webhook Transformation for TaskNotes
 * This file transforms TaskNotes webhook payloads into Discord-compatible format
 */

function transform(payload) {
  const { event, data, timestamp, vault } = payload;
  
  // Helper function to get emoji for event type
  function getEventEmoji(eventType) {
    const emojis = {
      'task.created': '📋',
      'task.updated': '✏️',
      'task.completed': '✅',
      'task.deleted': '🗑️',
      'task.archived': '📦',
      'task.unarchived': '📤',
      'time.started': '⏰',
      'time.stopped': '⏹️',
      'pomodoro.started': '🍅',
      'pomodoro.completed': '🎉',
      'pomodoro.interrupted': '⏸️',
      'reminder.triggered': '🔔',
      'recurring.instance.completed': '🔄'
    };
    return emojis[eventType] || '📢';
  }
  
  // Helper function to get color for event type
  function getEventColor(eventType) {
    const colors = {
      'task.created': 0x00ff00,     // Green
      'task.updated': 0xffaa00,     // Orange
      'task.completed': 0x0099ff,   // Blue
      'task.deleted': 0xff0000,     // Red
      'task.archived': 0x808080,    // Gray
      'time.started': 0x00ffff,     // Cyan
      'time.stopped': 0xff00ff,     // Magenta
      'pomodoro.started': 0xff6347,  // Tomato
      'pomodoro.completed': 0xffd700, // Gold
      'pomodoro.interrupted': 0xff4500, // Orange red
      'recurring.instance.completed': 0x32cd32 // Lime green
    };
    return colors[eventType] || 0x7289da; // Discord blurple as default
  }
  
  // Helper function to format time entries
  function formatTimeSpent(task) {
    if (!task.timeEntries || task.timeEntries.length === 0) {
      return "Not tracked";
    }
    
    const totalMinutes = task.timeEntries.reduce((sum, entry) => {
      return sum + (entry.duration || 0);
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
        embeds: [{
          title: `${getEventEmoji(event)} New Task Created`,
          description: data.task.title,
          color: getEventColor(event),
          fields: [
            {
              name: "📊 Status",
              value: data.task.status || "todo",
              inline: true
            },
            {
              name: "⚡ Priority", 
              value: data.task.priority || "normal",
              inline: true
            },
            {
              name: "📅 Due Date",
              value: data.task.due || "Not set",
              inline: true
            },
            {
              name: "📁 Projects",
              value: data.task.projects?.join(", ") || "None",
              inline: true
            },
            {
              name: "🏷️ Tags",
              value: data.task.tags?.join(", ") || "None",
              inline: true
            },
            {
              name: "⏱️ Time Estimate",
              value: data.task.timeEstimate ? `${data.task.timeEstimate}m` : "Not set",
              inline: true
            }
          ],
          footer: {
            text: `TaskNotes • ${vault.name}`,
            icon_url: "https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md#icon"
          },
          timestamp: timestamp
        }]
      };
      
    case 'task.completed':
      return {
        content: `🎉 **Task Completed!**`,
        embeds: [{
          title: data.task.title,
          color: getEventColor(event),
          fields: [
            {
              name: "⏱️ Time Spent",
              value: formatTimeSpent(data.task),
              inline: true
            },
            {
              name: "📅 Completed",
              value: new Date(timestamp).toLocaleDateString(),
              inline: true
            }
          ],
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    case 'task.updated':
      // Show what changed if previous state is available
      let fields = [
        {
          name: "📊 Status",
          value: data.task.status || "todo",
          inline: true
        }
      ];
      
      if (data.previous) {
        if (data.previous.status !== data.task.status) {
          fields.unshift({
            name: "📊 Status Changed",
            value: `${data.previous.status} → ${data.task.status}`,
            inline: false
          });
        }
      }
      
      return {
        embeds: [{
          title: `${getEventEmoji(event)} Task Updated`,
          description: data.task.title,
          color: getEventColor(event),
          fields: fields,
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    case 'task.deleted':
      return {
        embeds: [{
          title: `${getEventEmoji(event)} Task Deleted`,
          description: data.task.title,
          color: getEventColor(event),
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    case 'time.started':
      return {
        content: `⏰ Started working on: **${data.task.title}**`,
        embeds: [{
          color: getEventColor(event),
          fields: [
            {
              name: "📊 Status",
              value: data.task.status,
              inline: true
            },
            {
              name: "⚡ Priority",
              value: data.task.priority,
              inline: true
            }
          ],
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    case 'time.stopped':
      return {
        content: `⏹️ Stopped working on: **${data.task.title}**`,
        embeds: [{
          color: getEventColor(event),
          fields: [
            {
              name: "⏱️ Total Time Spent",
              value: formatTimeSpent(data.task),
              inline: true
            }
          ],
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    case 'pomodoro.completed':
      return {
        content: `🍅 **Pomodoro completed!** Great work! 🎉`,
        embeds: [{
          title: data.task ? `Working on: ${data.task.title}` : "Focus Session Complete",
          color: getEventColor(event),
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    case 'recurring.instance.completed':
      return {
        content: `🔄 **Recurring task instance completed!**`,
        embeds: [{
          title: data.task.title,
          description: `Completed instance for ${data.date}`,
          color: getEventColor(event),
          fields: [
            {
              name: "📅 Instance Date",
              value: data.date,
              inline: true
            },
            {
              name: "🔄 Recurrence",
              value: data.task.recurrence || "Not specified",
              inline: true
            },
            {
              name: "⚡ Priority",
              value: data.task.priority || "normal",
              inline: true
            },
            {
              name: "⏱️ Time Spent",
              value: formatTimeSpent(data.task),
              inline: true
            },
            {
              name: "📊 Total Completed",
              value: `${data.task.complete_instances?.length || 0} instances`,
              inline: true
            }
          ],
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    case 'reminder.triggered':
      return {
        content: `🔔 **Reminder**: ${data.message}`,
        embeds: [{
          title: data.task.title,
          color: 0xffd700, // Gold
          fields: [
            {
              name: "📅 Due Date",
              value: data.task.due || "Not set",
              inline: true
            },
            {
              name: "⚡ Priority",
              value: data.task.priority,
              inline: true
            }
          ],
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
      
    default:
      // Fallback for unknown events
      return {
        content: `${getEventEmoji(event)} **TaskNotes Event**: ${event}`,
        embeds: [{
          title: "Raw Event Data",
          description: "```json\n" + JSON.stringify(data, null, 2).substring(0, 1500) + "\n```",
          color: 0x7289da,
          footer: {
            text: `TaskNotes • ${vault.name}`
          },
          timestamp: timestamp
        }]
      };
  }
}