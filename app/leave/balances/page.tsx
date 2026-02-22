'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';
import { leaveService, LeaveBalance } from '@/ui/src/services/leave';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useAuth } from '@/ui/src/contexts/auth-context';

export default function LeaveBalancesPage() {
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const [balances, setBalances] = React.useState<LeaveBalance[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());

  React.useEffect(() => {
    loadLeaveBalances();
  }, [selectedYear, user?.id]);

  const loadLeaveBalances = async () => {
    try {
      setIsLoading(true);
      
      // If user can only view their own, use their user_id
      const userId = features.canViewAllLeave ? undefined : user?.id;
      const response = await leaveService.getLeaveBalances(userId);
      
      if (response.success && response.data) {
        // Filter by year
        const yearBalances = response.data.filter(b => b.year === selectedYear);
        setBalances(yearBalances);
      }
    } catch (error) {
      console.error('Failed to load leave balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableDays = (balance: LeaveBalance) => {
    return balance.allocated - balance.used - balance.pending;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leave Balances</h1>
            <p className="text-muted-foreground mt-1">
              {features.canViewAllLeave 
                ? 'View leave balances for all users'
                : 'View your leave balances'}
            </p>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="year">Year:</Label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-md"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Leave Balances */}
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">Loading...</div>
            </CardContent>
          </Card>
        ) : balances.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                No leave balances found for {selectedYear}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {balances.map((balance) => {
              const available = getAvailableDays(balance);
              const utilizationPercent = balance.allocated > 0 
                ? ((balance.used + balance.pending) / balance.allocated) * 100 
                : 0;

              return (
                <Card key={balance.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{balance.leave_type?.name || 'Unknown Type'}</span>
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Allocated */}
                    <div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                        <span>Allocated</span>
                        <span className="font-medium text-foreground">{balance.allocated} days</span>
                      </div>
                    </div>

                    {/* Used */}
                    <div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                        <span>Used</span>
                        <span className="font-medium text-foreground">{balance.used} days</span>
                      </div>
                    </div>

                    {/* Pending */}
                    {balance.pending > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                          <span>Pending</span>
                          <span className="font-medium text-yellow-600">{balance.pending} days</span>
                        </div>
                      </div>
                    )}

                    {/* Available */}
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Available</span>
                        <Badge 
                          variant={available > 0 ? "default" : "destructive"}
                          className="text-lg px-3 py-1"
                        >
                          {available} days
                        </Badge>
                      </div>
                    </div>

                    {/* Utilization Bar */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Utilization</span>
                        <span>{utilizationPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            utilizationPercent > 90 ? 'bg-red-500' :
                            utilizationPercent > 70 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
