import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AvailableItemsPage } from './pages/AvailableItemsPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { AdminVerificationPage } from './pages/AdminVerificationPage';
import { AdminHandoverPage } from './pages/AdminHandoverPage';
import { RegisterFoundItemPage } from './pages/RegisterFoundItemPage';
import { ReportLostItemPage } from './pages/ReportLostItemPage';
import { MyLostItemsPage } from './pages/MyLostItemsPage';
import { MatchesPage } from './pages/MatchesPage';
import { AdminCollectionPointsPage } from './pages/AdminCollectionPointsPage';
import { StudentReportFoundPage } from './pages/StudentReportFoundPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminDisputesPage } from './pages/AdminDisputesPage';

import { CampusStationsPage } from './pages/CampusStationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 selection:bg-blue-100">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingPage />} />
                  {/* /found-items and /available both serve the public catalog */}
                  <Route path="/available" element={<AvailableItemsPage />} />
                  <Route path="/found-items" element={<AvailableItemsPage />} />
                  {/* Campus stations and station QR resolver */}
                  <Route path="/stations" element={<CampusStationsPage />} />
                  <Route path="/stations/:stationCode" element={<CampusStationsPage />} />

                  {/* Authentication Routes (Redirect away if already logged in) */}
                  <Route element={<PublicOnlyRoute />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/admin/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                  </Route>

                  {/* General Protected Routes (All Authenticated Roles) */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                  </Route>

                  {/* Student Only Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                    <Route path="/recovery" element={<RecoveryPage />} />
                    {/* Student: Report Lost Item */}
                    <Route path="/lost" element={<ReportLostItemPage />} />
                    {/* Student: Report Found Item (photo-first AI flow) */}
                    <Route path="/found" element={<StudentReportFoundPage />} />
                    {/* Student: My Reports */}
                    <Route path="/reports" element={<MyLostItemsPage />} />
                    <Route path="/my-reports" element={<MyLostItemsPage />} />
                    {/* Student: Matches */}
                    <Route path="/matches" element={<MatchesPage />} />
                    <Route path="/my-matches" element={<MatchesPage />} />
                  </Route>

                  {/* Custodian & Admin Shared Routes (Physical Handovers) */}
                  <Route element={<ProtectedRoute allowedRoles={['custodian', 'admin', 'superadmin']} />}>
                    <Route path="/admin/handovers" element={<AdminHandoverPage />} />
                  </Route>

                  {/* Admin & Super Admin Only Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'superadmin']} />}>
                    <Route path="/admin/users" element={<AdminUsersPage />} />
                    <Route path="/admin/disputes" element={<AdminDisputesPage />} />
                    <Route path="/admin/register-found" element={<RegisterFoundItemPage />} />
                    <Route path="/admin/verification" element={<AdminVerificationPage />} />
                    <Route path="/admin/collection-points" element={<AdminCollectionPointsPage />} />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
