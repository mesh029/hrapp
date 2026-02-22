# HR App API - Quick Reference

## Base URL
- **Local:** `http://localhost:3000/api`
- **Production:** `https://your-domain.com/api`

## Authentication

### Login
```bash
POST /api/auth/login
Body: { "email": "user@example.com", "password": "password" }
Response: { "success": true, "data": { "token": "...", "user": {...} } }
```

### Use Token
```
Authorization: Bearer <token>
```

## Key Endpoints

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user
- `PATCH /api/users/[id]` - Update user

### Leave Requests
- `GET /api/leave/requests` - List leave requests
- `POST /api/leave/requests` - Create leave request
- `POST /api/leave/requests/[id]/submit` - Submit leave request

### Timesheets
- `GET /api/timesheets` - List timesheets
- `POST /api/timesheets` - Create timesheet
- `POST /api/timesheets/[id]/submit` - Submit timesheet

### Workflows
- `GET /api/workflows/instances` - List workflow instances
- `POST /api/workflows/instances/[id]/approve` - Approve step
- `POST /api/workflows/instances/[id]/decline` - Decline step

## Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message"
}
```

## Full Documentation

See `API_DOCUMENTATION_BUNDLE.md` for complete API reference.
