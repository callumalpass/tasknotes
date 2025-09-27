/**
 * Minimal Discord Webhook Transform for TaskNotes
 * This is the simplest possible transform for Discord webhooks
 */

console.log("🔥 transform file loaded");

function transform(payload) {
  const { event, data } = payload;

  // Simple Discord message format
  if (event === 'task.created') {
    return {
      content: `📝 New task: **${data.task.title}**`
    };
  }

  if (event === 'task.completed') {
    return {
      content: `✅ Completed: **${data.task.title}**`
    };
  }

  // For all other events, return a generic message
  return {
    content: `TaskNotes: ${event} event triggered`
  };
}