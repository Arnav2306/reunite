import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center space-x-2">
            <Link to="/" aria-label="Reunite — Home">
              <img
                src="/reunite-logo-transparent.png"
                alt="Reunite — Campus Lost & Found"
                className="h-8 w-auto object-contain"
                style={{ maxWidth: '100px' }}
              />
            </Link>
            <span className="text-slate-300">|</span>
            <span>Campus Lost &amp; Found Platform</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link to="/available" className="hover:text-slate-900 transition-colors">
              Available Items
            </Link>
            <Link to="/lost" className="hover:text-slate-900 transition-colors">
              Report Lost
            </Link>
            <Link to="/found" className="hover:text-slate-900 transition-colors">
              Report Found
            </Link>
          </div>

          <p className="text-xs text-slate-400">
            For campus community use. Authorized custody tracking and verification.
          </p>
        </div>
      </div>
    </footer>
  );
};
