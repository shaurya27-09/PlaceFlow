import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Briefcase,
  CheckCircle2,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet,
  Bot,
  ArrowRight,
  Sparkles,
  Zap,
  Building2,
  Users,
  Award,
  Layers,
  ChevronRight,
  Sun,
  Moon,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';

export const LandingPage: React.FC = () => {
  const { setCurrentView, isAuthenticated, userProfile, darkMode, toggleDarkMode, students, offers, companies } = useApp();

  const safeStudents = students || [];
  const safeOffers = offers || [];
  const safeCompanies = companies || [];

  const totalStudents = safeStudents.length;
  const placedStudents = safeStudents.filter(s => s.placementStatus === 'Placed' || s.placementStatus === 'Dream Placed').length;
  const placementRate = totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(1) + '%' : '0.0%';

  const validOffers = safeOffers.filter(o => (o.packageLPA || 0) > 0);
  const highestOffer = validOffers.length > 0 ? Math.max(...validOffers.map(o => o.packageLPA || 0)).toFixed(1) : '0.0';
  const highestOfferCompany = validOffers.length > 0 ? (validOffers.find(o => (o.packageLPA || 0) === Math.max(...validOffers.map(x => x.packageLPA || 0)))?.companyName || 'Campus') : 'Campus';
  const partnerCompaniesCount = safeCompanies.length > 0 ? `${safeCompanies.length}+` : '0';

  const handleLaunchPortal = () => {
    if (isAuthenticated && userProfile) {
      if (userProfile.role === 'student') setCurrentView('student-portal');
      else if (userProfile.role === 'recruiter') setCurrentView('recruiter-portal');
      else setCurrentView('dashboard');
    } else {
      setCurrentView('login');
    }
  };

  const handleViewDemo = () => {
    setCurrentView('login');
  };

  const features = [
    {
      icon: Briefcase,
      title: 'Smart Drive Management',
      description: 'End-to-end recruitment lifecycle from job role posting, schedule coordination, tier mapping (Mass, Core, Dream, Super Dream) to multi-round tracking.',
      tag: 'Workflow Automation'
    },
    {
      icon: Zap,
      title: 'Automatic Eligibility Gating',
      description: 'Zero-latency multi-criteria filtering on CGPA thresholds, active backlogs, attendance quotas, eligible branches, and graduation year with clear gating explanations.',
      tag: 'Rule Engine'
    },
    {
      icon: ShieldCheck,
      title: 'Offer Policy Enforcement',
      description: 'Eliminate candidate hoarding with institutional policy guards. Enforce Dream upgrade multipliers (e.g. >= 1.5x salary hike), acceptance freeze, and max offer rules.',
      tag: 'Policy Guard'
    },
    {
      icon: BarChart3,
      title: 'Real-time Placement Analytics',
      description: 'Interactive Recharts visualizations covering branch-wise conversion rates, salary quartile distributions, YoY placement trends, and top recruiter cohorts.',
      tag: 'Live Insights'
    },
    {
      icon: FileSpreadsheet,
      title: 'NIRF-Style Institutional Reporting',
      description: 'Streamline accreditation reporting with automated calculation of median salary, higher education transitions, entrepreneurship records, and one-click data exports.',
      tag: 'Accreditation Ready'
    },
    {
      icon: Bot,
      title: 'PlaceFlow AI Assistant',
      description: 'Conversational natural language interface to query live placement figures, eligibility diagnostics, candidate summaries, and institutional comparisons instantly.',
      tag: 'Intelligent Diagnostics'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                  PlaceFlow
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  SIH USICT012
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="landing-theme-toggle"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            <button
              id="landing-login-btn"
              onClick={() => setCurrentView('login')}
              className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Sign In
            </button>

            <button
              id="landing-nav-dashboard-btn"
              onClick={handleLaunchPortal}
              className="text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <span>Launch Platform</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-6 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Smart India Hackathon 2026 Problem Statement USICT012</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight max-w-4xl mx-auto leading-[1.12]"
          >
            Placement Management, <span className="text-blue-600 dark:text-blue-400">Simplified.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed"
          >
            One intelligent platform for placement drives, eligibility, offers and institutional reporting.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <button
              id="hero-explore-dashboard-btn"
              onClick={handleLaunchPortal}
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all flex items-center gap-2"
            >
              <span>Explore Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="hero-view-demo-btn"
              onClick={handleViewDemo}
              className="px-6 py-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-sm font-bold shadow-xs transition-all flex items-center gap-2"
            >
              <span>Sign In with Auth</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </motion.div>

          {/* Quick Metrics Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-left"
          >
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{placementRate}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Batch Placement Rate</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">₹{highestOffer} LPA</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Highest Package ({highestOfferCompany})</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{partnerCompaniesCount}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Partner Companies</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">0s</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Auto-Gating Latency</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="py-16 md:py-24 bg-white dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Comprehensive Institutional Capabilities
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-2">
              Engineered for the Modern Placement Office
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-3">
              Addressing every core requirement of the USICT012 problem statement with high-precision automation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-md flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {feature.tag}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Explore module</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Problem Statement Focus & Solution Architecture */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-linear-to-br from-blue-900 to-slate-900 text-white p-8 sm:p-12 border border-blue-800/50 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                  SIH 2026 Special Solution
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Solving the 4 Critical Pillars of College Placements
                </h3>
                <p className="text-blue-100/90 text-sm leading-relaxed">
                  Traditional college placement processes suffer from manual spreadsheet bottlenecks, ineligible students sneaking into high-tier drives, multiple offer hogging, and painful weeks compiling NIRF tables. PlaceFlow replaces that chaos with a streamlined digital workflow.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2.5 text-xs text-blue-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Algorithmic Eligibility Gating</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-blue-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Multi-Tier Offer Upgrade Policies</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-blue-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Instant NIRF Accreditation Export</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-blue-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Conversational AI Placement Querying</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                  <div className="text-xs font-semibold text-blue-200">Secure Institutional Access</div>
                  <div className="text-sm font-bold text-white mt-1">Ready to sign in as Administrator, Student, or Recruiter?</div>
                  <div className="mt-4 flex gap-2">
                    <button
                      id="landing-cta-signin-btn"
                      onClick={() => setCurrentView('login')}
                      className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition-colors shadow-sm text-center flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Sign In with Credentials</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">PlaceFlow</span>
            <span>—</span>
            <span>Developed for Smart India Hackathon 2026 (Problem Statement USICT012)</span>
          </div>
          <div>
            <span>Frontend Hackathon MVP • Modular & Firebase Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
