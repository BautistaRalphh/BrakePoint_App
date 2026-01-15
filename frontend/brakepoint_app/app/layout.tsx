import Theme from './component_tempo/theme';
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://tiles.openfreemap.org" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
      </head>
      <body>
        <NotificationProvider>
          <Theme>{children}</Theme>
        </NotificationProvider>
      </body>
    </html>
  );
}