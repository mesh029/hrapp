'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Calendar, Filter, Trash2, CheckSquare, Square } from 'lucide-react';
import { usePermissions } from '@/ui/src/hooks/use-permissions';
import { leaveService, LeaveRequest } from '@/ui/src/services/leave';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { useRouter } from 'next/navigation';

const COMPONENT_ID_CREATE_BUTTON = 'leave.create.button';

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-500',
  Submitted: 'bg-blue-500',
  UnderReview: 'bg-yellow-500',
  Approved: 'bg-green-500',
  Declined: 'bg-red-500',
  Adjusted: 'bg-orange-500',
  Cancelled: 'bg-gray-400',
};

export default function LeaveRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { hasPermission } = usePermissions();
  const { isVisible: showCreateButton, isEnabled: createButtonEnabled } = useComponentVisibility(
    COMPONENT_ID_CREATE_BUTTON,
    {
      fallbackPermission: 'leave.create',
      fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
    }
  );
  const [requests, setRequests] = React.useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [selectedRequests, setSelectedRequests] = React.useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const canDelete = features.isAdmin || hasPermission('system.admin');

  React.useEffect(() => {
    // Wait for UI features to load before making API call
    if (!uiLoading) {
      loadLeaveRequests();
    }
  }, [pagination.page, statusFilter, user?.id, uiLoading, features.canViewAllLeave]);

  const loadLeaveRequests = async () => {
    try {
      setIsLoading(true);
      
      // If user can only view their own, filter by user_id
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      // Apply filters based on permissions
      // If user doesn't have leave.read (canViewAllLeave), they can only see their own
      // But if they have leave.create, they should still see their own requests
      if (!features.canViewAllLeave && user?.id) {
        // User can only see their own requests
        params.user_id = user.id;
      }
      // If canViewAllLeave is true, don't filter by user_id - show all

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await leaveService.getLeaveRequests(params);
      
      console.log('[Leave Requests] Full response:', response);
      
      if (response.success) {
        // Handle nested response structure
        const responseData = (response.data as any)?.data || response.data;
        
        console.log('[Leave Requests] Extracted data:', responseData);
        
        if (responseData) {
          setRequests(responseData.requests || []);
          setPagination(prev => ({
            ...prev,
            total: responseData.pagination?.total || 0,
            totalPages: responseData.pagination?.totalPages || 0,
          }));
        }
      } else {
        console.error('[Leave Requests] API call failed:', response);
      }
    } catch (error) {
      console.error('Failed to load leave requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRequests = React.useMemo(() => {
    if (!searchTerm) return requests;
    
    const search = searchTerm.toLowerCase();
    return requests.filter(req => 
      req.user?.name?.toLowerCase().includes(search) ||
      req.user?.email?.toLowerCase().includes(search) ||
      req.leave_type?.name?.toLowerCase().includes(search) ||
      req.reason?.toLowerCase().includes(search)
    );
  }, [requests, searchTerm]);

  const handleViewRequest = (id: string) => {
    router.push(`/leave/requests/${id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSelectAll = () => {
    if (selectedRequests.size === filteredRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(filteredRequests.map(r => r.id)));
    }
  };

  const handleSelectRequest = (id: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRequests(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedRequests.size === 0) {
      alert('Please select at least one leave request to delete');
      return;
    }

    const confirmMessage = `⚠️ WARNING: Are you sure you want to delete ${selectedRequests.size} leave request(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await leaveService.bulkDeleteLeaveRequests(Array.from(selectedRequests));
      if (response.success) {
        const deletedCount = response.data?.deletedCount || selectedRequests.size;
        setSelectedRequests(new Set());
        // Wait a bit to ensure database transaction is committed
        await new Promise(resolve => setTimeout(resolve, 500));
        // Reload the list
        await loadLeaveRequests();
        alert(`Successfully deleted ${deletedCount} leave request(s)`);
      } else {
        alert(response.message || 'Failed to delete leave requests');
      }
    } catch (error: any) {
      console.error('Failed to bulk delete leave requests:', error);
      alert(error.message || 'Failed to delete leave requests');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leave Requests</h1>
            <p className="text-muted-foreground mt-1">
              {features.canViewAllLeave 
                ? 'Manage all leave requests in the system'
                : 'View and manage your leave requests'}
            </p>
          </div>
          
          {/* Create Leave Request Button - Visibility controlled by admin configuration */}
          {/* Falls back to permission check if no category config exists */}
          {showCreateButton && (
            <Button 
              onClick={() => router.push('/leave/requests/new')}
              disabled={!createButtonEnabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Leave Request
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
                    placeholder="Search by name, email, or reason..."
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
                  <option value="Adjusted">Adjusted</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Requests List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {features.canViewAllLeave ? 'All Leave Requests' : 'My Leave Requests'}
              </CardTitle>
              {canDelete && selectedRequests.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? 'Deleting...' : `Delete ${selectedRequests.size} Selected`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leave requests found
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
                      {selectedRequests.size === filteredRequests.length ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span>Select All ({selectedRequests.size}/{filteredRequests.length})</span>
                    </button>
                  </div>
                )}
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                      selectedRequests.has(request.id) ? 'bg-muted border-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRequest(request.id);
                          }}
                          className="mt-1"
                        >
                          {selectedRequests.has(request.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleViewRequest(request.id)}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">
                            {features.canViewAllLeave && request.user
                              ? request.user.name
                              : 'Leave Request'}
                          </h3>
                          <Badge className={statusColors[request.status] || 'bg-gray-500'}>
                            {request.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {formatDate(request.start_date)} - {formatDate(request.end_date)}
                            </span>
                          </div>
                          
                          <div>
                            <span className="font-medium">{request.days_requested}</span> days
                            {request.leave_type && (
                              <span className="ml-2">({request.leave_type.name})</span>
                            )}
                          </div>
                          
                          {request.reason && (
                            <div className="truncate" title={request.reason}>
                              {request.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewRequest(request.id);
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
