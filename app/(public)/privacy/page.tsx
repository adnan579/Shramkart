import type { Metadata } from 'next';
import { LandingScreen, LegalLauncher } from '../../../src/screens/Screens';

export const metadata: Metadata = { title: 'Privacy Notice | Shramkart' };

export default function PrivacyRoute() {
  return (
    <>
      <LandingScreen />
      <LegalLauncher tab="privacy" />
    </>
  );
}
