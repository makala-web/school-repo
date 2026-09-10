// Repository barrel exports
// All database access should go through these repositories

export { StudentRepository, type CreateStudentInput, type UpdateStudentInput, type StudentFilters } from './StudentRepository'
export { ClassRepository, type CreateClassInput, type UpdateClassInput, type ClassWithDetails } from './ClassRepository'
export { SchoolRepository, type CreateSchoolInput, type UpdateSchoolInput, type SchoolWithCounts } from './SchoolRepository'
export { SubjectRepository, type CreateSubjectInput, type UpdateSubjectInput, type SubjectWithClasses } from './SubjectRepository'
export { ExamRepository, type CreateExamInput, type UpdateExamInput, type ExamWithDetails } from './ExamRepository'
export { MarksRepository, type CreateMarksInput, type UpdateMarksInput, type MarksFilters } from './MarksRepository'
export { UserRepository, type CreateUserInput, type UpdateUserInput } from './UserRepository'
export { TabiaRepository, type CreateTabiaInput, type UpdateTabiaInput, type TabiaFilters } from './TabiaRepository'
export { ResultsRepository, type CreateResultInput, type UpdateResultInput, type ResultFilters } from './ResultsRepository'
