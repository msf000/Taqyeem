export enum UserRole {
  ADMIN = 'مدير النظام',
  PRINCIPAL = 'مدير المدرسة',
  TEACHER = 'المعلم',
  EVALUATOR = 'المقيم'
}

export enum TeacherCategory {
  TEACHER = 'معلم',
  KINDERGARTEN = 'معلمة روضة',
  ACTIVITY = 'معلم مسند له نشاط طلابي',
  HEALTH = 'معلم مسند له توجيه صحي',
  LAB = 'محضر مختبر',
  COUNSELOR = 'موجه طلابي',
  DEPUTY = 'وكيل مدرسة',
  MANAGER = 'مدير مدرسة'
}

export enum EvaluationStatus {
  NOT_EVALUATED = 'لم يتم التقييم',
  DRAFT = 'مسودة',
  COMPLETED = 'مقيم'
}

export interface School {
  id: string;
  name: string;
  stage: string;
  type: string;
  ministryId: string;
  managerName: string;
  evaluatorName: string;
}

export interface Teacher {
  id: string;
  nationalId: string;
  name: string;
  specialty: string;
  category: TeacherCategory;
  schoolId: string;
  status: EvaluationStatus;
  mobile: string;
}

export interface ImportResult {
  row: number;
  nationalId: string;
  name: string;
  specialty: string;
  mobile: string;
  addedBy: string;
  status: 'success' | 'failed';
  message?: string;
}

export interface RubricLevel {
  description: string;
  evidence: string;
}

export interface EvaluationIndicator {
  id: string;
  text: string;
  weight: number; 
  description: string;
  evaluationCriteria: string[]; // Detailed breakdown of the indicator
  verificationIndicators: string[]; // List of documents/records to verify
  rubric: Record<number, RubricLevel>; // 1 to 5
}

export interface EvaluationScore {
  indicatorId: string;
  level: number; // 1-5
  score: number; // Calculated based on weight
  subScores?: number[]; // Array of scores corresponding to criteria indices
  evidence: string;
  notes: string;
  improvement: string;
  isComplete: boolean;
}

export interface EvaluationData {
  id: string;
  teacherId: string;
  periodName: string;
  date: string;
  scores: Record<string, EvaluationScore>;
  status: EvaluationStatus;
  generalNotes: string;
  evaluatorName: string;
  managerName: string;
}