/**
 * Print Service - Professional PDF Generation & Printing (Web-only)
 * 
 * Features:
 * - PDF generation using jsPDF + html2canvas
 * - Browser-based PDF download
 * - Direct printing using browser print
 * - Language support (English/Kiswahili)
 * - Professional styling for B&W photocopy
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface PrintOptions {
  filename: string
  title?: string
  language?: 'en' | 'sw'
  saveToDevice?: boolean
  share?: boolean
}

export interface PrintResult {
  success: boolean
  pdfUrl?: string
  filePath?: string
  fileName?: string
  error?: string
}

class PrintServiceClass {
  /**
   * Generate PDF from HTML content
   */
  async generatePdfFromHtml(
    htmlContent: string,
    options: PrintOptions
  ): Promise<PrintResult> {
    try {
      console.log('[PrintService] Generating PDF:', options.filename)

      // Create a temporary container for rendering
      const container = document.createElement('div')
      container.innerHTML = htmlContent
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.width = '210mm' // A4 width
      document.body.appendChild(container)

      // Wait for images to load
      await this.waitForImages(container)

      // Convert to canvas
      const canvas = await html2canvas(container, {
        scale: 2, // High resolution for print quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794, // A4 width in pixels at 96 DPI
      })

      // Calculate dimensions
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)

      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 0

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)

      // Clean up
      document.body.removeChild(container)

      // Save PDF
      pdf.save(`${options.filename}.pdf`)

      return {
        success: true,
        pdfUrl: pdf.output('dataurlstring'),
      }
    } catch (error) {
      console.error('[PrintService] PDF generation error:', error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Direct print without PDF generation (uses browser print)
   */
  async directPrint(htmlContent: string, title: string): Promise<PrintResult> {
    try {
      console.log('[PrintService] Direct print:', title)

      // Web: open print window
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('Could not open print window. Please allow popups.')
      }

      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }

      return { success: true }
    } catch (error) {
      console.error('[PrintService] Direct print error:', error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  private safeFilename(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'shulea-report'
  }

  /**
   * Wait for all images in container to load
   */
  private waitForImages(container: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const images = container.querySelectorAll('img')
      let loadedCount = 0
      const totalImages = images.length

      if (totalImages === 0) {
        resolve()
        return
      }

      images.forEach((img) => {
        if (img.complete) {
          loadedCount++
          if (loadedCount === totalImages) resolve()
        } else {
          img.onload = () => {
            loadedCount++
            if (loadedCount === totalImages) resolve()
          }
          img.onerror = () => {
            loadedCount++
            if (loadedCount === totalImages) resolve()
          }
        }
      })

      // Timeout fallback (5 seconds)
      setTimeout(() => resolve(), 5000)
    })
  }
}

export const PrintService = new PrintServiceClass()
