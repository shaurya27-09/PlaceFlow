import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Edit3, AlertCircle, Loader2 } from 'lucide-react';
import { Student, Branch, PlacementStatus } from '../../types';

interface EditStudentModalProps {
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ isOpen, student, onClose }) => {
  const { updateStudent } = useApp();

  const [name, setName] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState<Branch>('CSE');
  const [cgpa, setCgpa] = useState<string>('8.0');
  const [backlogs, setBacklogs] = useState<number>(0);
  const [attendance, setAttendance] = useState<number>(85);
  const [placementStatus, setPlacementStatus] = useState<PlacementStatus>('Unplaced');
  const [graduationYear, setGraduationYear] = useState<number>(2026);
  const [skillsInput, setSkillsInput] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setName(student.name || '');
      setEnrollmentNumber(student.enrollmentNumber || '');
      setEmail(student.email || '');
      setPhone(student.phone || '');
      setBranch((student.branch as Branch) || 'CSE');
      setCgpa(String(student.cgpa ?? 7.0));
      setBacklogs(student.backlogs ?? 0);
      setAttendance(student.attendance ?? 85);
      setPlacementStatus(student.placementStatus || 'Unplaced');
      setGraduationYear(student.graduationYear || 2026);
      setSkillsInput((student.skills || []).join(', '));
      setGender((student.gender as any) || 'Male');
      setErrorMessage(null);
    }
  }, [student]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Student name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);

    try {
      await updateStudent(student.id, {
        name: trimmedName,
        enrollmentNumber: enrollmentNumber.trim(),
        email: email.trim() || `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@usict.ac.in`,
        phone: phone.trim() || '+91 98765 00000',
        branch,
        cgpa: parseFloat(cgpa) || 7.0,
        backlogs: Number(backlogs),
        attendance: Number(attendance),
        placementStatus,
        graduationYear: Number(graduationYear),
        skills: skills.length > 0 ? skills : ['DSA', 'Python', 'C++'],
        gender
      });

      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update student');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full flex flex-col max-h-[82vh] my-auto animate-in zoom-in-95 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">Edit Student Record</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Update student details & academic metrics</p>
            </div>
          </div>
          <button
            id="close-edit-student-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                id="edit-student-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sahil Kapoor"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Enrollment Number *
              </label>
              <input
                type="text"
                id="edit-student-enrollment"
                value={enrollmentNumber}
                onChange={e => setEnrollmentNumber(e.target.value)}
                placeholder="e.g. 09916403222"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="edit-student-email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student@usict.ac.in"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                id="edit-student-phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Branch / Discipline *
              </label>
              <select
                id="edit-student-branch"
                value={branch}
                onChange={e => setBranch(e.target.value as Branch)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CSE">CSE (Computer Science)</option>
                <option value="IT">IT (Information Tech)</option>
                <option value="ECE">ECE (Electronics & Comm)</option>
                <option value="EE">EE (Electrical Engg)</option>
                <option value="ME">ME (Mechanical Engg)</option>
                <option value="Civil">Civil Engineering</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cumulative CGPA (0 - 10) *
              </label>
              <input
                type="number"
                id="edit-student-cgpa"
                step="0.01"
                min="0"
                max="10"
                value={cgpa}
                onChange={e => setCgpa(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Active Backlogs *
              </label>
              <input
                type="number"
                id="edit-student-backlogs"
                min="0"
                max="15"
                value={backlogs}
                onChange={e => setBacklogs(Number(e.target.value))}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Attendance % *
              </label>
              <input
                type="number"
                id="edit-student-attendance"
                min="0"
                max="100"
                value={attendance}
                onChange={e => setAttendance(Number(e.target.value))}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Batch Year
              </label>
              <input
                type="number"
                id="edit-student-batch"
                value={graduationYear}
                onChange={e => setGraduationYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Placement Status
              </label>
              <select
                id="edit-student-status"
                value={placementStatus}
                onChange={e => setPlacementStatus(e.target.value as PlacementStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Unplaced">Unplaced</option>
                <option value="Placed">Placed</option>
                <option value="Dream Placed">Dream Placed</option>
                <option value="Higher Studies">Higher Studies</option>
                <option value="Opted Out">Opted Out</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gender
              </label>
              <select
                id="edit-student-gender"
                value={gender}
                onChange={e => setGender(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Technical Skills (Comma separated)
            </label>
            <input
              type="text"
              id="edit-student-skills"
              value={skillsInput}
              onChange={e => setSkillsInput(e.target.value)}
              placeholder="e.g. C++, React, Node.js, Python"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-50/75 dark:bg-slate-900/75 backdrop-blur-xs">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-edit-student-btn"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating in Database...</span>
                </>
              ) : (
                <span>Update Student</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
