import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admissions & Campaign Follow-Up',
  description: 'School Admissions Lead Follow-Up & Campaign Analytics Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="auto">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

