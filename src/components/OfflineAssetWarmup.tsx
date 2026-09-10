'use client'

import { useEffect } from 'react'

function collectSameOriginAssets(): string[] {
  const urls = new Set<string>()
  const addUrl = (value: string | null | undefined) => {
    if (!value) return
    try {
      const url = new URL(value, window.location.origin)
      if (url.origin === window.location.origin && url.pathname.startsWith('/_next/static/')) {
        urls.add(url.pathname + url.search)
      }
    } catch {
      // Ignore malformed URLs from browser extensions or injected scripts.
    }
  }

  document.querySelectorAll<HTMLScriptElement>('script[src]').forEach(node => addUrl(node.src))
  document.querySelectorAll<HTMLLinkElement>('link[href]').forEach(node => addUrl(node.href))
  performance.getEntriesByType('resource').forEach(entry => addUrl(entry.name))

  return Array.from(urls)
}

export function OfflineAssetWarmup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const warmAssets = () => {
      const urls = collectSameOriginAssets()
      if (urls.length === 0) return

      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({ type: 'SHULEA_PRECACHE_URLS', urls })
      }).catch(() => {
        urls.forEach(url => {
          fetch(url, { cache: 'force-cache' }).catch(() => undefined)
        })
      })
    }

    const timeout = window.setTimeout(warmAssets, 1500)
    window.addEventListener('online', warmAssets)

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('online', warmAssets)
    }
  }, [])

  return null
}
