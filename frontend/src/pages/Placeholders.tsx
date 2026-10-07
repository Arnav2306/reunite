import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  subtitle: string;
  description: string;
  milestone: string;
}

export const FeaturePlaceholder: React.FC<PlaceholderProps> = ({
  title,
  subtitle,
  description,
  milestone,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 mb-4">
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled for {milestone}</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm font-medium text-slate-600 mt-1">{subtitle}</p>

        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
          {description}
        </div>

        <div className="mt-8 flex items-center justify-center space-x-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export const LostPlaceholder: React.FC = () => (
  <FeaturePlaceholder
    title="Report Lost Item"
    subtitle="Owner Loss Submission Workflow"
    description="The lost item submission workflow with category selection, dynamic ownership questions, and time/location tracking is coming in an upcoming milestone."
    milestone="Phase 1 Workflow Milestone"
  />
);

export const FoundPlaceholder: React.FC = () => (
  <FeaturePlaceholder
    title="Report Found Item"
    subtitle="Finder Rapid Intake & Station Drop"
    description="The fast intake process for finders to capture item photo, auto-categorize, scan station QR, and deposit the physical item is coming in an upcoming milestone."
    milestone="Phase 1 Workflow Milestone"
  />
);

export const AvailablePlaceholder: React.FC = () => (
  <FeaturePlaceholder
    title="Available for Collection"
    subtitle="Admin Published Item Catalog"
    description="The catalog of items currently stored at custodial desks with public details and claim verification workflows is coming in an upcoming milestone."
    milestone="Phase 1 Workflow Milestone"
  />
);

export const ReportsPlaceholder: React.FC = () => (
  <FeaturePlaceholder
    title="My Reports"
    subtitle="Custody Tracking & Report History"
    description="The active reports list providing live physical status tracking (e.g. Reported, Deposited, Secure Hold, Ready for Pickup) is coming in an upcoming milestone."
    milestone="Phase 1 Workflow Milestone"
  />
);

export const MatchesPlaceholder: React.FC = () => (
  <FeaturePlaceholder
    title="Potential Matches"
    subtitle="Verification & Claim Requests"
    description="The match verification center where students answer attribute prompts to verify lost belongings and receive pickup OTPs is coming in an upcoming milestone."
    milestone="Phase 1 Workflow Milestone"
  />
);
