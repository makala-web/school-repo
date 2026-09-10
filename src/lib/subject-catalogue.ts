export type SubjectCatalogueType = 'PRIMARY' | 'SECONDARY'

export interface MasterSubjectDefinition {
  name: string
  shortName: string
  schoolType: SubjectCatalogueType
  category: 'CORE' | 'OPTIONAL' | 'RELIGIOUS' | 'LANGUAGE' | 'VOCATIONAL' | 'LIFE_SKILLS'
}

// One source for the subjects available to every Shulea school.
export const PRIMARY_MASTER_SUBJECTS: MasterSubjectDefinition[] = [
  { name: 'Kiswahili', shortName: 'KISW', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'English Language', shortName: 'ENG', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Mathematics', shortName: 'MATH', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Science', shortName: 'SCI', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Social Studies', shortName: 'SST', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Historia ya Tanzania na Maadili', shortName: 'HTM', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Jiografia na Mazingira', shortName: 'JAM', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Sanaa na Michezo', shortName: 'SAM', schoolType: 'PRIMARY', category: 'VOCATIONAL' },
  { name: 'Elimu ya Dini ya Kiislamu', shortName: 'EDK', schoolType: 'PRIMARY', category: 'RELIGIOUS' },
  { name: 'Bible Knowledge', shortName: 'BK', schoolType: 'PRIMARY', category: 'RELIGIOUS' },
  { name: 'Arabic', shortName: 'ARA', schoolType: 'PRIMARY', category: 'LANGUAGE' },
  { name: 'Chinese Language', shortName: 'CHI', schoolType: 'PRIMARY', category: 'LANGUAGE' },
  { name: 'French Language', shortName: 'FRE', schoolType: 'PRIMARY', category: 'LANGUAGE' },
  { name: 'Life Skills / Stadi za Maisha', shortName: 'LIFE', schoolType: 'PRIMARY', category: 'LIFE_SKILLS' },
  { name: 'Language and Communication', shortName: 'LCM', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Mathematics (Pre-Primary)', shortName: 'MAT-PP', schoolType: 'PRIMARY', category: 'CORE' },
  { name: 'Science and Environment', shortName: 'SCE', schoolType: 'PRIMARY', category: 'CORE' },
]

export const SECONDARY_MASTER_SUBJECTS: MasterSubjectDefinition[] = [
  { name: 'Mathematics', shortName: 'MATH', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'Additional Mathematics', shortName: 'ADD-MATH', schoolType: 'SECONDARY', category: 'OPTIONAL' },
  { name: 'Kiswahili', shortName: 'KISW', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'English Language', shortName: 'ENG', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'Arabic', shortName: 'ARA', schoolType: 'SECONDARY', category: 'LANGUAGE' },
  { name: 'French', shortName: 'FRE', schoolType: 'SECONDARY', category: 'LANGUAGE' },
  { name: 'Chinese', shortName: 'CHI', schoolType: 'SECONDARY', category: 'LANGUAGE' },
  { name: 'Literature in English', shortName: 'LIT', schoolType: 'SECONDARY', category: 'LANGUAGE' },
  { name: 'Fasihi ya Kiswahili', shortName: 'FASIHI', schoolType: 'SECONDARY', category: 'LANGUAGE' },
  { name: 'Biology', shortName: 'BIO', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'Physics', shortName: 'PHY', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'Chemistry', shortName: 'CHEM', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'Agriculture', shortName: 'AGR', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Computer Science', shortName: 'CS', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Geography', shortName: 'GEO', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'History', shortName: 'HIST', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'Historia ya Tanzania na Maadili', shortName: 'HTM', schoolType: 'SECONDARY', category: 'CORE' },
  { name: 'Bible Knowledge', shortName: 'BK', schoolType: 'SECONDARY', category: 'RELIGIOUS' },
  { name: 'Elimu ya Dini ya Kiislamu', shortName: 'EDK', schoolType: 'SECONDARY', category: 'RELIGIOUS' },
  { name: 'Business Studies', shortName: 'BUS', schoolType: 'SECONDARY', category: 'OPTIONAL' },
  { name: 'Bookkeeping', shortName: 'BKPG', schoolType: 'SECONDARY', category: 'OPTIONAL' },
  { name: 'Food and Human Nutrition', shortName: 'FHN', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Textile and Garment Construction', shortName: 'TGC', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Fine Art', shortName: 'ART', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Music', shortName: 'MUS', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Sport Studies', shortName: 'SPORT', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Theatre Arts', shortName: 'THEATRE', schoolType: 'SECONDARY', category: 'VOCATIONAL' },
  { name: 'Life Skills', shortName: 'LIFE', schoolType: 'SECONDARY', category: 'LIFE_SKILLS' },
]

export function getMasterSubjects(schoolType: SubjectCatalogueType) {
  return schoolType === 'PRIMARY' ? PRIMARY_MASTER_SUBJECTS : SECONDARY_MASTER_SUBJECTS
}

export function getMasterSubjectNames(schoolType: SubjectCatalogueType) {
  return new Set(getMasterSubjects(schoolType).map(subject => subject.name.toLowerCase()))
}
