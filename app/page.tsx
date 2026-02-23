import { redirect } from 'next/navigation';

export default function HomePage() {
  // Server-side redirect to login page
  // This is the cleanest approach - no client-side JavaScript needed
  redirect('/login');
}
