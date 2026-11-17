import type { Metadata } from 'next';
import { AboutScreen } from '../../../src/screens/Screens';

export const metadata: Metadata = { title: 'About Shramkart' };

export default function AboutRoute() {
  return <AboutScreen />;
}
