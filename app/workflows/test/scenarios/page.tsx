'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Save, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/ui/src/services/api';
import { rolesService, Role } from '@/ui/src/services/roles';
import { locationsService, Location } from '@/ui/src/services/locations';
import { usersService } from '@/ui/src/services/users';

interface TestUser {
  id?: string;
  name: string;
  email: string;
  role_id: string;
  location_id: string;
  manager_id?: string;
  is_employee?: boolean; // The one who submits
}

interface TestScenario {
  id?: string;
  name: string;
  description?: string;
  users: TestUser[];
}

export default function TestScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = React.useState<TestScenario[]>([]);
  const [currentScenario, setCurrentScenario] = React.useState<TestScenario | null>(null);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [existingUsers, setExistingUsers] = React.useState<Array<{ id: string; name: string; email: string }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [rolesRes, locationsRes, usersRes] = await Promise.all([
        rolesService.getRoles(),
        locationsService.getLocations(),
        usersService.getUsers({ status: 'active', limit: 100 }),
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data.roles || []);
      }
      if (locationsRes.success) {
        const locationsData = locationsRes.data as any;
        const locs = locationsData.locations || locationsData.flat || locationsData.tree || [];
        setLocations(Array.isArray(locs) ? locs : []);
      }
      if (usersRes.success && usersRes.data) {
        const users = usersRes.data.users || usersRes.data || [];
        setExistingUsers(users.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateScenario = () => {
    const newScenario: TestScenario = {
      name: `Test Scenario ${scenarios.length + 1}`,
      users: [
        {
          name: '',
          email: '',
          role_id: '',
          location_id: locations[0]?.id || '',
          is_employee: true,
        },
      ],
    };
    setCurrentScenario(newScenario);
  };

  const handleAddUser = () => {
    if (!currentScenario) return;
    setCurrentScenario({
      ...currentScenario,
      users: [
        ...currentScenario.users,
        {
          name: '',
          email: '',
          role_id: '',
          location_id: locations[0]?.id || '',
        },
      ],
    });
  };

  const handleRemoveUser = (index: number) => {
    if (!currentScenario) return;
    if (currentScenario.users.length <= 1) {
      alert('At least one user is required');
      return;
    }
    setCurrentScenario({
      ...currentScenario,
      users: currentScenario.users.filter((_, i) => i !== index),
    });
  };

  const handleUserChange = (index: number, field: keyof TestUser, value: any) => {
    if (!currentScenario) return;
    const newUsers = [...currentScenario.users];
    newUsers[index] = { ...newUsers[index], [field]: value };
    setCurrentScenario({ ...currentScenario, users: newUsers });
  };

  const handleSaveScenario = async () => {
    if (!currentScenario) return;

    // Validation
    if (!currentScenario.name.trim()) {
      alert('Scenario name is required');
      return;
    }
    if (currentScenario.users.some(u => !u.name || !u.email || !u.role_id || !u.location_id)) {
      alert('All users must have name, email, role, and location');
      return;
    }
    if (currentScenario.users.filter(u => u.is_employee).length !== 1) {
      alert('Exactly one user must be marked as the employee');
      return;
    }

    try {
      setIsSaving(true);
      // Save scenario (for now, just store in localStorage or call API)
      const response = await api.post('/api/workflows/test/scenarios', currentScenario);
      if (response.success) {
        setScenarios([...scenarios, { ...currentScenario, id: response.data.id }]);
        setCurrentScenario(null);
        alert('Scenario saved successfully!');
      } else {
        alert('Failed to save scenario');
      }
    } catch (error: any) {
      console.error('Failed to save scenario:', error);
      alert(error.message || 'Failed to save scenario');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunSimulation = (scenario: TestScenario) => {
    router.push(`/workflows/test/simulator?scenario=${scenario.id || 'new'}`);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/workflows/test')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Test Scenarios</h1>
            <p className="text-muted-foreground mt-1">
              Create test scenarios with 4 users (1 employee + 3 approvers)
            </p>
          </div>
        </div>

        {!currentScenario ? (
          <>
            {/* Scenarios List */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Saved Scenarios</h2>
              <Button onClick={handleCreateScenario}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Scenario
              </Button>
            </div>

            {scenarios.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No test scenarios created yet</p>
                  <Button onClick={handleCreateScenario}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Scenario
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenarios.map((scenario) => (
                  <Card key={scenario.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{scenario.name}</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRunSimulation(scenario)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Run Simulation
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {scenario.users.length} users
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {scenario.users.map((user, idx) => (
                            <Badge key={idx} variant={user.is_employee ? 'default' : 'secondary'}>
                              {user.name || `User ${idx + 1}`}
                              {user.is_employee && ' (Employee)'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Scenario Editor */
          <Card>
            <CardHeader>
              <CardTitle>Create Test Scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="scenario-name">Scenario Name *</Label>
                <Input
                  id="scenario-name"
                  value={currentScenario.name}
                  onChange={(e) => setCurrentScenario({ ...currentScenario, name: e.target.value })}
                  placeholder="e.g., Leave Approval Test - 4 Users"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Test Users ({currentScenario.users.length})</Label>
                  <Button variant="outline" size="sm" onClick={handleAddUser}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>

                {currentScenario.users.map((user, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant={user.is_employee ? 'default' : 'secondary'}>
                          {user.is_employee ? 'Employee (Submits Request)' : `Approver ${index}`}
                        </Badge>
                        {currentScenario.users.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input
                            value={user.name}
                            onChange={(e) => handleUserChange(index, 'name', e.target.value)}
                            placeholder="John Employee"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={user.email}
                            onChange={(e) => handleUserChange(index, 'email', e.target.value)}
                            placeholder="john@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Select
                            value={user.role_id || undefined}
                            onValueChange={(value) => handleUserChange(index, 'role_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map(role => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Location *</Label>
                          <Select
                            value={user.location_id || undefined}
                            onValueChange={(value) => handleUserChange(index, 'location_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {!user.is_employee && (
                          <div className="space-y-2 col-span-2">
                            <Label>Manager (Optional)</Label>
                            <Select
                              value={user.manager_id || '__none__'}
                              onValueChange={(value) => handleUserChange(index, 'manager_id', value === '__none__' ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select manager (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {currentScenario.users
                                  .filter((_, i) => i !== index)
                                  .map((u, i) => (
                                    <SelectItem key={i} value={u.id || `temp-${i}`}>
                                      {u.name || `User ${i + 1}`}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {user.is_employee && (
                          <div className="space-y-2 col-span-2">
                            <Label>Manager (First Approver)</Label>
                            <Select
                              value={user.manager_id || '__none__'}
                              onValueChange={(value) => handleUserChange(index, 'manager_id', value === '__none__' ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select manager" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {currentScenario.users
                                  .filter((_, i) => i !== index)
                                  .map((u, i) => (
                                    <SelectItem key={i} value={u.id || `temp-${i}`}>
                                      {u.name || `User ${i + 1}`}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              The employee's manager will be the first approver if workflow includes manager
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex items-center justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentScenario(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveScenario} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Scenario'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
