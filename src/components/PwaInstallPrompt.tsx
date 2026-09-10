'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type InstallPromptOutcome = 'accepted' | 'dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: InstallPromptOutcome; platform: string }>
}

declare global {
  interface Window {
    __shuleaDeferredPrompt?: BeforeInstallPromptEvent | null
  }
}

const DISMISSED_KEY = 'shulea-pwa-install-dismissed-at'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000
const SERVICE_WORKER_READY_TIMEOUT_MS = 8000

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function recentlyDismissed() {
  if (typeof window === 'undefined') return true
  const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0)
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL_MS
}

function waitForServiceWorkerReady() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      window.setTimeout(() => reject(new Error('Service worker did not become ready in time')), SERVICE_WORKER_READY_TIMEOUT_MS)
    }),
  ])
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [installHelpVisible, setInstallHelpVisible] = useState(false)
  const ios = useMemo(() => isIos(), [])

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    const applyDeferredPrompt = () => {
      if (!window.__shuleaDeferredPrompt) return
      setDeferredPrompt(window.__shuleaDeferredPrompt)
      setInstallHelpVisible(false)
      setVisible(true)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      window.__shuleaDeferredPrompt = event as BeforeInstallPromptEvent
      applyDeferredPrompt()
    }

    const handleCapturedBeforeInstallPrompt = () => {
      applyDeferredPrompt()
    }

    const handleInstalled = () => {
      setVisible(false)
      setDeferredPrompt(null)
      window.__shuleaDeferredPrompt = null
      window.localStorage.removeItem(DISMISSED_KEY)
    }

    applyDeferredPrompt()

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('shulea-beforeinstallprompt', handleCapturedBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    window.addEventListener('shulea-appinstalled', handleInstalled)

    if (window.__shuleaDeferredPrompt) {
      setInstallHelpVisible(false)
      setVisible(true)
    } else {
      setVisible(true)
    }

    if ('serviceWorker' in navigator) {
      waitForServiceWorkerReady()
        .then(() => {
          setOfflineReady(true)
          setVisible(true)
        })
        .catch(() => undefined)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('shulea-beforeinstallprompt', handleCapturedBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      window.removeEventListener('shulea-appinstalled', handleInstalled)
    }
  }, [ios])

  async function installApp() {
    if (!deferredPrompt) {
      await prepareOffline()
      setInstallHelpVisible(true)
      return
    }
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
    window.__shuleaDeferredPrompt = null
  }

  async function prepareOffline() {
    if (!('serviceWorker' in navigator)) {
      setInstallHelpVisible(true)
      return
    }
    setUpdating(true)
    try {
      const registration = await waitForServiceWorkerReady()
      await Promise.race([
        registration.update(),
        new Promise<void>((resolve) => window.setTimeout(resolve, 5000)),
      ])
      registration.active?.postMessage({
        type: 'SHULEA_PRECACHE_URLS',
        urls: Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[href]'))
          .map(node => 'src' in node ? node.src : node.href),
      })
      setOfflineReady(true)
    } catch (error) {
      console.warn('Shulea offline preparation did not complete automatically', error)
      setInstallHelpVisible(true)
    } finally {
      setUpdating(false)
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible || isStandalone()) return null

  return (
    <div
      className={cn(
        'fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-lg border border-emerald-200 bg-white p-3 shadow-xl shadow-black/10',
        'sm:right-5 sm:left-auto sm:bottom-5 sm:mx-0 sm:w-[420px]'
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Download / Sasisha Shulea</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            {ios
              ? 'Bonyeza Share kisha Add to Home Screen.'
              : offlineReady
                ? 'App imeandaliwa kwa matumizi ya offline. Install au sasisha cache kabla ya kuzima internet.'
                : 'Bonyeza hapa kuandaa app kwa matumizi ya offline na kuipakua kama program ya desktop.'}
          </p>
          {!ios && (
            <>
            <Button onClick={installApp} size="sm" className="mt-3 bg-emerald-600 hover:bg-emerald-700" disabled={updating}>
              {deferredPrompt ? <Download className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />}
              {deferredPrompt ? 'Download App' : updating ? 'Inaandaa offline...' : 'Sasisha Offline App'}
            </Button>
            {installHelpVisible && (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-amber-800">
                Kama popup ya install haijafunguka, tumia menu ya Chrome/Edge kisha Apps au Install Shulea. Offline cache imeandaliwa inapowezekana.
              </p>
            )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
