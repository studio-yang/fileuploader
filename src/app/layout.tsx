import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { I18nProvider } from '@/components/I18nProvider';

export const metadata: Metadata = {
  title:       'CHB 外部檔案傳輸平台 — Large File Transfer',
  description: 'Secure large file upload & download with GCS, Google Drive, and GitHub Releases',
  icons:       { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0066FF" />
      </head>
      <body>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
