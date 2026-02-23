'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, Calendar } from 'lucide-react';
import { leaveService, LeaveType } from '@/ui/src/services/leave';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useRouter } from 'next/navigation';

const COMPONENT_ID_LIST = 'leave.types.list.view';
const COMPONENT_ID_CREATE_BUTTON = 'leave.types.create.button';
const COMPONENT_ID_EDIT_ACTION = 'leave.types.edit.action';
const COMPONENT_ID_DELETE_ACTION = 'leave.types.delete.action';

export default function LeaveTypesPage() {
  const router = useRouter();
  const { features } = useDynamicUI();
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_LIST, {
    fallbackPermission: 'leave.types.read',
    fallbackCheck: (features) => features.isAdmin || features.canManageConfig,
  });

  const { isVisible: showCreateButton } = useComponentVisibility(COMPONENT_ID_CREATE_BUTTON, {
    fallbackPermission: 'leave.types.create',
    fallbackCheck: (features) => features.isAdmin || features.canManageConfig,
  });

  const { isVisible: canEdit } = useComponentVisibility(COMPONENT_ID_EDIT_ACTION, {
    fallbackPermission: 'leave.types.update',
    fallbackCheck: (features) => features.isAdmin || features.canManageConfig,
  });

  const { isVisible: canDelete } = useComponentVisibility(COMPONENT_ID_DELETE_ACTION, {
    fallbackPermission: 'leave.types.delete',
    fallbackCheck: (features) => features.isAdmin || features.canManageConfig,
  });

  React.useEffect(() => {
    if (canView) {
      loadLeaveTypes();
    }
  }, [canView]);

  const loadLeaveTypes = async () => {
    try {
      setIsLoading(true);
      const response = await leaveService.getLeaveTypes();
      if (response.success && response.data) {
        setLeaveTypes(response.data);
      }
    } catch (error) {
      console.error('Failed to load leave types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await leaveService.deleteLeaveType(id);
      if (response.success) {
        loadLeaveTypes();
      }
    } catch (error) {
      console.error('Failed to delete leave type:', error);
      alert('Failed to delete leave type');
    }
  };

  const filteredTypes = React.useMemo(() => {
    if (!searchTerm) return leaveTypes;
    
    const search = searchTerm.toLowerCase();
    return leaveTypes.filter(type => 
      type.name.toLowerCase().includes(search) ||
      type.description?.toLowerCase().includes(search)
    );
  }, [leaveTypes, searchTerm]);

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to view leave types
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
            <h1 className="text-3xl font-bold">Leave Types</h1>
            <p className="text-muted-foreground mt-1">
              Manage leave types and their configurations
            </p>
          </div>
          
          {showCreateButton && (
            <Button onClick={() => router.push('/leave/types/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Leave Type
            </Button>
          )}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leave types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Leave Types List */}
        <Card>
          <CardHeader>
            <CardTitle>All Leave Types</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'No leave types found matching your search' : 'No leave types found'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTypes.map((type) => (
                  <div
                    key={type.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{type.name}</h3>
                          <Badge variant={type.status === 'active' ? 'default' : 'secondary'}>
                            {type.status}
                          </Badge>
                        </div>
                        
                        {type.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {type.description}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              <span className="font-medium">{type.max_days_per_year}</span> days/year
                            </span>
                          </div>
                          
                          {type.carry_forward_allowed && (
                            <div>
                              <span className="text-muted-foreground">Carry Forward: </span>
                              <span className="font-medium">
                                {type.carry_forward_days || 0} days
                              </span>
                            </div>
                          )}
                          
                          <div>
                            <span className="text-muted-foreground">Type: </span>
                            <span className="font-medium">
                              {type.carry_forward_allowed ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {(canEdit || canDelete) && (
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/leave/types/${type.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(type.id, type.name)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
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
