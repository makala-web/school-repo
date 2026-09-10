import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { MobileProvider } from "@/components/MobileProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { OfflineAssetWarmup } from "@/components/OfflineAssetWarmup";

export const metadata: Metadata = {
  title: "Shulea v2.0 - School Results Management",
  description: "Offline School Results & Report Generator for Primary and Secondary Schools",
  icons: {
    icon: "/shulea-logo.png",
    apple: "/shulea-logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shulea",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__shuleaDeferredPrompt = null;
              window.addEventListener('beforeinstallprompt', function(event) {
                event.preventDefault();
                window.__shuleaDeferredPrompt = event;
                window.dispatchEvent(new Event('shulea-beforeinstallprompt'));
              });
              window.addEventListener('appinstalled', function() {
                window.__shuleaDeferredPrompt = null;
                window.dispatchEvent(new Event('shulea-appinstalled'));
              });
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <ErrorBoundary>
          <MobileProvider>
            {children}
          </MobileProvider>
        </ErrorBoundary>
        <PwaInstallPrompt />
        <OfflineAssetWarmup />
        <Toaster richColors position="top-center" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('Service Worker registered with scope:', registration.scope);
                    Promise.resolve(registration.update()).catch(function() {
                      // A dev server restart can briefly make an update unavailable.
                    });
                  }, function(err) {
                    console.warn('Service Worker registration unavailable:', err);
                  });
                });

                navigator.serviceWorker.addEventListener('controllerchange', function() {
                  if (sessionStorage.getItem('shulea-sw-refreshing') === '1') return;
                  sessionStorage.setItem('shulea-sw-refreshing', '1');
                  window.location.reload();
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
