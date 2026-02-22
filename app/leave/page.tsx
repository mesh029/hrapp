'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Leave Index Page
 * Redirects to leave requests list
 */
export default function LeavePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leave/requests');
  }, [router]);

  return (
    <div className="container mx-auto p-6">
      <div className="text-center py-8">Redirecting to leave requests...</div>
    </div>
  );
}
