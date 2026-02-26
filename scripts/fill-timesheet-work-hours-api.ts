/**
 * Script to fill work hours for all timesheet entries via API
 * This uses the authenticated API endpoint to update entries
 */

const TIMESHEET_ID = 'd5596cfd-1769-46ac-a408-274db9c8bda8';
const API_BASE = 'http://localhost:3001/api';

async function getAuthToken(): Promise<string> {
  // Try to get token from environment or use a test token
  // For now, we'll need to authenticate first
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'lucy.nyawira@test.com',
      password: 'password123', // Default password
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate');
  }

  const data = await response.json();
  return data.data?.access_token || data.access_token;
}

async function getTimesheet(token: string) {
  const response = await fetch(`${API_BASE}/timesheets/${TIMESHEET_ID}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch timesheet: ${response.statusText}`);
  }

  return response.json();
}

async function updateEntries(token: string, entries: Array<{ date: string; work_hours: number }>) {
  const response = await fetch(`${API_BASE}/timesheets/${TIMESHEET_ID}/entries`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entries }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update entries: ${response.statusText} - ${error}`);
  }

  return response.json();
}

async function main() {
  try {
    console.log('Authenticating...');
    const token = await getAuthToken();
    console.log('✓ Authenticated');

    console.log(`\nFetching timesheet ${TIMESHEET_ID}...`);
    const timesheetResponse = await getTimesheet(token);
    const timesheet = timesheetResponse.data || timesheetResponse;
    console.log(`✓ Found ${timesheet.entries?.length || 0} entries`);

    const entriesToUpdate: Array<{ date: string; work_hours: number }> = [];
    let skippedCount = 0;

    for (const entry of timesheet.entries || []) {
      const date = entry.date.split('T')[0]; // Get YYYY-MM-DD
      const hasLeave = (entry.leave_hours && parseFloat(entry.leave_hours) > 0);
      const hasHoliday = (entry.holiday_hours && parseFloat(entry.holiday_hours) > 0);
      const hasWorkHours = (entry.work_hours && parseFloat(entry.work_hours) > 0);

      if (hasLeave || hasHoliday) {
        console.log(`⏭️  Skipping ${date} - has leave or holiday`);
        skippedCount++;
        continue;
      }

      if (hasWorkHours) {
        console.log(`⏭️  Skipping ${date} - already has ${entry.work_hours} work hours`);
        skippedCount++;
        continue;
      }

      entriesToUpdate.push({
        date,
        work_hours: 8,
      });
      console.log(`✓ Will update ${date} with 8 work hours`);
    }

    if (entriesToUpdate.length === 0) {
      console.log('\n✓ No entries need updating');
      return;
    }

    console.log(`\nUpdating ${entriesToUpdate.length} entries...`);
    await updateEntries(token, entriesToUpdate);
    console.log('✓ Successfully updated all entries');

    console.log(`\nSummary:`);
    console.log(`- Updated: ${entriesToUpdate.length} entries`);
    console.log(`- Skipped: ${skippedCount} entries`);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
