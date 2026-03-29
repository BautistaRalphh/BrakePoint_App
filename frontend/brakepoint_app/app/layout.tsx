import * as React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";
import Theme from "./component_tempo/theme";
import { montserrat } from "./component_tempo/theme";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Notification from "@/components/ui/notifications";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <head>
        <link rel="preconnect" href="https://tiles.openfreemap.org" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
      </head>
      <body>
        <AppRouterCacheProvider options={{ key: "mui", enableCssLayer: true }}>
          <NotificationProvider>
            <Theme>{children}</Theme>
            <Notification />
          </NotificationProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}