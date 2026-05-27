import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title:       'CHB 外部檔案傳輸平台 — Large File Transfer',
  description: 'Secure large file upload & download with GCS, Google Drive, and GitHub Releases',
  icons:       { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
