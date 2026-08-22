import { Student, PlacementDrive, Branch, Offer } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

export interface UserEligibilityProfile {
  name?: string;
  age?: number;
  location?: string;
  is_premium?: boolean;
  cgpa?: number;
  backlogs?: number;
  attendance?: number;
  branch?: string;
}

export interface QualifyingOfferResult {
  offer: Offer | any;
  qualifies: boolean;
  reason: string;
}

export interface EligibilityResultRecord {
  id?: string;
  student_id: string;
  drive_id: string;
  eligible: boolean;
  reasons: string[];
  checked_at: string;
  student_name?: string;
  student_enrollment?: string;
  student_branch?: string;
  student_cgpa?: number;
  student_backlogs?: number;
  student_attendance?: number;
  student_graduation_year?: number;
}

export interface StudentEligibilityInput {
  id?: string;
  full_name?: string;
  name?: string;
  enrollment_number?: string;
  enrollmentNumber?: string;
  branch?: string;
  cgpa?: number;
  backlogs?: number;
  attendance?: number;
  graduation_year?: number;
  graduationYear?: number;
}

export interface DriveEligibilityInput {
  id?: string;
  company_id?: string;
  companyId?: string;
  company_name?: string;
  companyName?: string;
  role?: string;
  package_lpa?: number;
  packageLPA?: number;
  min_cgpa?: number;
  minCgpa?: number;
  max_backlogs?: number;
  maxBacklogs?: number;
  min_attendance?: number;
  minAttendance?: number;
  eligible_branches?: Branch[] | string[] | string;
  eligibleBranches?: Branch[] | string[] | string;
  graduation_year?: number;
  graduationYear?: number;
}

export interface DeterministicEligibilityResult {
  eligible: boolean;
  reasons: string[];
  // Compatibility fields for existing UI components
  isEligible?: boolean;
  reason?: string;
  criteriaStatus?: {
    cgpaPassed: boolean;
    cgpaDiff: number;
    backlogsPassed: boolean;
    attendancePassed: boolean;
    branchPassed: boolean;
    graduationYearPassed: boolean;
  };
}

export interface DriveEligibilityCriteria {
  minCgpa?: number;
  maxBacklogs?: number;
  minAttendance?: number;
  eligibleBranches?: Branch[] | string[];
  graduationYear?: number;
}

export interface StudentEligibilityData {
  cgpa?: number;
  backlogs?: number;
  attendance?: number;
  branch?: string;
  graduationYear?: number;
  name?: string;
  enrollmentNumber?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  reasons: string[];
  isEligible: boolean;
  criteriaStatus: {
    cgpaPassed: boolean;
    cgpaDiff: number;
    backlogsPassed: boolean;
    attendancePassed: boolean;
    branchPassed: boolean;
    graduationYearPassed?: boolean;
  };
}

/**
 * DETERMINISTIC RULE-BASED ELIGIBILITY ENGINE
 * 
 * NOTE: DO NOT use Gemini or any AI model to determine eligibility.
 * All decisions are evaluated deterministically against strict institutional rules.
 * 
 * Rules:
 * 1. CGPA: student.cgpa >= drive.min_cgpa
 * 2. BACKLOGS: student.backlogs <= drive.max_backlogs
 * 3. ATTENDANCE: student.attendance >= drive.min_attendance
 * 4. BRANCH: student.branch must exist inside drive.eligible_branches
 * 5. GRADUATION YEAR: If drive specifies graduation_year: student.graduation_year must equal drive.graduation_year
 * 
 * All rules are ALWAYS evaluated (does not stop after the first failed rule).
 */
