export function normalizeTanzaniaPhoneNumber(phone: string): { valid: boolean; phone?: string; error?: string } {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) {
    return { valid: false, error: 'Phone number is required' }
  }

  let local = ''
  if (digits.length === 9 && digits.startsWith('6')) {
    local = digits
  } else if (digits.length === 10 && digits.startsWith('0')) {
    local = digits.slice(1)
  } else if (digits.length === 12 && digits.startsWith('255')) {
    local = digits.slice(3)
  } else {
    return { valid: false, error: 'Use 0623424892, 623424892, 255623424892, or +255623424892' }
  }

  if (!/^6\d{8}$/.test(local)) {
    return { valid: false, error: 'Tanzania mobile number must start with 6 and contain 9 local digits' }
  }

  return { valid: true, phone: `+255${local}` }
}

type NativeSmsBridge = {
  sendSms?: (options: { phone: string; message: string }) => Promise<unknown>
  send?: (options: { phone: string; message: string; recipients?: string[] }) => Promise<unknown>
}

type WindowWithNativeSms = Window & typeof globalThis & {
  Capacitor?: {
    Plugins?: Record<string, NativeSmsBridge | undefined>
  }
  ShuleaSms?: NativeSmsBridge
  NativeSms?: NativeSmsBridge
}

async function tryNativeSmsSend(phone: string, message: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const win = window as WindowWithNativeSms
  const bridges = [
    win.ShuleaSms,
    win.NativeSms,
    win.Capacitor?.Plugins?.ShuleaSms,
    win.Capacitor?.Plugins?.NativeSms,
    win.Capacitor?.Plugins?.SmsSender,
    win.Capacitor?.Plugins?.SMS,
  ].filter(Boolean) as NativeSmsBridge[]

  for (const bridge of bridges) {
    if (typeof bridge.sendSms === 'function') {
      await bridge.sendSms({ phone, message })
      return true
    }
    if (typeof bridge.send === 'function') {
      await bridge.send({ phone, message, recipients: [phone] })
      return true
    }
  }

  return false
}

function openSmsComposer(phone: string, message: string): void {
  const separator = /android/i.test(navigator.userAgent) ? '?' : '&'
  window.location.href = `sms:${encodeURIComponent(phone)}${separator}body=${encodeURIComponent(message)}`
}

function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  const normalized = normalizeTanzaniaPhoneNumber(phone)
  return normalized.valid ? { valid: true } : { valid: false, error: normalized.error }
}

export class SmsSender {
  static isDesktop(): boolean {
    return true
  }

  static async send(phone: string, message: string): Promise<void> {
    const validation = normalizeTanzaniaPhoneNumber(phone)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    if (!message.trim()) {
      throw new Error('Message is required')
    }

    const sentByNativeBridge = await tryNativeSmsSend(validation.phone!, message)
    if (!sentByNativeBridge) {
      openSmsComposer(validation.phone!, message)
    }
  }

  static async sendMany(items: Array<{ phone: string; message: string }>, onProgress?: (sent: number, total: number, errors: string[]) => void): Promise<{ sent: number; errors: string[] }> {
    const errors: string[] = []
    let sent = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        const validation = normalizeTanzaniaPhoneNumber(item.phone)
        if (!validation.valid) {
          errors.push(`Invalid phone number: ${item.phone} (${validation.error})`)
          continue
        }

        if (!item.message.trim()) {
          errors.push(`Empty message for: ${validation.phone || item.phone}`)
          continue
        }

        await this.send(validation.phone!, item.message)
        sent++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to send to ${item.phone}: ${errorMsg}`)
      }
      
      onProgress?.(sent, items.length, errors)
    }

    return { sent, errors }
  }

  static async openComposer(phone: string, message: string): Promise<void> {
    const validation = normalizeTanzaniaPhoneNumber(phone)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    openSmsComposer(validation.phone!, message)
  }
}
