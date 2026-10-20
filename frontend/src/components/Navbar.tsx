import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import type { AppNotification } from '../types/recovery';
import { Menu, X, Bell, User as UserIcon, LogOut, ChevronRight, Search, Camera, Sun, Moon, Shield } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<AppNotification[] | { results: AppNotification[] }>('/api/notifications/');
      return Array.isArray(res) ? res : res.results || [];
    },
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const isStaff = user?.role && ['custodian', 'admin', 'superadmin'].includes(user.role);

  // Student navigation — covers the full user journey
  const studentLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Report Lost', path: '/lost' },
    { name: 'Report Found', path: '/found' },
    { name: 'Found Items', path: '/found-items' },
    { name: 'Stations', path: '/stations' },
    { name: 'My Reports', path: '/my-reports' },
    { name: 'My Matches', path: '/my-matches' },
    { name: 'Recovery', path: '/recovery' },
  ];

  // Admin/custodian navigation — operational
  const adminLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Found Items', path: '/found-items' },
    { name: 'Register Found', path: '/admin/register-found' },
    { name: 'Stations', path: '/admin/collection-points' },
    { name: 'Claims', path: '/admin/verification' },
    { name: 'Handovers', path: '/admin/handovers' },
  ];

  const publicLinks = [
    { name: 'Home', path: '/' },
    { name: 'Found Items', path: '/found-items' },
    { name: 'Stations', path: '/stations' },
  ];

  const navLinks = isAuthenticated
    ? isStaff ? adminLinks : studentLinks
    : publicLinks;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Brand */}
          <div className="flex items-center">
            <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center mr-6 group" aria-label="Reunite – Campus Lost & Found – Home">
              <img
                src="/reunite-logo-transparent.png"
                alt="Reunite — Campus Lost & Found"
                className="h-9 w-auto object-contain transition-opacity group-hover:opacity-80"
                style={{ maxWidth: '140px' }}
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex lg:items-center lg:space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive(link.path)
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            {isAuthenticated ? (
              <>
                {/* Quick action buttons for students */}
                {!isStaff && (
                  <div className="flex items-center gap-1.5 mr-2">
                    <Link
                      to="/lost"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Lost
                    </Link>
                    <Link
                      to="/found"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Found
                    </Link>
                  </div>
                )}

                {/* Notifications bell */}
                <Link
                  to="/notifications"
                  className={`p-2 rounded-lg transition-colors relative ${
                    isActive('/notifications')
                      ? 'text-slate-900 bg-slate-100'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title={unreadCount > 0 ? `${unreadCount} unread` : 'Notifications'}
                  aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile */}
                <Link
                  to="/profile"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    isActive('/profile')
                      ? 'bg-slate-100 text-slate-900 border-slate-300 font-semibold'
                      : 'text-slate-700 hover:text-slate-900 bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span className="max-w-[120px] truncate text-sm">{user?.name || 'Profile'}</span>
                </Link>

                {/* Logout */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login?portal=staff"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Staff &amp; Custodian Access"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  Staff Desk
                </Link>
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Dark / Light Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4.5 h-4.5 text-amber-400" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-slate-600" />
              )}
            </button>
          </div>

          {/* Mobile menu button & theme toggle */}
          <div className="flex items-center gap-1 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg transition-colors"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
            {isAuthenticated && unreadCount > 0 && (
              <Link to="/notifications" className="relative p-2 text-slate-500 hover:text-slate-900">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white">
          {/* Student quick actions */}
          {isAuthenticated && !isStaff && (
            <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-2">
              <Link
                to="/lost"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl"
              >
                <Search className="w-4 h-4" />
                I Lost Something
              </Link>
              <Link
                to="/found"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl"
              >
                <Camera className="w-4 h-4" />
                I Found Something
              </Link>
            </div>
          )}

          {/* Navigation Links */}
          <div className="px-3 py-2 space-y-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg ${
                  isActive(link.path)
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{link.name}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>

          {/* Auth section */}
          <div className="px-4 py-3 border-t border-slate-100">
            {isAuthenticated ? (
              <div className="space-y-1">
                <Link
                  to="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-slate-500" />
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  <UserIcon className="w-4 h-4 text-slate-500" />
                  <span className="truncate">Profile ({user?.email})</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
