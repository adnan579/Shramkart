import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import '../../src/index.css';
import { AppProvider } from '../../src/shell/AppProvider';
import { SiteShell } from '../../src/shell/SiteShell';
import { languageForCookie } from '../../src/utils/routes';
import { cookies } from 'next/headers';
import { pageSeed } from '../../server/next/page-data';

const title = 'Shramkart — Direct Hands for Indian Industry';
const description = 'Direct Hands for Indian Industry. Zero Middlemen. 100% Fair Pay. Two-way blue and grey-collar workforce marketplace connecting manufacturing units with verified ITI technicians.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary_large_image' },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '48x48' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = { themeColor: '#F5A524' };

// Rendered per request (never prerendered): the page policy in proxy.ts needs a fresh nonce, and the shared data
// below is specific to the person asking.
export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = languageForCookie((await cookies()).get('hj_language')?.value);
  const seed = await pageSeed();
  return (
    <AppProvider initialSnapshot={seed?.snapshot} initialSession={seed?.session} initialLanguage={language}>
      <SiteShell>{children}</SiteShell>
      <Analytics />
      <SpeedInsights />
    </AppProvider>
  );
}
