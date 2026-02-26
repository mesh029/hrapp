'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Building2, Calendar, Shield, Edit, Save, X } from 'lucide-react';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { usersService } from '@/ui/src/services/users';
import { api } from '@/ui/src/services/api';
import { Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  status: string;
  primary_location_id?: string;
  manager_id?: string;
  staff_number?: string;
  charge_code?: string;
  created_at: string;
  updated_at: string;
  primary_location?: {
    id: string;
    name: string;
  };
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  user_roles?: Array<{
    role: {
      id: string;
      name: string;
      status: string;
    };
  }>;
  roles?: Array<{
    id: string;
    name: string;
  }>;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user: currentUser, refreshUser } = useAuth();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
  });

  React.useEffect(() => {
    if (currentUser?.id) {
      loadProfile();
    }
  }, [currentUser?.id]);

  const loadProfile = async () => {
    if (!currentUser?.id) return;

    try {
      setIsLoading(true);
      const response = await usersService.getUser(currentUser.id);
      
      if (response && response.success && response.data) {
        // API returns user data directly in response.data
        const userData = response.data;
        
        // Transform user_roles to roles format - filter active roles only
        const activeRoles = (userData.user_roles || [])
          .filter((ur: any) => ur.role && ur.role.status === 'active')
          .map((ur: any) => ({
            id: ur.role.id,
            name: ur.role.name,
          }));
        
        const transformedData: UserProfile = {
          ...userData,
          roles: activeRoles,
        };
        
        setProfile(transformedData);
        setFormData({
          name: userData.name || '',
          email: userData.email || '',
        });
      } else {
        setError('Failed to load profile');
      }
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      setError(error.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await api.patch(`/api/users/${currentUser.id}`, {
        name: formData.name,
        email: formData.email,
      });

      if (response.success) {
        setIsEditing(false);
        await loadProfile();
        refreshUser();
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      setError(error.response?.data?.error || error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
      });
    }
    setIsEditing(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">
            <p className="text-destructive">Failed to load profile</p>
            {error && <p className="text-sm text-muted-foreground mt-2">{error}</p>}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground mt-2">View and manage your account information</p>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                <User className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">{profile.name}</h2>
                <p className="text-muted-foreground">{profile.email}</p>
                <Badge variant={profile.status === 'active' ? 'default' : 'secondary'} className="mt-2">
                  {profile.status}
                </Badge>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Full Name</Label>
                  <p className="text-lg font-medium">{profile.name}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-lg">{profile.email}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={profile.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                    {profile.status}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization Information</CardTitle>
            <CardDescription>Your role and location details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profile.primary_location ? (
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Primary Location
                  </Label>
                  <p className="text-lg font-medium">{profile.primary_location.name}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Primary Location
                  </Label>
                  <p className="text-lg font-medium text-muted-foreground">Not assigned</p>
                </div>
              )}

              {profile.manager ? (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Manager</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium">{profile.manager.name}</p>
                      <p className="text-sm text-muted-foreground">{profile.manager.email}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Manager</Label>
                  <p className="text-lg font-medium text-muted-foreground">No manager assigned</p>
                </div>
              )}

              {profile.staff_number && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Staff Number</Label>
                  <p className="text-lg font-medium">{profile.staff_number}</p>
                </div>
              )}

              {profile.charge_code && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Charge Code</Label>
                  <p className="text-lg font-medium">{profile.charge_code}</p>
                </div>
              )}
            </div>

            {profile.roles && profile.roles.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Roles
                </Label>
                <div className="flex flex-wrap gap-2">
                  {profile.roles.map((role) => (
                    <Badge key={role.id} variant="secondary">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Account metadata and timestamps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Account Created
                </Label>
                <p className="text-sm">
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Last Updated</Label>
                <p className="text-sm">
                  {new Date(profile.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
