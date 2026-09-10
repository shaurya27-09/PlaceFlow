import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  GraduationCap,
  Building2,
  Mail,
  User,
  Hash,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Edit3
} from 'lucide-react';

interface RegisterViewProps {
  onBackToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onBackToLogin }) => {
  const { sendRegistrationOtp, registerWithOtp, companies } = useApp();

  // Role can ONLY be 'student' or 'recruiter'. Never 'admin'.
  const [accountType, setAccountType] = useState<'student' | 'recruiter'>('student');
  const [step, setStep] = useState<1 | 2>(1);

  // Student form fields
  const [studentEmail, setStudentEmail] = useState('');
  const [studentName, setStudentName] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');

  // Recruiter form fields
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // OTP Verification state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState<number>(60);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Input refs for the 6 OTP boxes
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 60-second Countdown Timer for Resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  // Focus the first OTP box when transitioning to Step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  const activeEmail = accountType === 'student' ? studentEmail.trim() : recruiterEmail.trim();

  // Validate and dispatch OTP via Supabase Auth
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (accountType === 'student') {
      const email = studentEmail.trim();
      const name = studentName.trim();
      const enroll = enrollmentNumber.trim();

      if (!email || !emailRegex.test(email)) {
        setErrorMessage('Please enter a valid student/institutional email address.');
        return;
      }
      if (!name || name.length < 2) {
        setErrorMessage('Please enter the student\'s full name.');
        return;
      }
      if (!enroll || enroll.length < 3) {
        setErrorMessage('Please enter a valid enrollment number (e.g., 00116403221).');
        return;
      }

      setIsSendingOtp(true);
      try {
        const res = await sendRegistrationOtp(email, 'student', {
          name,
          enrollmentNumber: enroll
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Failed to send OTP. Please check your credentials.');
          return;
        }

        setStep(2);
        setCountdown(60);
        setOtpDigits(['', '', '', '', '', '']);
        setSuccessMessage(`A 6-digit verification code was sent to ${email}`);
      } catch (err: any) {
        setErrorMessage(err?.message || 'An unexpected error occurred while sending OTP.');
      } finally {
        setIsSendingOtp(false);
      }
    } else {
      // Recruiter flow
      const email = recruiterEmail.trim();
      const name = recruiterName.trim();
      const comp = companyName.trim();

      if (!name || name.length < 2) {
        setErrorMessage('Please enter the recruiter\'s full name.');
        return;
      }
      if (!comp || comp.length < 2) {
        setErrorMessage('Please enter the company or organization name.');
        return;
      }
      if (!email || !emailRegex.test(email)) {
        setErrorMessage('Please enter a valid official work email address.');
        return;
      }

      setIsSendingOtp(true);
      try {
        const res = await sendRegistrationOtp(email, 'recruiter', {
          name,
          companyName: comp
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Failed to send OTP. Please check your credentials.');
          return;
        }

        setStep(2);
        setCountdown(60);
        setOtpDigits(['', '', '', '', '', '']);
        setSuccessMessage(`A 6-digit verification code was sent to ${email}`);
      } catch (err: any) {
        setErrorMessage(err?.message || 'An unexpected error occurred while sending OTP.');
      } finally {
        setIsSendingOtp(false);
      }
    }
  };

  // Resend OTP with rate-limit protection
  const handleResendOtp = async () => {
    if (countdown > 0 || isSendingOtp) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSendingOtp(true);

    try {
      const res = await sendRegistrationOtp(
        activeEmail,
        accountType,
        accountType === 'student'
          ? { name: studentName.trim(), enrollmentNumber: enrollmentNumber.trim() }
          : { name: recruiterName.trim(), companyName: companyName.trim() }
      );

      if (!res.success) {
        setErrorMessage(res.error || 'Unable to resend OTP at this time.');
      } else {
        setCountdown(60);
        setSuccessMessage(`A new verification code was sent to ${activeEmail}`);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // OTP input handlers (individual digit boxes with auto-focus & paste)
  const handleDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // Single digit input
    const char = cleanVal.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    // Auto advance to next box
    if (index < 5 && char) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleVerifyOtp();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  };

  // Verify OTP and complete registration
  const handleVerifyOtp = async () => {
    const token = otpDigits.join('').trim();
    if (token.length < 6) {
      setErrorMessage('Please enter all 6 digits of the OTP code.');
      return;
    }

    setErrorMessage(null);
    setIsVerifyingOtp(true);

    try {
      const res = await registerWithOtp({
        email: activeEmail,
        token,
        role: accountType,
        studentName: accountType === 'student' ? studentName.trim() : undefined,
        enrollmentNumber: accountType === 'student' ? enrollmentNumber.trim() : undefined,
        recruiterName: accountType === 'recruiter' ? recruiterName.trim() : undefined,
        companyName: accountType === 'recruiter' ? companyName.trim() : undefined
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Verification failed. Please check the OTP or request a new code.');
      }
      // On success, registerWithOtp updates AppContext role & view, redirecting user seamlessly!
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Role and Details Input */}
      {step === 1 && (
        <>
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              id="register-back-to-login-top-btn"
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Step 1 of 2
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Create your PlaceFlow account
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Verify your email via Supabase Auth to activate your portal.
            </p>
          </div>

          {/* Account Type Selector: Strictly Student or Recruiter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              I am a:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="register-type-student-btn"
                onClick={() => {
                  setAccountType('student');
                  setErrorMessage(null);
                }}
                className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  accountType === 'student'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <GraduationCap className="w-5 h-5" />
                <span className="text-xs font-semibold">Student</span>
              </button>

              <button
                type="button"
                id="register-type-recruiter-btn"
                onClick={() => {
                  setAccountType('recruiter');
                  setErrorMessage(null);
                }}
                className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  accountType === 'recruiter'
                    ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs font-semibold">Recruiter</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 italic">
              Note: T&P Administrators must use the official password login.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              id="register-step1-error-alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSendOtp} className="space-y-4">
            {accountType === 'student' ? (
              <>
                {/* Student Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      id="student-register-email-input"
                      value={studentEmail}
                      onChange={e => {
                        setStudentEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="student@placeflow.ac.in"
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                {/* Student Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Student name
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      id="student-register-name-input"
                      value={studentName}
                      onChange={e => {
                        setStudentName(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Full Name (e.g. Raghav Sharma)"
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                {/* Enrollment Number */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Enrollment number
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      id="student-register-enrollment-input"
                      value={enrollmentNumber}
                      onChange={e => {
                        setEnrollmentNumber(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. 00116403221"
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Recruiter Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Recruiter name
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      id="recruiter-register-name-input"
                      value={recruiterName}
                      onChange={e => {
                        setRecruiterName(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. Priya Patel"
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Company
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      id="recruiter-register-company-input"
                      value={companyName}
                      onChange={e => {
                        setCompanyName(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. Google, Microsoft, Infosys"
                      list="existing-companies-list"
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <datalist id="existing-companies-list">
                      {(companies || []).map(c => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Official Work Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Official work email
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      id="recruiter-register-email-input"
                      value={recruiterEmail}
                      onChange={e => {
                        setRecruiterEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="priya.patel@company.com"
                      className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Send OTP Button */}
            <button
              type="submit"
              id="register-send-otp-btn"
              disabled={isSendingOtp}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              {isSendingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <span>Send OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Already have an account? Login */}
          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                id="register-to-login-link"
                onClick={onBackToLogin}
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Login
              </button>
            </p>
          </div>
        </>
      )}

      {/* Step 2: OTP Verification */}
      {step === 2 && (
        <>
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              id="register-otp-back-step-btn"
              onClick={() => {
                setStep(1);
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Details</span>
            </button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Step 2 of 2
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Enter the 6-digit OTP sent to your email
            </h3>
            <div className="mt-1.5 flex items-center flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Code sent to</span>
              <strong className="text-slate-800 dark:text-slate-200 font-semibold break-all">
                {activeEmail}
              </strong>
              <button
                type="button"
                id="register-change-email-btn"
                onClick={() => {
                  setStep(1);
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Change email</span>
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div
              id="register-otp-success-alert"
              className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div
              id="register-otp-error-alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* 6 Digit Input Boxes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 text-center">
              Enter 6-Digit Code
            </label>
            <div className="flex justify-center gap-2 sm:gap-3 my-4">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  id={`otp-digit-input-${idx}`}
                  value={digit}
                  onChange={e => handleDigitChange(idx, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(idx, e)}
                  onPaste={idx === 0 ? handleDigitPaste : undefined}
                  className="w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  autoFocus={idx === 0}
                />
              ))}
            </div>
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
              Enter numbers or paste code directly
            </p>
          </div>

          {/* Verify OTP Button */}
          <button
            type="button"
            id="register-verify-otp-btn"
            onClick={handleVerifyOtp}
            disabled={isVerifyingOtp || otpDigits.join('').length < 6}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            {isVerifyingOtp ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying OTP...</span>
              </>
            ) : (
              <>
                <span>Verify OTP</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Resend OTP & Countdown */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              id="register-resend-otp-btn"
              onClick={handleResendOtp}
              disabled={countdown > 0 || isSendingOtp}
              className={`inline-flex items-center gap-1 font-bold ${
                countdown > 0 || isSendingOtp
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin' : ''}`} />
              <span>Resend OTP</span>
            </button>

            {countdown > 0 ? (
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                Resend in {countdown}s
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                OTP Ready to resend
              </span>
            )}
          </div>

          {/* Login Link */}
          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                id="register-to-login-link-step2"
                onClick={onBackToLogin}
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Login
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  );
};
