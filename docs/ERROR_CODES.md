# Error Codes Reference

## HTTP Status Codes

### 200 OK
Success response with data.

### 201 Created
Resource successfully created.

### 400 Bad Request
Invalid input, validation errors, or malformed request.

**Common Causes:**
- Missing required fields
- Invalid UUID format
- Invalid date format
- Validation errors (Zod schema failures)
- Invalid enum values

**Example:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "email": ["Invalid email format"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

### 401 Unauthorized
Missing or invalid authentication token

**Common Causes:**
- Missing `Authorization` header
- Invalid or expired access token
- Token format incorrect

**Example:**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 403 Forbidden
User authenticated but lacks required permissions

**Common Causes:**
- User doesn't have required permission
- User doesn't have location scope for operation
- User not eligible for workflow step
- Delegation expired or revoked

**Example:**
```json
{
  "success": false,
  "message": "Forbidden: Insufficient permissions"
}
```

### 404 Not Found
Resource not found

**Common Causes:**
- Resource ID doesn't exist
- Resource was soft deleted
- Invalid resource path

**Example:**
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 409 Conflict
Resource conflict (duplicate, constraint violation)

**Common Causes:**
- Duplicate email
- Duplicate role name
- Overlapping delegation
- Unique constraint violation

**Example:**
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```

### 500 Internal Server Error
Server error

**Common Causes:**
- Database connection error
- Unexpected error in code
- External service failure

**Example:**
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Common Error Messages

### Authentication Errors
- `"Unauthorized"` - Missing or invalid token
- `"Token expired"` - Access token expired, use refresh token
- `"Invalid refresh token"` - Refresh token invalid or expired

### Permission Errors
- `"Forbidden: Insufficient permissions"` - User lacks required permission
- `"Forbidden: Cannot view other users' delegations"` - Cannot access other user's data
- `"Only system admin can delegate on behalf of others"` - Admin-only operation

### Validation Errors
- `"Validation error"` - Input validation failed (check `errors` field)
- `"Invalid UUID format"` - UUID format incorrect
- `"Invalid email format"` - Email format incorrect
- `"Password must be at least 8 characters"` - Password too short

### Resource Errors
- `"Resource not found"` - Resource doesn't exist
- `"User not found"` - User doesn't exist
- `"Workflow template not found"` - Template doesn't exist
- `"Leave request not found"` - Leave request doesn't exist

### Workflow Errors
- `"Workflow instance must be in Draft status to submit"` - Wrong status
- `"Workflow instance is not in a reviewable state"` - Cannot approve/decline
- `"User does not have permission to approve this step"` - No authority
- `"This workflow step does not allow decline"` - Decline not allowed
- `"Comment is required for decline"` - Missing required comment

### Business Logic Errors
- `"Insufficient leave balance"` - Not enough leave days
- `"Overlapping leave request"` - Dates overlap with existing request
- `"Circular manager relationship"` - Cannot set manager to create cycle
- `"Overlapping delegation exists"` - Delegation conflicts with existing one
- `"Delegator does not have the permission being delegated"` - Invalid delegation

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": {
    "field": ["Error detail 1", "Error detail 2"]
  }
}
```

The `errors` field is optional and only present for validation errors (400 Bad Request).

---

## Best Practices

1. **Always check `success` field** first
2. **Check `errors` field** for validation details (400 errors)
3. **Handle 401 errors** by refreshing token or re-authenticating
4. **Handle 403 errors** by checking user permissions
5. **Log 500 errors** for debugging
6. **Display user-friendly messages** from `message` field
