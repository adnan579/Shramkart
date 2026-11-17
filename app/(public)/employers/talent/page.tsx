import type { Metadata } from 'next';
import { TalentScreen } from '../../../../src/screens/Screens';
import { requirePageRole } from '../../../../server/next/page-data';

export const metadata: Metadata = { title: 'Find verified talent | Shramkart', robots: { index: false, follow: false } };

export default async function TalentRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole('employer', '/employers/talent', await searchParams);
  return <TalentScreen />;
}
