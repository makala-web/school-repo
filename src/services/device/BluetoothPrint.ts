// Bluetooth Print Service
// Handles printing to Bluetooth printers from mobile devices
// Supports ESC/POS printers commonly used in retail

import { toast } from 'sonner'

// Types for Bluetooth printer
interface BluetoothDevice {
  name: string
  address: string
  connected: boolean
}

// ESC/POS commands for thermal printers
const ESC = '\x1B'
const GS = '\x1D'
const INIT = ESC + '@'
const ALIGN_LEFT = ESC + 'a' + '\x00'
const ALIGN_CENTER = ESC + 'a' + '\x01'
const ALIGN_RIGHT = ESC + 'a' + '\x02'
const BOLD_ON = ESC + 'E' + '\x01'
const BOLD_OFF = ESC + 'E' + '\x00'
const FONT_A = ESC + 'M' + '\x00' // 12x24
const FONT_B = ESC + 'M' + '\x01' // 9x17
const FONT_C = ESC + 'M' + '\x02' // 9x24
const CUT_PAPER = GS + 'V' + '\x01'
const LINE_FEED = '\x0A'
const FEED_LINES = (n: number) => ESC + 'd' + String.fromCharCode(n)

export class BluetoothPrint {
  private static device: BluetoothDevice | null = null
  private static supported: boolean = false
  private static characteristic: BluetoothRemoteGATTCharacteristic | null = null

