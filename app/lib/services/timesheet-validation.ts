import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;

export type ValidationStatus = 'valid' | 'warning' | 'error';

export interface ValidationResult {
  status: ValidationStatus;
  expectedHours: number;
  actualHours: number;
  discrepancy: number;
  dailyIssues: Array<{
    date: string;
    expected: number;
    actual: number;
    discrepancy: number;
    issue: string;
  }>;
  notes: string[];
}

/**
 * Validate a timesheet
 * Rules:
 * 1. Only one of work_hours, leave_hours, or holiday_hours can be set per day (mutual exclusivity)
 * 2. Work hours on weekends require approved weekend extra request
 * 3. Work hours cannot exceed expected hours without approved overtime/weekend extra
 * 4. Missing work hours are warnings (can still submit)
 */
export async function validateTimesheet(timesheetId: string): Promise<ValidationResult> {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      entries: {
        orderBy: { date: 'asc' },
      },
      user: {
        include: {
          staff_type: true,
        },
      },
    },
  });

  if (!timesheet) {
    throw new Error('Timesheet not found');
  }

  const dailyIssues: ValidationResult['dailyIssues'] = [];
  const notes: string[] = [];
  let totalExpected = 0;
  let totalActual = 0;

  for (const entry of timesheet.entries) {
    const expected = entry.expected_hours.toNumber();
    const actual = entry.total_hours.toNumber();
    const workHours = entry.work_hours.toNumber();
    const leaveHours = entry.leave_hours.toNumber();
    const holidayHours = entry.holiday_hours.toNumber();
    const weekendExtraHours = entry.weekend_extra_hours.toNumber();
    const overtimeHours = entry.overtime_hours.toNumber();
    
    const entryDate = new Date(entry.date);
    const dayOfWeek = entryDate.getDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hasWeekendExtra = weekendExtraHours > 0 || entry.weekend_extra_request_id !== null;
    const isHoliday = holidayHours > 0 || entry.holiday_id !== null;
    const isLeaveDay = leaveHours > 0 || entry.leave_request_id !== null;
    
    // Only count expected/actual for work days (not weekends, holidays, or leave days)
    // Weekends are optional and shouldn't affect totals
    if (!isWeekend && !isHoliday && !isLeaveDay) {
      totalExpected += expected;
      totalActual += actual;
    } else {
      // For optional days, only count actual if there are hours entered
      totalActual += actual;
    }

    // Skip validation for non-work days (expected = 0) unless there's weekend work without approval
    if (expected === 0) {
      if (isWeekend && workHours > 0 && !hasWeekendExtra) {
        dailyIssues.push({
          date: entry.date.toISOString().split('T')[0],
          expected,
          actual,
          discrepancy: actual - expected,
          issue: `Weekend work requires manager approval (weekend extra request)`,
        });
      }
      continue; // Skip further validation for non-work days
    }

    // For work days (expected > 0), validate:

    // 1. Check mutual exclusivity: Only one of work/leave/holiday can be > 0
    const typeCount = [workHours > 0, leaveHours > 0, holidayHours > 0].filter(Boolean).length;
    if (typeCount > 1) {
      dailyIssues.push({
        date: entry.date.toISOString().split('T')[0],
        expected,
        actual,
        discrepancy: actual - expected,
        issue: `Multiple hour types set: Only one of work hours (${workHours.toFixed(2)}h), leave hours (${leaveHours.toFixed(2)}h), or holiday hours (${holidayHours.toFixed(2)}h) can be set per day`,
      });
      continue; // Skip other validations if mutual exclusivity is violated
    }

    // 2. Check weekend restrictions: Work hours on weekends require approval
    if (isWeekend && workHours > 0 && !hasWeekendExtra) {
      dailyIssues.push({
        date: entry.date.toISOString().split('T')[0],
        expected,
        actual,
        discrepancy: actual - expected,
        issue: `Weekend work requires manager approval (weekend extra request)`,
      });
    }

    // 3. Check if work hours exceed expected (only for work days with work hours)
    if (workHours > 0) {
      // Calculate approved extras (overtime + weekend extra)
      const approvedExtras = overtimeHours + (isWeekend ? weekendExtraHours : 0);
      
      // Base work hours should not exceed expected
      // Excess is allowed only if it's from approved extras
      const baseWorkHours = workHours - (isWeekend ? weekendExtraHours : 0);
      
      if (baseWorkHours > expected) {
        const unapprovedExcess = baseWorkHours - expected;
        dailyIssues.push({
          date: entry.date.toISOString().split('T')[0],
          expected,
          actual,
          discrepancy: actual - expected,
          issue: `Work hours (${workHours.toFixed(2)}h) exceed expected (${expected.toFixed(2)}h) by ${unapprovedExcess.toFixed(2)}h without approval`,
        });
      }
    }

    // 4. Check for missing hours (only for regular work days)
    // Weekends, holidays, and leave days are optional - no warnings for missing work hours
    // isHoliday and isLeaveDay are already defined above
    const isOptionalDay = isWeekend || isHoliday || isLeaveDay;
    
    if (!isOptionalDay) {
      // Only check for missing hours on regular work days (not weekends, holidays, or leave days)
      if (workHours === 0 && leaveHours === 0 && holidayHours === 0) {
        dailyIssues.push({
          date: entry.date.toISOString().split('T')[0],
          expected,
          actual,
          discrepancy: actual - expected,
          issue: `No hours entered: Expected ${expected.toFixed(2)}h. Please enter work hours, leave hours, or holiday hours.`,
        });
      } else if (workHours > 0 && workHours < expected && leaveHours === 0 && holidayHours === 0) {
        // Partial work hours (less than expected) - this is a warning
        const missing = expected - workHours;
        dailyIssues.push({
          date: entry.date.toISOString().split('T')[0],
          expected,
          actual,
          discrepancy: actual - expected,
          issue: `Incomplete hours: ${workHours.toFixed(2)}h entered, ${expected.toFixed(2)}h expected. Missing ${missing.toFixed(2)}h.`,
        });
      }
      // If there's leave or holiday hours, that's fine (they replace work hours)
    }
    // Weekends, holidays, and leave days are optional - no validation needed if no work is entered
  }

  const totalDiscrepancy = totalActual - totalExpected;

  // Determine overall status
  // Only mark as error for critical issues (mutual exclusivity, unapproved excess, weekend without approval)
  // Missing hours are warnings (can still submit)
  // IMPORTANT: Don't show warnings just because weekends/holidays/leave days are empty
  let status: ValidationStatus = 'valid';
  
  const criticalIssues = dailyIssues.filter(issue => 
    issue.issue.includes('Multiple hour types') || 
    issue.issue.includes('exceed expected') ||
    issue.issue.includes('Weekend work requires')
  );
  
  if (criticalIssues.length > 0) {
    status = 'error';
  } else if (dailyIssues.length > 0) {
    // Only show warning if there are actual issues (not just empty weekends/holidays/leave days)
    // Check if all issues are about missing hours on optional days (shouldn't happen, but just in case)
    const hasRealWarnings = dailyIssues.some(issue => 
      !issue.issue.includes('No hours entered') || 
      (issue.expected > 0 && !issue.issue.includes('weekend') && !issue.issue.includes('holiday') && !issue.issue.includes('leave'))
    );
    if (hasRealWarnings) {
      status = 'warning';
    }
  }
  
  // Don't show warning status just because of total discrepancy if it's due to optional days
  // Only show warning if there are actual daily issues

  // Generate clear, concise notes
  if (criticalIssues.length > 0) {
    notes.push(`❌ ${criticalIssues.length} critical issue(s) must be fixed before submission:`);
    criticalIssues.forEach(issue => {
      const dateStr = new Date(issue.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      notes.push(`  • ${dateStr}: ${issue.issue}`);
    });
  }

  const warningIssues = dailyIssues.filter(issue => !criticalIssues.includes(issue));
  // Only show warnings if there are actual issues (not empty weekends/holidays/leave days)
  if (warningIssues.length > 0) {
    // Filter out warnings for optional days (weekends, holidays, leave days with 0 expected)
    const realWarnings = warningIssues.filter(issue => {
      const issueDate = new Date(issue.date);
      const dayOfWeek = issueDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      // Only show warnings for work days with missing hours
      return !isWeekend && issue.expected > 0;
    });
    
    if (realWarnings.length > 0) {
      notes.push(`⚠️ ${realWarnings.length} warning(s) - review recommended:`);
      realWarnings.forEach(issue => {
        const dateStr = new Date(issue.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        notes.push(`  • ${dateStr}: ${issue.issue}`);
      });
    }
  }

  // Don't show total discrepancy if it's just due to optional days
  // Only show if there are actual daily issues
  if (status === 'valid' && Math.abs(totalDiscrepancy) > 0.01 && dailyIssues.length === 0) {
    notes.push(`Total: ${totalActual.toFixed(2)}h (Expected: ${totalExpected.toFixed(2)}h)`);
  }

  return {
    status,
    expectedHours: totalExpected,
    actualHours: totalActual,
    discrepancy: totalDiscrepancy,
    dailyIssues,
    notes,
  };
}

/**
 * Check if timesheet can be submitted
 * Returns true only if validation passes (status is 'valid' or 'warning')
 * Returns false if status is 'error'
 */
export async function canSubmitTimesheet(timesheetId: string): Promise<{
  canSubmit: boolean;
  validation: ValidationResult;
}> {
  const validation = await validateTimesheet(timesheetId);
  const canSubmit = validation.status !== 'error';

  return {
    canSubmit,
    validation,
  };
}
