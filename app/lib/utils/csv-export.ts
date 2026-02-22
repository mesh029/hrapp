/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Escape CSV values
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Create CSV rows
  const rows = [
    csvHeaders.map(escapeCSV).join(','),
    ...data.map((row) =>
      csvHeaders.map((header) => escapeCSV(row[header])).join(',')
    ),
  ];

  return rows.join('\n');
}

/**
 * Convert leave utilization report to CSV
 */
export function leaveUtilizationToCSV(report: any): string {
  const rows = report.utilization.map((item: any) => ({
    'User Name': item.userName,
    'User Email': item.userEmail,
    'Leave Type': item.leaveTypeName,
    'Location': item.locationName,
    'Staff Type': item.staffTypeName,
    'Total Days': item.totalDays,
    'Approved Days': item.approvedDays,
    'Pending Days': item.pendingDays,
    'Declined Days': item.declinedDays,
  }));

  return convertToCSV(rows);
}

/**
 * Convert leave balance report to CSV
 */
export function leaveBalanceToCSV(report: any): string {
  const rows = report.balances.map((item: any) => ({
    'User Name': item.userName,
    'User Email': item.userEmail,
    'Leave Type': item.leaveTypeName,
    'Location': item.locationName,
    'Staff Type': item.staffTypeName,
    'Year': item.year,
    'Allocated Days': item.allocatedDays,
    'Used Days': item.usedDays,
    'Pending Days': item.pendingDays,
    'Available Days': item.availableDays,
  }));

  return convertToCSV(rows);
}

/**
 * Convert timesheet summary to CSV
 */
export function timesheetSummaryToCSV(report: any): string {
  const rows = report.timesheets.map((item: any) => ({
    'User Name': item.userName,
    'User Email': item.userEmail,
    'Location': item.locationName,
    'Staff Type': item.staffTypeName,
    'Year': item.year,
    'Month': item.month,
    'Status': item.status,
    'Work Hours': item.totalWorkHours,
    'Leave Hours': item.totalLeaveHours,
    'Holiday Hours': item.totalHolidayHours,
    'Total Hours': item.totalHours,
  }));

  return convertToCSV(rows);
}