  // Check if Bluetooth printing is supported
  static async checkSupport(): Promise<boolean> {
    try {
      // Check Web Bluetooth API
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        this.supported = true
        return true
      }

      // Check for Capacitor Bluetooth plugin
      const w = window as unknown as { Capacitor?: { getPlatform(): string }; BluetoothPrinter?: unknown }
      if (w.Capacitor && w.BluetoothPrinter) {
        this.supported = true
        return true
      }

      return false
    } catch {
      return false
    }
  }

  // Scan for Bluetooth printers
  static async scanForPrinters(): Promise<BluetoothDevice[]> {
    const devices: BluetoothDevice[] = []

    try {
      // Try Web Bluetooth API
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        const bt = navigator.bluetooth as Bluetooth & {
          requestDevice(options: { filters: Array<{ services: string[] }>; optionalServices: string[] }): Promise<BluetoothDevice>
        }

        // Request device with printer services
        const device = await bt.requestDevice({
          filters: [
            { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common printer service
            { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },  // Another printer service
          ],
          optionalServices: ['device_information']
        })

        if (device) {
          const dev = device as unknown as { name?: string; id: string }
          devices.push({
            name: dev.name || 'Unknown Printer',
            address: dev.id,
            connected: false
          })
        }
      }

      // Fallback: return empty list if no Bluetooth support
      return devices

    } catch (error) {
      console.error('[BluetoothPrint] Scan failed:', error)
      
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        toast.info('No Bluetooth printers found nearby')
      } else {
        toast.error('Bluetooth scan failed: ' + (error as Error).message)
      }
      
      return devices
    }
  }

  // Connect to printer
  static async connect(address: string): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
        throw new Error('Bluetooth not supported')
      }

      const bt = navigator.bluetooth as Bluetooth & {
        requestDevice(options: { filters: Array<{ name?: string }>; optionalServices: string[] }): Promise<BluetoothDevice>
      }

      const device = await bt.requestDevice({
        filters: [{ name: address }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      })

      const dev = device as unknown as {
        gatt?: { connect(): Promise<BluetoothRemoteGATTServer> }
      }

      if (!dev.gatt) {
        throw new Error('Device does not support GATT')
      }

      const server = await dev.gatt.connect()
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
      this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb')

      this.device = {
        name: (device as unknown as { name?: string }).name || 'Printer',
        address,
        connected: true
      }

      toast.success('Connected to printer: ' + this.device.name)
      return true

    } catch (error) {
      console.error('[BluetoothPrint] Connection failed:', error)
      toast.error('Failed to connect: ' + (error as Error).message)
      return false
    }
  }

  // Disconnect from printer
  static async disconnect(): Promise<void> {
    this.device = null
    this.characteristic = null
    toast.info('Printer disconnected')
  }

  // Get connected device
  static getConnectedDevice(): BluetoothDevice | null {
    return this.device
  }

  // Print text
  static async printText(text: string, options?: {
    align?: 'left' | 'center' | 'right'
    bold?: boolean
    font?: 'A' | 'B' | 'C'
    lines?: number
  }): Promise<boolean> {
    try {
      if (!this.characteristic) {
        throw new Error('No printer connected')
      }

      let command = INIT

      // Set alignment
      switch (options?.align) {
        case 'center':
          command += ALIGN_CENTER
          break
        case 'right':
          command += ALIGN_RIGHT
          break
        default:
          command += ALIGN_LEFT
      }

      // Set font
      switch (options?.font) {
        case 'B':
          command += FONT_B
          break
        case 'C':
          command += FONT_C
          break
        default:
          command += FONT_A
      }

      // Bold
      if (options?.bold) {
        command += BOLD_ON
      }

      // Add text
      command += text + LINE_FEED

      // Reset bold
      if (options?.bold) {
        command += BOLD_OFF
      }

      // Feed lines
      if (options?.lines) {
        command += FEED_LINES(options.lines)
      }

      // Send to printer
      const encoder = new TextEncoder()
      await this.characteristic.writeValue(encoder.encode(command))

      return true

    } catch (error) {
      console.error('[BluetoothPrint] Print failed:', error)
      toast.error('Print failed: ' + (error as Error).message)
      return false
    }
  }

  // Print student report formatted for thermal printer
  static async printStudentReport(report: {
    studentName: string
    className: string
    term: string
    year: string
    subjects: Array<{ name: string; marks: number; grade: string; remarks: string }>
    total: number
    average: number
    grade: string
    division: string
    position: string
  }): Promise<boolean> {
    try {
      // Header
      await this.printText('STUDENT REPORT', { align: 'center', bold: true, font: 'A' })
      await this.printText('------------------------------', { align: 'center' })
      await this.printText('')

      // Student info
      await this.printText(`Name: ${report.studentName}`, { align: 'left' })
      await this.printText(`Class: ${report.className}`, { align: 'left' })
      await this.printText(`Term: ${report.term}`, { align: 'left' })
      await this.printText(`Year: ${report.year}`, { align: 'left' })
      await this.printText('')

      // Subjects header
      await this.printText('SUBJECTS:', { bold: true })
      await this.printText('------------------------------', { align: 'center' })

      // Subjects
      for (const subject of report.subjects) {
        const line = `${subject.name.substring(0, 12).padEnd(12)} ${String(subject.marks).padStart(3)} ${subject.grade}`
        await this.printText(line)
      }

      await this.printText('------------------------------', { align: 'center' })

      // Summary
      await this.printText(`Total: ${report.total}`, { bold: true })
      await this.printText(`Average: ${report.average.toFixed(1)}%`)
      await this.printText(`Grade: ${report.grade}`)
      await this.printText(`Division: ${report.division}`)
      await this.printText(`Position: ${report.position}`)
      await this.printText('')

      // Footer
      await this.printText('------------------------------', { align: 'center' })
      await this.printText('Printed by Shulea App', { align: 'center', font: 'B' })
      await this.printText(new Date().toLocaleDateString(), { align: 'center', font: 'B' })

      // Cut paper
      await this.cutPaper()

      toast.success('Report printed successfully')
      return true

    } catch (error) {
      console.error('[BluetoothPrint] Report print failed:', error)
      toast.error('Failed to print report')
      return false
    }
  }

  // Cut paper
  static async cutPaper(): Promise<boolean> {
    try {
      if (!this.characteristic) {
        throw new Error('No printer connected')
      }

      const encoder = new TextEncoder()
      await this.characteristic.writeValue(encoder.encode(CUT_PAPER))
      return true

    } catch (error) {
      console.error('[BluetoothPrint] Cut paper failed:', error)
      return false
    }
  }

  // Print marksheet for class
  static async printMarksheet(className: string, students: Array<{
    name: string
    subjects: number[]
    total: number
    average: number
    grade: string
    position: number
  }>, subjectNames: string[]): Promise<boolean> {
    try {
      // Header
      await this.printText('CLASS MARKSHEET', { align: 'center', bold: true })
      await this.printText(className, { align: 'center', bold: true })
      await this.printText('===========================', { align: 'center' })
      await this.printText('')

      // Compact subject header
      const subjHeader = subjectNames.map((s, i) => `S${i + 1}`).join(' ')
      await this.printText(`No. Name        ${subjHeader} Tot Avg Gr Pos`)
      await this.printText('------------------------------', { align: 'center' })

      // Students (compact format)
      for (let i = 0; i < students.length; i++) {
        const s = students[i]
        const name = s.name.substring(0, 10).padEnd(10)
        const subjMarks = s.subjects.map(m => String(Math.round(m)).padStart(2)).join(' ')
        const line = `${String(i + 1).padStart(2)} ${name} ${subjMarks} ${String(s.total).padStart(3)} ${String(Math.round(s.average)).padStart(2)} ${s.grade} ${String(s.position).padStart(2)}`
        await this.printText(line, { font: 'B' })
      }

      await this.printText('')
      await this.printText('===========================', { align: 'center' })
      await this.printText(`Total Students: ${students.length}`, { align: 'center', font: 'B' })
      await this.printText(new Date().toLocaleDateString(), { align: 'center', font: 'B' })

      await this.cutPaper()

      toast.success('Marksheet printed')
      return true

    } catch (error) {
      console.error('[BluetoothPrint] Marksheet print failed:', error)
      return false
    }
  }
}

// Type declarations for Web Bluetooth
declare global {
  interface BluetoothRemoteGATTServer {
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
  }

  interface BluetoothRemoteGATTCharacteristic {
    writeValue(value: BufferSource): Promise<void>
  }

  interface BluetoothDevice {
    name?: string
    id: string
    gatt?: {
      connect(): Promise<BluetoothRemoteGATTServer>
    }
  }

  interface Navigator {
    bluetooth?: Bluetooth
  }

  interface Bluetooth {
    requestDevice(options: {
      filters?: Array<{ name?: string; services?: string[] }>
      optionalServices?: string[]
    }): Promise<BluetoothDevice>
  }
}
