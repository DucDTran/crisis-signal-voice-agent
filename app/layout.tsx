import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CrisisSignal | Crisis Coordination',
  description:
    'An AI-assisted multi-hazard crisis coordination simulation for Vinh City, Vietnam.',
  openGraph: {
    title: 'CrisisSignal | Crisis Coordination',
    description:
      'An AI-assisted multi-hazard crisis coordination simulation for Vinh City, Vietnam.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CrisisSignal | Crisis Coordination',
    description:
      'An AI-assisted multi-hazard crisis coordination simulation for Vinh City, Vietnam.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
