import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { CollectionPoint } from '../types/recovery';
import {
  MapPin, CheckCircle2, AlertTriangle, ArrowRight,
  QrCode, Search, ShieldCheck, Layers, Loader2
} from 'lucide-react';

interface StationDetail extends CollectionPoint {
  backup_station_details?: {
    id: number;
    station_code: string;
    building: string;
    floor: string;
    status: string;
  };
  directions?: string;
  opening_hours?: Record<string, string>;
}

export const CampusStationsPage: React.FC = () => {
  const { stationCode } = useParams<{ stationCode?: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [qrModalStation, setQrModalStation] = useState<StationDetail | null>(null);

  // Fetch all stations
  const { data: stations = [], isLoading, isError } = useQuery<StationDetail[]>({
    queryKey: ['campus-stations'],
    queryFn: async () => {
      const res = await api.get<StationDetail[] | { results: StationDetail[] }>('/api/collection-points/');
      return Array.isArray(res) ? res : (res as { results: StationDetail[] }).results || [];
    },
  });

  // If a specific stationCode was scanned/provided in URL:
  const activeParamStation = stationCode
    ? stations.find(s => s.station_code.toLowerCase() === stationCode.toLowerCase())
    : null;

  const filteredStations = stations.filter(s =>
    s.station_code.toLowerCase().includes(search.toLowerCase()) ||
    s.building.toLowerCase().includes(search.toLowerCase()) ||
    (s.zone && s.zone.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campus Collection Stations</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              Verified Holding Desks
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Official physical custody stations across campus where found items are safely deposited, logged into institutional custody, and verified for physical handover.
          </p>
        </div>

        <Link
          to="/found"
          className="self-start md:self-auto inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
        >
          Report Found Item <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Link>
      </div>

      {/* Scanned QR Station Highlight Banner (if stationCode URL route) */}
      {stationCode && (
        <div className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Scanned Station QR
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
              {stationCode.toUpperCase()}
            </span>
          </div>

          {activeParamStation ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{activeParamStation.building}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeParamStation.floor ? `${activeParamStation.floor} • ` : ''}
                    {activeParamStation.station_type || 'Collection Holding Desk'}
                  </p>
                </div>

                <span className={`self-start sm:self-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  activeParamStation.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {activeParamStation.status === 'ACTIVE' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      Station Available
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                      Station Temporarily Closed
                    </>
                  )}
                </span>
              </div>

              {activeParamStation.status === 'ACTIVE' ? (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-teal-900">Ready to drop off an item?</p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      You are at station {activeParamStation.station_code}. Take a photo and file the report now.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/found?station=${activeParamStation.station_code}`)}
                    className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shadow-xs"
                  >
                    Report Found Item at this Station <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Station Notice: Drop-off Unavailable at this Station</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    This collection point is currently undergoing custodial transfer or maintenance. Please do not leave items unattended.
                  </p>
                  {activeParamStation.backup_station_details && (
                    <div className="pt-2 border-t border-amber-200 text-xs text-amber-900">
                      <strong>Recommended Alternative Station:</strong>{' '}
                      {activeParamStation.backup_station_details.station_code} ({activeParamStation.backup_station_details.building}, {activeParamStation.backup_station_details.floor})
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600">
              Station code <strong className="font-mono">{stationCode}</strong> was not found in registered campus custody records.
            </div>
          )}
        </div>
      )}

      {/* Search Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          placeholder="Search campus stations by building, station code, or campus zone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs border-0 focus:outline-none focus:ring-0 bg-transparent placeholder:text-slate-400"
        />
      </div>

      {/* Stations List */}
      {isLoading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-xs text-slate-500 mt-2">Loading campus collection stations...</p>
        </div>
      ) : isError ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-700">
          Failed to load collection stations list.
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500">
          No campus stations matched your search query.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStations.map((station) => {
            const isAvail = station.status === 'ACTIVE';

            return (
              <div
                key={station.public_id}
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all hover:shadow-sm ${
                  isAvail ? 'border-slate-200 hover:border-blue-300' : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Code & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      {station.station_code}
                    </span>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      isAvail
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {isAvail ? 'Available' : 'Closed / Unavailable'}
                    </span>
                  </div>

                  {/* Building & Details */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{station.building}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {station.floor ? `${station.floor} • ` : ''}
                      {station.station_type || 'Holding Desk'}
                    </p>
                  </div>

                  {/* Location metadata */}
                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 text-slate-600 border border-slate-100">
                    {station.zone && (
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Zone: <strong>{station.zone}</strong></span>
                      </div>
                    )}
                    {station.capacity > 0 && (
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Vault Capacity: {station.capacity} items</span>
                      </div>
                    )}
                    {station.directions && (
                      <div className="flex items-start gap-1.5 pt-1 border-t border-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-relaxed">{station.directions}</span>
                      </div>
                    )}
                  </div>

                  {/* If unavailable, show why & alternative */}
                  {!isAvail && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                      <p className="font-semibold flex items-center gap-1 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        Station Notice
                      </p>
                      <p className="text-[11px] text-amber-800">
                        Drop-off unavailable at this desk.
                      </p>
                      {station.backup_station_details && (
                        <p className="text-[11px] font-medium text-amber-900 pt-1 border-t border-amber-200">
                          Use alternative: {station.backup_station_details.station_code} ({station.backup_station_details.building})
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => setQrModalStation(station)}
                    className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                    title="View Station Permanent QR Code"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  {isAvail ? (
                    <button
                      onClick={() => navigate(`/found?station=${station.station_code}`)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                    >
                      Report Found Item Here <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                    >
                      Station Inactive
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Station Permanent QR Modal */}
      {qrModalStation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-xl text-center space-y-4 relative">
            <h3 className="text-base font-bold text-slate-900">Permanent Station QR</h3>
            <p className="text-xs text-slate-500">
              Physical plaque QR placed at {qrModalStation.building} desk. Resolves directly to stable station code.
            </p>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto shadow-inner">
              <QrCode className="w-36 h-36 text-slate-900 mx-auto" />
              <p className="mt-3 font-mono text-sm font-bold text-slate-900 tracking-wider">
                {qrModalStation.station_code}
              </p>
            </div>

            <div className="text-[11px] text-slate-500 bg-blue-50 border border-blue-100 p-2.5 rounded-xl text-left">
              <strong>Security Guarantee:</strong> This permanent QR encodes only the stable campus station identifier. It contains zero tokens, passwords, or temporary credentials.
            </div>

            <button
              onClick={() => setQrModalStation(null)}
              className="w-full py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
