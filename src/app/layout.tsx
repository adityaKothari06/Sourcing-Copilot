import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sourcing Copilot | Tractor & Implements Talent Search',
  description: 'Multi-portal Boolean search and keyword intelligence engine for the Tractor & Farm Implements industry.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
