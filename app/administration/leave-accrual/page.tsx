'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { leaveService } from '@/ui/src/services/leave';
import { locationsService } from '@/ui/src/services/locations';
import { leaveAccrualService, LeaveAccrualConfig } from '@/ui/src/services/leave-accrual';
import { api } from '@/ui/src/services/api';
import { rolesService, Role } from '@/ui/src/services/roles';
import { adminService, UserCategory } from '@/ui/src/services/admin';
import { usersService, User } from '@/ui/src/services/users';

interface StaffType {
  id: string;
  name: string;
  code: string;
}

export default function LeaveAccrualAdminPage() {
  const { features } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility('admin.leave-accrual.view', {
    fallbackCheck: (f) => f.isAdmin || f.canApproveLeave,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [configs, setConfigs] = React.useState<LeaveAccrualConfig[]>([]);
  const [leaveTypes, setLeaveTypes] = React.useState<Array<{ id: string; name: string }>>([]);
  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [staffTypes, setStaffTypes] = React.useState<StaffType[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [userCategories, setUserCategories] = React.useState<UserCategory[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    leave_type_id: '',
    location_id: '',
    staff_type_id: '',
    accrual_rate: '1.75',
    accrual_period: 'monthly',
  });
  const [applyForm, setApplyForm] = React.useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    role_ids: [] as string[],
    user_category_ids: [] as string[],
    user_ids: [] as string[],
    location_id: '',
    staff_type_id: '',
  });
  const [isApplying, setIsApplying] = React.useState(false);
  const [applyResult, setApplyResult] = React.useState<any>(null);

  const loadAll = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [cfgRes, leaveTypesRes, locationsRes, staffTypesRes, rolesRes, categoriesRes, usersRes] = await Promise.all([
        leaveAccrualService.getConfigs({ page: 1, limit: 100 }),
        leaveService.getLeaveTypes(),
        locationsService.getLocations({ status: 'active' }),
        api.get<any>('/api/staff-types?status=active&limit=200'),
        rolesService.getRoles({ limit: 200, status: 'active' }),
        adminService.getUserCategories(),
        usersService.getUsers({ limit: 1000, status: 'active' }),
      ]);

      setConfigs((cfgRes?.data?.configs || cfgRes?.data?.data?.configs || []) as LeaveAccrualConfig[]);
      setLeaveTypes((leaveTypesRes?.data?.leaveTypes || leaveTypesRes?.data || []) as Array<{ id: string; name: string }>);
      setLocations(
        (locationsRes?.data?.flat || locationsRes?.data?.locations || locationsRes?.data?.tree || []) as Array<{
          id: string;
          name: string;
        }>
      );
      setStaffTypes((staffTypesRes?.data?.staffTypes || staffTypesRes?.data?.data?.staffTypes || []) as StaffType[]);
      setRoles((rolesRes?.data?.roles || rolesRes?.data?.data?.roles || []) as Role[]);
      setUserCategories((categoriesRes?.data || categoriesRes?.data?.data || []) as UserCategory[]);
      setUsers((usersRes?.data?.users || usersRes?.data?.data?.users || []) as User[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load leave accrual configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (canView) loadAll();
  }, [canView, loadAll]);

  const createConfig = async () => {
    if (!form.leave_type_id) {
      setError('Leave type is required.');
      return;
    }

    try {
      setError(null);
      await leaveAccrualService.createConfig({
        leave_type_id: form.leave_type_id,
        location_id: form.location_id || null,
        staff_type_id: form.staff_type_id || null,
        accrual_rate: Number(form.accrual_rate),
        accrual_period: form.accrual_period as 'monthly' | 'quarterly' | 'annual',
        is_active: true,
      });
      setForm((prev) => ({ ...prev, location_id: '', staff_type_id: '', accrual_rate: '1.75', accrual_period: 'monthly' }));
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to create accrual configuration');
    }
  };

  const updateConfig = async (cfg: LeaveAccrualConfig, patch: Partial<LeaveAccrualConfig>) => {
    try {
      setError(null);
      await leaveAccrualService.updateConfig(cfg.id, {
        accrual_rate: patch.accrual_rate !== undefined ? Number(patch.accrual_rate) : undefined,
        accrual_period: patch.accrual_period as any,
        is_active: patch.is_active,
      });
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to update accrual configuration');
    }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('Delete this accrual config?')) return;
    try {
      setError(null);
      await leaveAccrualService.deleteConfig(id);
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to delete accrual configuration');
    }
  };

  const toggleSelected = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const runApply = async (dryRun: boolean) => {
    if (!applyForm.leave_type_id || !applyForm.start_date || !applyForm.end_date) {
      setError('Leave type, start date, and end date are required for accrual application.');
      return;
    }
    try {
      setIsApplying(true);
      setError(null);
      const res = await leaveAccrualService.applyAccrual({
        leave_type_id: applyForm.leave_type_id,
        start_date: applyForm.start_date,
        end_date: applyForm.end_date,
        role_ids: applyForm.role_ids,
        user_category_ids: applyForm.user_category_ids,
        user_ids: applyForm.user_ids,
        location_id: applyForm.location_id || null,
        staff_type_id: applyForm.staff_type_id || null,
        dry_run: dryRun,
      });
      setApplyResult(res?.data || res?.data?.data || null);
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to apply accrual');
    } finally {
      setIsApplying(false);
    }
  };

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 text-muted-foreground">You do not have access to leave accrual configuration.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Leave Accrual Configuration</CardTitle>
            <CardDescription>
              Default system rate is <b>1.75 days/month</b> (used when no specific config exists).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.leave_type_id}
                onChange={(e) => setForm((p) => ({ ...p, leave_type_id: e.target.value }))}
              >
                <option value="">Leave Type</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.location_id}
                onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}
              >
                <option value="">Any Location (Default)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.staff_type_id}
                onChange={(e) => setForm((p) => ({ ...p, staff_type_id: e.target.value }))}
              >
                <option value="">Any Staff Type (Default)</option>
                {staffTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                step="0.01"
                value={form.accrual_rate}
                onChange={(e) => setForm((p) => ({ ...p, accrual_rate: e.target.value }))}
                placeholder="Rate"
              />
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.accrual_period}
                onChange={(e) => setForm((p) => ({ ...p, accrual_period: e.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={createConfig}>Add Config</Button>
              <Button variant="outline" onClick={loadAll}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apply Accrual to Target Scope</CardTitle>
            <CardDescription>
              Apply leave accrual for a date window to users filtered by role, user category, explicit user list, location, and staff type.
              Contract start/end dates are respected automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={applyForm.leave_type_id}
                onChange={(e) => setApplyForm((p) => ({ ...p, leave_type_id: e.target.value }))}
              >
                <option value="">Leave Type</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={applyForm.start_date}
                onChange={(e) => setApplyForm((p) => ({ ...p, start_date: e.target.value }))}
              />
              <Input
                type="date"
                value={applyForm.end_date}
                onChange={(e) => setApplyForm((p) => ({ ...p, end_date: e.target.value }))}
              />
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={applyForm.location_id}
                onChange={(e) => setApplyForm((p) => ({ ...p, location_id: e.target.value }))}
              >
                <option value="">Any Location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={applyForm.staff_type_id}
                onChange={(e) => setApplyForm((p) => ({ ...p, staff_type_id: e.target.value }))}
              >
                <option value="">Any Staff Type</option>
                {staffTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border rounded-md p-3 max-h-40 overflow-auto">
                <p className="text-sm font-medium mb-2">Roles (optional)</p>
                <div className="space-y-1">
                  {roles.map((role) => (
                    <label key={role.id} className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={applyForm.role_ids.includes(role.id)}
                        onChange={() =>
                          setApplyForm((p) => ({ ...p, role_ids: toggleSelected(p.role_ids, role.id) }))
                        }
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="border rounded-md p-3 max-h-40 overflow-auto">
                <p className="text-sm font-medium mb-2">User Categories (optional)</p>
                <div className="space-y-1">
                  {userCategories.map((cat) => (
                    <label key={cat.id} className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={applyForm.user_category_ids.includes(cat.id)}
                        onChange={() =>
                          setApplyForm((p) => ({
                            ...p,
                            user_category_ids: toggleSelected(p.user_category_ids, cat.id),
                          }))
                        }
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="border rounded-md p-3 max-h-40 overflow-auto">
                <p className="text-sm font-medium mb-2">Specific Users (optional)</p>
                <div className="space-y-1">
                  {users.map((u) => (
                    <label key={u.id} className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={applyForm.user_ids.includes(u.id)}
                        onChange={() =>
                          setApplyForm((p) => ({ ...p, user_ids: toggleSelected(p.user_ids, u.id) }))
                        }
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" disabled={isApplying} onClick={() => runApply(true)}>
                {isApplying ? 'Running...' : 'Preview (Dry Run)'}
              </Button>
              <Button disabled={isApplying} onClick={() => runApply(false)}>
                {isApplying ? 'Applying...' : 'Apply Accrual'}
              </Button>
            </div>

            {applyResult && (
              <div className="text-sm border rounded-md p-3 space-y-1">
                <p>
                  <b>Mode:</b> {applyResult.dry_run ? 'Dry Run' : 'Applied'}
                </p>
                <p>
                  <b>Targeted users:</b> {applyResult.targeted_users}
                </p>
                <p>
                  <b>Total days:</b> {applyResult.total_days}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Accrual Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : configs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No accrual configs found. Default fallback is 1.75/month.</div>
            ) : (
              <div className="space-y-3">
                {configs.map((cfg) => (
                  <div key={cfg.id} className="border rounded-md p-3 space-y-2">
                    <div className="text-sm">
                      <b>{cfg.leave_type?.name || 'Leave Type'}</b> | {cfg.location?.name || 'Any Location'} |{' '}
                      {cfg.staff_type?.name || 'Any Staff Type'}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={String(cfg.accrual_rate)}
                        onBlur={(e) => updateConfig(cfg, { accrual_rate: e.target.value })}
                        className="w-28"
                      />
                      <select
                        defaultValue={cfg.accrual_period}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        onChange={(e) => updateConfig(cfg, { accrual_period: e.target.value as any })}
                      >
                        <option value="monthly">monthly</option>
                        <option value="quarterly">quarterly</option>
                        <option value="annual">annual</option>
                      </select>
                      <label className="text-sm flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked={cfg.is_active}
                          onChange={(e) => updateConfig(cfg, { is_active: e.target.checked })}
                        />
                        Active
                      </label>
                      <Button variant="destructive" size="sm" onClick={() => deleteConfig(cfg.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
