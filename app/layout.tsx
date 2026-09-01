import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FloodSignal | Vinh City Exercise',
  description:
    'A voice-to-map flood operations simulation for Vinh City, Vietnam.',
  openGraph: {
    title: 'FloodSignal | Vinh City Exercise',
    description:
      'A voice-to-map flood operations simulation for Vinh City, Vietnam.',
    images: ['/floodsignal-social-preview.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FloodSignal | Vinh City Exercise',
    description:
      'A voice-to-map flood operations simulation for Vinh City, Vietnam.',
    images: ['/floodsignal-social-preview.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
