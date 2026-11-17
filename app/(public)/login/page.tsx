import type { Metadata } from 'next';
import { AuthLauncher, LandingScreen } from '../../../src/screens/Screens';

export const metadata: Metadata = { title: 'Sign in | Shramkart', robots: { index: false, follow: false } };

export default async function LoginRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <>
      <LandingScreen />
      <AuthLauncher
        role={query.role === 'employer' ? 'employer' : 'worker'}
        mode={query.mode === 'register' ? 'register' : 'login'}
        next={typeof query.next === 'string' ? query.next : undefined}
      />
    </>
  );
}
