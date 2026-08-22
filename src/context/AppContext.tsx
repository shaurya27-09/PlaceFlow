import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { generateUUID, isValidUUID } from '../lib/uuid';
import {
  Student,
  Company,
  PlacementDrive,
  Application,
  Offer,
  OfferPolicyConfig,
  UserRole,
  UserProfile,
  ToastMessage,
  EligibilityEvaluation,
  ApplicationStatus,
  OfferStatus,
  PlacementKPIs,
  BranchStatItem,
  CtcDistributionItem,
  YearlyTrendItem,
  NirfTableRow,
  Branch,
  PlacementStatus
} from '../types';
import {
  initialStudents,
  initialCompanies,
  initialDrives,
  initialApplications,
  initialOffers,
  defaultOfferPolicyConfig
} from '../data/mockData';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  testSupabaseConnection,
  fetchAllFromSupabase,
  fetchStudentsFromSupabase,
  fetchCompaniesFromSupabase,
  fetchDrivesFromSupabase,
  addStudentToSupabase,
  updateStudentInSupabase,
  deleteStudentFromSupabase,
  addCompanyToSupabase,
  updateCompanyInSupabase,
  deleteCompanyFromSupabase,
  addDriveToSupabase,
  updateDriveInSupabase,
  deleteDriveFromSupabase,
  seedInitialDataToSupabase,
  upsertStudentToSupabase,
  upsertCompanyToSupabase,
  upsertDriveToSupabase,
  upsertApplicationToSupabase,
  addApplicationToSupabase,
  updateApplicationInSupabase,
  checkStudentEligibilityForDriveInDb,
  fetchApplicationsJoinedFromSupabase,
  upsertOfferToSupabase,
  updateOfferStatusInSupabase,
  upsertPolicyToSupabase,
  fetchUserProfile
} from '../lib/supabase';
import {
  checkEligibility,
  StudentEligibilityData,
  DriveEligibilityCriteria,
  EligibilityResult
} from '../lib/eligibilityEngine';
import {
  checkOfferPolicy,
  OfferPolicyEvaluation
} from '../lib/offerPolicyEngine';

