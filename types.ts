
export enum UserRole {
  ADMIN = 'مدير النظام',
  PRINCIPAL = 'مدير المدرسة',
  TEACHER = 'المعلم',
  EVALUATOR = 'المقيم'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  nationalId?: string; // Added field
  schoolId?: string;
  schoolName?: string;
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
  educationOffice?: string; // Added
  academicYear?: string; // Added
  managerName: string;
  managerNationalId?: string; // Added field
  evaluatorName: string;
}

export interface Teacher {
  id: string;
  nationalId: string;
  name: string;
  specialty: string;
  category: TeacherCategory;
  role?: UserRole; 
  roles?: UserRole[]; // New field for multiple roles support
  schoolId: string;
  status: EvaluationStatus;
  mobile: string;
  password?: string;
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
  applicableCategories?: TeacherCategory[]; // Filter by teacher category
  categoryWeights?: Record<string, number>; // Specific weights per category
}

export interface EvaluationScore {
  indicatorId: string;
  level: number; // 1-5 (Likert Scale Input)
  score: number; // Calculated Weighted Score
  subScores?: Record<number, number>; // Index of criteria -> Score (1-5)
  evidence: string;
  notes: string;
  improvement: string; // Opportunities for improvement
  strengths?: string; // Points of strength (New Field)
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
  objectionText?: string;
  objectionStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
  teacherEvidenceLinks?: { indicatorId: string, url: string, description: string }[];
}

export interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  password?: string;
  school_id?: string;
  created_at?: string;
}

export interface Subscription {
  id: string;
  school_id: string;
  school_name?: string; // For display
  plan_name: 'Basic' | 'Premium' | 'Enterprise';
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'pending';
  price: number;
}

export interface SchoolEvent {
  id: string;
  name: string;
  type: 'evaluation' | 'audit' | 'objection' | 'other';
  start_date: string;
  end_date: string;
  status: 'active' | 'upcoming' | 'closed';
  description: string;
  schoolId?: string; // Added schoolId
}
