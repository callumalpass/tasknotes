#!/usr/bin/env node

/**
 * Simple webhook test server for TaskNotes webhook testing
 * 
 * Usage: node test-webhook.js [port]
 * Default port: 3000
 * 
 * This server will log all incoming webhook payloads and verify signatures.
 */

const express = require('express');
const crypto = require('crypto');
const app = express();

const PORT = process.argv[2] || 3000;

// Middleware
app.use(express.json());

// Test webhook secret (you should use this when configuring the webhook in TaskNotes)
const WEBHOOK_SECRET = 'test-secret-key-for-tasknotes-webhooks';

console.log('='.repeat(60));
console.log('TaskNotes Webhook Test Server');
console.log('='.repeat(60));
console.log(`Server running on: http://localhost:${PORT}`);
console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
console.log(`Test secret: ${WEBHOOK_SECRET}`);
console.log('='.repeat(60));

/**
 * Verify webhook signature
 */
function verifySignature(payload, signature, secret) {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  return signature === expectedSignature;
}

/**
 * Main webhook endpoint
 */
app.post('/webhook', (req, res) => {
  const timestamp = new Date().toISOString();
  const signature = req.headers['x-tasknotes-signature'];
  const event = req.headers['x-tasknotes-event'];
  const deliveryId = req.headers['x-tasknotes-delivery-id'];
  
  console.log('\n' + '='.repeat(50));
  console.log(`📨 Webhook Received [${timestamp}]`);
  console.log('='.repeat(50));
  
  // Headers
  console.log('📋 Headers:');
  console.log(`  Event Type: ${event || 'unknown'}`);
  console.log(`  Delivery ID: ${deliveryId || 'unknown'}`);
  console.log(`  Signature: ${signature ? signature.substring(0, 16) + '...' : 'missing'}`);
  
  // Signature verification
  const isValidSignature = verifySignature(req.body, signature, WEBHOOK_SECRET);
  console.log(`  Signature Valid: ${isValidSignature ? '✅' : '❌'}`);
  
  if (!isValidSignature) {
    console.log('⚠️  WARNING: Invalid signature! Check your webhook secret.');
  }
  
  // Payload
  console.log('\n📦 Payload:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Event-specific processing
  if (req.body.event && req.body.data) {
    console.log('\n🔄 Processing Event:');
    
    switch (req.body.event) {
      case 'task.created':
        console.log(`  ➕ New task created: "${req.body.data.task?.title}"`);
        if (req.body.data.source === 'nlp') {
          console.log(`  💬 Created via NLP from: "${req.body.data.originalText}"`);
        }
        break;
        
      case 'task.updated':
        console.log(`  ✏️  Task updated: "${req.body.data.task?.title}"`);
        if (req.body.data.previous) {
          console.log(`  📊 Changed status: ${req.body.data.previous.status} → ${req.body.data.task?.status}`);
        }
        break;
        
      case 'task.completed':
        console.log(`  ✅ Task completed: "${req.body.data.task?.title}"`);
        break;
        
      case 'task.deleted':
        console.log(`  🗑️  Task deleted: "${req.body.data.task?.title}"`);
        break;
        
      case 'task.archived':
        console.log(`  📦 Task archived: "${req.body.data.task?.title}"`);
        break;
        
      case 'time.started':
        console.log(`  ⏰ Time tracking started: "${req.body.data.task?.title}"`);
        break;
        
      case 'time.stopped':
        console.log(`  ⏹️  Time tracking stopped: "${req.body.data.task?.title}"`);
        break;
        
      case 'reminder.triggered':
        console.log(`  🔔 Reminder triggered: "${req.body.data.task?.title}"`);
        console.log(`  📝 Message: "${req.body.data.message}"`);
        console.log(`  🕐 Notification time: ${req.body.data.notificationTime}`);
        break;
        
      default:
        console.log(`  🔍 Unknown event: ${req.body.event}`);
    }
  }
  
  console.log('='.repeat(50));
  
  // Always respond with 200 OK
  res.status(200).json({ 
    received: true, 
    timestamp,
    event,
    deliveryId,
    signatureValid: isValidSignature
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'TaskNotes webhook test server is running'
  });
});

/**
 * Root endpoint with instructions
 */
app.get('/', (req, res) => {
  res.send(`
    <h1>TaskNotes Webhook Test Server</h1>
    <p>This server is ready to receive TaskNotes webhooks!</p>
    
    <h2>Configuration:</h2>
    <ul>
      <li><strong>Webhook URL:</strong> <code>http://localhost:${PORT}/webhook</code></li>
      <li><strong>Secret:</strong> <code>${WEBHOOK_SECRET}</code></li>
    </ul>
    
    <h2>Setup Instructions:</h2>
    <ol>
      <li>Open TaskNotes Settings → HTTP API tab</li>
      <li>Enable HTTP API if not already enabled</li>
      <li>Click "Add Webhook" in the Webhook Settings section</li>
      <li>Enter URL: <code>http://localhost:${PORT}/webhook</code></li>
      <li>Select the events you want to test</li>
      <li>The secret will be auto-generated - replace it with: <code>${WEBHOOK_SECRET}</code></li>
      <li>Save the webhook configuration</li>
      <li>Perform actions in TaskNotes to trigger webhook events!</li>
    </ol>
    
    <p>Check the console output to see webhook payloads as they arrive.</p>
  `);
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Ready to receive webhooks!`);
  console.log(`\nTo test:`);
  console.log(`1. Add webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`2. Use secret: ${WEBHOOK_SECRET}`);
  console.log(`3. Perform actions in TaskNotes`);
  console.log(`4. Watch the console for webhook events!\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down webhook test server...');
  process.exit(0);
});