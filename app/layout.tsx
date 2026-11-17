import { cookies } from 'next/headers';
import { languageForCookie } from '../src/utils/routes';
import { notoSans, notoSansDevanagari } from './fonts';

// The one root layout. It only owns <html> and <body>: the public site adds its shell in (public)/layout.tsx
// and the staff console has its own layout in (admin)/layout.tsx.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = languageForCookie((await cookies()).get('hj_language')?.value);
  return (
    <html lang={lang} className={`${notoSans.variable} ${notoSansDevanagari.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
