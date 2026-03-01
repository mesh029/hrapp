'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Calendar, FileText, Trash2, CheckSquare, Square } from 'lucide-react';
import { usePermissions } from '@/ui/src/hooks/use-permissions';
import { timesheetService, Timesheet } from '@/ui/src/services/timesheets';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { useRouter } from 'next/navigation';

const COMPONENT_ID_LIST = 'timesheet.list.view';
const COMPONENT_ID_CREATE_BUTTON = 'timesheet.create.button';

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-500',
  Submitted: 'bg-blue-500',
  UnderReview: 'bg-yellow-500',
  Approved: 'bg-green-500',
  Declined: 'bg-red-500',
  Locked: 'bg-purple-500',
};

export default function TimesheetsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { hasPermission } = usePermissions();
  const [timesheets, setTimesheets] = React.useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [selectedTimesheets, setSelectedTimesheets] = React.useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const canDelete = features.isAdmin || hasPermission('timesheet.delete') || hasPermission('system.admin');

  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_LIST, {
    fallbackPermission: 'timesheet.read',
    fallbackCheck: (features) =>
      features.canViewAllTimesheets || features.canCreateTimesheet || features.canSubmitTimesheet,
  });

  const { isVisible: showCreateButton } = useComponentVisibility(COMPONENT_ID_CREATE_BUTTON, {
    fallbackPermission: 'timesheet.create',
    fallbackCheck: (features) => features.canCreateTimesheet && !features.isAdmin,
  });

  React.useEffect(() => {
    if (!uiLoading && canView) {
      loadTimesheets();
    }
  }, [pagination.page, statusFilter, user?.id, uiLoading, canView]);

  const loadTimesheets = async () => {
    try {
      setIsLoading(true);
      
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      // Apply filters based on permissions
      if (!features.canViewAllTimesheets && !features.canApproveTimesheet && user?.id) {
        params.user_id = user.id; // Only show own timesheets
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await timesheetService.getTimesheets(params);
      
      if (response.success && response.data) {
        setTimesheets(response.data.timesheets || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error('Failed to load timesheets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = (start: string, end: string) => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const handleSelectAll = () => {
    if (selectedTimesheets.size === timesheets.length) {
      setSelectedTimesheets(new Set());
    } else {
      setSelectedTimesheets(new Set(timesheets.map(t => t.id)));
    }
  };

  const handleSelectTimesheet = (id: string) => {
    const newSelected = new Set(selectedTimesheets);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTimesheets(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedTimesheets.size === 0) {
      alert('Please select at least one timesheet to delete');
      return;
    }

    const confirmMessage = `⚠️ WARNING: Are you sure you want to delete ${selectedTimesheets.size} timesheet(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await timesheetService.bulkDeleteTimesheets(Array.from(selectedTimesheets));
      if (response.success) {
        const deletedCount = response.data?.deletedCount || selectedTimesheets.size;
        setSelectedTimesheets(new Set());
        // Wait a bit to ensure database transaction is committed
        await new Promise(resolve => setTimeout(resolve, 500));
        // Reload the list
        await loadTimesheets();
        alert(`Successfully deleted ${deletedCount} timesheet(s)`);
      } else {
        alert(response.message || 'Failed to delete timesheets');
      }
    } catch (error: any) {
      console.error('Failed to bulk delete timesheets:', error);
      alert(error.message || 'Failed to delete timesheets');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to view timesheets
          </div>
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
            <h1 className="text-3xl font-bold">Timesheets</h1>
            <p className="text-muted-foreground mt-1">
              {features.canViewAllTimesheets 
                ? 'Manage all timesheets in the system'
                : 'View and manage your timesheets'}
            </p>
          </div>
          
          {showCreateButton && (
            <Button onClick={() => router.push('/timesheets/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Timesheet
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or period..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="all">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="UnderReview">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                  <option value="Locked">Locked</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timesheets List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {features.canViewAllTimesheets || features.canApproveTimesheet ? 'Team Timesheets' : 'My Timesheets'}
              </CardTitle>
              {canDelete && selectedTimesheets.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? 'Deleting...' : `Delete ${selectedTimesheets.size} Selected`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : timesheets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No timesheets found
              </div>
            ) : (
              <div className="space-y-4">
                {/* Select All Checkbox */}
                {canDelete && (
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {selectedTimesheets.size === timesheets.length ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span>Select All ({selectedTimesheets.size}/{timesheets.length})</span>
                    </button>
                  </div>
                )}
                {timesheets.map((timesheet) => (
                  <div
                    key={timesheet.id}
                    className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                      selectedTimesheets.has(timesheet.id) ? 'bg-muted border-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTimesheet(timesheet.id);
                          }}
                          className="mt-1"
                        >
                          {selectedTimesheets.has(timesheet.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => router.push(`/timesheets/${timesheet.id}`)}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">
                            {features.canViewAllTimesheets && timesheet.user
                              ? timesheet.user.name
                              : 'Timesheet'}
                          </h3>
                          <Badge className={statusColors[timesheet.status] || 'bg-gray-500'}>
                            {timesheet.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {formatDateRange(timesheet.period_start, timesheet.period_end)}
                            </span>
                          </div>
                          
                          {timesheet.total_hours !== undefined && (
                            <div>
                              <span className="font-medium">{timesheet.total_hours}</span> hours
                            </div>
                          )}
                          
                          {timesheet.location && (
                            <div>
                              <span className="font-medium">{timesheet.location.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/timesheets/${timesheet.id}`);
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
