'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { api } from '@/ui/src/services/api';
import { usersService, User } from '@/ui/src/services/users';
import { rolesService, Role } from '@/ui/src/services/roles';
import { adminService, UserCategory } from '@/ui/src/services/admin';
import { leaveService, LeaveType } from '@/ui/src/services/leave';
import { locationsService } from '@/ui/src/services/locations';
import { Calendar, FileText, Users, RefreshCw, Plus, Search, CheckCircle, XCircle } from 'lucide-react';

interface StaffType {
  id: string;
  name: string;
  code: string;
}

export default function ContractsLeaveManagementPage() {
  const { features } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility('admin.contracts-leave.view', {
    fallbackCheck: (f) => f.isAdmin || f.canManageLeaveBalances || f.canManageUsers,
  });

  const [activeTab, setActiveTab] = React.useState<'contracts' | 'bulk-contracts' | 'bulk-reset' | 'bulk-allocate'>('contracts');
  const [isLoading, setIsLoading] = React.useState(true);
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [categories, setCategories] = React.useState<UserCategory[]>([]);
  const [staffTypes, setStaffTypes] = React.useState<StaffType[]>([]);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Contract assignment form (individual)
  const [contractForm, setContractForm] = React.useState({
    user_id: '',
    contract_start_date: '',
    contract_end_date: '',
    auto_calculate_leave: true as boolean | null,
    leave_type_id: '',
    manual_leave_days: '',
  });
  const [isAssigningContract, setIsAssigningContract] = React.useState(false);
  const [contractError, setContractError] = React.useState<string>('');
  const [contractSuccess, setContractSuccess] = React.useState<string>('');

  // Bulk contract assignment form
  const [bulkContractForm, setBulkContractForm] = React.useState({
    user_ids: [] as string[],
    role_ids: [] as string[],
    category_ids: [] as string[],
    staff_type_ids: [] as string[],
    contract_start_date: '',
    contract_end_date: '',
    auto_calculate_leave: true as boolean | null,
    leave_type_id: '',
    manual_leave_days: '',
  });
  const [isBulkAssigningContracts, setIsBulkAssigningContracts] = React.useState(false);
  const [bulkContractError, setBulkContractError] = React.useState<string>('');
  const [bulkContractSuccess, setBulkContractSuccess] = React.useState<string>('');

  // Bulk reset form
  const [resetForm, setResetForm] = React.useState({
    user_ids: [] as string[],
    role_ids: [] as string[],
    category_ids: [] as string[],
    staff_type_ids: [] as string[],
    leave_type_id: '',
    reason: '',
  });
  const [isResetting, setIsResetting] = React.useState(false);
  const [resetError, setResetError] = React.useState<string>('');
  const [resetSuccess, setResetSuccess] = React.useState<string>('');

  // Bulk allocate form
  const [allocateForm, setAllocateForm] = React.useState({
    user_ids: [] as string[],
    role_ids: [] as string[],
    staff_type_ids: [] as string[],
    leave_type_id: '',
    year: new Date().getFullYear(),
    days: '',
  });
  const [isAllocating, setIsAllocating] = React.useState(false);
  const [allocateError, setAllocateError] = React.useState<string>('');
  const [allocateSuccess, setAllocateSuccess] = React.useState<string>('');

  React.useEffect(() => {
    if (canView) {
      loadAll();
    }
  }, [canView]);

  const loadAll = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadUsers(),
        loadRoles(),
        loadCategories(),
        loadStaffTypes(),
        loadLeaveTypes(),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersService.getUsers({ limit: 1000, status: 'active' });
      if (response.success && response.data) {
        setUsers(response.data.users || response.data || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await rolesService.getRoles({ limit: 200, status: 'active' });
      if (response.success && response.data) {
        setRoles(response.data.roles || response.data || []);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await adminService.getUserCategories();
      if (response.success && response.data) {
        setCategories(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadStaffTypes = async () => {
    try {
      const response = await api.get<{ success?: boolean; data?: { staffTypes?: any[] } }>('/api/staff-types?status=active&limit=200');
      if (response && 'success' in response && response.success && response.data) {
        setStaffTypes(response.data.staffTypes || (Array.isArray(response.data) ? response.data : []) || []);
      }
    } catch (error) {
      console.error('Failed to load staff types:', error);
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const response = await leaveService.getLeaveTypes();
      if (response.success && response.data) {
        const leaveTypes = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any)?.leaveTypes || [];
        setLeaveTypes(leaveTypes);
      }
    } catch (error) {
      console.error('Failed to load leave types:', error);
    }
  };

  const handleAssignContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAssigningContract(true);
    setContractError('');
    setContractSuccess('');

    try {
      const payload: any = {
        contract_start_date: contractForm.contract_start_date,
        contract_end_date: contractForm.contract_end_date || null,
      };

      if (contractForm.auto_calculate_leave === true && contractForm.leave_type_id) {
        payload.auto_calculate_leave = true;
        payload.leave_type_id = contractForm.leave_type_id;
      } else if (contractForm.auto_calculate_leave === false && contractForm.leave_type_id && contractForm.manual_leave_days) {
        payload.auto_calculate_leave = false;
        payload.leave_type_id = contractForm.leave_type_id;
        payload.manual_leave_days = parseFloat(contractForm.manual_leave_days);
      }
      // If auto_calculate_leave is null, no leave allocation is included

      const response = await api.patch<{ success?: boolean; message?: string }>(`/api/users/${contractForm.user_id}/contract`, payload);

      if (response && 'success' in response && response.success) {
        setContractSuccess('Contract assigned successfully!');
        setContractForm({
          user_id: '',
          contract_start_date: '',
          contract_end_date: '',
          auto_calculate_leave: true as boolean | null,
          leave_type_id: '',
          manual_leave_days: '',
        });
        await loadUsers();
      } else {
        setContractError(response.message || 'Failed to assign contract');
      }
    } catch (error: any) {
      setContractError(error.message || 'Failed to assign contract');
    } finally {
      setIsAssigningContract(false);
    }
  };

  const handleBulkAssignContracts = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBulkAssigningContracts(true);
    setBulkContractError('');
    setBulkContractSuccess('');

    try {
      const payload: any = {
        contract_start_date: bulkContractForm.contract_start_date,
        contract_end_date: bulkContractForm.contract_end_date || null,
      };

      if (bulkContractForm.user_ids.length > 0) payload.user_ids = bulkContractForm.user_ids;
      if (bulkContractForm.role_ids.length > 0) payload.role_ids = bulkContractForm.role_ids;
      if (bulkContractForm.category_ids.length > 0) payload.category_ids = bulkContractForm.category_ids;
      if (bulkContractForm.staff_type_ids.length > 0) payload.staff_type_ids = bulkContractForm.staff_type_ids;

      if (bulkContractForm.auto_calculate_leave === true && bulkContractForm.leave_type_id) {
        payload.auto_calculate_leave = true;
        payload.leave_type_id = bulkContractForm.leave_type_id;
      } else if (bulkContractForm.auto_calculate_leave === false && bulkContractForm.leave_type_id && bulkContractForm.manual_leave_days) {
        payload.auto_calculate_leave = false;
        payload.leave_type_id = bulkContractForm.leave_type_id;
        payload.manual_leave_days = parseFloat(bulkContractForm.manual_leave_days);
      }

      const response = await api.post<{ success?: boolean; message?: string; data?: { assigned?: number; errors?: number } }>('/api/users/bulk-assign-contracts', payload);

      if (response && 'success' in response && response.success) {
        setBulkContractSuccess(`Successfully assigned contracts to ${response.data?.assigned || 0} users. ${response.data?.errors || 0} errors occurred.`);
        setBulkContractForm({
          user_ids: [],
          role_ids: [],
          category_ids: [],
          staff_type_ids: [],
          contract_start_date: '',
          contract_end_date: '',
          auto_calculate_leave: true as boolean | null,
          leave_type_id: '',
          manual_leave_days: '',
        });
        await loadUsers();
      } else {
        setBulkContractError(response.message || 'Failed to bulk assign contracts');
      }
    } catch (error: any) {
      setBulkContractError(error.message || 'Failed to bulk assign contracts');
    } finally {
      setIsBulkAssigningContracts(false);
    }
  };

  const handleBulkReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetError('');
    setResetSuccess('');

    try {
      const payload: any = {
        reason: resetForm.reason,
      };

      if (resetForm.user_ids.length > 0) payload.user_ids = resetForm.user_ids;
      if (resetForm.role_ids.length > 0) payload.role_ids = resetForm.role_ids;
      if (resetForm.category_ids.length > 0) payload.category_ids = resetForm.category_ids;
      if (resetForm.staff_type_ids.length > 0) payload.staff_type_ids = resetForm.staff_type_ids;
      if (resetForm.leave_type_id) payload.leave_type_id = resetForm.leave_type_id;

      const response = await api.post<{ success?: boolean; message?: string; data?: { reset?: number; errors?: number } }>('/api/leave/balances/bulk-reset', payload);

      if (response && 'success' in response && response.success) {
        setResetSuccess(`Successfully reset ${response.data?.reset || 0} leave balances. ${response.data?.errors || 0} errors occurred.`);
        setResetForm({
          user_ids: [],
          role_ids: [],
          category_ids: [],
          staff_type_ids: [],
          leave_type_id: '',
          reason: '',
        });
      } else {
        setResetError(response.message || 'Failed to reset leave balances');
      }
    } catch (error: any) {
      setResetError(error.message || 'Failed to reset leave balances');
    } finally {
      setIsResetting(false);
    }
  };

  const handleBulkAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAllocating(true);
    setAllocateError('');
    setAllocateSuccess('');

    try {
      const payload: any = {
        leave_type_id: allocateForm.leave_type_id,
        year: allocateForm.year,
        days: parseFloat(allocateForm.days),
      };

      if (allocateForm.user_ids.length > 0) payload.user_ids = allocateForm.user_ids;
      if (allocateForm.role_ids.length > 0) payload.role_ids = allocateForm.role_ids;
      if (allocateForm.staff_type_ids.length > 0) payload.staff_type_ids = allocateForm.staff_type_ids;

      const response = await api.post<{ success?: boolean; message?: string; data?: { allocated?: number; errors?: number } }>('/api/leave/balances/bulk-allocate', payload);

      if (response && 'success' in response && response.success) {
        setAllocateSuccess(`Successfully allocated ${allocateForm.days} days to ${response.data?.allocated || 0} users. ${response.data?.errors || 0} errors occurred.`);
        setAllocateForm({
          user_ids: [],
          role_ids: [],
          staff_type_ids: [],
          leave_type_id: '',
          year: new Date().getFullYear(),
          days: '',
        });
      } else {
        setAllocateError(response.message || 'Failed to allocate leave days');
      }
    } catch (error: any) {
      setAllocateError(error.message || 'Failed to allocate leave days');
    } finally {
      setIsAllocating(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return user.name.toLowerCase().includes(query) || 
           user.email.toLowerCase().includes(query) ||
           (user.staff_number && user.staff_number.toLowerCase().includes(query));
  });

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                You do not have permission to view this page.
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Contract & Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            Assign contracts, reset leave balances, and allocate leave days in bulk
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="contracts">
              <FileText className="h-4 w-4 mr-2" />
              Assign Contract (Individual)
            </TabsTrigger>
            <TabsTrigger value="bulk-contracts">
              <Users className="h-4 w-4 mr-2" />
              Bulk Assign Contracts
            </TabsTrigger>
            <TabsTrigger value="bulk-reset">
              <RefreshCw className="h-4 w-4 mr-2" />
              Bulk Reset Leave
            </TabsTrigger>
            <TabsTrigger value="bulk-allocate">
              <Plus className="h-4 w-4 mr-2" />
              Bulk Allocate Leave
            </TabsTrigger>
          </TabsList>

          {/* Assign Contracts Tab */}
          <TabsContent value="contracts">
            <Card>
              <CardHeader>
                <CardTitle>Assign Contract Period</CardTitle>
                <CardDescription>
                  Assign contract dates to employees and optionally allocate leave days automatically or manually
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAssignContract} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contract_user">Employee *</Label>
                      <select
                        id="contract_user"
                        value={contractForm.user_id}
                        onChange={(e) => setContractForm({ ...contractForm, user_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      >
                        <option value="">Select employee...</option>
                        {filteredUsers.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="contract_start">Contract Start Date *</Label>
                      <Input
                        id="contract_start"
                        type="date"
                        value={contractForm.contract_start_date}
                        onChange={(e) => setContractForm({ ...contractForm, contract_start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contract_end">Contract End Date (optional)</Label>
                      <Input
                        id="contract_end"
                        type="date"
                        value={contractForm.contract_end_date}
                        onChange={(e) => setContractForm({ ...contractForm, contract_end_date: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Leave empty for permanent employees</p>
                    </div>
                    <div>
                      <Label htmlFor="auto_calculate">Leave Allocation</Label>
                      <select
                        id="auto_calculate"
                        value={contractForm.auto_calculate_leave === null ? 'none' : (contractForm.auto_calculate_leave ? 'auto' : 'manual')}
                        onChange={(e) => {
                          const value = e.target.value;
                          setContractForm({ 
                            ...contractForm, 
                            auto_calculate_leave: value === 'none' ? null : (value === 'auto'),
                            leave_type_id: value === 'none' ? '' : contractForm.leave_type_id,
                            manual_leave_days: value === 'none' ? '' : contractForm.manual_leave_days,
                          });
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="auto">Auto-calculate based on contract period</option>
                        <option value="manual">Manually assign days</option>
                        <option value="none">No leave allocation</option>
                      </select>
                    </div>
                    {contractForm.auto_calculate_leave !== null && (
                      <>
                        <div>
                          <Label htmlFor="contract_leave_type">Leave Type *</Label>
                          <select
                            id="contract_leave_type"
                            value={contractForm.leave_type_id}
                            onChange={(e) => setContractForm({ ...contractForm, leave_type_id: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            required={contractForm.auto_calculate_leave !== null}
                          >
                            <option value="">Select leave type...</option>
                            {leaveTypes.map(type => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                          </select>
                        </div>
                        {!contractForm.auto_calculate_leave && (
                          <div>
                            <Label htmlFor="manual_days">Days to Allocate *</Label>
                            <Input
                              id="manual_days"
                              type="number"
                              step="0.25"
                              value={contractForm.manual_leave_days}
                              onChange={(e) => setContractForm({ ...contractForm, manual_leave_days: e.target.value })}
                              placeholder="e.g., 21"
                              min="0.25"
                              required={contractForm.auto_calculate_leave === false}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {contractError && (
                    <div className="text-red-600 text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {contractError}
                    </div>
                  )}
                  {contractSuccess && (
                    <div className="text-green-600 text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {contractSuccess}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isAssigningContract}>
                      {isAssigningContract ? 'Assigning...' : 'Assign Contract'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Assign Contracts Tab */}
          <TabsContent value="bulk-contracts">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Assign Contracts</CardTitle>
                <CardDescription>
                  Assign contract periods to multiple employees by role, category, staff type, or individual selection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBulkAssignContracts} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bulk_contract_roles">Roles (optional)</Label>
                      <select
                        id="bulk_contract_roles"
                        multiple
                        value={bulkContractForm.role_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setBulkContractForm({ ...bulkContractForm, role_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>
                    <div>
                      <Label htmlFor="bulk_contract_categories">User Categories (optional)</Label>
                      <select
                        id="bulk_contract_categories"
                        multiple
                        value={bulkContractForm.category_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setBulkContractForm({ ...bulkContractForm, category_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="bulk_contract_staff_types">Staff Types (optional)</Label>
                      <select
                        id="bulk_contract_staff_types"
                        multiple
                        value={bulkContractForm.staff_type_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setBulkContractForm({ ...bulkContractForm, staff_type_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {staffTypes.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="bulk_contract_start">Contract Start Date *</Label>
                      <Input
                        id="bulk_contract_start"
                        type="date"
                        value={bulkContractForm.contract_start_date}
                        onChange={(e) => setBulkContractForm({ ...bulkContractForm, contract_start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bulk_contract_end">Contract End Date (optional)</Label>
                      <Input
                        id="bulk_contract_end"
                        type="date"
                        value={bulkContractForm.contract_end_date}
                        onChange={(e) => setBulkContractForm({ ...bulkContractForm, contract_end_date: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Leave empty for permanent employees</p>
                    </div>
                    <div>
                      <Label htmlFor="bulk_auto_calculate">Leave Allocation</Label>
                      <select
                        id="bulk_auto_calculate"
                        value={bulkContractForm.auto_calculate_leave === null ? 'none' : (bulkContractForm.auto_calculate_leave ? 'auto' : 'manual')}
                        onChange={(e) => {
                          const value = e.target.value;
                          setBulkContractForm({ 
                            ...bulkContractForm, 
                            auto_calculate_leave: value === 'none' ? null : (value === 'auto'),
                            leave_type_id: value === 'none' ? '' : bulkContractForm.leave_type_id,
                            manual_leave_days: value === 'none' ? '' : bulkContractForm.manual_leave_days,
                          });
                        }}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="auto">Auto-calculate based on contract period</option>
                        <option value="manual">Manually assign days</option>
                        <option value="none">No leave allocation</option>
                      </select>
                    </div>
                    {bulkContractForm.auto_calculate_leave !== null && (
                      <>
                        <div>
                          <Label htmlFor="bulk_contract_leave_type">Leave Type *</Label>
                          <select
                            id="bulk_contract_leave_type"
                            value={bulkContractForm.leave_type_id}
                            onChange={(e) => setBulkContractForm({ ...bulkContractForm, leave_type_id: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            required={bulkContractForm.auto_calculate_leave !== null}
                          >
                            <option value="">Select leave type...</option>
                            {leaveTypes.map(type => (
                              <option key={type.id} value={type.id}>{type.name}</option>
                            ))}
                          </select>
                        </div>
                        {bulkContractForm.auto_calculate_leave === false && (
                          <div>
                            <Label htmlFor="bulk_manual_days">Days to Allocate *</Label>
                            <Input
                              id="bulk_manual_days"
                              type="number"
                              step="0.25"
                              value={bulkContractForm.manual_leave_days}
                              onChange={(e) => setBulkContractForm({ ...bulkContractForm, manual_leave_days: e.target.value })}
                              placeholder="e.g., 21"
                              min="0.25"
                              required={bulkContractForm.auto_calculate_leave === false}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {bulkContractError && (
                    <div className="text-red-600 text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {bulkContractError}
                    </div>
                  )}
                  {bulkContractSuccess && (
                    <div className="text-green-600 text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {bulkContractSuccess}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isBulkAssigningContracts}>
                      {isBulkAssigningContracts ? 'Assigning Contracts...' : 'Bulk Assign Contracts'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Reset Tab */}
          <TabsContent value="bulk-reset">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Reset Leave Balances</CardTitle>
                <CardDescription>
                  Reset leave balances for multiple employees by role, category, staff type, or individual selection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBulkReset} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reset_roles">Roles (optional)</Label>
                      <select
                        id="reset_roles"
                        multiple
                        value={resetForm.role_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setResetForm({ ...resetForm, role_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>
                    <div>
                      <Label htmlFor="reset_categories">User Categories (optional)</Label>
                      <select
                        id="reset_categories"
                        multiple
                        value={resetForm.category_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setResetForm({ ...resetForm, category_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="reset_staff_types">Staff Types (optional)</Label>
                      <select
                        id="reset_staff_types"
                        multiple
                        value={resetForm.staff_type_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setResetForm({ ...resetForm, staff_type_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {staffTypes.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="reset_leave_type">Leave Type (optional)</Label>
                      <select
                        id="reset_leave_type"
                        value={resetForm.leave_type_id}
                        onChange={(e) => setResetForm({ ...resetForm, leave_type_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="">All Leave Types</option>
                        {leaveTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">Leave empty to reset all leave types</p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reset_reason">Reason *</Label>
                    <Textarea
                      id="reset_reason"
                      value={resetForm.reason}
                      onChange={(e) => setResetForm({ ...resetForm, reason: e.target.value })}
                      placeholder="Enter reason for resetting leave balances..."
                      rows={3}
                      required
                    />
                  </div>
                  {resetError && (
                    <div className="text-red-600 text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {resetError}
                    </div>
                  )}
                  {resetSuccess && (
                    <div className="text-green-600 text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {resetSuccess}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isResetting} variant="destructive">
                      {isResetting ? 'Resetting...' : 'Reset Leave Balances'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Allocate Tab */}
          <TabsContent value="bulk-allocate">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Allocate Leave Days</CardTitle>
                <CardDescription>
                  Allocate leave days to multiple employees by role or staff type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBulkAllocate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="allocate_roles">Roles (optional)</Label>
                      <select
                        id="allocate_roles"
                        multiple
                        value={allocateForm.role_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setAllocateForm({ ...allocateForm, role_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>
                    <div>
                      <Label htmlFor="allocate_staff_types">Staff Types (optional)</Label>
                      <select
                        id="allocate_staff_types"
                        multiple
                        value={allocateForm.staff_type_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setAllocateForm({ ...allocateForm, staff_type_ids: selected });
                        }}
                        className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                        size={5}
                      >
                        {staffTypes.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="allocate_leave_type">Leave Type *</Label>
                      <select
                        id="allocate_leave_type"
                        value={allocateForm.leave_type_id}
                        onChange={(e) => setAllocateForm({ ...allocateForm, leave_type_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      >
                        <option value="">Select leave type...</option>
                        {leaveTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="allocate_year">Year *</Label>
                      <Input
                        id="allocate_year"
                        type="number"
                        value={allocateForm.year}
                        onChange={(e) => setAllocateForm({ ...allocateForm, year: parseInt(e.target.value) })}
                        min="2000"
                        max="3000"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="allocate_days">Days to Allocate *</Label>
                      <Input
                        id="allocate_days"
                        type="number"
                        step="0.25"
                        value={allocateForm.days}
                        onChange={(e) => setAllocateForm({ ...allocateForm, days: e.target.value })}
                        placeholder="e.g., 21"
                        min="0.25"
                        required
                      />
                    </div>
                  </div>
                  {allocateError && (
                    <div className="text-red-600 text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {allocateError}
                    </div>
                  )}
                  {allocateSuccess && (
                    <div className="text-green-600 text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {allocateSuccess}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isAllocating}>
                      {isAllocating ? 'Allocating...' : 'Allocate Leave Days'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
