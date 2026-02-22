# HR System API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All endpoints (except `/api/auth/*`) require authentication via JWT Bearer token.

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Optional success message",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": {
    "field": ["Error detail"]
  }
}
```

## Error Codes

- `400` - Bad Request (validation errors, invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Authentication Endpoints

### POST /api/auth/login
Login and receive access/refresh tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "name": "User Name",
      "email": "user@example.com"
    }
  }
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc..."
  }
}
```

### POST /api/auth/logout
Logout and invalidate refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## User Management

### GET /api/users
List users with pagination and filtering.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10, max: 100)
- `status` (string, optional: "active", "suspended", "deactivated")
- `location_id` (uuid, optional)
- `staff_type_id` (uuid, optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}
```

### POST /api/users
Create a new user.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "status": "active",
  "primary_location_id": "uuid",
  "staff_type_id": "uuid",
  "manager_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active",
    ...
  }
}
```

### GET /api/users/:id
Get user details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active",
    "primary_location": { ... },
    "staff_type": { ... },
    "roles": [...],
    ...
  }
}
```

### PATCH /api/users/:id
Update user.

**Request:**
```json
{
  "name": "John Updated",
  "status": "active",
  "manager_id": "uuid"
}
```

### DELETE /api/users/:id
Soft delete user.

---

## Leave Management

### GET /api/leave/requests
List leave requests.

**Query Parameters:**
- `page`, `limit`
- `status` (string)
- `user_id` (uuid)
- `leave_type_id` (uuid)
- `location_id` (uuid)

### POST /api/leave/requests
Create leave request.

**Request:**
```json
{
  "user_id": "uuid",
  "leave_type_id": "uuid",
  "start_date": "2025-01-15",
  "end_date": "2025-01-20",
  "days": 5,
  "reason": "Vacation"
}
```

### POST /api/leave/requests/:id/submit
Submit leave request for approval.

### GET /api/leave/balances
List leave balances.

### POST /api/leave/balances/allocate
Manually allocate leave days (admin only).

---

## Timesheet Management

### GET /api/timesheets
List timesheets.

**Query Parameters:**
- `page`, `limit`
- `user_id` (uuid)
- `location_id` (uuid)
- `year` (number)
- `month` (number)
- `status` (string)

### POST /api/timesheets
Create timesheet.

**Request:**
```json
{
  "user_id": "uuid",
  "location_id": "uuid",
  "year": 2025,
  "month": 1
}
```

### PATCH /api/timesheets/:id/entries
Bulk update timesheet entries.

**Request:**
```json
{
  "entries": [
    {
      "date": "2025-01-15",
      "work_hours": 8,
      "leave_hours": 0,
      "holiday_hours": 0,
      "weekend_extra_hours": 0,
      "overtime_hours": 0
    }
  ]
}
```

### POST /api/timesheets/:id/submit
Submit timesheet for approval.

---

## Reporting

### GET /api/reports/leave/utilization
Get leave utilization report.

**Query Parameters:**
- `location_id` (uuid)
- `staff_type_id` (uuid)
- `leave_type_id` (uuid)
- `user_id` (uuid)
- `start_date` (date)
- `end_date` (date)

### GET /api/reports/leave/balances
Get leave balance summary.

### GET /api/reports/timesheets/summary
Get timesheet summary.

### GET /api/reports/approvals/pending
Get pending approvals dashboard.

### GET /api/reports/dashboard
Get aggregated dashboard data (cached).

### GET /api/reports/export/:type
Export report as CSV.

**Types:** `leave-utilization`, `leave-balances`, `timesheets`

---

## Notifications

### GET /api/notifications
List notifications for authenticated user.

**Query Parameters:**
- `page`, `limit`
- `is_read` (boolean)
- `type` (string)

### PATCH /api/notifications
Mark notifications as read (bulk).

**Request:**
```json
{
  "notificationIds": ["uuid1", "uuid2"],
  "markAll": false
}
```

### PATCH /api/notifications/:id
Mark single notification as read.

### DELETE /api/notifications/:id
Delete notification.

---

## Audit Logs

### GET /api/audit-logs
List audit logs (admin only).

**Query Parameters:**
- `page`, `limit`
- `actor_id` (uuid)
- `action` (string)
- `resource_type` (string)
- `resource_id` (uuid)
- `start_date` (date)
- `end_date` (date)

### GET /api/audit-logs/:id
Get audit log details (admin only).

---

## Permissions Required

Common permissions:
- `users.read`, `users.create`, `users.update`, `users.delete`
- `leave.read`, `leave.create`, `leave.approve`
- `timesheet.read`, `timesheet.create`, `timesheet.approve`
- `workflows.read`, `workflows.create`
- `delegations.create`, `delegations.read`
- `audit.read` (admin only)
- `system.admin` (full access)

---

## Notes

- All UUIDs must be valid UUID v4 format
- Dates should be in ISO 8601 format (YYYY-MM-DD)
- Pagination defaults: page=1, limit=10
- All endpoints require authentication except `/api/auth/*`
- Location scopes and permissions are enforced on all operations
- Soft deletes are used for core entities (users, locations, etc.)