export function evaluateStudentEligibility(
  student: StudentEligibilityInput | Student,
  drive: DriveEligibilityInput | PlacementDrive
): DeterministicEligibilityResult {
  const reasons: string[] = [];

  // 1. Extract and normalize student values (supporting both snake_case and camelCase)
  const studentCgpa = typeof student.cgpa === 'number' ? student.cgpa : parseFloat(String((student as any).cgpa || 0)) || 0;
  const studentBacklogs = typeof student.backlogs === 'number' ? student.backlogs : parseInt(String((student as any).backlogs || 0), 10) || 0;
  const studentAttendance = typeof student.attendance === 'number' ? student.attendance : parseInt(String((student as any).attendance || 0), 10) || 0;
  const studentBranch = String((student as any).branch || '').trim();
  const studentGradYear = (student as any).graduation_year ?? (student as any).graduationYear;

  // 2. Extract and normalize drive criteria (supporting both snake_case and camelCase)
  const minCgpa = typeof (drive as any).min_cgpa === 'number' 
    ? (drive as any).min_cgpa 
    : (typeof (drive as any).minCgpa === 'number' ? (drive as any).minCgpa : parseFloat(String((drive as any).min_cgpa || (drive as any).minCgpa || 0)) || 0);

  const maxBacklogs = typeof (drive as any).max_backlogs === 'number'
    ? (drive as any).max_backlogs
    : (typeof (drive as any).maxBacklogs === 'number' ? (drive as any).maxBacklogs : parseInt(String((drive as any).max_backlogs || (drive as any).maxBacklogs || 0), 10) || 0);

  const minAttendance = typeof (drive as any).min_attendance === 'number'
    ? (drive as any).min_attendance
    : (typeof (drive as any).minAttendance === 'number' ? (drive as any).minAttendance : parseInt(String((drive as any).min_attendance || (drive as any).minAttendance || 0), 10) || 0);

  const rawBranches = (drive as any).eligible_branches ?? (drive as any).eligibleBranches ?? [];
  let eligibleBranches: string[] = [];
  if (Array.isArray(rawBranches)) {
    eligibleBranches = rawBranches.map(b => String(b).trim());
  } else if (typeof rawBranches === 'string' && rawBranches.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawBranches);
      eligibleBranches = Array.isArray(parsed) ? parsed.map(b => String(b).trim()) : [rawBranches.trim()];
    } catch {
      eligibleBranches = rawBranches.split(',').map(b => b.trim()).filter(Boolean);
    }
  }

  const driveGradYear = (drive as any).graduation_year ?? (drive as any).graduationYear;

  // RULE 1: CGPA (student.cgpa >= drive.min_cgpa)
  const cgpaPassed = studentCgpa >= minCgpa;
  if (!cgpaPassed) {
    reasons.push(`CGPA ${studentCgpa} is below required ${minCgpa}`);
  }

  // RULE 2: BRANCH (student.branch must exist inside drive.eligible_branches)
  const branchPassed = eligibleBranches.length === 0 || eligibleBranches.some(
    b => b.toLowerCase() === studentBranch.toLowerCase()
  );
  if (!branchPassed) {
    reasons.push(`Branch ${studentBranch || 'Unknown'} is not eligible for this drive`);
  }

  // RULE 3: BACKLOGS (student.backlogs <= drive.max_backlogs)
  const backlogsPassed = studentBacklogs <= maxBacklogs;
  if (!backlogsPassed) {
    const backlogText = studentBacklogs === 1 ? '1 backlog' : `${studentBacklogs} backlogs`;
    reasons.push(`${backlogText} exceeds maximum allowed ${maxBacklogs}`);
  }

  // RULE 4: ATTENDANCE (student.attendance >= drive.min_attendance)
  const attendancePassed = studentAttendance >= minAttendance;
  if (!attendancePassed) {
    reasons.push(`Attendance ${studentAttendance}% is below required ${minAttendance}%`);
  }

  // RULE 5: GRADUATION YEAR (If drive specifies graduation_year: student.graduation_year must equal drive.graduation_year)
  let graduationYearPassed = true;
  if (driveGradYear !== undefined && driveGradYear !== null && driveGradYear !== '' && Number(driveGradYear) > 0) {
    if (studentGradYear !== undefined && studentGradYear !== null && studentGradYear !== '' && Number(studentGradYear) > 0) {
      if (Number(studentGradYear) !== Number(driveGradYear)) {
        graduationYearPassed = false;
        reasons.push(`Graduation year ${studentGradYear} does not match required batch ${driveGradYear}`);
      }
    }
  }

  const eligible = reasons.length === 0;

  return {
    eligible,
    reasons,
    isEligible: eligible,
    reason: eligible ? '' : reasons.join('. '),
    criteriaStatus: {
      cgpaPassed,
      cgpaDiff: Number((studentCgpa - minCgpa).toFixed(2)),
      backlogsPassed,
      attendancePassed,
      branchPassed,
      graduationYearPassed
    }
  };
}

/**
 * Backward compatibility wrapper for checkEligibility
 */
