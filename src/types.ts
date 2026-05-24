export interface Registration {
  id: string; // matches tracking_id
  full_name: string;
  age: number;
  sex: 'Male' | 'Female';
  promoted_grade: number; // 9, 10, 11, 12, etc. (usually 10, 11, 12 as per analytics)
  average: number; // Last Year Average
  transcript_url: string;
  receipt_url: string;
  payment_method: 'CBE' | 'SINQEE BANK' | 'TELEBIRR';
  status: 'Pending Review' | 'Approved' | 'Rejected';
  class_assignment: string | null; // e.g., '10A', '11C', etc.
  rejection_reason: string | null;
  tracking_id: string; // Unique tracking ID used to retrieve registration
  created_at: string; // ISO string or timestamp string
}

export interface GradeSetting {
  grade: string; // "10", "11", "12"
  students_per_class: number;
}

export interface Class {
  id: string; // e.g., "10A"
  grade: string;
  class_name: string; // "10A"
  class_type: 'Special' | 'Regular';
  total_students: number;
}

export interface AdminLog {
  action: string;
  timestamp: string;
  ip_address: string;
}

export interface GradeAnalytics {
  grade: string;
  totalStudents: number;
  approvedStudents: number;
  maleCount: number;
  femaleCount: number;
  numberOfClasses: number;
}

export interface DashboardStats {
  totalStudents: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  gradeStats: { [grade: string]: GradeAnalytics };
}
