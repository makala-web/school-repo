/**
 * usePrint Hook
 * 
 * Provides easy access to print functionality for components
 * Supports both PDF generation and direct printing
 * Includes language switching for reports
 */

import { useState, useCallback } from 'react'
import { PrintService, type PrintOptions, type PrintResult } from '@/services/print/PrintService'

interface UsePrintOptions {
  defaultLanguage?: 'en' | 'sw'
}

export interface UsePrintReturn {
  isPrinting: boolean
  lastResult: PrintResult | null
  language: 'en' | 'sw'
  setLanguage: (lang: 'en' | 'sw') => void
  printPdf: (htmlContent: string, filename: string, title?: string) => Promise<PrintResult>
  sharePdf: (htmlContent: string, filename: string, title?: string) => Promise<PrintResult>
  directPrint: (htmlContent: string, title?: string) => Promise<PrintResult>
  toggleLanguage: () => void
}

export function usePrint(options: UsePrintOptions = {}): UsePrintReturn {
  const [isPrinting, setIsPrinting] = useState(false)
  const [lastResult, setLastResult] = useState<PrintResult | null>(null)
  const [language, setLanguage] = useState<'en' | 'sw'>(options.defaultLanguage || 'sw')

  /**
   * Generate and save PDF
   */
  const printPdf = useCallback(async (
    htmlContent: string,
    filename: string,
    title?: string
  ): Promise<PrintResult> => {
    setIsPrinting(true)
    try {
      const result = await PrintService.generatePdfFromHtml(htmlContent, {
        filename,
        title,
        language,
        saveToDevice: true,
        share: false,
      })
      setLastResult(result)
      return result
    } finally {
      setIsPrinting(false)
    }
  }, [language])

  /**
   * Generate PDF and share
   */
  const sharePdf = useCallback(async (
    htmlContent: string,
    filename: string,
    title?: string
  ): Promise<PrintResult> => {
    setIsPrinting(true)
    try {
      const result = await PrintService.generatePdfFromHtml(htmlContent, {
        filename,
        title,
        language,
        saveToDevice: true,
        share: true,
      })
      setLastResult(result)
      return result
    } finally {
      setIsPrinting(false)
    }
  }, [language])

  /**
   * Direct print without PDF
   */
  const directPrint = useCallback(async (
    htmlContent: string,
    title?: string
  ): Promise<PrintResult> => {
    setIsPrinting(true)
    try {
      const result = await PrintService.directPrint(htmlContent, title || 'Shulea Report')
      setLastResult(result)
      return result
    } finally {
      setIsPrinting(false)
    }
  }, [])

  /**
   * Toggle between English and Swahili
   */
  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'en' ? 'sw' : 'en')
  }, [])

  return {
    isPrinting,
    lastResult,
    language,
    setLanguage,
    printPdf,
    sharePdf,
    directPrint,
    toggleLanguage,
  }
}
