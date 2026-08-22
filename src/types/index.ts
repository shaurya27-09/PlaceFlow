export type Branch = 'CSE' | 'IT' | 'ECE' | 'EE' | 'ME' | 'Civil';

export type PlacementStatus = 'Unplaced' | 'Placed' | 'Dream Placed' | 'Higher Studies' | 'Opted Out';

export type CompanyTier = 'Mass' | 'Core' | 'Dream' | 'Super Dream';

export type DriveStatus = 'Draft' | 'Active' | 'Ongoing' | 'Upcoming' | 'Completed' | 'Cancelled';

export type ApplicationStatus = 'Applied' | 'Shortlisted' | 'Interview' | 'Offered' | 'Selected' | 'Rejected' | 'Offer Accepted' | 'Offer Declined';

export type OfferStatus = 'Offered' | 'Accepted' | 'Rejected' | 'Withdrawn' | 'Pending' | 'Declined' | 'Revoked' | 'Blocked by Policy';

export type UserRole = 'admin' | 'student' | 'recruiter';

export interface UserProfile {
  id: string; // auth.users UUID
  email: string;
  role: UserRole;
  student_id: string | null;
  company_id: string | null;
  created_at?: string;
}

export interface StudentOfferSummary {
  offerId: string;
  companyName: string;
  role: string;
  packageLPA: number;
  status: OfferStatus;
  offerDate: string;
}

export interface Student {
  id: string;
  name: string;
  enrollmentNumber: string;
  email: string;
  phone: string;
  branch: Branch;
  cgpa: number;
  backlogs: number;
  attendance: number; // percentage e.g. 82
  placementStatus: PlacementStatus;
  offers: StudentOfferSummary[];
  graduationYear: number;
  skills: string[];
  resumeUrl?: string;
  gender?: 'Male' | 'Female' | 'Other';
  avatar?: string;
  user_id?: string;
  created_by?: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  tier: CompanyTier;
  openDrivesCount: number;
  averagePackage: number; // LPA
  minPackage: number;
  maxPackage: number;
  status: 'Active' | 'Upcoming' | 'Past Partner';
  website: string;
  location: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  totalHiredHistory: number;
  logo: string;
  company_name?: string;
  created_at?: string;
  user_id?: string;
  created_by?: string;
}

export interface PlacementDrive {
  id: string;
  companyId: string;
  companyName: string;
  companyLogo: string;
  role: string;
  jobDescription: string;
  packageLPA: number;
  offer_limit_lpa?: number;
  tier: CompanyTier;
  minCgpa: number;
  maxBacklogs: number;
  eligibleBranches: Branch[];
  minAttendance: number; // percentage
  graduationYear: number;
  offerPolicyRule: 'No Restrictions' | 'Max 1 Offer' | 'Dream Upgrade Only (>= 1.5x)' | 'Must have <= 6 LPA' | 'Strict Single Offer' | string;
  driveDate: string;
  registrationDeadline: string;
  location: 'On-Campus' | 'Virtual' | 'Hybrid';
  status: DriveStatus;
  rounds: string[];
  eligibleCount?: number;
  applicationsCount?: number;
  user_id?: string;
  created_by?: string;
}

export interface EligibilityEvaluation {
  eligible: boolean;
  isEligible: boolean;
  reason: string;
  reasons: string[];
  criteriaStatus: {
    cgpaPassed: boolean;
    cgpaDiff: number;
    backlogsPassed: boolean;
    attendancePassed: boolean;
    branchPassed: boolean;
    graduationYearPassed?: boolean;
    policyPassed?: boolean;
  };
}

export interface Application {
  id: string;
  studentId: string;
  studentName: string;
  studentEnrollment: string;
  studentBranch: Branch;
  studentCgpa: number;
  studentAttendance: number;
  driveId: string;
  companyName: string;
  companyLogo: string;
  role: string;
  packageLPA: number;
  appliedDate: string;
  eligibilityStatus: 'Eligible' | 'Conditionally Eligible' | 'Ineligible';
  ineligibilityReasons?: string[];
  status: ApplicationStatus;
  currentRound?: string;
  interviewSlot?: string;
  feedback?: string;
  user_id?: string;
  created_by?: string;
}

export interface Offer {
  id: string;
  studentId: string;
  studentName: string;
  studentEnrollment: string;
  studentBranch: Branch;
  driveId?: string;
  companyId: string;
  companyName: string;
  companyLogo: string;
  role: string;
  packageLPA: number;
  offerDate: string;
  status: OfferStatus;
  policyCheckPassed?: boolean;
  policyViolationReason?: string;
  tier?: CompanyTier;
  deadlineDate?: string;
  bondYears?: number;
  user_id?: string;
  created_by?: string;
}

export interface OfferPolicyConfig {
  allowMultipleOffers: boolean;
  maxOffersAllowed: number;
  dreamThresholdLPA: number; // e.g. 6 LPA
  superDreamThresholdLPA: number; // e.g. 12 LPA
  minHikePercentageForUpgrade: number; // e.g. 50%
  freezeOnAcceptance: boolean;
  massRecruiterLock: boolean;
}

export interface NirfReportData {
  academicYear: string;
  totalGraduatingStudents: number;
  placedStudentsCount: number;
  placementPercentage: number;
  higherStudiesCount: number;
  entrepreneurshipCount: number;
  internshipsCount: number;
  highestPackageLPA: number;
  averagePackageLPA: number;
  medianPackageLPA: number;
  recruitingCompaniesCount: number;
  branchWise: {
    branch: Branch;
    total: number;
    placed: number;
    higherStudies: number;
    medianLPA: number;
    averageLPA: number;
  }[];
  salaryBands: {
    band: string;
    count: number;
    percentage: number;
  }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedAction?: {
    label: string;
    actionType: 'navigate' | 'filter' | 'view';
    payload: string;
  };
  dataCard?: {
    title: string;
    items: { label: string; value: string | number }[];
    type?: 'stat' | 'list' | 'alert';
  };
}

export interface PlacementKPIs {
  totalStudents: number;
  placedStudents: number;
  placementPercentage: number;
  averagePackage: number;
  medianPackage: number;
  highestPackage: number;
  totalOffers: number;
  dreamOffersCount: number;
  superDreamOffersCount: number;
  companiesVisited: number;
  activeDrives: number;
}

export interface BranchStatItem {
  branch: Branch | string;
  total: number;
  placed: number;
  placementRate: number;
  avgPackage: number;
}

export interface CtcDistributionItem {
  range: string;
  count: number;
  color: string;
}

export interface YearlyTrendItem {
  year: string;
  totalPlaced: number;
  averagePackage: number;
  placementPercentage: number;
}

export interface NirfTableRow {
  academicYear: string;
  approvedIntake: number;
  firstYearAdmitted: number;
  graduatingYear: string;
  graduatedStipulatedTime: number;
  studentsPlaced: number;
  medianSalaryLPA: number;
  studentsHigherStudies: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

