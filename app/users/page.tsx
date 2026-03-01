'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, Search, Download, Upload } from 'lucide-react';
import { usersService } from '@/ui/src/services/users';
import { rolesService } from '@/ui/src/services/roles';
import { BulkUploadModal } from '@/components/users/bulk-upload-modal';

export default function UsersPage() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>('all');
  const [roles, setRoles] = React.useState<any[]>([]);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = React.useState(false);

  React.useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [selectedRoleId]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const params: any = { limit: 50 };
      if (selectedRoleId !== 'all') {
        params.role_id = selectedRoleId;
      }
      const response = await usersService.getUsers(params);
      console.log('Users API Response:', response); // Debug log
      if (response.success && response.data) {
        // API returns: { success: true, data: { users: [...], pagination: {...} } }
        const usersList = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any).users || [];
        setUsers(usersList);
      } else {
        console.error('Unexpected response format:', response);
      }
    } catch (error: any) {
      console.error('Failed to load users:', error);
      // Don't show alert, just log - user will see empty state
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await rolesService.getRoles({ status: 'active', limit: 100 });
      if (response.success && response.data) {
        const rolesList = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any).roles || [];
        setRoles(rolesList);
      }
    } catch (error: any) {
      console.error('Failed to load roles:', error);
    }
  };


  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.staff_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-muted-foreground">Manage system users and permissions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={() => window.location.href = '/users/new'}>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or staff number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* ENHANCED: Role Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="role-filter" className="text-sm font-medium text-muted-foreground">
                Filter by Role:
              </label>
              <select
                id="role-filter"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Users List */}
        {isLoading ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">Loading users...</div>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          </Card>
        ) : (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold">Name</th>
                    <th className="text-left p-4 font-semibold">Email</th>
                    <th className="text-left p-4 font-semibold">Staff Number</th>
                    <th className="text-left p-4 font-semibold">Roles</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-accent/50">
                      <td className="p-4">{user.name}</td>
                      <td className="p-4">{user.email}</td>
                      <td className="p-4">{user.staff_number || '-'}</td>
                      <td className="p-4">
                        {/* ENHANCED: Show user roles */}
                        {user.user_roles && user.user_roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.user_roles
                              .filter((ur: any) => ur.role && ur.role.status === 'active')
                              .map((ur: any) => (
                                <span
                                  key={ur.role.id}
                                  className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                >
                                  {ur.role.name}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No roles</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.location.href = `/users/${user.id}/edit`}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.location.href = `/users/${user.id}`}
                          >
                            View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete user "${user.name}"?`)) {
                                try {
                                  await usersService.deleteUser(user.id);
                                  loadUsers();
                                } catch (error: any) {
                                  alert(error.message || 'Failed to delete user');
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Bulk Upload Modal */}
        <BulkUploadModal
          isOpen={isBulkUploadOpen}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={() => {
            setIsBulkUploadOpen(false);
            loadUsers();
          }}
        />
      </div>
    </MainLayout>
  );
}
