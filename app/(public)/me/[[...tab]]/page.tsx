import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WorkerProfileScreen } from '../../../../src/screens/Screens';
import { requirePageRole } from '../../../../server/next/page-data';

export const metadata: Metadata = { title: 'My Shramkart profile', robots: { index: false, follow: false } };

const TABS = new Set(['applications', 'id-card', 'profile']);

interface Props {
  params: Promise<{ tab?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WorkerProfileRoute({ params, searchParams }: Props) {
  const { tab = [] } = await params;
  if (tab.length > 1 || (tab[0] && !TABS.has(tab[0]))) notFound();
  await requirePageRole('worker', `/me${tab.length ? `/${tab[0]}` : ''}`, await searchParams);
  return <WorkerProfileScreen />;
}