export function checkEligibility(
  student: StudentEligibilityData,
  criteria: DriveEligibilityCriteria
): EligibilityResult {
  const result = evaluateStudentEligibility(
    {
      cgpa: student.cgpa,
      backlogs: student.backlogs,
      attendance: student.attendance,
      branch: student.branch,
      name: student.name,
      enrollmentNumber: student.enrollmentNumber,
      graduationYear: student.graduationYear
    },
    {
      minCgpa: criteria.minCgpa,
      maxBacklogs: criteria.maxBacklogs,
      minAttendance: criteria.minAttendance,
      eligibleBranches: criteria.eligibleBranches,
      graduationYear: criteria.graduationYear
    }
  );

  return {
    eligible: result.eligible,
    isEligible: result.eligible,
    reason: result.reason || '',
    reasons: result.reasons,
    criteriaStatus: result.criteriaStatus || {
      cgpaPassed: true,
      cgpaDiff: 0,
      backlogsPassed: true,
      attendancePassed: true,
      branchPassed: true
    }
  };
}

/**
 * Wrapper for evaluating a Student against a PlacementDrive
 */
export function evaluateEligibility(
  student: Student,
  drive: PlacementDrive
): EligibilityResult {
  return checkEligibility(student, drive);
}

/**
 * Filters an array of students into eligible and ineligible cohorts
 */
export function getEligibleStudentsForDrive(
  students: Student[],
  drive: PlacementDrive
): {
  eligible: Student[];
  ineligible: { student: Student; reason: string; reasons: string[] }[];
} {
  const eligible: Student[] = [];
  const ineligible: { student: Student; reason: string; reasons: string[] }[] = [];

  for (const student of students) {
    const result = evaluateStudentEligibility(student, drive);
    if (result.eligible) {
      eligible.push(student);
    } else {
      ineligible.push({
        student,
        reason: result.reasons.join('. '),
        reasons: result.reasons
      });
    }
  }

  return { eligible, ineligible };
}

/**
 * RUN ELIGIBILITY CHECK PIPELINE:
 * 1. Fetches placement drive from Supabase (or uses passed drive).
 * 2. Fetches all students from Supabase (or uses passed students).
 * 3. Evaluates every student using the deterministic rule-based engine.
 * 4. Upserts each result into Supabase 'eligibility_results' table based on student_id + drive_id.
 */
