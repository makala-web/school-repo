'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

type BarcodeDetectorResult = { rawValue?: string }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>
}

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanFailure: (error: string) => void
  onScanError: (error: string) => void
}

export default function QrScanner({ onScanSuccess, onScanFailure, onScanError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const [readerId] = useState(`qr-reader-${crypto.randomUUID()}`)
  const callbacksRef = useRef({ onScanSuccess, onScanFailure, onScanError })
  const [isStarting, setIsStarting] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [scannerMode, setScannerMode] = useState<'native' | 'html5'>('native')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    callbacksRef.current = { onScanSuccess, onScanFailure, onScanError }
  }, [onScanSuccess, onScanFailure, onScanError])

  useEffect(() => {
    let cancelled = false
    let cleanupTimeout: NodeJS.Timeout | null = null

    const stopNativeScanner = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      streamRef.current?.getTracks().forEach(track => {
        track.stop()
        track.enabled = false
      })
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
        videoRef.current.load()
      }
    }

    const normalizeCameraError = (error: unknown) => {
      let errorMsg = 'Camera initialization issue'
      let details = error instanceof Error ? error.message : 'Unknown error'
      
      if (details.includes('Permission denied') || details.includes('NotAllowedError')) {
        errorMsg = 'Camera permission denied'
        details = 'Go to Android Settings > Apps > Shulea > Permissions > Camera, then allow camera permission.'
      } else if (details.includes('NotFoundError')) {
        errorMsg = 'No camera found'
        details = 'This device has no accessible camera. Check if camera is available and not disabled.'
      } else if (details.includes('Failed to fetch')) {
        errorMsg = 'WebView camera issue'
        details = 'Update Android System WebView or Chrome from Play Store. Try entering Desktop URL manually.'
      } else if (details.includes('NotReadableError')) {
        errorMsg = 'Camera in use'
        details = 'Camera is being used by another app. Close other apps using camera and try again.'
      } else if (details.includes('OverconstrainedError')) {
        errorMsg = 'Camera constraint error'
        details = 'Camera does not support requested settings. Trying with different configuration...'
      } else if (details.includes('Video playback failed')) {
        errorMsg = 'Video playback issue'
        details = 'Camera stream cannot be played. Retrying with different settings...'
      }
      
      return { errorMsg, details }
    }

    const startNativeScanner = async (): Promise<boolean> => {
      // Skip native BarcodeDetector on Android - it causes issues
      // Go directly to html5-qrcode which is more stable
      return false
    }

    const startScanner = async () => {
      setIsStarting(true)
      setErrorMessage(null)

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not available. On Android, update WebView/Chrome and allow camera permission.')
        }

        const nativeStarted = await startNativeScanner().catch((error) => {
          console.warn('Native BarcodeDetector scanner failed, falling back to html5-qrcode:', error)
          stopNativeScanner()
          return false
        })

        if (nativeStarted) {
          if (!cancelled) setIsStarting(false)
          return
        }

        setScannerMode('html5')

        // Check if camera is available
        const devices = await Html5Qrcode.getCameras()
        if (devices.length === 0) {
          throw new Error('No cameras found on this device')
        }

        if (cancelled) return

        const html5QrCode = new Html5Qrcode(readerId)
        scannerRef.current = html5QrCode

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        }

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!cancelled) {
              callbacksRef.current.onScanSuccess(decodedText)
              html5QrCode.stop().catch(console.error)
            }
          },
          (errorMessage) => {
            // Ignore scan errors during normal operation
            // Only log if it's a critical error
            if (!errorMessage.includes('No QR code found') && !errorMessage.includes('NotFoundException')) {
              console.log('Scan error:', errorMessage)
              if (!cancelled) {
                callbacksRef.current.onScanFailure(errorMessage)
              }
            }
          }
        )
        if (!cancelled) setIsStarting(false)
      } catch (error) {
        const { errorMsg, details } = normalizeCameraError(error)
        console.error('Scanner error:', error)
        setErrorMessage(errorMsg)
        setErrorDetails(details)
        callbacksRef.current.onScanError(`${errorMsg}: ${details}`)
        setIsStarting(false)
      }
    }

    startScanner()

    return () => {
      cancelled = true
      if (cleanupTimeout) clearTimeout(cleanupTimeout)
      stopNativeScanner()
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined)
      }
    }
  }, [retryCount])

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center space-y-4 p-4">
        <div className="text-red-500 text-sm text-center">
          <p className="font-medium">{errorMessage}</p>
          {errorDetails && (
            <p className="text-xs mt-2 text-gray-600">{errorDetails}</p>
          )}
        </div>
        <button
          onClick={() => {
            setErrorMessage(null)
            setErrorDetails(null)
            setRetryCount(prev => prev + 1)
          }}
          className="text-xs text-blue-600 underline"
        >
          Retry starting camera
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Or try entering Desktop URL manually
        </p>
      </div>
    )
  }

  if (isStarting) {
    return (
      <div className="flex flex-col items-center space-y-4 p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        <p className="text-sm text-muted-foreground text-center">
          Starting camera...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {scannerMode === 'native' ? (
        <video ref={videoRef} className="w-full max-w-sm rounded-md bg-black" muted playsInline />
      ) : (
        <div id={readerId} className="w-full max-w-sm" />
      )}
      <p className="text-sm text-muted-foreground text-center">
        Point camera at QR code to scan
      </p>
    </div>
  )
}
