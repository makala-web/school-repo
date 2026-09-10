export function getUserFriendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = error instanceof Error ? error.message : String(error || '')
  const message = raw.toLowerCase()

  if (message.includes('demo mode') || message.includes('read-only') || message.includes('read only')) {
    return 'Demo mode is read-only. You can view sample data, but changes are disabled.'
  }
  if (message.includes('prismaclient') || message.includes('browser environment') || message.includes('failed to execute sql')) {
    return 'Local storage is still being prepared. Please wait a moment and try again.'
  }
  if (message.includes('database not initialized') || message.includes('initialize offline database')) {
    return 'Offline storage could not be opened. Please reload the app and try again.'
  }
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('offline') || message.includes('request failed')) {
    return 'Internet connection is unavailable. Your changes remain on this device and will sync when connection returns.'
  }
  if (message.includes('synchronization') || message.includes('sync')) {
    return 'Synchronization could not complete. Your local data is safe and will retry when you are online.'
  }
  if (message.includes('forbidden') || message.includes('unauthorized') || message.includes('permission')) {
    return 'You do not have permission to perform this action.'
  }

  return raw && raw.length < 180 ? raw : fallback
}
