import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Search, Camera, Eye, ShieldCheck, ArrowRight,
  CheckCircle2, MapPin, Sparkles
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-20 py-10">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto text-center px-4 sm:px-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 mb-7">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          Campus Lost &amp; Found Platform
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Lost something on campus?
          <br />
          <span className="text-blue-600">Let's bring it back.</span>
        </h1>

        <p className="mt-5 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Report what you lost or found. Reunite uses AI to connect lost items with found items — fast, simple, and campus-specific.
        </p>

        {/* Primary CTAs */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-sm sm:max-w-none mx-auto">
          <Link
            to={isAuthenticated ? '/lost' : '/login'}
            id="hero-cta-lost"
            className="w-full sm:w-auto group inline-flex items-center justify-center gap-3 px-7 py-4 bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
          >
            <Search className="w-5 h-5" />
            I Lost Something
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to={isAuthenticated ? '/found' : '/login'}
            id="hero-cta-found"
            className="w-full sm:w-auto group inline-flex items-center justify-center gap-3 px-7 py-4 bg-teal-600 hover:bg-teal-700 text-white text-base font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
          >
            <Camera className="w-5 h-5" />
            I Found Something
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="mt-5">
          <Link
            to="/found-items"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Browse found items →
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Simple. Fast. Campus-specific.</h2>
          <p className="text-slate-500 mt-2 text-base">Reunite makes the entire recovery process effortless for students.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Found Something flow */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-600">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-teal-900">I Found Something</h3>
            </div>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Take a photo of the found item' },
                { step: '2', text: 'AI identifies and describes it for you' },
                { step: '3', text: 'You review and confirm the details' },
                { step: '4', text: 'Drop it off at the nearest campus station' },
              ].map(item => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center text-xs font-bold text-teal-700 shrink-0">
                    {item.step}
                  </div>
                  <p className="text-sm text-teal-800">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-teal-700">
              <Sparkles className="w-3.5 h-3.5" />
              Photo is the primary input — no long forms
            </div>
          </div>

          {/* Lost Something flow */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-red-900">I Lost Something</h3>
            </div>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Select the item category' },
                { step: '2', text: 'Answer 3–4 smart questions about it' },
                { step: '3', text: 'Optionally upload a photo' },
                { step: '4', text: 'AI checks against all found items' },
              ].map(item => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 border border-red-300 flex items-center justify-center text-xs font-bold text-red-700 shrink-0">
                    {item.step}
                  </div>
                  <p className="text-sm text-red-800">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-red-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Photo is optional — report works without it
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW REUNITE WORKS END-TO-END ─────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">The full recovery journey</h2>
          <div className="flex flex-col sm:flex-row items-start gap-0 sm:gap-4 relative">
            {[
              { icon: Camera, label: 'Found & Reported', desc: 'Student or custodian reports item with photo', color: 'teal' },
              { icon: Eye, label: 'AI Matches', desc: 'AI compares against all lost reports', color: 'blue' },
              { icon: ShieldCheck, label: 'Ownership Verified', desc: 'Owner answers verification questions', color: 'amber' },
              { icon: MapPin, label: 'Item Retrieved', desc: 'Authorized handover at campus station', color: 'emerald' },
            ].map((item, idx) => (
              <React.Fragment key={item.label}>
                <div className="flex-1 flex flex-col items-center text-center p-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                    item.color === 'teal' ? 'bg-teal-50 border border-teal-200 text-teal-600' :
                    item.color === 'blue' ? 'bg-blue-50 border border-blue-200 text-blue-600' :
                    item.color === 'amber' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                    'bg-emerald-50 border border-emerald-200 text-emerald-600'
                  }`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
                {idx < 3 && (
                  <div className="hidden sm:flex items-center justify-center mt-6 text-slate-300">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST / COMMITMENTS ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Privacy First</h4>
              <p className="text-xs text-slate-500 mt-1">
                Identifying details and private marks are never exposed publicly — only verified owners can access them.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Sparkles className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900">AI-Assisted Matching</h4>
              <p className="text-xs text-slate-500 mt-1">
                Reunite uses AI to automatically match lost reports with found items — reducing your effort to near zero.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <MapPin className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Campus-Anchored</h4>
              <p className="text-xs text-slate-500 mt-1">
                Integrated with your campus buildings and official custodial stations for secure physical handovers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FOOTER ────────────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-slate-900 rounded-2xl p-10 sm:p-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Ready to find it?</h2>
            <p className="text-slate-400 mt-3 text-base">
              Join your campus on Reunite — it takes under a minute.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                id="cta-footer-signup"
                className="px-7 py-3.5 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-colors shadow-sm"
              >
                Create Account
              </Link>
              <Link
                to="/login"
                id="cta-footer-login"
                className="px-7 py-3.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
              >
                Log In
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
