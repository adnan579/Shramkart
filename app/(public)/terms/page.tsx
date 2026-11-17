import type { Metadata } from 'next';
import { LandingScreen, LegalLauncher } from '../../../src/screens/Screens';

export const metadata: Metadata = { title: 'Terms of Use | Shramkart' };

export default function TermsRoute() {
  return (
    <>
      <LandingScreen />
      <LegalLauncher tab="terms" />
    </>
  );
}
