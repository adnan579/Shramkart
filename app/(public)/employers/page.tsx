import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { EmployerPitchClient } from './EmployerPitchClient';
import { languageForCookie } from '../../../src/utils/routes';

export const metadata: Metadata = {
  title: 'Hire verified factory talent | Shramkart',
  description: 'Connect directly with verified manufacturing workers and ITI technicians.',
};

export default async function EmployersPage() {
  const language = languageForCookie((await cookies()).get('hj_language')?.value);
  return (
    <div className="min-h-full bg-[var(--sk-canvas)]">
      <EmployerPitchClient language={language} />
    </div>
  );
}