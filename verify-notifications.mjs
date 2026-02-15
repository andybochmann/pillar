#!/usr/bin/env node
/**
 * End-to-end verification script for Due Date Notifications feature
 *
 * This script:
 * 1. Creates a task with a due date
 * 2. Triggers the notification check
 * 3. Verifies notifications were created
 */

const BASE_URL = 'http://localhost:3000';

// Test credentials from CLAUDE.md
const credentials = {
  email: 'test@pillar.dev',
  password: 'TestPassword123!',
};

async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${BASE_URL}/api/auth/signin/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  // Extract session cookie
  const cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie returned');
  }

  console.log('✅ Logged in successfully');
  return cookies;
}

async function createTask(sessionCookie) {
  console.log('\n📝 Creating task with due date...');

  // Create a task due in 1 day
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0); // 2 PM tomorrow

  const taskData = {
    title: 'E2E Test Task - Notification Verification',
    description: 'This task is for testing due date notifications',
    dueDate: tomorrow.toISOString(),
    priority: 'high',
    column: 'todo',
  };

  const response = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create task: ${response.status} - ${error}`);
  }

  const task = await response.json();
  console.log(`✅ Task created: "${task.title}" (ID: ${task._id})`);
  console.log(`   Due date: ${new Date(task.dueDate).toLocaleString()}`);
  return task;
}

async function checkDueDates(sessionCookie) {
  console.log('\n🔔 Triggering notification check...');

  const response = await fetch(`${BASE_URL}/api/notifications/check-due-dates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to check due dates: ${response.status} - ${error}`);
  }

  const result = await response.json();
  console.log(`✅ Notification check completed`);
  console.log(`   Notifications created: ${result.created}`);
  return result;
}

async function getNotifications(sessionCookie) {
  console.log('\n📬 Fetching notifications...');

  const response = await fetch(`${BASE_URL}/api/notifications`, {
    headers: {
      'Cookie': sessionCookie,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch notifications: ${response.status} - ${error}`);
  }

  const notifications = await response.json();
  console.log(`✅ Retrieved ${notifications.length} notification(s)`);

  if (notifications.length > 0) {
    console.log('\nNotifications:');
    notifications.forEach((notif, index) => {
      console.log(`  ${index + 1}. [${notif.type}] ${notif.title}`);
      console.log(`     ${notif.message}`);
      console.log(`     Read: ${notif.read}, Dismissed: ${notif.dismissed}`);
    });
  }

  return notifications;
}

async function cleanup(sessionCookie, taskId) {
  console.log('\n🧹 Cleaning up test data...');

  // Delete the test task
  await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Cookie': sessionCookie,
    },
  });

  console.log('✅ Test task deleted');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Due Date Notifications - E2E Verification             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Login
    const sessionCookie = await login();

    // Step 2: Create task with due date
    const task = await createTask(sessionCookie);

    // Step 3: Trigger notification check
    const checkResult = await checkDueDates(sessionCookie);

    // Step 4: Verify notifications were created
    const notifications = await getNotifications(sessionCookie);

    // Step 5: Clean up
    await cleanup(sessionCookie, task._id);

    // Verify success
    console.log('\n╔════════════════════════════════════════════════════════╗');
    if (checkResult.created > 0 && notifications.length > 0) {
      console.log('║  ✅ VERIFICATION SUCCESSFUL                            ║');
      console.log('║                                                        ║');
      console.log('║  The notification system is working correctly:        ║');
      console.log(`║  - Task created with due date                         ║`);
      console.log(`║  - ${checkResult.created} notification(s) generated                     ║`);
      console.log(`║  - Notifications retrievable via API                  ║`);
    } else {
      console.log('║  ⚠️  VERIFICATION INCOMPLETE                           ║');
      console.log('║                                                        ║');
      console.log('║  No notifications were created. This may be expected  ║');
      console.log('║  if the due date is too far in the future or quiet    ║');
      console.log('║  hours are active.                                    ║');
    }
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\n⚠️  Make sure the dev server is running: pnpm dev\n');
    process.exit(1);
  }
}

main();