export async function runEligibilityCheck(
  driveId: string,
  fallbackDrive?: PlacementDrive,
  fallbackStudents?: Student[]
): Promise<{
  success: boolean;
  totalStudents: number;
  eligibleCount: number;
  ineligibleCount: number;
  eligibilityPercentage: number;
  results: EligibilityResultRecord[];
  error?: string;
}> {
  try {
    let drive: any = fallbackDrive;
    let students: any[] = fallbackStudents || [];

    // 1. Fetch drive from Supabase if connected
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: driveData, error: driveError } = await supabase
          .from('placement_drives')
          .select('*')
          .eq('id', driveId)
          .maybeSingle();

        if (driveError) {
          console.warn('Notice querying Supabase placement_drives (using provided context):', driveError.message);
        } else if (driveData) {
          drive = driveData;
        }
      } catch (e: any) {
        console.warn('Notice querying drive from Supabase:', e?.message);
      }

      // 2. Fetch students from Supabase if connected
      try {
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .order('full_name', { ascending: true });

        if (studentsError) {
          console.warn('Notice querying Supabase students (using provided context):', studentsError.message);
        } else if (studentsData && studentsData.length > 0) {
          students = studentsData;
        }
      } catch (e: any) {
        console.warn('Notice querying students from Supabase:', e?.message);
      }
    }

    if (!drive) {
      return {
        success: false,
        totalStudents: 0,
        eligibleCount: 0,
        ineligibleCount: 0,
        eligibilityPercentage: 0,
        results: [],
        error: `Placement drive with ID ${driveId} could not be found.`
      };
    }

    if (!students || students.length === 0) {
      return {
        success: false,
        totalStudents: 0,
        eligibleCount: 0,
        ineligibleCount: 0,
        eligibilityPercentage: 0,
        results: [],
        error: 'No student records available to evaluate.'
      };
    }

    // 3. Evaluate every student through the deterministic engine
    const now = new Date().toISOString();
    const evaluationRecords: EligibilityResultRecord[] = [];
    let eligibleCount = 0;

    for (const student of students) {
      const studentId = String(student.id);
      const evalResult = evaluateStudentEligibility(student, drive);

      if (evalResult.eligible) {
        eligibleCount++;
      }

      evaluationRecords.push({
        student_id: studentId,
        drive_id: String(driveId),
        eligible: evalResult.eligible,
        reasons: evalResult.reasons,
        checked_at: now,
        student_name: student.full_name || student.name || 'Student',
        student_enrollment: student.enrollment_number || student.enrollmentNumber || student.roll_number || '',
        student_branch: student.branch || '',
        student_cgpa: typeof student.cgpa === 'number' ? student.cgpa : parseFloat(String(student.cgpa || 0)) || 0,
        student_backlogs: typeof student.backlogs === 'number' ? student.backlogs : parseInt(String(student.backlogs || 0), 10) || 0,
        student_attendance: typeof student.attendance === 'number' ? student.attendance : parseInt(String(student.attendance || 0), 10) || 0,
        student_graduation_year: student.graduation_year || student.graduationYear || 2026
      });
    }

    const totalStudents = students.length;
    const ineligibleCount = totalStudents - eligibleCount;
    const eligibilityPercentage = totalStudents > 0 ? Math.round((eligibleCount / totalStudents) * 100) : 0;

    // 4. Save results to Supabase 'eligibility_results' table using UPSERT
    let persistenceError: string | undefined = undefined;

    if (isSupabaseConfigured && supabase) {
      try {
        // Query existing records to match existing IDs if table uses UUID/text PK
        const { data: existingRows, error: fetchErr } = await supabase
          .from('eligibility_results')
          .select('id, student_id')
          .eq('drive_id', driveId);

        if (fetchErr) {
          console.warn('Notice checking existing eligibility_results:', fetchErr.message);
        }

        const idMap = new Map((existingRows || []).map((r: any) => [String(r.student_id), String(r.id)]));

        const upsertPayload = evaluationRecords.map(rec => {
          const existingId = idMap.get(rec.student_id);
          return {
            ...(existingId ? { id: existingId } : {}),
            student_id: rec.student_id,
            drive_id: rec.drive_id,
            eligible: rec.eligible,
            reasons: rec.reasons,
            checked_at: rec.checked_at
          };
        });

        // Upsert on student_id,drive_id conflict
        let upsertResponse = await supabase
          .from('eligibility_results')
          .upsert(upsertPayload, { onConflict: 'student_id,drive_id' });

        if (upsertResponse.error) {
          console.warn('Notice on conflict student_id,drive_id upsert, attempting standard upsert:', upsertResponse.error.message);
          // Fallback if unique constraint is defined on id
          const fallbackPayload = evaluationRecords.map(rec => {
            const existingId = idMap.get(rec.student_id) || `elg-${rec.student_id}-${rec.drive_id}`;
            return {
              id: existingId,
              student_id: rec.student_id,
              drive_id: rec.drive_id,
              eligible: rec.eligible,
              reasons: rec.reasons,
              checked_at: rec.checked_at
            };
          });

          upsertResponse = await supabase
            .from('eligibility_results')
            .upsert(fallbackPayload, { onConflict: 'id' });
        }

        if (upsertResponse.error) {
          console.error('Supabase eligibility_results upsert error:', upsertResponse.error);
          persistenceError = upsertResponse.error.message;
        }
      } catch (err: any) {
        console.error('Exception writing to Supabase eligibility_results:', err);
        persistenceError = err?.message || 'Database write error';
      }
    }

    return {
      success: true,
      totalStudents,
      eligibleCount,
      ineligibleCount,
      eligibilityPercentage,
      results: evaluationRecords,
      error: persistenceError
    };
  } catch (err: any) {
    console.error('Fatal exception in runEligibilityCheck:', err);
    return {
      success: false,
      totalStudents: 0,
      eligibleCount: 0,
      ineligibleCount: 0,
      eligibilityPercentage: 0,
      results: [],
      error: err?.message || 'Failed to complete eligibility check'
    };
  }
}

/**
 * Fetch historical eligibility results from Supabase
 */
export async function fetchEligibilityResultsFromSupabase(
  driveId: string
): Promise<{ data?: EligibilityResultRecord[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('eligibility_results')
      .select('*')
      .eq('drive_id', driveId);

    if (error) {
      return { error: error.message };
    }

    const mapped: EligibilityResultRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: String(row.student_id),
      drive_id: String(row.drive_id),
      eligible: Boolean(row.eligible),
      reasons: Array.isArray(row.reasons)
        ? row.reasons
        : (row.reasons ? (typeof row.reasons === 'string' ? JSON.parse(row.reasons) : [row.reasons]) : []),
      checked_at: row.checked_at || ''
    }));

    return { data: mapped };
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch eligibility results' };
  }
}
