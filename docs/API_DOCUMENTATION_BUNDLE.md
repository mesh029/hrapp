# HR App API - Complete Documentation Bundle

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Formats](#requestresponse-formats)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

## API Overview

The HR App API is a RESTful API built with Next.js 14, providing comprehensive HR management functionality including:
- User and employee management
- Leave request workflows
- Timesheet management
- Workflow engine
- Permissions and roles
- Reporting and analytics

### API Version
Current version: **v1**

### Technology Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL 15+
- **ORM:** Prisma 7
- **Cache:** Redis 7+
- **Authentication:** JWT (JSON Web Tokens)

## Authentication

### Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
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
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "user@example.com",
      "staff_number": "EMP-001",
      "charge_code": "CC-001"
    }
  }
}
```

### Using the Token

Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Refresh Token

**Endpoint:** `POST /api/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

## Base URL

- **Development:** `http://localhost:3000/api`
- **Production:** `https://your-domain.com/api`

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/logout` | User logout | Yes |
| POST | `/api/auth/refresh` | Refresh token | No |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List users | Yes |
| POST | `/api/users` | Create user | Yes |
| GET | `/api/users/[id]` | Get user | Yes |
| PATCH | `/api/users/[id]` | Update user | Yes |
| DELETE | `/api/users/[id]` | Delete user | Yes |
| GET | `/api/users/[id]/direct-reports` | Get direct reports | Yes |
| PATCH | `/api/users/[id]/manager` | Update manager | Yes |

### Leave Requests

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/leave/requests` | List leave requests | Yes |
| POST | `/api/leave/requests` | Create leave request | Yes |
| GET | `/api/leave/requests/[id]` | Get leave request | Yes |
| PATCH | `/api/leave/requests/[id]` | Update leave request | Yes |
| POST | `/api/leave/requests/[id]/submit` | Submit leave request | Yes |

### Leave Types

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/leave/types` | List leave types | Yes |
| POST | `/api/leave/types` | Create leave type | Yes |
| GET | `/api/leave/types/[id]` | Get leave type | Yes |
| PATCH | `/api/leave/types/[id]` | Update leave type | Yes |

### Leave Balances

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/leave/balances` | List leave balances | Yes |
| GET | `/api/leave/balances/user/[userId]` | Get user balances | Yes |
| POST | `/api/leave/balances/allocate` | Allocate leave | Yes |
| POST | `/api/leave/balances/adjust` | Adjust balance | Yes |
| POST | `/api/leave/balances/reset` | Reset balances | Yes |

### Timesheets

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/timesheets` | List timesheets | Yes |
| POST | `/api/timesheets` | Create timesheet | Yes |
| GET | `/api/timesheets/[id]` | Get timesheet | Yes |
| PATCH | `/api/timesheets/[id]` | Update timesheet | Yes |
| POST | `/api/timesheets/[id]/submit` | Submit timesheet | Yes |
| PATCH | `/api/timesheets/[id]/entries` | Update entries | Yes |

### Weekend Extra / Overtime

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/timesheets/[id]/weekend-extra` | Request weekend extra | Yes |
| POST | `/api/timesheets/weekend-extra/[requestId]/approve` | Approve weekend extra | Yes |
| POST | `/api/timesheets/weekend-extra/[requestId]/decline` | Decline weekend extra | Yes |
| POST | `/api/timesheets/overtime` | Request overtime | Yes |
| POST | `/api/timesheets/overtime/[requestId]/approve` | Approve overtime | Yes |
| POST | `/api/timesheets/overtime/[requestId]/decline` | Decline overtime | Yes |

### Workflows

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/workflows/templates` | List workflow templates | Yes |
| POST | `/api/workflows/templates` | Create workflow template | Yes |
| GET | `/api/workflows/templates/[id]` | Get workflow template | Yes |
| PATCH | `/api/workflows/templates/[id]` | Update workflow template | Yes |
| GET | `/api/workflows/instances` | List workflow instances | Yes |
| GET | `/api/workflows/instances/[id]` | Get workflow instance | Yes |
| POST | `/api/workflows/instances/[id]/approve` | Approve workflow step | Yes |
| POST | `/api/workflows/instances/[id]/decline` | Decline workflow step | Yes |
| POST | `/api/workflows/instances/[id]/adjust` | Adjust workflow step | Yes |

### Roles & Permissions

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/roles` | List roles | Yes |
| POST | `/api/roles` | Create role | Yes |
| GET | `/api/roles/[id]` | Get role | Yes |
| PATCH | `/api/roles/[id]` | Update role | Yes |
| GET | `/api/permissions` | List permissions | Yes |
| GET | `/api/permissions/[id]` | Get permission | Yes |

