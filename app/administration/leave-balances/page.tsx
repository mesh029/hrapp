'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { api } from '@/ui/src/services/api';
import { Calendar, Plus, Minus, History, Search } from 'lucide-react';

interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  available: number;
  leave_type?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface LeaveType {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function LeaveBalancesAdminPage() {
  const { features } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility('admin.leave-balances.view', {
    fallbackCheck: (f) => f.isAdmin || f.canManageLeaveBalances,
  });

  const [balances, setBalances] = React.useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedUserId, setSelectedUserId] = React.useState<string>('');
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = React.useState<string>('');

  // Adjustment form state
  const [showAdjustForm, setShowAdjustForm] = React.useState(false);
  const [adjustForm, setAdjustForm] = React.useState({
    user_id: '',
    leave_type_id: '',
    year: new Date().getFullYear(),
    days: '',
    reason: '',
  });
  const [isAdjusting, setIsAdjusting] = React.useState(false);
  const [adjustError, setAdjustError] = React.useState<string>('');

  // Allocation form state
  const [showAllocateForm, setShowAllocateForm] = React.useState(false);
  const [allocateForm, setAllocateForm] = React.useState({
    user_id: '',
    leave_type_id: '',
    year: new Date().getFullYear(),
    days: '',
  });
  const [isAllocating, setIsAllocating] = React.useState(false);
  const [allocateError, setAllocateError] = React.useState<string>('');

  // Adjustment history
  const [showHistory, setShowHistory] = React.useState(false);
  const [historyUserId, setHistoryUserId] = React.useState<string>('');
  const [adjustmentHistory, setAdjustmentHistory] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (canView) {
      loadAll();
    }
  }, [canView, selectedYear, selectedUserId, selectedLeaveTypeId]);

  const loadAll = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadLeaveBalances(),
        loadLeaveTypes(),
        loadUsers(),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeaveBalances = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUserId) params.append('user_id', selectedUserId);
      if (selectedYear) params.append('year', selectedYear.toString());

      const response = await api.get<{ success?: boolean; data?: LeaveBalance[] }>(`/api/leave/balances?${params.toString()}`);
      if (response && 'success' in response && response.success && response.data) {
        setBalances(response.data);
      }
    } catch (error) {
      console.error('Failed to load leave balances:', error);
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const response = await api.get<{ success?: boolean; data?: LeaveType[] }>('/api/leave/types');
      if (response && 'success' in response && response.success && response.data) {
        setLeaveTypes(response.data);
      }
    } catch (error) {
      console.error('Failed to load leave types:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get<{ success?: boolean; data?: { users?: User[] } }>('/api/users?limit=1000');
      if (response && 'success' in response && response.success && response.data) {
        setUsers((response.data as any).users || response.data || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadAdjustmentHistory = async (userId: string, leaveTypeId?: string, year?: number) => {
    try {
      const params = new URLSearchParams();
      params.append('user_id', userId);
      if (leaveTypeId) params.append('leave_type_id', leaveTypeId);
      if (year) params.append('year', year.toString());

      const response = await api.get<{ success?: boolean; data?: any[] }>(`/api/leave/balances/adjust?${params.toString()}`);
      if (response && 'success' in response && response.success && response.data) {
        setAdjustmentHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to load adjustment history:', error);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdjusting(true);
    setAdjustError('');

    try {
      const response = await api.post<{ success?: boolean; message?: string }>('/api/leave/balances/adjust', {
        user_id: adjustForm.user_id,
        leave_type_id: adjustForm.leave_type_id,
        year: adjustForm.year,
        days: parseFloat(adjustForm.days),
        reason: adjustForm.reason,
      });

      if (response && 'success' in response && response.success) {
        setShowAdjustForm(false);
        setAdjustForm({
          user_id: '',
          leave_type_id: '',
          year: new Date().getFullYear(),
          days: '',
          reason: '',
        });
        await loadLeaveBalances();
      } else {
        setAdjustError(response.message || 'Failed to adjust leave balance');
      }
    } catch (error: any) {
      setAdjustError(error.message || 'Failed to adjust leave balance');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAllocating(true);
    setAllocateError('');

    try {
      const response = await api.post<{ success?: boolean; message?: string }>('/api/leave/balances/allocate', {
        user_id: allocateForm.user_id,
        leave_type_id: allocateForm.leave_type_id,
        year: allocateForm.year,
        days: parseFloat(allocateForm.days),
      });

      if (response && 'success' in response && response.success) {
        setShowAllocateForm(false);
        setAllocateForm({
          user_id: '',
          leave_type_id: '',
          year: new Date().getFullYear(),
          days: '',
        });
        await loadLeaveBalances();
      } else {
        setAllocateError(response.message || 'Failed to allocate leave days');
      }
    } catch (error: any) {
      setAllocateError(error.message || 'Failed to allocate leave days');
    } finally {
      setIsAllocating(false);
    }
  };

  const filteredBalances = balances.filter(balance => {
    if (selectedLeaveTypeId && balance.leave_type_id !== selectedLeaveTypeId) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const userName = balance.user?.name?.toLowerCase() || '';
      const userEmail = balance.user?.email?.toLowerCase() || '';
      const leaveTypeName = balance.leave_type?.name?.toLowerCase() || '';
      return userName.includes(query) || userEmail.includes(query) || leaveTypeName.includes(query);
    }
    return true;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leave Balance Management</h1>
            <p className="text-muted-foreground mt-1">
              Add, subtract, or allocate leave days for employees
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setShowAllocateForm(true);
                setShowAdjustForm(false);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Allocate Days
            </Button>
            <Button
              onClick={() => {
                setShowAdjustForm(true);
                setShowAllocateForm(false);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Minus className="h-4 w-4" />
              Adjust Balance
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="year">Year</Label>
                <select
                  id="year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="user">User</Label>
                <select
                  id="user"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="leaveType">Leave Type</Label>
                <select
                  id="leaveType"
                  value={selectedLeaveTypeId}
                  onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">All Leave Types</option>
                  {leaveTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allocation Form */}
        {showAllocateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Allocate Leave Days</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAllocate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="allocate_user">User *</Label>
                    <select
                      id="allocate_user"
                      value={allocateForm.user_id}
                      onChange={(e) => setAllocateForm({ ...allocateForm, user_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">Select user...</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
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
                  <div className="text-red-600 text-sm">{allocateError}</div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={isAllocating}>
                    {isAllocating ? 'Allocating...' : 'Allocate Days'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAllocateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Adjustment Form */}
        {showAdjustForm && (
          <Card>
            <CardHeader>
              <CardTitle>Adjust Leave Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdjust} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adjust_user">User *</Label>
                    <select
                      id="adjust_user"
                      value={adjustForm.user_id}
                      onChange={(e) => setAdjustForm({ ...adjustForm, user_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">Select user...</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="adjust_leave_type">Leave Type *</Label>
                    <select
                      id="adjust_leave_type"
                      value={adjustForm.leave_type_id}
                      onChange={(e) => setAdjustForm({ ...adjustForm, leave_type_id: e.target.value })}
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
                    <Label htmlFor="adjust_year">Year *</Label>
                    <Input
                      id="adjust_year"
                      type="number"
                      value={adjustForm.year}
                      onChange={(e) => setAdjustForm({ ...adjustForm, year: parseInt(e.target.value) })}
                      min="2000"
                      max="3000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="adjust_days">Days (positive to add, negative to subtract) *</Label>
                    <Input
                      id="adjust_days"
                      type="number"
                      step="0.25"
                      value={adjustForm.days}
                      onChange={(e) => setAdjustForm({ ...adjustForm, days: e.target.value })}
                      placeholder="e.g., 5 or -3"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="adjust_reason">Reason *</Label>
                  <Textarea
                    id="adjust_reason"
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                    placeholder="Enter reason for adjustment..."
                    rows={3}
                    required
                  />
                </div>
                {adjustError && (
                  <div className="text-red-600 text-sm">{adjustError}</div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={isAdjusting}>
                    {isAdjusting ? 'Adjusting...' : 'Adjust Balance'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAdjustForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Leave Balances Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Balances ({filteredBalances.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredBalances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leave balances found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Leave Type</th>
                      <th className="text-right p-2">Allocated</th>
                      <th className="text-right p-2">Used</th>
                      <th className="text-right p-2">Pending</th>
                      <th className="text-right p-2">Available</th>
                      <th className="text-center p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBalances.map((balance) => {
                      const available = balance.allocated - balance.used - balance.pending;
                      return (
                        <tr key={balance.id} className="border-b">
                          <td className="p-2">
                            <div className="font-medium">{balance.user?.name || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">{balance.user?.email}</div>
                          </td>
                          <td className="p-2">{balance.leave_type?.name || 'Unknown'}</td>
                          <td className="p-2 text-right">{balance.allocated.toFixed(2)}</td>
                          <td className="p-2 text-right">{balance.used.toFixed(2)}</td>
                          <td className="p-2 text-right text-yellow-600">{balance.pending.toFixed(2)}</td>
                          <td className="p-2 text-right">
                            <Badge variant={available >= 0 ? "default" : "destructive"}>
                              {available.toFixed(2)}
                            </Badge>
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setHistoryUserId(balance.user_id);
                                setShowHistory(true);
                                loadAdjustmentHistory(balance.user_id, balance.leave_type_id, balance.year);
                              }}
                              className="flex items-center gap-1"
                            >
                              <History className="h-4 w-4" />
                              History
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Adjustment History Modal */}
        {showHistory && (
          <Card>
            <CardHeader>
              <CardTitle>Adjustment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {adjustmentHistory.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No adjustment history found
                  </div>
                ) : (
                  adjustmentHistory.map((adj) => (
                    <div key={adj.id} className="border-b pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{adj.leaveTypeName}</div>
                          <div className="text-sm text-muted-foreground">{adj.reason}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(adj.adjustedAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={adj.adjustment >= 0 ? "default" : "destructive"}>
                          {adj.adjustment >= 0 ? '+' : ''}{adj.adjustment.toFixed(2)} days
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Adjusted by: {adj.adjustedBy}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4">
                <Button variant="outline" onClick={() => setShowHistory(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
