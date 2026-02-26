'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { usersService } from '@/ui/src/services/users';
import { rolesService, Role } from '@/ui/src/services/roles';
import { api } from '@/ui/src/services/api';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [locations, setLocations] = React.useState<any[]>([]);
  const [managers, setManagers] = React.useState<any[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [userRoles, setUserRoles] = React.useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [autoSaveTimeout, setAutoSaveTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const lastSavedStaffNumber = React.useRef<string>('');

  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    status: 'active' as 'active' | 'suspended',
    staff_number: '',
    charge_code: '',
    primary_location_id: '',
    manager_id: '',
    contract_start_date: '',
    contract_end_date: '',
  });

  React.useEffect(() => {
    if (userId) {
      loadUser();
      loadLocations();
      loadManagers();
      loadRoles();
    }
    // Cleanup auto-save timeout on unmount
    return () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    };
  }, [userId]);

  const loadUser = async () => {
    try {
      setIsLoadingUser(true);
      const response = await usersService.getUser(userId);
      console.log('Load user response:', response);
      if (response.success && response.data) {
        const user = response.data;
        console.log('User data:', user);
        console.log('User roles:', user.user_roles);
        const staffNum = user.staff_number || '';
        setFormData({
          name: user.name || '',
          email: user.email || '',
          status: user.status || 'active',
          staff_number: staffNum,
          charge_code: user.charge_code || '',
          primary_location_id: user.primary_location_id || '',
          manager_id: user.manager_id || '',
          contract_start_date: user.contract_start_date ? String(user.contract_start_date).slice(0, 10) : '',
          contract_end_date: user.contract_end_date ? String(user.contract_end_date).slice(0, 10) : '',
        });
        lastSavedStaffNumber.current = staffNum;
        // Load user roles - ensure we get the latest roles
        if (user.user_roles && Array.isArray(user.user_roles)) {
          const activeRoles = user.user_roles
            .filter((ur: any) => ur.role && ur.role.status === 'active')
            .map((ur: any) => ur.role);
          console.log('Active roles from loadUser:', activeRoles);
          console.log('Raw user_roles:', user.user_roles);
          // Force state update with a new array reference
          setUserRoles([...activeRoles]);
        } else {
          console.log('No user_roles found, setting empty array');
          setUserRoles([]);
        }
      } else {
        console.error('Failed to load user:', response);
        setError('Failed to load user data');
      }
    } catch (err: any) {
      console.error('Error loading user:', err);
      setError(err.message || 'Failed to load user');
    } finally {
      setIsLoadingUser(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await rolesService.getRoles();
      if (response.success && response.data) {
        setRoles(response.data.roles || []);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedRoleId) return;

    try {
      setIsLoading(true);
      setError('');
      const response = await api.post(`/api/users/${userId}/roles`, {
        roleId: selectedRoleId,
      });

      console.log('Role assignment response:', response);

      if (response.success) {
        // The API returns the updated user with roles in response.data
        const updatedUser = response.data;
        
        console.log('Updated user from response:', updatedUser);
        console.log('user_roles in response:', updatedUser?.user_roles);
        
        // Update user roles from the response immediately
        if (updatedUser && updatedUser.user_roles && Array.isArray(updatedUser.user_roles)) {
          const activeRoles = updatedUser.user_roles
            .filter((ur: any) => ur.role && ur.role.status === 'active')
            .map((ur: any) => ur.role);
          console.log('Setting active roles:', activeRoles);
          console.log('Current userRoles state before update:', userRoles);
          // Force state update with a new array reference
          setUserRoles([...activeRoles]);
          console.log('State updated, new userRoles should be:', activeRoles);
        } else {
          console.warn('No user_roles in response, reloading user');
          // If response doesn't have roles, reload from server
          await loadUser();
        }
        
        setSelectedRoleId('');
        setSuccessMessage('Role assigned successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Also reload user to ensure everything is in sync
        await loadUser();
      } else {
        setError(response.message || 'Failed to assign role');
      }
    } catch (error: any) {
      console.error('Role assignment error:', error);
      setError(error.message || 'Failed to assign role');
      // Even on error, try to reload user to get current state
      await loadUser();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to remove this role?')) return;

    try {
      const response = await api.delete(`/api/users/${userId}/roles/${roleId}`);
      if (response.success) {
        // Reload user to get updated roles
        await loadUser();
      } else {
        alert(response.message || 'Failed to remove role');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to remove role');
    }
  };

  const loadLocations = async () => {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/api/locations?tree=false');
      if (response.success && response.data) {
        // Handle different response structures
        let locationsList: any[] = [];
        if (Array.isArray(response.data)) {
          locationsList = response.data;
        } else if (response.data.locations && Array.isArray(response.data.locations)) {
          locationsList = response.data.locations;
        } else if (response.data.flat && Array.isArray(response.data.flat)) {
          locationsList = response.data.flat;
        }
        setLocations(locationsList);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const loadManagers = async () => {
    try {
      const response = await usersService.getUsers({ limit: 100, status: 'active' });
      if (response.success && response.data) {
        setManagers(response.data.users || []);
      }
    } catch (error) {
      console.error('Failed to load managers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setIsLoading(true);

    try {
      await usersService.updateUser(userId, {
        ...formData,
        primary_location_id: formData.primary_location_id || undefined,
        manager_id: formData.manager_id || undefined,
        staff_number: formData.staff_number || undefined,
        charge_code: formData.charge_code || undefined,
        contract_start_date: formData.contract_start_date || null,
        contract_end_date: formData.contract_end_date || null,
      });

      // Use router.refresh() to ensure the detail page gets updated data
      router.push(`/users/${userId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingUser) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading user...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit User</h1>
            <p className="text-muted-foreground">Update user information</p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Additional Information</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="staff_number">Staff Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="staff_number"
                        value={formData.staff_number}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setFormData({ ...formData, staff_number: newValue });
                          // Auto-save staff number after 1 second of no typing
                          if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
                          const timeout = setTimeout(async () => {
                            if (newValue !== lastSavedStaffNumber.current && newValue.trim() !== '') {
                              try {
                                await usersService.updateUser(userId, { staff_number: newValue || undefined });
                                lastSavedStaffNumber.current = newValue;
                              } catch (err) {
                                console.error('Auto-save failed:', err);
                              }
                            }
                          }, 1000);
                          setAutoSaveTimeout(timeout);
                        }}
                        placeholder="Auto-generate or enter manually"
                        disabled={isLoading}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          // Generate staff number: STF-YYYYMMDD-XXXX (last 4 digits of user ID)
                          const prefix = 'STF';
                          const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                          const suffix = userId.slice(-4).toUpperCase();
                          const generated = `${prefix}-${date}-${suffix}`;
                          setFormData({ ...formData, staff_number: generated });
                          try {
                            await usersService.updateUser(userId, { staff_number: generated });
                            lastSavedStaffNumber.current = generated;
                            setError('');
                          } catch (err: any) {
                            setError(err.message || 'Failed to generate staff number');
                          }
                        }}
                        disabled={isLoading}
                        size="sm"
                      >
                        Generate
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="charge_code">Charge Code</Label>
                    <Input
                      id="charge_code"
                      value={formData.charge_code}
                      onChange={(e) => setFormData({ ...formData, charge_code: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primary_location_id">Primary Location</Label>
                    <select
                      id="primary_location_id"
                      value={formData.primary_location_id}
                      onChange={(e) => setFormData({ ...formData, primary_location_id: e.target.value })}
                      disabled={isLoading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">None</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manager_id">Manager</Label>
                    <select
                      id="manager_id"
                      value={formData.manager_id}
                      onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                      disabled={isLoading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">None</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} ({manager.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'suspended' })}
                      disabled={isLoading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contract_start_date">Contract Start Date</Label>
                    <Input
                      id="contract_start_date"
                      type="date"
                      value={formData.contract_start_date}
                      onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contract_end_date">Contract End Date</Label>
                    <Input
                      id="contract_end_date"
                      type="date"
                      value={formData.contract_end_date}
                      onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Role Assignment */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Roles</h3>
                <div className="space-y-4">
                  {/* Current Roles */}
                  <div>
                    <Label>Assigned Roles</Label>
                    {userRoles.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {userRoles.map((role) => (
                          <Badge key={role.id} variant="default" className="flex items-center gap-1">
                            {role.name}
                            <button
                              type="button"
                              onClick={() => handleRemoveRole(role.id)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">No roles assigned</p>
                    )}
                  </div>

                  {/* Assign New Role */}
                  <div className="flex gap-2">
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select a role to assign...</option>
                      {roles
                        .filter(role => !userRoles.find(ur => ur.id === role.id))
                        .map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      onClick={handleAssignRole}
                      disabled={!selectedRoleId || isLoading}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Assign Role
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Note: "Manager" is not a role - it's a relationship. Use the "Manager" field above to assign a manager to this user.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-lg bg-green-100 text-green-800 text-sm">
                  {successMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update User'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
