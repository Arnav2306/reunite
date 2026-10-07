import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import type { CollectionPoint } from '../types/recovery';
import {
  Building2, Plus, Edit2, AlertCircle,
  Loader2, MapPin, Layers, Power, X
} from 'lucide-react';

export const AdminCollectionPointsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<CollectionPoint | null>(null);

  // Form state
  const [stationCode, setStationCode] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [stationType, setStationType] = useState('HOD Cabin');
  const [zone, setZone] = useState('');
  const [capacity, setCapacity] = useState(50);
  const [statusVal, setStatusVal] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch all collection points
  const { data: collectionPoints = [], isLoading, isError } = useQuery<CollectionPoint[]>({
    queryKey: ['admin-collection-points'],
    queryFn: async () => {
      const res = await api.get<CollectionPoint[] | { results: CollectionPoint[] }>('/api/collection-points/');
      return Array.isArray(res) ? res : (res as { results: CollectionPoint[] }).results || [];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: Partial<CollectionPoint>) => {
      return api.post('/api/collection-points/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collection-points'] });
      queryClient.invalidateQueries({ queryKey: ['collection-points'] });
      closeModal();
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to create collection point.');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CollectionPoint> }) => {
      return api.patch(`/api/collection-points/${id}/`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-collection-points'] });
      queryClient.invalidateQueries({ queryKey: ['collection-points'] });
      closeModal();
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to update collection point.');
    },
  });

  const openCreate = () => {
    setEditingPoint(null);
    setStationCode('');
    setBuilding('');
    setFloor('');
    setStationType('HOD Cabin');
    setZone('');
    setCapacity(50);
    setStatusVal('ACTIVE');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (point: CollectionPoint) => {
    setEditingPoint(point);
    setStationCode(point.station_code);
    setBuilding(point.building);
    setFloor(point.floor);
    setStationType(point.station_type);
    setZone(point.zone);
    setCapacity(point.capacity || 50);
    setStatusVal(point.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    setEditingPoint(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationCode.trim() || !building.trim()) {
      setFormError('Station code and building are required.');
      return;
    }

    const payload = {
      station_code: stationCode.trim().toUpperCase(),
      building: building.trim(),
      floor: floor.trim(),
      station_type: stationType,
      zone: zone.trim(),
      capacity: Number(capacity),
      status: statusVal,
    };

    if (editingPoint) {
      updateMutation.mutate({ id: editingPoint.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleStatus = (point: CollectionPoint) => {
    const newStatus = point.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    updateMutation.mutate({ id: point.id, data: { status: newStatus } });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campus Collection Points</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
              Staff Custody Management
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure physical custody holding desks, HOD cabins, and departmental collection stations across campus.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Collection Point
        </button>
      </div>

      {/* Content */}
      <div className="mt-8">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-2">Loading collection points...</p>
          </div>
        ) : isError ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
            Failed to load collection points.
          </div>
        ) : collectionPoints.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">No collection points configured</h2>
              <p className="text-sm text-slate-500 mt-1">
                Add holding desks or HOD cabins so staff can deposit found items and assign custody locations.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Configure First Station
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collectionPoints.map((point) => {
              const isActive = point.status === 'ACTIVE';

              return (
                <div
                  key={point.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {point.station_code}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base mt-1.5">
                          {point.station_type}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Building: <strong className="text-slate-800">{point.building}</strong></span>
                      </div>
                      {point.floor && (
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Floor: <strong className="text-slate-800">{point.floor}</strong></span>
                        </div>
                      )}
                      {point.zone && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Zone / Area: <strong className="text-slate-800">{point.zone}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Items in Custody: <strong className="text-slate-700">{point.current_count || 0}</strong></span>
                      <span>Capacity: <strong className="text-slate-700">{point.capacity || 'Unlimited'}</strong></span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => toggleStatus(point)}
                      className={`inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                        isActive
                          ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <Power className="w-3 h-3 mr-1" />
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openEdit(point)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      <Edit2 className="w-3 h-3 mr-1 text-slate-500" />
                      Edit Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingPoint ? 'Edit Collection Point' : 'Add New Collection Point'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical station where student belongings are safely stored.
              </p>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Station Code * (e.g. HOD-CS-01, DESK-LIB-02)
                </label>
                <input
                  type="text"
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value)}
                  placeholder="e.g. HOD-CS-01"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Building / Block Name *
                </label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="e.g. Computer Science Block, Main Academic Tower"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Floor
                  </label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. 2nd Floor, Ground"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Station Type
                  </label>
                  <select
                    value={stationType}
                    onChange={(e) => setStationType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="HOD Cabin">HOD Cabin</option>
                    <option value="Custodial Desk">Custodial Desk</option>
                    <option value="Security Post">Security Post</option>
                    <option value="Department Office">Department Office</option>
                    <option value="Library Desk">Library Desk</option>
                    <option value="Central Lost & Found">Central Lost & Found</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Zone / Details
                  </label>
                  <input
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="e.g. Room 204, North Wing"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Storage Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ACTIVE">ACTIVE (Available for found item deposits)</option>
                  <option value="INACTIVE">INACTIVE (Temporarily closed)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex items-center px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    editingPoint ? 'Save Changes' : 'Create Station'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