interface AppContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Supabase Auth & Profile States
  currentUser: any | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Role & Navigation
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  activeStudentId: string | null;
  setActiveStudentId: (id: string | null) => void;
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  activeStudent: Student | undefined;

  // Supabase Database States
  isSupabaseConfigured: boolean;
  supabaseConnected: boolean;
  isSyncing: boolean;
  testConnection: () => Promise<{ success: boolean; message: string }>;
  syncAllToSupabase: () => Promise<void>;
  pullFromSupabase: () => Promise<void>;
  fetchStudents: () => Promise<Student[]>;
  fetchCompanies: () => Promise<Company[]>;
  fetchDrives: () => Promise<PlacementDrive[]>;

  // Data collections
  students: Student[];
  companies: Company[];
  drives: PlacementDrive[];
  applications: Application[];
  offers: Offer[];
  offerPolicy: OfferPolicyConfig;
  toasts: ToastMessage[];

  // Computed Analytics & Institutional Compliance
  kpis: PlacementKPIs;
  branchStats: BranchStatItem[];
  ctcDistribution: CtcDistributionItem[];
  yearlyTrends: YearlyTrendItem[];
  nirfData: NirfTableRow[];

  // Selected state for deep linking/modals
  selectedDriveForEligibility: PlacementDrive | null;
  setSelectedDriveForEligibility: (drive: PlacementDrive | null) => void;
  selectedStudentForDetail: Student | null;
  setSelectedStudentForDetail: (student: Student | null) => void;

  // Actions
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  addStudent: (studentData: Omit<Student, 'id' | 'offers'>) => Promise<void>;
  updateStudent: (id: string, partial: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addCompany: (companyData: Partial<Company> & Record<string, any>) => Promise<void>;
  updateCompany: (id: string, partial: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  addDrive: (driveData: Omit<PlacementDrive, 'id' | 'applicationsCount' | 'eligibleCount'>) => Promise<PlacementDrive>;
  updateDrive: (id: string, partial: Partial<PlacementDrive>) => Promise<void>;
  deleteDrive: (id: string) => Promise<void>;
  applyToDrive: (studentId: string, driveId: string) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  updateApplicationStatus: (appId: string, newStatus: ApplicationStatus, currentRound?: string) => Promise<void> | void;
  acceptOffer: (offerId: string) => void;
  declineOffer: (offerId: string) => void;
  createOffer: (offerData: Omit<Offer, 'id'>) => void;
  updateOfferStatus: (offerId: string, newStatus: OfferStatus) => Promise<void> | void;
  updateOfferPolicy: (newConfig: Partial<OfferPolicyConfig>) => void;

  // Rule Engines
  checkEligibility: (student: StudentEligibilityData, criteria: DriveEligibilityCriteria) => EligibilityResult;
  checkOfferPolicy: (student: Student, drive: PlacementDrive) => OfferPolicyEvaluation;
  evaluateEligibility: (student: Student, drive: PlacementDrive) => EligibilityEvaluation;
  checkOfferPolicyCompliance: (student: Student, prospectivePackageLPA: number) => { allowed: boolean; reason?: string };
  getEligibleStudentsForDrive: (drive: PlacementDrive) => { eligible: Student[]; ineligible: { student: Student; reasons: string[] }[] };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('placeflow_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Supabase Auth & Profile States
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Current view and role
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [currentView, setCurrentView] = useState<string>('landing');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Interactive state
  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem('placeflow_students');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((s: any) => ({
            ...s,
            skills: s.skills || [],
            offers: s.offers || [],
            backlogs: s.backlogs ?? 0,
            attendance: s.attendance ?? 75,
            cgpa: s.cgpa ?? 0
          }));
        }
      }
    } catch {
      // fallback
    }
    return initialStudents;
  });

  const [companies, setCompanies] = useState<Company[]>(() => {
    try {
      const saved = localStorage.getItem('placeflow_companies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return initialCompanies;
  });

  const [drives, setDrives] = useState<PlacementDrive[]>(() => {
    try {
      const saved = localStorage.getItem('placeflow_drives');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((d: any) => ({
            ...d,
            eligibleBranches: d.eligibleBranches || ['CSE', 'IT']
          }));
        }
      }
    } catch {}
    return initialDrives;
  });

  const [applications, setApplications] = useState<Application[]>(() => {
    try {
      const saved = localStorage.getItem('placeflow_applications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return initialApplications;
  });

  const [offers, setOffers] = useState<Offer[]>(() => {
    try {
      const saved = localStorage.getItem('placeflow_offers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return initialOffers;
  });

  const [offerPolicy, setOfferPolicy] = useState<OfferPolicyConfig>(() => {
    const saved = localStorage.getItem('placeflow_offer_policy');
    return saved ? JSON.parse(saved) : defaultOfferPolicyConfig;
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedDriveForEligibility, setSelectedDriveForEligibility] = useState<PlacementDrive | null>(null);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);

  // Supabase Database States
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Derive active student strictly from activeStudentId
  const activeStudent = activeStudentId
    ? students.find(s => s.id === activeStudentId) || (currentRole === 'student' && userProfile ? {
        id: activeStudentId,
        name: userProfile.email ? userProfile.email.split('@')[0] : 'Student',
        enrollmentNumber: activeStudentId,
        email: userProfile.email,
        phone: '',
        branch: 'CSE' as Branch,
        cgpa: 0,
        backlogs: 0,
        attendance: 75,
        placementStatus: 'Unplaced' as PlacementStatus,
        offers: [],
        graduationYear: 2026,
        skills: []
      } : undefined)
    : undefined;

  // Helper to resolve user profile from database with intelligent fallback
  const resolveProfile = async (authUser: any): Promise<UserProfile> => {
    try {
      const { profile } = await fetchUserProfile(authUser.id);
      if (profile) return profile;
    } catch (e) {
      console.warn('Could not fetch profile from public.profiles table:', e);
    }

    // Determine role from auth metadata or email patterns
    const metaRole = authUser.user_metadata?.role as UserRole | undefined;
    const metaStudentId = authUser.user_metadata?.student_id;
    const metaCompanyId = authUser.user_metadata?.company_id;

    const emailStr = (authUser.email || '').toLowerCase();
    const matchedStudent = (students || []).find(s => s.email?.toLowerCase() === emailStr);

    let determinedRole: UserRole = metaRole || 'admin';
    if (!metaRole) {
      if (emailStr.includes('admin') || emailStr.includes('tpo') || emailStr.includes('officer')) {
        determinedRole = 'admin';
      } else if (emailStr.includes('recruiter') || emailStr.includes('hr') || emailStr.includes('campus') || emailStr.includes('company')) {
        determinedRole = 'recruiter';
      } else if (matchedStudent || emailStr.includes('student') || emailStr.includes('.std')) {
        determinedRole = 'student';
      } else {
        determinedRole = 'admin';
      }
    }

    const fallbackProfile: UserProfile = {
      id: authUser.id,
      email: authUser.email || '',
      role: determinedRole,
      student_id: metaStudentId || matchedStudent?.id || (determinedRole === 'student' ? 'std-1' : null),
      company_id: metaCompanyId || (determinedRole === 'recruiter' ? 'comp-1' : null),
      created_at: new Date().toISOString()
    };

    // Attempt to lazily write profile to public.profiles if table exists
    try {
      const client = getSupabaseClient();
      if (client) {
        await client.from('profiles').upsert({
          id: fallbackProfile.id,
          email: fallbackProfile.email,
          role: fallbackProfile.role,
          student_id: fallbackProfile.student_id,
          company_id: fallbackProfile.company_id
        });
      }
    } catch (_) {
      // Non-fatal if profiles table doesn't exist
    }

    return fallbackProfile;
  };

  // Supabase Auth Session Initialization & Auth State Synchronization
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const client = getSupabaseClient();
      if (!client) {
        setIsLoadingAuth(false);
        return;
      }

      try {
        const { data } = await client.auth.getSession();
        const session = data?.session;
        if (session?.user && isMounted) {
          const profile = await resolveProfile(session.user);
          if (isMounted) {
            setCurrentUser(session.user);
            setUserProfile(profile);
            setCurrentRole(profile.role);
            if (profile.role === 'student') {
              setActiveStudentId(profile.student_id || 'std-1');
              setSelectedCompanyId(null);
              setCurrentView(prev => (prev === 'landing' || prev === 'login' ? 'student-portal' : prev));
            } else if (profile.role === 'recruiter') {
              setSelectedCompanyId(profile.company_id || 'comp-1');
              setActiveStudentId(null);
              setCurrentView(prev => (prev === 'landing' || prev === 'login' ? 'recruiter-portal' : prev));
            } else if (profile.role === 'admin') {
              setActiveStudentId(null);
              setSelectedCompanyId(null);
              setCurrentView(prev => (prev === 'landing' || prev === 'login' ? 'dashboard' : prev));
            }
          }
        }
      } catch (err) {
        console.error('Session restoration error:', err);
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    restoreSession();

    const client = getSupabaseClient();
    let subscription: { unsubscribe: () => void } | null = null;
    if (client) {
      const { data } = client.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await resolveProfile(session.user);
          if (isMounted) {
            setCurrentUser(session.user);
            setUserProfile(profile);
            setCurrentRole(profile.role);
            if (profile.role === 'student') {
              setActiveStudentId(profile.student_id || 'std-1');
              setSelectedCompanyId(null);
              setCurrentView('student-portal');
            } else if (profile.role === 'recruiter') {
              setSelectedCompanyId(profile.company_id || 'comp-1');
              setActiveStudentId(null);
              setCurrentView('recruiter-portal');
            } else if (profile.role === 'admin') {
              setActiveStudentId(null);
              setSelectedCompanyId(null);
              setCurrentView('dashboard');
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setUserProfile(null);
          setActiveStudentId(null);
          setSelectedCompanyId(null);
          setCurrentView('login');
        }
      });
      subscription = data.subscription;
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Real Supabase Login
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        error: 'Supabase client is not configured. Please check your Supabase credentials in settings.'
      };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error || !data?.user) {
        // Return the exact descriptive error from Supabase Auth
        const errorMsg = error?.message || 'Invalid email or password.';
        if (errorMsg.toLowerCase().includes('email not confirmed')) {
          return {
            success: false,
            error: 'Email not confirmed. Please confirm the user email in Supabase Dashboard -> Authentication -> Users.'
          };
        }
        return {
          success: false,
          error: errorMsg
        };
      }

      const authUser = data.user;
      const profile = await resolveProfile(authUser);

      // Authoritative role from profile
      setCurrentUser(authUser);
      setUserProfile(profile);
      setCurrentRole(profile.role);

      if (profile.role === 'admin') {
        setActiveStudentId(null);
        setSelectedCompanyId(null);
        setCurrentView('dashboard');
        addToast('Welcome Administrator', `Logged in as ${profile.email}`, 'success');
      } else if (profile.role === 'student') {
        setActiveStudentId(profile.student_id || 'std-1');
        setSelectedCompanyId(null);
        setCurrentView('student-portal');
        addToast('Welcome Student', `Logged in as ${profile.email}`, 'success');
      } else if (profile.role === 'recruiter') {
        setSelectedCompanyId(profile.company_id || 'comp-1');
        setActiveStudentId(null);
        setCurrentView('recruiter-portal');
        addToast('Welcome Corporate Partner', `Logged in as ${profile.email}`, 'success');
      }

      return { success: true };
    } catch (err: any) {
      console.error('Login exception:', err);
      return {
        success: false,
        error: err?.message || 'Authentication error. Please try again.'
      };
    }
  };

  // Real Supabase Logout
  const logout = async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('SignOut exception:', err);
      }
    }

    setCurrentUser(null);
    setUserProfile(null);
    setCurrentRole('student');
    setActiveStudentId(null);
    setSelectedCompanyId(null);
    setCurrentView('login');
    addToast('Signed Out', 'You have been signed out successfully.', 'info');
  };

  // Check Supabase connection on boot & optionally fetch remote data
  useEffect(() => {
    if (isSupabaseConfigured) {
      testSupabaseConnection().then(res => {
        setSupabaseConnected(res.success);
        if (res.success) {
          // Attempt automatic pull from Supabase
          fetchAllFromSupabase().then(data => {
            if (data.students !== undefined) {
              setStudents(data.students);
            }
            if (data.companies !== undefined) {
              setCompanies(data.companies);
            }
            if (data.drives !== undefined) {
              setDrives(data.drives);
            }
            if (data.applications !== undefined) {
              setApplications(data.applications);
            }
            if (data.offers !== undefined) {
              setOffers(data.offers);
            }
            if (data.offerPolicy) {
              setOfferPolicy(data.offerPolicy);
            }
            addToast('Supabase Connected', 'Synchronized live records from Supabase database.', 'success');
          }).catch(err => {
            console.error('Supabase auto-sync failed:', err);
          });
        }
      });
    }
  }, []);

  const testConnection = async () => {
    const res = await testSupabaseConnection();
    setSupabaseConnected(res.success);
    return res;
  };

  const syncAllToSupabase = async () => {
    if (!isSupabaseConfigured) {
      addToast('Supabase Not Configured', 'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.', 'warning');
      return;
    }
    setIsSyncing(true);
    const res = await seedInitialDataToSupabase(students, companies, drives, applications, offers, offerPolicy);
    setIsSyncing(false);
    if (res.success) {
      setSupabaseConnected(true);
      addToast('Data Synced', res.message, 'success');
    } else {
      addToast('Sync Error', res.message, 'error');
    }
  };

  const pullFromSupabase = async () => {
    if (!isSupabaseConfigured) {
      addToast('Supabase Not Configured', 'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.', 'warning');
      return;
    }
    setIsSyncing(true);
    const data = await fetchAllFromSupabase();
    setIsSyncing(false);
    if (data.error) {
      addToast('Fetch Error', data.error, 'error');
      return;
    }
    if (data.students !== undefined) setStudents(data.students);
    if (data.companies !== undefined) setCompanies(data.companies);
    if (data.drives !== undefined) setDrives(data.drives);
    if (data.applications !== undefined) setApplications(data.applications);
    if (data.offers !== undefined) setOffers(data.offers);
    if (data.offerPolicy) setOfferPolicy(data.offerPolicy);
    addToast('Data Pulled', 'Refreshed local records from Supabase database.', 'success');
  };

  // Sync theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('placeflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('placeflow_theme', 'light');
    }
  }, [darkMode]);

  // Persist state to local storage for realistic prototype testing
  useEffect(() => {
    localStorage.setItem('placeflow_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('placeflow_companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('placeflow_drives', JSON.stringify(drives));
  }, [drives]);

  useEffect(() => {
    localStorage.setItem('placeflow_applications', JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    localStorage.setItem('placeflow_offers', JSON.stringify(offers));
  }, [offers]);

  useEffect(() => {
    localStorage.setItem('placeflow_offer_policy', JSON.stringify(offerPolicy));
  }, [offerPolicy]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Rule Engine 2: Offer Policy Engine
  const evaluateOfferPolicy = (student: Student, drive: PlacementDrive): OfferPolicyEvaluation => {
    return checkOfferPolicy(student, drive, {
      allOffers: offers,
      policyConfig: offerPolicy
    });
  };

  // Rule engine 1: Deterministic Eligibility Evaluation
  const evaluateEligibility = (student: Student, drive: PlacementDrive): EligibilityEvaluation => {
    // Core deterministic evaluation: CGPA, Backlogs, Attendance, Branch
    const baseResult = checkEligibility(student, drive);
    const reasons: string[] = [...baseResult.reasons];

    // Graduation Year Check
    let graduationYearPassed = true;
    if (drive.graduationYear && student.graduationYear && student.graduationYear !== drive.graduationYear) {
      graduationYearPassed = false;
      reasons.push(`Graduation year (${student.graduationYear}) does not match batch ${drive.graduationYear}`);
    }

    // Offer Policy Check
    const offerPolicyResult = evaluateOfferPolicy(student, drive);
    const policyPassed = offerPolicyResult.allowed;
    if (!policyPassed && offerPolicyResult.reason) {
      reasons.push(offerPolicyResult.reason);
    }

    const isEligible = baseResult.eligible && graduationYearPassed && policyPassed;
    const reason = isEligible ? '' : reasons.join('. ');

    return {
      eligible: isEligible,
      isEligible,
      reason,
      reasons,
      criteriaStatus: {
        ...baseResult.criteriaStatus,
        graduationYearPassed,
        policyPassed
      }
    };
  };

  // Rule Engine 2 Backward-Compatibility: Institutional Offer Policy Compliance
  const checkOfferPolicyCompliance = (student: Student, prospectivePackageLPA: number): { allowed: boolean; reason?: string } => {
    const dummyDrive: PlacementDrive = {
      id: 'check-compliance',
      companyId: 'dummy',
      companyName: 'Prospective Employer',
      companyLogo: '',
      role: 'Candidate Role',
      jobDescription: 'Prospective candidate role',
      packageLPA: prospectivePackageLPA,
      tier: prospectivePackageLPA >= offerPolicy.superDreamThresholdLPA ? 'Super Dream' : prospectivePackageLPA >= offerPolicy.dreamThresholdLPA ? 'Dream' : 'Core',
      minCgpa: 0,
      maxBacklogs: 10,
      eligibleBranches: ['CSE', 'IT', 'ECE', 'EE', 'ME'],
      minAttendance: 0,
      graduationYear: student.graduationYear || 2026,
      offerPolicyRule: 'Dream Upgrade Only (>= 1.5x)',
      registrationDeadline: new Date().toISOString().split('T')[0],
      driveDate: new Date().toISOString().split('T')[0],
      location: 'Virtual',
      status: 'Active',
      rounds: ['Interview']
    };

    const result = evaluateOfferPolicy(student, dummyDrive);
    return {
      allowed: result.allowed,
      reason: result.reason || undefined
    };
  };

  const getEligibleStudentsForDrive = (drive: PlacementDrive) => {
    const eligible: Student[] = [];
    const ineligible: { student: Student; reasons: string[] }[] = [];

    students.forEach(student => {
      const evalResult = evaluateEligibility(student, drive);
      if (evalResult.isEligible) {
        eligible.push(student);
      } else {
        ineligible.push({ student, reasons: evalResult.reasons });
      }
    });

    return { eligible, ineligible };
  };

  const fetchStudents = async (): Promise<Student[]> => {
    if (isSupabaseConfigured) {
      const res = await fetchStudentsFromSupabase();
      if (res.data && res.data.length > 0) {
        setStudents(res.data);
        return res.data;
      }
    }
    return students;
  };

  // Student Actions
  const addStudent = async (studentData: Omit<Student, 'id' | 'offers'>) => {
    if (isSupabaseConfigured) {
      const res = await addStudentToSupabase({
        ...studentData,
        id: generateUUID(),
        offers: []
      });
      if (res.error) {
        addToast('Database Error', `Failed to create student: ${res.error}`, 'error');
        throw new Error(res.error);
      }
      if (res.data) {
        const savedStudent: Student = {
          ...studentData,
          id: String(res.data.id),
          offers: []
        };
        setStudents(prev => [savedStudent, ...prev]);
        addToast('Student Added', `${savedStudent.name} (${savedStudent.enrollmentNumber}) added successfully.`, 'success');
        return;
      }
    }

    const studentId = generateUUID();
    const newStudent: Student = {
      ...studentData,
      id: studentId,
      offers: []
    };
    setStudents(prev => [newStudent, ...prev]);
    addToast('Student Added', `${newStudent.name} (${newStudent.enrollmentNumber}) added successfully.`, 'success');
  };

  const updateStudent = async (id: string, partial: Partial<Student>) => {
    if (isSupabaseConfigured) {
      const res = await updateStudentInSupabase(id, partial);
      if (!res.success && res.error) {
        addToast('Database Error', `Failed to update student: ${res.error}`, 'error');
        throw new Error(res.error);
      }
    }

    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id === id) {
          return { ...s, ...partial };
        }
        return s;
      });
      return updated;
    });

    if (selectedStudentForDetail?.id === id) {
      setSelectedStudentForDetail(prev => prev ? { ...prev, ...partial } : null);
    }

    addToast('Student Updated', 'Student details updated successfully.', 'success');
  };

  const deleteStudent = async (id: string) => {
    const targetStudent = students.find(s => s.id === id);
    if (isSupabaseConfigured) {
      const res = await deleteStudentFromSupabase(id);
      if (!res.success && res.error) {
        addToast('Database Error', `Failed to delete student: ${res.error}`, 'error');
        throw new Error(res.error);
      }
    }

    setStudents(prev => prev.filter(s => s.id !== id));
    if (selectedStudentForDetail?.id === id) {
      setSelectedStudentForDetail(null);
    }
    addToast('Student Deleted', `${targetStudent ? targetStudent.name : 'Student'} has been removed.`, 'info');
  };

  const fetchCompanies = async (): Promise<Company[]> => {
    if (isSupabaseConfigured) {
      const res = await fetchCompaniesFromSupabase();
      if (res.data && res.data.length > 0) {
        setCompanies(res.data);
        return res.data;
      }
    }
    return companies;
  };

  // Company Actions
  const addCompany = async (companyData: Omit<Company, 'id'> | any) => {
    if (isSupabaseConfigured) {
      // Send payload to Supabase using only valid DB columns
      const res = await addCompanyToSupabase(companyData);
      if (res.error) {
        addToast('Database Error', `Failed to create company: ${res.error}`, 'error');
        throw new Error(res.error);
      }
      if (res.data) {
        const compName = res.data.company_name || res.data.name || companyData.company_name || companyData.name || 'Company';
        const savedCompany: Company = {
          id: String(res.data.id),
          name: compName,
          company_name: compName,
          industry: res.data.industry || companyData.industry || 'Technology',
          tier: companyData.tier || 'Dream',
          openDrivesCount: companyData.openDrivesCount ?? 0,
          averagePackage: parseFloat(companyData.averagePackage ?? companyData.average_package) || 0,
          minPackage: parseFloat(companyData.minPackage ?? companyData.min_package) || 0,
          maxPackage: parseFloat(companyData.maxPackage ?? companyData.max_package) || 0,
          status: res.data.status || companyData.status || 'Active',
          website: res.data.website || companyData.website || '',
          location: companyData.location || '',
          contactPerson: res.data.contact_person || res.data.contact_name || companyData.contactPerson || companyData.contact_person || '',
          contactEmail: res.data.contact_email || companyData.contactEmail || companyData.contact_email || '',
          contactPhone: res.data.contact_phone || companyData.contactPhone || companyData.contact_phone || '',
          totalHiredHistory: companyData.totalHiredHistory || 0,
          logo: companyData.logo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80',
          created_at: res.data.created_at
        };
        setCompanies(prev => [savedCompany, ...prev]);
        addToast('Company Registered', `${savedCompany.name} partner profile created.`, 'success');
        return;
      }
    }

    const companyId = generateUUID();
    const compName = companyData.company_name || companyData.name || 'Company';
    const newCompany: Company = {
      id: companyId,
      name: compName,
      company_name: compName,
      industry: companyData.industry || 'Technology',
      tier: companyData.tier || 'Dream',
      openDrivesCount: companyData.openDrivesCount ?? 0,
      averagePackage: parseFloat(companyData.averagePackage ?? companyData.average_package) || 0,
      minPackage: parseFloat(companyData.minPackage ?? companyData.min_package) || 0,
      maxPackage: parseFloat(companyData.maxPackage ?? companyData.max_package) || 0,
      status: companyData.status || 'Active',
      website: companyData.website || '',
      location: companyData.location || '',
      contactPerson: companyData.contactPerson || companyData.contact_person || '',
      contactEmail: companyData.contactEmail || companyData.contact_email || '',
      contactPhone: companyData.contactPhone || companyData.contact_phone || '',
      totalHiredHistory: companyData.totalHiredHistory || 0,
      logo: companyData.logo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80'
    };
    setCompanies(prev => [newCompany, ...prev]);
    addToast('Company Registered', `${newCompany.name} partner profile created.`, 'success');
  };

  const updateCompany = async (id: string, partial: Partial<Company>) => {
    if (isSupabaseConfigured) {
      const res = await updateCompanyInSupabase(id, partial);
      if (!res.success && res.error) {
        addToast('Database Error', `Failed to update company: ${res.error}`, 'error');
        throw new Error(res.error);
      }
    }

    setCompanies(prev => {
      const updated = prev.map(c => {
        if (c.id === id) {
          return { ...c, ...partial };
        }
        return c;
      });
      return updated;
    });

    addToast('Company Updated', 'Company details updated successfully.', 'success');
  };

  const deleteCompany = async (id: string) => {
    const targetCompany = companies.find(c => c.id === id);
    if (isSupabaseConfigured) {
      const res = await deleteCompanyFromSupabase(id);
      if (!res.success && res.error) {
        addToast('Database Error', `Failed to delete company: ${res.error}`, 'error');
        throw new Error(res.error);
      }
    }
    setCompanies(prev => prev.filter(c => c.id !== id));
    addToast('Company Removed', `${targetCompany ? targetCompany.name : 'Company'} has been removed.`, 'info');
  };

  const fetchDrives = async (): Promise<PlacementDrive[]> => {
    if (isSupabaseConfigured) {
      const res = await fetchDrivesFromSupabase();
      if (res.data && res.data.length > 0) {
        setDrives(res.data);
        return res.data;
      }
    }
    return drives;
  };

  // Drive Actions
  const addDrive = async (driveData: Omit<PlacementDrive, 'id' | 'applicationsCount' | 'eligibleCount'>): Promise<PlacementDrive> => {
    const driveId = generateUUID();
    const mockDrive: PlacementDrive = {
      ...driveData,
      id: driveId,
      applicationsCount: 0,
      eligibleCount: 0
    };

    // Calculate eligible count
    const { eligible } = getEligibleStudentsForDrive(mockDrive);
    mockDrive.eligibleCount = eligible.length;

    if (isSupabaseConfigured) {
      const res = await addDriveToSupabase(mockDrive);
      if (res.error) {
        addToast('Database Error', `Failed to create placement drive: ${res.error}`, 'error');
        throw new Error(res.error);
      }
      if (res.data?.id) {
        mockDrive.id = String(res.data.id);
      }
    }

    setDrives(prev => [mockDrive, ...prev]);
    addToast('Drive Created', `Placement drive for ${mockDrive.companyName} (${mockDrive.role}) published.`, 'success');
    return mockDrive;
  };

  const updateDrive = async (id: string, partial: Partial<PlacementDrive>) => {
    if (isSupabaseConfigured) {
      const res = await updateDriveInSupabase(id, partial);
      if (!res.success && res.error) {
        addToast('Database Error', `Failed to update placement drive: ${res.error}`, 'error');
        throw new Error(res.error);
      }
    }

    setDrives(prev => {
      const updated = prev.map(d => {
        if (d.id === id) {
          const u = { ...d, ...partial };
          return u;
        }
        return d;
      });
      return updated;
    });

    addToast('Drive Updated', 'Placement drive details updated successfully.', 'success');
  };

  const deleteDrive = async (id: string) => {
    const targetDrive = drives.find(d => d.id === id);
    if (isSupabaseConfigured) {
      const res = await deleteDriveFromSupabase(id);
      if (!res.success && res.error) {
        addToast('Database Error', `Failed to delete placement drive: ${res.error}`, 'error');
        throw new Error(res.error);
      }
    }

    setDrives(prev => prev.filter(d => d.id !== id));
    if (selectedDriveForEligibility?.id === id) {
      setSelectedDriveForEligibility(null);
    }
    addToast('Drive Removed', `Drive for ${targetDrive ? targetDrive.companyName : 'Company'} removed.`, 'info');
  };

  // Application Actions
  const applyToDrive = async (studentId: string, driveId: string): Promise<{ success: boolean; message: string }> => {
    const student = students.find(s => s.id === studentId);
    const drive = drives.find(d => d.id === driveId);

    if (!student || !drive) {
      addToast('Error', 'Student or drive record not found.', 'error');
      return { success: false, message: 'Student or drive not found' };
    }

    // 1. Check if already applied (prevent duplicate applications)
    const existing = applications.find(a => a.studentId === studentId && a.driveId === driveId);
    if (existing) {
      const msg = 'You have already applied for this placement drive.';
      addToast('Notice', msg, 'info');
      return { success: false, message: msg };
    }

    // 2. Check eligibility_results (The deterministic eligibility engine remains the source of truth)
    let isEligible = false;
    let eligibilityReasons: string[] = [];
    let isEvaluated = false;

    if (isSupabaseConfigured) {
      const dbCheck = await checkStudentEligibilityForDriveInDb(studentId, driveId);
      if (dbCheck.status === 'not_evaluated') {
        const msg = 'Eligibility has not been evaluated for this drive yet.';
        addToast('Evaluation Required', msg, 'warning');
        return { success: false, message: msg };
      } else if (dbCheck.status === 'ineligible') {
        isEligible = false;
        eligibilityReasons = dbCheck.reasons.length > 0 ? dbCheck.reasons : ['Does not meet minimum drive criteria.'];
        isEvaluated = true;
      } else if (dbCheck.status === 'eligible') {
        isEligible = true;
        isEvaluated = true;
      }
    } else {
      // Local fallback using deterministic eligibility engine
      const evaluation = evaluateEligibility(student, drive);
      isEligible = evaluation.isEligible;
      eligibilityReasons = evaluation.reasons;
      isEvaluated = true;
    }

    if (!isEvaluated) {
      const msg = 'Eligibility has not been evaluated for this drive yet.';
      addToast('Evaluation Required', msg, 'warning');
      return { success: false, message: msg };
    }

    if (!isEligible) {
      const reasonStr = eligibilityReasons.join('. ') || 'Criteria not met';
      addToast('Application Blocked', `Ineligible for ${drive.companyName}: ${reasonStr}`, 'warning');
      return { success: false, message: `You are not eligible for this placement drive. Reason: ${reasonStr}` };
    }

    // 3. Offer Policy Check
    const offerPolicyResult = evaluateOfferPolicy(student, drive);
    if (offerPolicyResult.blocked) {
      addToast('Application Blocked', `Reason: ${offerPolicyResult.reason}`, 'warning');
      return {
        success: false,
        message: `Application Blocked\n\nReason:\n${offerPolicyResult.reason}`
      };
    }

    // 4. Eligible & Evaluated: Create Application with status "Applied"
    const appId = generateUUID();
    const newApp: Application = {
      id: appId,
      studentId: student.id,
      studentName: student.name,
      studentEnrollment: student.enrollmentNumber,
      studentBranch: student.branch,
      studentCgpa: student.cgpa,
      studentAttendance: student.attendance,
      driveId: drive.id,
      companyName: drive.companyName,
      companyLogo: drive.companyLogo,
      role: drive.role,
      packageLPA: drive.packageLPA,
      appliedDate: new Date().toISOString().split('T')[0],
      eligibilityStatus: 'Eligible',
      status: 'Applied',
      currentRound: drive.rounds?.[0] || 'Application Review'
    };

    setApplications(prev => [newApp, ...prev]);

    if (isSupabaseConfigured) {
      const res = await addApplicationToSupabase(newApp);
      if (res.data?.id && res.data.id !== appId) {
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, id: res.data!.id } : a));
      }
      if (res.error) {
        console.error('Supabase application creation error:', res.error);
      }
    }

    // increment drive applicationsCount
    setDrives(prev => prev.map(d => {
      if (d.id === driveId) {
        const u = { ...d, applicationsCount: (d.applicationsCount || 0) + 1 };
        if (isSupabaseConfigured) upsertDriveToSupabase(u);
        return u;
      }
      return d;
    }));

    addToast('Application Submitted!', `Successfully applied for ${drive.companyName} - ${drive.role}`, 'success');
    return { success: true, message: 'Application submitted successfully!' };
  };

  const updateApplicationStatus = async (appId: string, newStatus: ApplicationStatus, currentRound?: string) => {
    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        const u = {
          ...app,
          status: newStatus,
          currentRound: currentRound || app.currentRound
        };
        return u;
      }
      return app;
    }));

    if (isSupabaseConfigured) {
      const res = await updateApplicationInSupabase(appId, {
        status: newStatus,
        currentRound
      });
      if (!res.success && res.error) {
        console.error(`Supabase update error for application ${appId}:`, res.error);
        addToast('Database Error', `Failed to sync update to Supabase: ${res.error}`, 'error');
        return;
      }
    }

    addToast('Status Updated', `Application moved to ${newStatus}`, 'info');
  };

  // Offer Actions
  const acceptOffer = (offerId: string) => {
    const targetOffer = offers.find(o => o.id === offerId);
    if (!targetOffer) return;

    const updatedOffer: Offer = { ...targetOffer, status: 'Accepted' };
    if (isSupabaseConfigured) upsertOfferToSupabase(updatedOffer);

    // Update offer status
    setOffers(prev => prev.map(o => o.id === offerId ? updatedOffer : o));

    // Update student offers array & placement status
    setStudents(prev => prev.map(s => {
      if (s.id === targetOffer.studentId) {
        const studentOffersList = s.offers || [];
        const updatedOffers = studentOffersList.map(o => o.offerId === offerId ? { ...o, status: 'Accepted' as OfferStatus } : o);
        const hasOffer = updatedOffers.some(o => o.offerId === offerId);
        if (!hasOffer) {
          updatedOffers.push({
            offerId: targetOffer.id,
            companyName: targetOffer.companyName,
            role: targetOffer.role,
            packageLPA: targetOffer.packageLPA,
            status: 'Accepted',
            offerDate: targetOffer.offerDate
          });
        }
        const newStatus = targetOffer.packageLPA >= offerPolicy.superDreamThresholdLPA ? 'Dream Placed' : 'Placed';
        const updatedStudent: Student = {
          ...s,
          placementStatus: newStatus,
          offers: updatedOffers
        };
        if (isSupabaseConfigured) upsertStudentToSupabase(updatedStudent);
        return updatedStudent;
      }
      return s;
    }));

    addToast('Offer Accepted! 🎉', `Congratulations! Accepted offer from ${targetOffer.companyName} at ₹${targetOffer.packageLPA} LPA`, 'success');
  };

  const declineOffer = (offerId: string) => {
    const targetOffer = offers.find(o => o.id === offerId);
    if (!targetOffer) return;

    const updatedOffer: Offer = { ...targetOffer, status: 'Declined' };
    if (isSupabaseConfigured) upsertOfferToSupabase(updatedOffer);

    setOffers(prev => prev.map(o => o.id === offerId ? updatedOffer : o));
    setStudents(prev => prev.map(s => {
      if (s.id === targetOffer.studentId) {
        const updatedStudent: Student = {
          ...s,
          offers: (s.offers || []).map(o => o.offerId === offerId ? { ...o, status: 'Declined' as OfferStatus } : o)
        };
        if (isSupabaseConfigured) upsertStudentToSupabase(updatedStudent);
        return updatedStudent;
      }
      return s;
    }));

    addToast('Offer Declined', `Declined offer from ${targetOffer.companyName}`, 'info');
  };

  const updateOfferStatus = async (offerId: string, newStatus: OfferStatus) => {
    const targetOffer = offers.find(o => o.id === offerId);
    if (!targetOffer) return;

    const updatedOffer: Offer = { ...targetOffer, status: newStatus };
    setOffers(prev => prev.map(o => o.id === offerId ? updatedOffer : o));

    if (isSupabaseConfigured) {
      const res = await updateOfferStatusInSupabase(offerId, newStatus);
      if (!res.success && res.error) {
        console.error('Supabase offer status update error:', res.error);
      }
    }

    // If offer is Accepted, update student placementStatus to 'Placed' or 'Dream Placed'
    if (newStatus === 'Accepted') {
      setStudents(prev => prev.map(s => {
        if (s.id === targetOffer.studentId) {
          const studentOffersList = s.offers || [];
          const updatedOffers = studentOffersList.map(o => o.offerId === offerId ? { ...o, status: 'Accepted' as OfferStatus } : o);
          const hasOffer = updatedOffers.some(o => o.offerId === offerId);
          if (!hasOffer) {
            updatedOffers.push({
              offerId: targetOffer.id,
              companyName: targetOffer.companyName,
              role: targetOffer.role,
              packageLPA: targetOffer.packageLPA,
              status: 'Accepted',
              offerDate: targetOffer.offerDate
            });
          }
          const placementStatus = targetOffer.packageLPA >= offerPolicy.superDreamThresholdLPA ? 'Dream Placed' : 'Placed';
          const updatedStudent: Student = {
            ...s,
            placementStatus,
            offers: updatedOffers
          };
          if (isSupabaseConfigured) upsertStudentToSupabase(updatedStudent);
          return updatedStudent;
        }
        return s;
      }));
    }
  };

  const createOffer = (offerData: Omit<Offer, 'id'>) => {
    const offerId = generateUUID();
    const newOffer: Offer = {
      ...offerData,
      id: offerId
    };
    setOffers(prev => [newOffer, ...prev]);
    if (isSupabaseConfigured) upsertOfferToSupabase(newOffer);

    // Also add reference to student
    setStudents(prev => prev.map(s => {
      if (s.id === newOffer.studentId) {
        const updatedStudent: Student = {
          ...s,
          offers: [
            ...(s.offers || []),
            {
              offerId: newOffer.id,
              companyName: newOffer.companyName,
              role: newOffer.role,
              packageLPA: newOffer.packageLPA,
              status: newOffer.status,
              offerDate: newOffer.offerDate
            }
          ]
        };
        if (isSupabaseConfigured) upsertStudentToSupabase(updatedStudent);
        return updatedStudent;
      }
      return s;
    }));

    addToast('Offer Issued', `Offer of ₹${newOffer.packageLPA} LPA from ${newOffer.companyName} issued to ${newOffer.studentName}`, 'success');
  };

  const updateOfferPolicy = (newConfig: Partial<OfferPolicyConfig>) => {
    const updated = { ...offerPolicy, ...newConfig };
    setOfferPolicy(updated);
    if (isSupabaseConfigured) upsertPolicyToSupabase(updated);
    addToast('Policy Updated', 'Institutional placement offer policy updated successfully.', 'success');
  };

  // Dynamic analytics calculations
  const totalStudentsCount = (students || []).length;
  const placedStudentsCount = (students || []).filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length;
  const calculatedPlacementRate = totalStudentsCount > 0 ? parseFloat(((placedStudentsCount / totalStudentsCount) * 100).toFixed(1)) : 0;
  const acceptedOfferList = (offers || []).filter(o => o.status === 'Accepted');
  const acceptedPackagesList = acceptedOfferList.map(o => o.packageLPA || 0).filter(p => p > 0);
  const allValidPackages = (offers || []).map(o => o.packageLPA || 0).filter(p => p > 0);
  const highestPkg = allValidPackages.length > 0 ? Math.max(...allValidPackages) : 0;
  const averagePkg = acceptedPackagesList.length > 0
    ? parseFloat((acceptedPackagesList.reduce((a, b) => a + b, 0) / acceptedPackagesList.length).toFixed(2))
    : 0;

  const sortedAccepted = [...acceptedPackagesList].sort((a, b) => a - b);
  const medianPkg = sortedAccepted.length > 0
    ? sortedAccepted.length % 2 !== 0
      ? sortedAccepted[Math.floor(sortedAccepted.length / 2)]
      : parseFloat(((sortedAccepted[sortedAccepted.length / 2 - 1] + sortedAccepted[sortedAccepted.length / 2]) / 2).toFixed(2))
    : 0;

  const kpis: PlacementKPIs = {
    totalStudents: totalStudentsCount,
    placedStudents: placedStudentsCount,
    placementPercentage: calculatedPlacementRate,
    averagePackage: averagePkg,
    medianPackage: medianPkg,
    highestPackage: highestPkg,
    totalOffers: (offers || []).length,
    dreamOffersCount: (offers || []).filter(o => o.packageLPA >= 8 && o.packageLPA < 14).length,
    superDreamOffersCount: (offers || []).filter(o => o.packageLPA >= 14).length,
    companiesVisited: (companies || []).length,
    activeDrives: (drives || []).filter(d => d.status === 'Active' || d.status === 'Upcoming' || d.status === 'Ongoing').length
  };

  const branches: Branch[] = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil'];
  const branchStats: BranchStatItem[] = branches.map(branchName => {
    const bStudents = (students || []).filter(s => s.branch === branchName);
    const total = bStudents.length;
    const placed = bStudents.filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length;
    const placementRate = total > 0 ? parseFloat(((placed / total) * 100).toFixed(1)) : 0;
    const bOffers = (offers || []).filter(o => o.studentBranch === branchName && (o.status === 'Accepted' || o.status === 'Offered'));
    const avgPackage = bOffers.length > 0
      ? parseFloat((bOffers.reduce((acc, o) => acc + (o.packageLPA || 0), 0) / bOffers.length).toFixed(2))
      : 0;

    return {
      branch: branchName,
      total,
      placed,
      placementRate,
      avgPackage
    };
  });

  const ctcDistribution: CtcDistributionItem[] = [
    { range: 'Below 5 LPA', count: (offers || []).filter(o => (o.packageLPA ?? 0) > 0 && (o.packageLPA ?? 0) < 5).length, color: '#F59E0B' },
    { range: '5–10 LPA', count: (offers || []).filter(o => (o.packageLPA ?? 0) >= 5 && (o.packageLPA ?? 0) < 10).length, color: '#10B981' },
    { range: '10–20 LPA', count: (offers || []).filter(o => (o.packageLPA ?? 0) >= 10 && (o.packageLPA ?? 0) < 20).length, color: '#2563EB' },
    { range: '20+ LPA', count: (offers || []).filter(o => (o.packageLPA ?? 0) >= 20).length, color: '#8B5CF6' }
  ];

  const yearlyTrends: YearlyTrendItem[] = [
    { year: '2023', totalPlaced: 352, averagePackage: 8.9, placementPercentage: 80.0 },
    { year: '2024', totalPlaced: 378, averagePackage: 9.8, placementPercentage: 82.2 },
    { year: '2025', totalPlaced: 394, averagePackage: 10.45, placementPercentage: 82.1 },
    { year: '2026 (Live)', totalPlaced: placedStudentsCount, averagePackage: averagePkg, placementPercentage: calculatedPlacementRate }
  ];

  const nirfData: NirfTableRow[] = [
    {
      academicYear: '2022-23',
      approvedIntake: 480,
      firstYearAdmitted: 460,
      graduatingYear: '2025-26 (Current)',
      graduatedStipulatedTime: 452,
      studentsPlaced: 394,
      medianSalaryLPA: 9.20,
      studentsHigherStudies: 42
    },
    {
      academicYear: '2021-22',
      approvedIntake: 480,
      firstYearAdmitted: 450,
      graduatingYear: '2024-25',
      graduatedStipulatedTime: 438,
      studentsPlaced: 378,
      medianSalaryLPA: 8.50,
      studentsHigherStudies: 38
    },
    {
      academicYear: '2020-21',
      approvedIntake: 440,
      firstYearAdmitted: 420,
      graduatingYear: '2023-24',
      graduatedStipulatedTime: 410,
      studentsPlaced: 352,
      medianSalaryLPA: 7.80,
      studentsHigherStudies: 45
    }
  ];

  return (
    <AppContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        currentUser,
        userProfile,
        isAuthenticated: Boolean(currentUser && userProfile),
        isLoadingAuth,
        login,
        logout,
        currentRole,
        setCurrentRole,
        currentView,
        setCurrentView,
        activeStudentId,
        setActiveStudentId,
        selectedCompanyId,
        setSelectedCompanyId,
        activeStudent,
        isSupabaseConfigured,
        supabaseConnected,
        isSyncing,
        testConnection,
        syncAllToSupabase,
        pullFromSupabase,
        fetchStudents,
        fetchCompanies,
        fetchDrives,
        students,
        companies,
        drives,
        applications,
        offers,
        offerPolicy,
        toasts,
        kpis,
        branchStats,
        ctcDistribution,
        yearlyTrends,
        nirfData,
        selectedDriveForEligibility,
        setSelectedDriveForEligibility,
        selectedStudentForDetail,
        setSelectedStudentForDetail,
        addToast,
        removeToast,
        addStudent,
        updateStudent,
        deleteStudent,
        addCompany,
        updateCompany,
        deleteCompany,
        addDrive,
        updateDrive,
        deleteDrive,
        applyToDrive,
        updateApplicationStatus,
        acceptOffer,
        declineOffer,
        createOffer,
        updateOfferStatus,
        updateOfferPolicy,
        checkEligibility,
        checkOfferPolicy: evaluateOfferPolicy,
        evaluateEligibility,
        checkOfferPolicyCompliance,
        getEligibleStudentsForDrive
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