### Locations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/locations` | List locations | Yes |
| POST | `/api/locations` | Create location | Yes |
| GET | `/api/locations/[id]` | Get location | Yes |
| PATCH | `/api/locations/[id]` | Update location | Yes |
| GET | `/api/locations/[id]/ancestors` | Get ancestors | Yes |
| GET | `/api/locations/[id]/descendants` | Get descendants | Yes |

### Staff Types

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/staff-types` | List staff types | Yes |
| POST | `/api/staff-types` | Create staff type | Yes |
| GET | `/api/staff-types/[id]` | Get staff type | Yes |
| PATCH | `/api/staff-types/[id]` | Update staff type | Yes |

### Work Hours Configuration

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/config/work-hours` | List work hours configs | Yes |
| POST | `/api/config/work-hours` | Create work hours config | Yes |
| GET | `/api/config/work-hours/by-location/[locationId]` | Get by location | Yes |
| GET | `/api/config/work-hours/by-staff-type/[staffTypeId]` | Get by staff type | Yes |

### Reports

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/reports/dashboard` | Dashboard data | Yes |
| GET | `/api/reports/leave/utilization` | Leave utilization | Yes |
| GET | `/api/reports/leave/balances` | Leave balances | Yes |
| GET | `/api/reports/timesheets/summary` | Timesheet summary | Yes |
| GET | `/api/reports/approvals/pending` | Pending approvals | Yes |

### Notifications

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/notifications` | List notifications | Yes |
| GET | `/api/notifications/[id]` | Get notification | Yes |
| PATCH | `/api/notifications/[id]` | Mark as read | Yes |

### Audit Logs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/audit-logs` | List audit logs | Yes |
| GET | `/api/audit-logs/[id]` | Get audit log | Yes |

## Request/Response Formats

### Standard Request Format

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `search`: Search term
- `status`: Filter by status
- `sort`: Sort field
- `order`: Sort order (asc/desc)

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Error details"
}
```

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information",
  "code": "ERROR_CODE"
}
```

## Rate Limiting

Currently, rate limiting is not implemented. Consider implementing:
- 100 requests per minute per IP
- 1000 requests per hour per user

## Examples

### Create Leave Request

```bash
curl -X POST https://api.example.com/api/leave/requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type_id": "uuid",
    "start_date": "2025-02-01",
    "end_date": "2025-02-05",
    "days_requested": 5,
    "reason": "Vacation"
  }'
```

### Submit Timesheet

```bash
curl -X POST https://api.example.com/api/timesheets/abc-123/submit \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Approve Workflow Step

```bash
curl -X POST https://api.example.com/api/workflows/instances/xyz-789/approve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stepOrder": 1,
    "comment": "Approved"
  }'
```

### Get User Leave Balances

```bash
curl -X GET "https://api.example.com/api/leave/balances/user/user-uuid?year=2025" \
  -H "Authorization: Bearer <token>"
```

## Data Models

### User

```typescript
{
  id: string (UUID)
  name: string
  email: string (unique)
  staff_number: string? (unique)
  charge_code: string?
  status: "active" | "suspended" | "deactivated"
  primary_location_id: string (UUID)
  manager_id: string? (UUID)
  staff_type_id: string? (UUID)
  created_at: DateTime
  updated_at: DateTime
}
```

### Leave Request

```typescript
{
  id: string (UUID)
  user_id: string (UUID)
  leave_type_id: string (UUID)
  start_date: Date
  end_date: Date
  days_requested: Decimal
  reason: string
  status: "Draft" | "Submitted" | "Approved" | "Declined"
  workflow_instance_id: string? (UUID)
  location_id: string (UUID)
  created_at: DateTime
  updated_at: DateTime
}
```

### Timesheet

```typescript
{
  id: string (UUID)
  user_id: string (UUID)
  period_start: Date
  period_end: Date
  status: "Draft" | "Submitted" | "Approved" | "Declined"
  total_hours: Decimal
  workflow_instance_id: string? (UUID)
  location_id: string (UUID)
  created_at: DateTime
  updated_at: DateTime
}
```

## Additional Resources

- **Deployment Guide:** See `DEPLOYMENT_GUIDE.md`
- **Setup Requirements:** See `SETUP_REQUIREMENTS.md`
- **React Flow Diagrams:** See `REACT_FLOW_WORKFLOW_DIAGRAMS.md`

---

**Last Updated:** 2025-01-24
**API Version:** 1.0.0
