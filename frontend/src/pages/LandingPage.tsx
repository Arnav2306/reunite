import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import {
  Search, Camera, Eye, ShieldCheck, ArrowRight,
  CheckCircle2, MapPin, Sparkles, GraduationCap, Building2
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const { data: trustStats } = useQuery<{ items_returned: number; active_stations: number; total_registered: number }>({
    queryKey: ['public-trust-stats'],
    queryFn: async () => api.get('/api/items/public-stats/'),
    staleTime: 30000,
  });

  return (
    <div className="space-y-16 sm:space-y-20 py-8 sm:py-10">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto text-center px-4 sm:px-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Campus Lost &amp; Found Platform · "Found it. Report it. Reunite it."
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Lost something on campus?
          <br />
          <span className="text-blue-600">Let's help you find it.</span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          One small action can reunite a lost item with its owner. Reunite connects lost possessions with found items through AI assistance and verified campus collection desks.
        </p>

        {/* Real Database Trust Metric Banner */}
        <div className="mt-8 max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-3 divide-x divide-slate-100 text-center">
          <div className="px-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {trustStats ? trustStats.items_returned : 0}
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5">
              Items Successfully Returned
            </div>
          </div>
          <div className="px-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">
              {trustStats ? trustStats.active_stations : 0}
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5">
              Active Campus Stations
            </div>
          </div>
          <div className="px-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">
              {trustStats ? trustStats.total_registered : 0}
            </div>
            <div className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-0.5">
              Items Registered
            </div>
          </div>
        </div>

        {/* Two Clear Entry Choices: Student vs Staff / Custodian */}
        {!isAuthenticated && (
          <div className="mt-8 max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <Link
              to="/login?portal=student"
              className="p-4 bg-blue-50/70 border-2 border-blue-200 hover:border-blue-400 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Student Portal
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Report lost items, upload found photos, and track recovery
              </p>
              <div className="mt-2 text-xs font-semibold text-blue-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Sign In as Student →
              </div>
            </Link>

            <Link
              to="/login?portal=staff"
              className="p-4 bg-slate-50 border-2 border-slate-200 hover:border-slate-400 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Building2 className="w-4 h-4 text-slate-600" />
                Admin &amp; Staff Desk
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Custodial intake, claim verification, and OTP handovers
              </p>
              <div className="mt-2 text-xs font-semibold text-slate-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Custodial Login →
              </div>
            </Link>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto">
          <Link
            to={isAuthenticated ? '/lost' : '/login'}
            id="hero-cta-lost"
            className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
          >
            <Search className="w-4 h-4" />
            I Lost Something
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to={isAuthenticated ? '/found' : '/login'}
            id="hero-cta-found"
            className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
          >
            <Camera className="w-4 h-4" />
            I Found Something
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/found-items"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            Browse Found Items
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Simple. Fast. Campus-specific.</h2>
          <p className="text-slate-500 mt-2 text-sm sm:text-base">
            "Found something? One small action can reunite it with its owner."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Found Something flow */}
          <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-600">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-teal-900">I Found Something</h3>
            </div>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Snap a photo of the item you found' },
                { step: '2', text: 'AI vision identifies category and attributes' },
                { step: '3', text: 'Review and confirm suggested details' },
                { step: '4', text: 'Drop off at your nearest station (or flag bulky item)' },
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
              Photo is primary — quick 2-minute reporting
            </div>
          </div>

          {/* Lost Something flow */}
          <div className="bg-red-50/70 border border-red-200 rounded-2xl p-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-red-900">I Lost Something</h3>
            </div>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Select item category (Phone, Laptop, Keys...)' },
                { step: '2', text: 'Answer 3–4 category-specific smart questions' },
                { step: '3', text: 'Upload optional reference photo if available' },
                { step: '4', text: 'Reunite monitors and matches against campus inventory' },
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
              Photo optional — smart questions provide matching accuracy
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW REUNITE WORKS END-TO-END ─────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">The full campus recovery journey</h2>
          <div className="flex flex-col sm:flex-row items-start gap-0 sm:gap-4 relative">
            {[
              { icon: Camera, label: 'Found & Cataloged', desc: 'Finder logs item with photo at campus station', color: 'teal' },
              { icon: Eye, label: 'Automated Match', desc: 'Reunite compares against all active lost reports', color: 'blue' },
              { icon: ShieldCheck, label: 'Ownership Verified', desc: 'Owner submits verification answers securely', color: 'amber' },
              { icon: MapPin, label: 'Physical Handover', desc: 'Valuables use OTP; General items direct desk handover', color: 'emerald' },
            ].map((item, idx) => (
              <React.Fragment key={item.label}>
                <div className="flex-1 flex flex-col items-center text-center p-3">
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

      {/* ── TRUST & INTEGRITY COMMITMENTS ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Privacy Shielded</h4>
              <p className="text-xs text-slate-500 mt-1">
                Serial numbers, IMEIs, and private answers are shielded from public catalog view. Only authenticated staff and verified owners can access them.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
            <Sparkles className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Valuable Item OTP Protection</h4>
              <p className="text-xs text-slate-500 mt-1">
                Laptops, phones, and high-value belongings require a cryptographic, single-use OTP for physical collection.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
            <MapPin className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Campus Anchored</h4>
              <p className="text-xs text-slate-500 mt-1">
                Integrated directly with official campus buildings, HOD Cabins, library desks, and security posts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FOOTER ────────────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-slate-900 rounded-2xl p-8 sm:p-12 text-white space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold">Ready to find it?</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Join your campus on Reunite — create an account with your email or phone in seconds.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/signup"
                id="cta-footer-signup"
                className="px-6 py-3 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-colors shadow-sm"
              >
                Create Account
              </Link>
              <Link
                to="/login"
                id="cta-footer-login"
                className="px-6 py-3 text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
