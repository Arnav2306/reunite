import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AppNotification } from '../types/recovery';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  PackageCheck,
  Check,
  RotateCw,
  ArrowRight,
  Inbox,
  Loader2
} from 'lucide-react';

interface NotificationMeta {
  badgeLabel: string;
  badgeClass: string;
  icon: React.ReactNode;
  actionLabel?: string;
  actionPath?: string;
}

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<AppNotification[] | { results: AppNotification[] }>('/api/notifications/');
      return Array.isArray(res) ? res : res.results || [];
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/api/notifications/${id}/read/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/notifications/mark-all-read/');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.length - unreadCount;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const getNotificationMeta = (type: string): NotificationMeta => {
    switch (type) {
      case 'MATCH_FOUND':
        return {
          badgeLabel: 'Potential Match',
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: <Sparkles className="w-5 h-5 text-purple-600" />,
          actionLabel: 'View Matches',
          actionPath: '/matches',
        };
      case 'CLAIM_APPROVED':
        return {
          badgeLabel: 'Claim Approved',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          actionLabel: 'View Recovery Tracker',
          actionPath: '/recovery',
        };
      case 'CLAIM_REJECTED':
        return {
          badgeLabel: 'Claim Update',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
          actionLabel: 'View Claim Details',
          actionPath: '/recovery',
        };
      case 'CLAIM_SUBMITTED':
        return {
          badgeLabel: 'Under Review',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <Clock className="w-5 h-5 text-amber-600" />,
          actionLabel: 'Track Recovery',
          actionPath: '/recovery',
        };
      case 'HANDOVER_COMPLETED':
        return {
          badgeLabel: 'Handover Resolved',
          badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
          icon: <PackageCheck className="w-5 h-5 text-teal-600" />,
          actionLabel: 'View History',
          actionPath: '/recovery',
        };
      default:
        return {
          badgeLabel: 'Campus Update',
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: <Bell className="w-5 h-5 text-slate-600" />,
        };
    }
  };

  const handleActionClick = (notification: AppNotification, path?: string) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.public_id);
    }
    if (path) {
      navigate(path);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header card with gradient border and quick actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Live physical and custodial updates about your lost reports, potential item matches, claim verifications, and OTP collections.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="self-start sm:self-center inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs disabled:opacity-50"
          >
            {markAllReadMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-slate-600" />
            ) : (
              <Check className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All <span className="ml-1 opacity-75">({notifications.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              filter === 'unread'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                filter === 'unread' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-800'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter('read')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === 'read'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Read <span className="ml-1 opacity-75">({readCount})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-end sm:self-auto inline-flex items-center text-xs text-slate-500 hover:text-slate-800 transition-colors p-1"
          title="Refresh notifications"
        >
          <RotateCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="space-y-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-200 rounded-md w-1/4" />
                <div className="h-4 bg-slate-200 rounded-full w-20" />
              </div>
              <div className="h-3 bg-slate-100 rounded-md w-3/4" />
              <div className="h-2.5 bg-slate-100 rounded-md w-1/3" />
            </div>
          ))}
        </div>
      ) : isError ? (
        /* User-Friendly Error State */
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">We couldn't load your notifications</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              A temporary network or server issue prevented notifications from loading. Please check your connection and try again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </button>
        </div>
      ) : notifications.length === 0 ? (
        /* Global Empty State */
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-center mx-auto text-blue-600 mb-2">
            <Inbox className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">You're all caught up</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Updates about your lost item reports, automated potential matches, ownership claims, security OTP codes, and collection schedules will appear here in real time.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              View My Lost Reports
            </button>
            <button
              type="button"
              onClick={() => navigate('/available')}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              Browse Found Items Catalog
            </button>
          </div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        /* Filter-Specific Empty State */
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 mb-1">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {filter === 'unread' ? 'No unread notifications' : 'No read notifications'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filter === 'unread'
              ? "You've read all your updates! Check the 'All' tab to review previous notifications."
              : 'You do not have any past read notifications yet.'}
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline pt-1"
          >
            Show All Notifications
          </button>
        </div>
      ) : (
        /* Notifications List with Visual Hierarchy */
        <div className="space-y-3">
          {filteredNotifications.map((n) => {
            const meta = getNotificationMeta(n.notification_type);
            const isUnread = !n.read;

            return (
              <div
                key={n.public_id}
                className={`group relative rounded-xl border p-5 transition-all duration-150 ${
                  isUnread
                    ? 'border-blue-200 bg-blue-50/40 shadow-xs border-l-4 border-l-blue-600 hover:bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left Icon + Body */}
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                      isUnread ? 'bg-white border-blue-200 shadow-2xs' : 'bg-slate-50 border-slate-200'
                    }`}>
                      {meta.icon}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-sm tracking-tight ${
                          isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                        }`}>
                          {n.title}
                        </h3>

                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badgeClass}`}>
                          {meta.badgeLabel}
                        </span>

                        {isUnread && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-blue-600 text-white">
                            NEW
                          </span>
                        )}
                      </div>

                      <p className={`text-xs leading-relaxed break-words ${
                        isUnread ? 'text-slate-800' : 'text-slate-600'
                      }`}>
                        {n.message}
                      </p>

                      <div className="flex items-center space-x-3 pt-1 text-[11px] text-slate-400">
                        <span>{new Date(n.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">ID: {n.public_id.substring(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Mark read + Context Action */}
                  <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    {meta.actionPath && (
                      <button
                        type="button"
                        onClick={() => handleActionClick(n, meta.actionPath)}
                        className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          isUnread
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        <span>{meta.actionLabel || 'View Details'}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </button>
                    )}

                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => markReadMutation.mutate(n.public_id)}
                        disabled={markReadMutation.isPending && markReadMutation.variables === n.public_id}
                        className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors p-1"
                        title="Mark notification as read"
                      >
                        {markReadMutation.isPending && markReadMutation.variables === n.public_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <span>Mark read</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
