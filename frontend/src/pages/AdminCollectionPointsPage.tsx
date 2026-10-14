import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api';
import type { CollectionPoint, CampusBlockItem, CampusConfig } from '../types/recovery';
import {
  Building2, Plus, Edit2, AlertCircle,
  Loader2, MapPin, Layers, Power, X, ShieldAlert,
  Phone, Mail, Navigation, Settings, CheckCircle2
} from 'lucide-react';

export const AdminCollectionPointsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<CollectionPoint | null>(null);

  // Campus settings modal
  const [isCampusModalOpen, setIsCampusModalOpen] = useState(false);
  const [campusName, setCampusName] = useState('');
  const [campusAddress, setCampusAddress] = useState('');
  const [campusLocality, setCampusLocality] = useState('');
  const [campusCity, setCampusCity] = useState('');
  const [campusState, setCampusState] = useState('');
  const [campusCountry, setCampusCountry] = useState('India');
  const [campusPinCode, setCampusPinCode] = useState('');
  const [campusEmail, setCampusEmail] = useState('');
  const [campusPhone, setCampusPhone] = useState('');
  const [campusWebsite, setCampusWebsite] = useState('');
  const [campusMapsLink, setCampusMapsLink] = useState('');
  const [campusSaveSuccess, setCampusSaveSuccess] = useState(false);

  // Blocks management modal
  const [isBlocksModalOpen, setIsBlocksModalOpen] = useState(false);
  const [newBlockCode, setNewBlockCode] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockDesc, setNewBlockDesc] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);

  // Station Form state
  const [stationCode, setStationCode] = useState('');
  const [building, setBuilding] = useState('');
  const [blockId, setBlockId] = useState<string>('');
  const [floor, setFloor] = useState('');
  const [stationType, setStationType] = useState('HOD Cabin');
  const [zone, setZone] = useState('');
  const [capacity, setCapacity] = useState(50);
  const [statusVal, setStatusVal] = useState<'ACTIVE' | 'INACTIVE' | 'UNVERIFIED'>('ACTIVE');
  const [directions, setDirections] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch campus config
  const { data: campusConfig } = useQuery<CampusConfig>({
    queryKey: ['admin-campus-config'],
    queryFn: async () => {
      try {
        return await api.get<CampusConfig>('/api/collection-points/campus/');
      } catch {
        return null as any;
      }
    },
  });

  // Fetch campus blocks
  const { data: campusBlocks = [] } = useQuery<CampusBlockItem[]>({
    queryKey: ['admin-campus-blocks'],
    queryFn: async () => {
      try {
        const res = await api.get<CampusBlockItem[] | { results: CampusBlockItem[] }>('/api/collection-points/blocks/');
        return Array.isArray(res) ? res : (res as { results: CampusBlockItem[] }).results || [];
      } catch {
        return [];
      }
    },
  });

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

  // Update campus config mutation
  const updateCampusMutation = useMutation({
    mutationFn: async (payload: Partial<CampusConfig>) => {
      return api.patch('/api/collection-points/campus-settings/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-config'] });
      queryClient.invalidateQueries({ queryKey: ['campus-config'] });
      setCampusSaveSuccess(true);
      setTimeout(() => {
        setCampusSaveSuccess(false);
        setIsCampusModalOpen(false);
      }, 1200);
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to update campus configuration.');
    },
  });

  // Create campus block mutation
  const createBlockMutation = useMutation({
    mutationFn: async (payload: { code: string; name: string; description: string }) => {
      return api.post('/api/collection-points/blocks/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['campus-blocks'] });
      setNewBlockCode('');
      setNewBlockName('');
      setNewBlockDesc('');
      setBlockError(null);
    },
    onError: (err: ApiError) => {
      setBlockError(err.message || 'Failed to create campus block.');
    },
  });

  const openCreate = () => {
    setEditingPoint(null);
    setStationCode('');
    setBuilding('');
    setBlockId('');
    setFloor('');
    setStationType('HOD Cabin');
    setZone('');
    setCapacity(50);
    setStatusVal('ACTIVE');
    setDirections('');
    setMapLink('');
    setLatitude('');
    setLongitude('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openEdit = (point: CollectionPoint) => {
    setEditingPoint(point);
    setStationCode(point.station_code);
    setBuilding(point.building);
    setBlockId(point.block ? String(point.block) : '');
    setFloor(point.floor || '');
    setStationType(point.station_type);
    setZone(point.zone || '');
    setCapacity(point.capacity || 50);
    setStatusVal(point.status as any || 'ACTIVE');
    setDirections(point.directions || '');
    setMapLink(point.map_link || '');
    setLatitude(point.latitude != null ? String(point.latitude) : '');
    setLongitude(point.longitude != null ? String(point.longitude) : '');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const openCampusModal = () => {
    if (campusConfig) {
      setCampusName(campusConfig.name || '');
      setCampusAddress(campusConfig.address || '');
      setCampusLocality(campusConfig.locality || '');
      setCampusCity(campusConfig.city || '');
      setCampusState(campusConfig.state || '');
      setCampusCountry(campusConfig.country || 'India');
      setCampusPinCode(campusConfig.pin_code || '');
      setCampusEmail(campusConfig.contact_email || '');
      setCampusPhone(campusConfig.contact_phone || '');
      setCampusWebsite(campusConfig.website || '');
      setCampusMapsLink(campusConfig.maps_link || '');
    }
    setFormError(null);
    setCampusSaveSuccess(false);
    setIsCampusModalOpen(true);
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

    const payload: any = {
      station_code: stationCode.trim().toUpperCase(),
      building: building.trim(),
      floor: floor.trim(),
      station_type: stationType,
      zone: zone.trim(),
      capacity: Number(capacity),
      status: statusVal,
      block: blockId ? Number(blockId) : null,
      requires_block_confirmation: !blockId,
      directions: directions.trim(),
      map_link: mapLink.trim(),
      latitude: latitude.trim() ? parseFloat(latitude.trim()) : null,
      longitude: longitude.trim() ? parseFloat(longitude.trim()) : null,
    };

    if (editingPoint) {
      updateMutation.mutate({ id: editingPoint.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleSaveCampus = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<CampusConfig> = {
      name: campusName.trim(),
      address: campusAddress.trim(),
      locality: campusLocality.trim(),
      city: campusCity.trim(),
      state: campusState.trim(),
      country: campusCountry.trim(),
      pin_code: campusPinCode.trim(),
      contact_email: campusEmail.trim(),
      contact_phone: campusPhone.trim(),
      website: campusWebsite.trim(),
      maps_link: campusMapsLink.trim(),
    };
    updateCampusMutation.mutate(payload);
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockCode.trim() || !newBlockName.trim()) {
      setBlockError('Block code and name are required.');
      return;
    }
    createBlockMutation.mutate({
      code: newBlockCode.trim().toUpperCase(),
      name: newBlockName.trim(),
      description: newBlockDesc.trim(),
    });
  };

  const toggleStatus = (point: CollectionPoint) => {
    const newStatus = point.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    updateMutation.mutate({ id: point.id, data: { status: newStatus } });
  };

  // Find stations requiring administrative block confirmation
  const pendingStations = collectionPoints.filter(cp => cp.requires_block_confirmation);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setIsBlocksModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors"
          >
            <Layers className="w-4 h-4 mr-1.5 text-slate-500" />
            Manage Blocks ({campusBlocks.length})
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Collection Point
          </button>
        </div>
      </div>

      {/* Campus Details Overview Banner */}
      {campusConfig && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-400" />
                <h2 className="text-lg font-bold text-white">{campusConfig.name}</h2>
                <span className="text-xs px-2 py-0.5 bg-teal-500/20 text-teal-300 font-semibold rounded border border-teal-500/30">
                  Configured Institution
                </span>
                <button
                  onClick={openCampusModal}
                  className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700"
                >
                  <Settings className="w-3 h-3 text-teal-400" />
                  Edit Details
                </button>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{campusConfig.address || 'Address pending'}</span>
                {campusConfig.city && <span>• {campusConfig.city}, {campusConfig.state}</span>}
                {campusConfig.pin_code && <span>— {campusConfig.pin_code}</span>}
              </p>
              {(campusConfig.contact_email || campusConfig.contact_phone || campusConfig.maps_link) && (
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                  {campusConfig.contact_email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" /> {campusConfig.contact_email}
                    </span>
                  )}
                  {campusConfig.contact_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> {campusConfig.contact_phone}
                    </span>
                  )}
                  {campusConfig.maps_link && (
                    <a
                      href={campusConfig.maps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Campus Map
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-400 flex flex-wrap gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6 shrink-0">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Campus Blocks</p>
                <p className="text-base font-bold text-white">{campusBlocks.length} Blocks</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Desks</p>
                <p className="text-base font-bold text-white">{collectionPoints.length} Stations</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Pending Review</p>
                <p className="text-base font-bold text-amber-400">{pendingStations.length} Pending</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ambiguous Mappings Warning Banner */}
      {pendingStations.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>{pendingStations.length} Stations Require Administrative Block Confirmation</span>
          </div>
          <p className="text-xs text-amber-800">
            The following stations have ambiguous campus block mappings (e.g. Admission Cell, Girls Hostel with multiple blocks, or multi-CSE Block V) and cannot guess block assignments automatically. Click <strong>Edit</strong> on a station to confirm its official block:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {pendingStations.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => openEdit(p)}
                className="text-xs px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-md font-medium text-amber-900 transition-colors"
              >
                {p.station_code}: {p.building} → Confirm Block
              </button>
            ))}
          </div>
        </div>
      )}

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
                      {point.block_details && (
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Block: <strong className="text-slate-800">{point.block_details.code} ({point.block_details.name})</strong></span>
                        </div>
                      )}
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
                      {point.directions && (
                        <p className="text-[11px] text-slate-500 italic mt-1">
                          Directions: {point.directions}
                        </p>
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

      {/* Edit Campus Details Modal */}
      {isCampusModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 relative">
            <button
              onClick={() => setIsCampusModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Edit Official Institution Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized administrators can enter official college information, directions, contact info, and map links.
              </p>
            </div>

            {campusSaveSuccess && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                Institution settings saved successfully!
              </div>
            )}

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCampus} className="space-y-3 text-xs max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Institution Name *</label>
                <input
                  type="text"
                  value={campusName}
                  onChange={(e) => setCampusName(e.target.value)}
                  placeholder="e.g. Medicaps University"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Campus Address *</label>
                <textarea
                  value={campusAddress}
                  onChange={(e) => setCampusAddress(e.target.value)}
                  placeholder="A.B. Road, Pigdamber, Rau, Indore, Madhya Pradesh – 453331, India"
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Locality / Sector</label>
                  <input
                    type="text"
                    value={campusLocality}
                    onChange={(e) => setCampusLocality(e.target.value)}
                    placeholder="Pigdamber, Rau"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={campusCity}
                    onChange={(e) => setCampusCity(e.target.value)}
                    placeholder="Indore"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={campusState}
                    onChange={(e) => setCampusState(e.target.value)}
                    placeholder="Madhya Pradesh"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={campusCountry}
                    onChange={(e) => setCampusCountry(e.target.value)}
                    placeholder="India"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={campusPinCode}
                    onChange={(e) => setCampusPinCode(e.target.value)}
                    placeholder="453331"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Contact Email</label>
                  <input
                    type="email"
                    value={campusEmail}
                    onChange={(e) => setCampusEmail(e.target.value)}
                    placeholder="lostandfound@medicaps.ac.in"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Contact Phone</label>
                  <input
                    type="text"
                    value={campusPhone}
                    onChange={(e) => setCampusPhone(e.target.value)}
                    placeholder="+91 731 2856230"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Website</label>
                <input
                  type="url"
                  value={campusWebsite}
                  onChange={(e) => setCampusWebsite(e.target.value)}
                  placeholder="https://www.medicaps.ac.in"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Campus Map Link / Verified Coordinates URL</label>
                <input
                  type="url"
                  value={campusMapsLink}
                  onChange={(e) => setCampusMapsLink(e.target.value)}
                  placeholder="https://maps.google.com/?q=22.6175,75.8239"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCampusModalOpen(false)}
                  className="px-3.5 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateCampusMutation.isPending}
                  className="inline-flex items-center px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  {updateCampusMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Save Institution Details'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Blocks Modal */}
      {isBlocksModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 relative">
            <button
              onClick={() => setIsBlocksModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Campus Blocks &amp; Buildings ({campusBlocks.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official institution buildings. Adding new blocks allows desks and stations to be associated immediately.
              </p>
            </div>

            {/* Add new block sub-form */}
            <form onSubmit={handleCreateBlock} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <p className="font-bold text-slate-800">Add New Campus Block</p>
              {blockError && (
                <p className="text-xs text-red-600 font-semibold">{blockError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newBlockCode}
                  onChange={(e) => setNewBlockCode(e.target.value)}
                  placeholder="Code (e.g. BLOCK-W)"
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg uppercase font-mono"
                  required
                />
                <input
                  type="text"
                  value={newBlockName}
                  onChange={(e) => setNewBlockName(e.target.value)}
                  placeholder="Name (e.g. Block W)"
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                  required
                />
                <input
                  type="text"
                  value={newBlockDesc}
                  onChange={(e) => setNewBlockDesc(e.target.value)}
                  placeholder="Description / Departments"
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createBlockMutation.isPending}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  {createBlockMutation.isPending ? 'Adding…' : 'Add Block'}
                </button>
              </div>
            </form>

            {/* Existing blocks list */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 text-xs">
              {campusBlocks.map((b) => (
                <div key={b.id} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-blue-700 px-2 py-0.5 bg-blue-50 rounded mr-2">
                      {b.code}
                    </span>
                    <strong className="text-slate-800">{b.name}</strong>
                    {b.description && (
                      <span className="text-slate-500 ml-2">— {b.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBlocksModalOpen(false)}
                className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Station Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 relative">
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

            <form onSubmit={handleSubmit} className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Station Code * (e.g. MED-BLK-B000, MED-LIB-G)
                </label>
                <input
                  type="text"
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value)}
                  placeholder="e.g. MED-BLK-B000"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Building / Station Name *
                </label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="e.g. Block B — EC/IT/Commerce"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Associated Official Campus Block
                </label>
                <select
                  value={blockId}
                  onChange={(e) => setBlockId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pending Administrative Assignment --</option>
                  {campusBlocks.map(b => (
                    <option key={b.id} value={String(b.id)}>
                      {b.code} — {b.name} ({b.description || 'Block'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Linking an official block resolves pending confirmation warnings.
                </p>
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
                    placeholder="e.g. Ground Floor, 2nd Floor"
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
                    <option value="Reception / Help Desk">Reception / Help Desk</option>
                    <option value="Hostel Office">Hostel Office</option>
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
                    placeholder="e.g. Room 204, Main Entry"
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
                  Walking Directions within Campus
                </label>
                <input
                  type="text"
                  value={directions}
                  onChange={(e) => setDirections(e.target.value)}
                  placeholder="e.g. Near main stairs, adjacent to Dean office"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Verified Map Link (Google Maps / Campus Portal)
                </label>
                <input
                  type="url"
                  value={mapLink}
                  onChange={(e) => setMapLink(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Latitude (GPS)
                  </label>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 22.617500"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Longitude (GPS)
                  </label>
                  <input
                    type="text"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 75.823900"
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
                  <option value="INACTIVE">INACTIVE (Temporarily closed / deposits disabled)</option>
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
