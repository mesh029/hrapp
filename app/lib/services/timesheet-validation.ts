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
 * Hard validation: hours should NOT exceed expected EXCEPT:
 * - Approved weekend extra hours
 * - Approved holiday hours
 * - Approved overtime hours
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
    const discrepancy = actual - expected;

    totalExpected += expected;
    totalActual += actual;

    // Calculate approved extra hours
    const approvedExtras = entry.weekend_extra_hours
      .plus(entry.overtime_hours)
      .plus(entry.holiday_hours)
      .toNumber();

    // Calculate work + leave hours (these should match expected)
    const workAndLeave = entry.work_hours.plus(entry.leave_hours).toNumber();

    // Check if actual exceeds expected
    if (actual > expected) {
      // Check if the excess is from approved extras
      const excess = actual - expected;
      const unapprovedExcess = excess - approvedExtras;

      if (unapprovedExcess > 0) {
        // There's unapproved excess hours
        dailyIssues.push({
          date: entry.date.toISOString().split('T')[0],
          expected,
          actual,
          discrepancy,
          issue: `Hours exceed expected by ${unapprovedExcess.toFixed(2)} hours without approval`,
        });
      }
    } else if (actual < expected) {
      // Check if the shortfall is acceptable (might be due to leave/holiday)
      if (workAndLeave < expected && entry.leave_hours.toNumber() === 0 && entry.holiday_hours.toNumber() === 0) {
        // Missing work hours without leave or holiday
        dailyIssues.push({
          date: entry.date.toISOString().split('T')[0],
          expected,
          actual,
          discrepancy,
          issue: `Missing ${Math.abs(discrepancy).toFixed(2)} hours of work`,
        });
      }
    }
  }

  const totalDiscrepancy = totalActual - totalExpected;

  // Determine overall status
  let status: ValidationStatus = 'valid';
  if (dailyIssues.some((issue) => issue.issue.includes('exceed'))) {
    status = 'error'; // Hard validation: cannot exceed without approval
  } else if (dailyIssues.length > 0 || Math.abs(totalDiscrepancy) > 0.01) {
    status = 'warning';
  }

  // Add summary notes
  if (totalDiscrepancy > 0) {
    notes.push(`Total hours exceed expected by ${totalDiscrepancy.toFixed(2)} hours`);
  } else if (totalDiscrepancy < 0) {
    notes.push(`Total hours are ${Math.abs(totalDiscrepancy).toFixed(2)} hours below expected`);
  }

  if (dailyIssues.length > 0) {
    notes.push(`${dailyIssues.length} day(s) have validation issues`);
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
