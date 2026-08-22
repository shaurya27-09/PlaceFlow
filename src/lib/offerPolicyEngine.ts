import { Student, PlacementDrive, Offer, OfferPolicyConfig } from '../types';

export interface ExistingOfferSummary {
  id?: string;
  offerId?: string;
  companyName: string;
  packageLPA: number;
  role?: string;
  status: string; // 'Offered' | 'Accepted' | 'Pending' | 'Rejected' | 'Withdrawn' | 'Declined'
  offerDate?: string;
}

export interface OfferPolicyEvaluation {
  allowed: boolean;
  reason: string | null;
  highestExistingOffer: number | null;
  blocked: boolean;
  title: string; // 'Application Blocked' or 'Application Allowed'
  existingOffers: ExistingOfferSummary[];
  existingPackage: number;
  allowedLimit?: number;
  ruleApplied: string;
}

/**
 * Cleanly format LPA numbers (e.g. 8 -> "8", 8.5 -> "8.5")
 */
export function formatLpa(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Number.isInteger(val) ? val.toString() : val.toString();
}

/**
 * Extract active or accepted offers for a student.
 * Active statuses include 'Offered', 'Accepted', and 'Pending'.
 * Inactive statuses (excluded): 'Rejected', 'Withdrawn', 'Declined', 'Revoked', 'Blocked by Policy'.
 */
export function getStudentActiveOffers(
  student: Student,
  allOffers?: Offer[]
): ExistingOfferSummary[] {
  const list: ExistingOfferSummary[] = [];
  const activeStatuses = ['Offered', 'Accepted', 'Pending'];

  // Check student's own embedded offers
  if (student.offers && Array.isArray(student.offers)) {
    student.offers.forEach(o => {
      if (activeStatuses.includes(o.status)) {
        list.push({
          id: o.offerId,
          offerId: o.offerId,
          companyName: o.companyName,
          packageLPA: typeof o.packageLPA === 'number' ? o.packageLPA : parseFloat(String(o.packageLPA)) || 0,
          role: o.role,
          status: o.status,
          offerDate: o.offerDate
        });
      }
    });
  }

  // If global offers collection provided, merge any additional matches
  if (allOffers && Array.isArray(allOffers)) {
    allOffers
      .filter(o => o.studentId === student.id && activeStatuses.includes(o.status))
      .forEach(o => {
        if (!list.some(item => (item.offerId && item.offerId === o.id) || (item.companyName === o.companyName && item.packageLPA === o.packageLPA))) {
          list.push({
            id: o.id,
            offerId: o.id,
            companyName: o.companyName,
            packageLPA: typeof o.packageLPA === 'number' ? o.packageLPA : parseFloat(String(o.packageLPA)) || 0,
            role: o.role,
            status: o.status,
            offerDate: o.offerDate
          });
        }
      });
  }

  return list;
}

/**
 * Deterministic Offer Policy Engine
 *
 * Checks whether a student can apply for a placement drive based on:
 * 1. Active offers held by the student
 * 2. The drive's `offer_limit_lpa` (if set)
 * 3. Additional institutional rules (e.g., package cap, Dream upgrade >= 1.5x)
 *
 * DO NOT use Gemini or AI for policy decisions.
 */
