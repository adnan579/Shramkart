import type { Metadata } from 'next';
import { EmployerDashboardScreen } from '../../../../src/screens/Screens';
import { requirePageRole } from '../../../../server/next/page-data';

export const metadata: Metadata = { title: 'Employer dashboard', robots: { index: false, follow: false } };

export default async function EmployerDashboardRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole('employer', '/employers/dashboard', await searchParams);
  return <EmployerDashboardScreen />;
}
