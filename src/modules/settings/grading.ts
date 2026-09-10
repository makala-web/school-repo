import type { SchoolType } from '@/types'

export interface DefaultGradingConfig {
  schoolType: SchoolType
  grade: string
  minMark: number
  maxMark: number
  remarks: string
  points?: number | null
  division?: string | null
}

const PRIMARY_GRADING_DEFAULTS: DefaultGradingConfig[] = [
  { schoolType: 'PRIMARY', grade: 'A', minMark: 41, maxMark: 50, remarks: 'Excellent' },
  { schoolType: 'PRIMARY', grade: 'B', minMark: 31, maxMark: 40, remarks: 'Very Good' },
  { schoolType: 'PRIMARY', grade: 'C', minMark: 21, maxMark: 30, remarks: 'Good' },
  { schoolType: 'PRIMARY', grade: 'D', minMark: 11, maxMark: 20, remarks: 'Satisfactory' },
  { schoolType: 'PRIMARY', grade: 'E', minMark: 0, maxMark: 10, remarks: 'Poor' },
]

const SECONDARY_GRADING_DEFAULTS: DefaultGradingConfig[] = [
  { schoolType: 'SECONDARY', grade: 'A', minMark: 75, maxMark: 100, remarks: 'Excellent', points: 1, division: 'I' },
  { schoolType: 'SECONDARY', grade: 'B', minMark: 65, maxMark: 74, remarks: 'Very Good', points: 2, division: 'II' },
  { schoolType: 'SECONDARY', grade: 'C', minMark: 45, maxMark: 64, remarks: 'Good', points: 3, division: 'III' },
  { schoolType: 'SECONDARY', grade: 'D', minMark: 30, maxMark: 44, remarks: 'Satisfactory', points: 4, division: 'IV' },
  { schoolType: 'SECONDARY', grade: 'F', minMark: 0, maxMark: 29, remarks: 'Fail', points: 5, division: '0' },
]

export function getDefaultGradingConfigs(schoolType: SchoolType): DefaultGradingConfig[] {
  return schoolType === 'PRIMARY' ? PRIMARY_GRADING_DEFAULTS : SECONDARY_GRADING_DEFAULTS
}