export function checkOfferPolicy(
  student: Student,
  drive: PlacementDrive,
  options?: {
    allOffers?: Offer[];
    policyConfig?: OfferPolicyConfig;
  }
): OfferPolicyEvaluation {
  const activeOffers = getStudentActiveOffers(student, options?.allOffers);

  // If student has no active or accepted offers, application is allowed
  if (activeOffers.length === 0) {
    return {
      allowed: true,
      reason: null,
      highestExistingOffer: null,
      blocked: false,
      title: 'Application Allowed',
      existingOffers: [],
      existingPackage: 0,
      ruleApplied: 'No Prior Offers'
    };
  }

  // Calculate highest existing package
  let highestOfferItem = activeOffers[0];
  for (const offer of activeOffers) {
    if (offer.packageLPA > highestOfferItem.packageLPA) {
      highestOfferItem = offer;
    }
  }
  const highestExistingOffer = highestOfferItem.packageLPA;
  const existingPackage = highestExistingOffer;

  // 1. Primary Rule: Check drive's offer_limit_lpa (if specified)
  const driveOfferLimit = drive.offer_limit_lpa !== undefined && drive.offer_limit_lpa !== null
    ? Number(drive.offer_limit_lpa)
    : undefined;

  if (driveOfferLimit !== undefined && !isNaN(driveOfferLimit) && driveOfferLimit > 0) {
    if (highestExistingOffer >= driveOfferLimit) {
      const reason = `Existing offer of ₹${formatLpa(highestExistingOffer)} LPA exceeds or equals the ₹${formatLpa(driveOfferLimit)} LPA participation limit for this drive.`;
      return {
        allowed: false,
        reason,
        highestExistingOffer,
        blocked: true,
        title: 'Application Blocked',
        existingOffers: activeOffers,
        existingPackage,
        allowedLimit: driveOfferLimit,
        ruleApplied: `Offer Limit (<= ${driveOfferLimit} LPA)`
      };
    }
  }

  const driveRule = (drive.offerPolicyRule || '').trim();

  // If the drive rule is explicitly "No Restrictions", permit application
  if (driveRule === 'No Restrictions') {
    return {
      allowed: true,
      reason: null,
      highestExistingOffer,
      blocked: false,
      title: 'Application Allowed',
      existingOffers: activeOffers,
      existingPackage,
      ruleApplied: 'No Restrictions'
    };
  }

  // 2. Package Cap Rule in drive rule text: e.g. "Must have <= 6 LPA" or "<= X LPA"
  const capMatch = driveRule.match(/<=?\s*(\d+(\.\d+)?)\s*LPA/i);
  if (capMatch) {
    const allowedLimit = parseFloat(capMatch[1]);
    if (existingPackage > allowedLimit) {
      const reason = `Existing offer of ₹${formatLpa(existingPackage)} LPA exceeds allowed limit of ₹${formatLpa(allowedLimit)} LPA.`;
      return {
        allowed: false,
        reason,
        highestExistingOffer,
        blocked: true,
        title: 'Application Blocked',
        existingOffers: activeOffers,
        existingPackage,
        allowedLimit,
        ruleApplied: driveRule
      };
    }
  }

  // 3. Dream Upgrade Rule (>= 1.5x)
  if (driveRule === 'Dream Upgrade Only (>= 1.5x)' || driveRule.includes('1.5x')) {
    const minRequiredPackage = Number((existingPackage * 1.5).toFixed(2));
    if (drive.packageLPA < minRequiredPackage) {
      const reason = `Existing package ₹${formatLpa(existingPackage)} LPA requires at least 1.5x upgrade (₹${formatLpa(minRequiredPackage)} LPA). Prospective package is ₹${formatLpa(drive.packageLPA)} LPA.`;
      return {
        allowed: false,
        reason,
        highestExistingOffer,
        blocked: true,
        title: 'Application Blocked',
        existingOffers: activeOffers,
        existingPackage,
        allowedLimit: minRequiredPackage,
        ruleApplied: 'Dream Upgrade (>= 1.5x)'
      };
    }
  }

  // 4. Single Offer Policy ("Max 1 Offer" / "Strict Single Offer")
  if ((driveRule === 'Max 1 Offer' || driveRule === 'Strict Single Offer') && activeOffers.length >= 1) {
    const reason = `Student already holds an active offer of ₹${formatLpa(existingPackage)} LPA from ${highestOfferItem.companyName}.`;
    return {
      allowed: false,
      reason,
      highestExistingOffer,
      blocked: true,
      title: 'Application Blocked',
      existingOffers: activeOffers,
      existingPackage,
      ruleApplied: driveRule
    };
  }

  // 5. Global Policy Config Checks (if provided)
  if (options?.policyConfig) {
    const cfg = options.policyConfig;
    const acceptedOffers = activeOffers.filter(o => o.status === 'Accepted');
    if (cfg.freezeOnAcceptance && acceptedOffers.length > 0 && drive.packageLPA < cfg.superDreamThresholdLPA) {
      const reason = `Existing accepted offer of ₹${formatLpa(existingPackage)} LPA freezes participation for non-Super Dream drives (< ₹${cfg.superDreamThresholdLPA} LPA).`;
      return {
        allowed: false,
        reason,
        highestExistingOffer,
        blocked: true,
        title: 'Application Blocked',
        existingOffers: activeOffers,
        existingPackage,
        allowedLimit: cfg.superDreamThresholdLPA,
        ruleApplied: 'Institutional Freeze on Acceptance'
      };
    }

    if (cfg.maxOffersAllowed > 0 && activeOffers.length >= cfg.maxOffersAllowed) {
      const reason = `Student has reached the maximum allowed offers (${cfg.maxOffersAllowed}) under university policy.`;
      return {
        allowed: false,
        reason,
        highestExistingOffer,
        blocked: true,
        title: 'Application Blocked',
        existingOffers: activeOffers,
        existingPackage,
        ruleApplied: 'Institutional Max Offers'
      };
    }
  }

  return {
    allowed: true,
    reason: null,
    highestExistingOffer,
    blocked: false,
    title: 'Application Allowed',
    existingOffers: activeOffers,
    existingPackage,
    ruleApplied: 'Policy Compliant'
  };
}
