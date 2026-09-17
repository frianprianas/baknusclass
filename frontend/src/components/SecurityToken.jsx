import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    ShieldCheck, RefreshCw, RotateCcw, Clock, Key, Calendar, Activity, X, Search,
    Filter, Users, CheckCircle2, AlertCircle, Copy, Check, UserCheck, BookOpen, LayoutGrid, List
} from 'lucide-react';

const SecurityToken = () => {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState('');
    const [myAssignments, setMyAssignments] = useState([]);

    // Monitoring state (Table based)
    const [monitoringData, setMonitoringData] = useState([]);
    const [loadingMonitoring, setLoadingMonitoring] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // Filters
    const [selectedMapelFilter, setSelectedMapelFilter] = useState('ALL');
    const [selectedKelasFilter, setSelectedKelasFilter] = useState('ALL');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // ALL, BELUM_MULAI, SEDANG_MENGERJAKAN, SELESAI
    const [searchQuery, setSearchQuery] = useState('');

    // Active View Mode
    const [activeTab, setActiveTab] = useState('monitoring'); // 'monitoring' or 'token_list'

    // Proktor Assignment Modal (bisa diawal atau saat berjalan)
    const [isProktorModalOpen, setIsProktorModalOpen] = useState(false);
    const [allTeachers, setAllTeachers] = useState([]);
    const [selectedProktorIds, setSelectedProktorIds] = useState([]);
    const [savingProktor, setSavingProktor] = useState(false);
    const [teacherSearch, setTeacherSearch] = useState('');

    // Token copy state
    const [copiedTokenId, setCopiedTokenId] = useState(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userProfileId = user.profileId;

    useEffect(() => {
        let role = user.role || 'GURU';
        setUserRole(role);
        fetchEvents();
        if (role === 'GURU') {
            fetchMyAssignments();
        }
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        try {
            const res = await axios.get('/api/users', { headers }).catch(() => null);
            if (res && res.data) {
                const teachers = res.data.filter(u => u.role === 'GURU');
                setAllTeachers(teachers);
            } else {
                const altRes = await axios.get('/api/users/teachers', { headers }).catch(() => null);
                if (altRes && altRes.data) setAllTeachers(altRes.data);
            }
        } catch (err) {
            console.error('Failed to fetch teachers', err);
        }
    };

    const fetchEvents = async () => {
        try {
            const res = await axios.get('/api/exam/event', { headers });
            const activeEvents = res.data.filter(e => e.statusAktif);
            setEvents(activeEvents);
            if (activeEvents.length > 0) {
                const defaultEvent = activeEvents[0];
                setSelectedEventId(defaultEvent.id);
                setSelectedProktorIds(defaultEvent.proktorIds || []);
                fetchExamsAndMonitoring(defaultEvent.id);
            }
        } catch (err) {
            console.error('Fetch events error', err);
        }
    };

    const fetchMyAssignments = async () => {
        try {
            const res = await axios.get('/api/enrollment/guru-mapel/my', { headers });
            setMyAssignments(res.data);
        } catch (err) {
            console.error('Fetch assignments error:', err);
        }
    };

    const fetchExamsAndMonitoring = async (eventId) => {
        if (!eventId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/exam/ujian-mapel/event/${eventId}`, { headers });
            setExams(res.data);

            const activeEv = events.find(e => e.id == eventId);
            if (activeEv) {
                setSelectedProktorIds(activeEv.proktorIds || []);
            }

            // Immediately fetch live monitoring table
            await refreshMonitoringData(eventId, selectedMapelFilter, res.data);
        } catch (err) {
            console.error('Fetch exams error:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshMonitoringData = async (eventId = selectedEventId, mapelFilter = selectedMapelFilter, currentExams = exams) => {
        if (!eventId) return;
        setLoadingMonitoring(true);
        try {
            let combinedData = [];

            if (mapelFilter !== 'ALL') {
                // Fetch for specific ujian mapel
                const res = await axios.get(`/api/exam/ujian-mapel/${mapelFilter}/monitoring`, { headers });
                combinedData = res.data || [];
            } else {
                // Try event-wide monitoring endpoint
                const res = await axios.get(`/api/exam/ujian-mapel/event/${eventId}/monitoring`, { headers }).catch(() => null);
                if (res && res.data) {
                    combinedData = res.data;
                } else {
                    // Fallback: fetch for all exams in this event in parallel
                    const examsList = currentExams.length > 0 ? currentExams : (exams || []);
                    const promises = examsList.map(ex =>
                        axios.get(`/api/exam/ujian-mapel/${ex.id}/monitoring`, { headers })
                            .then(r => r.data || [])
                            .catch(() => [])
                    );
                    const results = await Promise.all(promises);
                    combinedData = results.flat();
                }
            }

            setMonitoringData(combinedData);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to load monitoring data:', err);
        } finally {
            setLoadingMonitoring(false);
        }
    };

    // Auto Refresh Effect every 15 seconds
    useEffect(() => {
        if (!autoRefresh || !selectedEventId) return;
        const interval = setInterval(() => {
            refreshMonitoringData(selectedEventId, selectedMapelFilter);
        }, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, selectedEventId, selectedMapelFilter, exams]);

    const handleEventChange = (e) => {
        const id = e.target.value;
        setSelectedEventId(id);
        setSelectedMapelFilter('ALL');
        setSelectedKelasFilter('ALL');
        fetchExamsAndMonitoring(id);
    };

    const handleMapelFilterChange = (e) => {
        const val = e.target.value;
        setSelectedMapelFilter(val);
        refreshMonitoringData(selectedEventId, val);
    };

    const handleRefreshToken = async (id) => {
        if (!window.confirm('Generate ulang token ujian ini? Peserta akan memerlukan token baru untuk melanjutkan.')) return;
        try {
            await axios.post(`/api/exam/ujian-mapel/${id}/refresh-token`, {}, { headers });
            alert('Token berhasil diperbarui!');
            fetchExamsAndMonitoring(selectedEventId);
        } catch (err) {
            alert('Gagal refresh token');
        }
    };

    const handleResetUjianSiswa = async (siswaId, namaSiswa, ujianId) => {
        const targetUjianId = ujianId || (selectedMapelFilter !== 'ALL' ? selectedMapelFilter : null);
        if (!targetUjianId) {
            alert('Pilih mata pelajaran terlebih dahulu untuk mereset ujian.');
            return;
        }
        if (!window.confirm(`Yakin ingin mengizinkan ${namaSiswa} untuk mengulang ujian ini?\n\nStatus pengerjaan dan semua jawaban siswa akan direset agar siswa dapat mulai mengerjakan kembali dari awal.`)) return;

        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post(`/api/exam/ujian-mapel/${targetUjianId}/reset-siswa/${siswaId}`, {}, { headers });
            alert(`Berhasil! Ujian untuk ${namaSiswa} telah direset. Siswa dapat login dan mengerjakan ujian dari awal.`);
            fetchMonitoringData();
        } catch (err) {
            console.error('Failed to reset exam for student', err);
            alert('Gagal mereset ujian siswa: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleResetPeserta = async (nisn, namaSiswa, ujianId) => {
        if (!window.confirm(`Yakin ingin mereset sesi login untuk ${namaSiswa} (NISN: ${nisn})? Peserta akan bisa login kembali dari perangkat baru.`)) return;
        try {
            const targetUjianId = ujianId || (selectedMapelFilter !== 'ALL' ? selectedMapelFilter : exams[0]?.id);
            if (!targetUjianId) {
                alert('Pilih mata pelajaran terlebih dahulu untuk mereset.');
                return;
            }

            await axios.post(`/api/exam/ujian-mapel/${targetUjianId}/reset-peserta?nisn=${nisn}`, {}, { headers });
            alert(`Sesi login untuk ${namaSiswa} berhasil direset!`);
            refreshMonitoringData();
        } catch (err) {
            alert('Gagal mereset sesi peserta');
        }
    };

    const handleCopyToken = (tokenText, examId) => {
        if (!tokenText || tokenText === '---') return;
        navigator.clipboard.writeText(tokenText);
        setCopiedTokenId(examId);
        setTimeout(() => setCopiedTokenId(null), 2000);
    };

    // Save Proktor Assignments (Baik di awal maupun saat berjalan)
    const handleSaveProktors = async () => {
        if (!selectedEventId) return;
        setSavingProktor(true);
        try {
            // First try dedicated endpoint PUT /api/exam/event/{id}/proktors
            let success = false;
            try {
                await axios.put(`/api/exam/event/${selectedEventId}/proktors`, selectedProktorIds, { headers });
                success = true;
            } catch (e) {
                // Fallback to updating entire event
                const activeEv = events.find(ev => ev.id == selectedEventId);
                if (activeEv) {
                    await axios.put(`/api/exam/event/${selectedEventId}`, {
                        ...activeEv,
                        proktorIds: selectedProktorIds
                    }, { headers });
                    success = true;
                }
            }

            if (success) {
                alert('Penugasan Pengawas / Proktor berhasil diperbarui!');
                setIsProktorModalOpen(false);
                // Update local events state
                setEvents(prev => prev.map(ev => ev.id == selectedEventId ? { ...ev, proktorIds: selectedProktorIds } : ev));
            }
        } catch (err) {
            console.error('Failed to save proctors:', err);
            alert('Gagal menyimpan penugasan proktor.');
        } finally {
            setSavingProktor(false);
        }
    };

    const activeEventObj = events.find(e => e.id == selectedEventId);
    const isProktor = activeEventObj?.proktorIds?.includes(userProfileId);

    // List of unique classes extracted from monitoring data
    const availableClasses = useMemo(() => {
        const set = new Set();
        monitoringData.forEach(item => {
            if (item.namaKelas && item.namaKelas !== 'Tanpa Kelas') {
                set.add(item.namaKelas);
            }
        });
        return Array.from(set).sort();
    }, [monitoringData]);

    // Filtered Monitoring Data for Table
    const filteredMonitoringList = useMemo(() => {
        return monitoringData.filter(item => {
            // Filter Kelas
            if (selectedKelasFilter !== 'ALL' && item.namaKelas !== selectedKelasFilter) {
                return false;
            }

            // Filter Status Ujian
            if (selectedStatusFilter !== 'ALL') {
                if (selectedStatusFilter === 'BELUM_MULAI') {
                    if (item.isFinished || item.isOnline || item.waktuMulai) return false;
                } else if (selectedStatusFilter === 'SEDANG_MENGERJAKAN') {
                    if (item.isFinished || (!item.isOnline && !item.waktuMulai)) return false;
                } else if (selectedStatusFilter === 'SELESAI') {
                    if (!item.isFinished) return false;
                }
            }

            // Search query (Nama / NISN)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = item.namaSiswa?.toLowerCase().includes(q);
                const matchNisn = item.nisn?.toLowerCase().includes(q);
                if (!matchName && !matchNisn) return false;
            }

            return true;
        });
    }, [monitoringData, selectedKelasFilter, selectedStatusFilter, searchQuery]);

    // KPI Counters
    const kpiStats = useMemo(() => {
        let total = monitoringData.length;
        let belumMulai = 0;
        let sedang = 0;
        let selesai = 0;
        let online = 0;

        monitoringData.forEach(item => {
            if (item.isOnline) online++;
            if (item.isFinished) {
                selesai++;
            } else if (item.isOnline || item.waktuMulai) {
                sedang++;
            } else {
                belumMulai++;
            }
        });

        return { total, belumMulai, sedang, selesai, online };
    }, [monitoringData]);

    // Filtered teachers for Proktor modal
    const filteredTeachers = useMemo(() => {
        if (!teacherSearch.trim()) return allTeachers;
        const q = teacherSearch.toLowerCase().trim();
        return allTeachers.filter(t =>
            t.namaLengkap?.toLowerCase().includes(q) ||
            t.email?.toLowerCase().includes(q) ||
            t.username?.toLowerCase().includes(q)
        );
    }, [allTeachers, teacherSearch]);

    // Names of assigned proctors for display in header
    const assignedProctorNames = useMemo(() => {
        if (!activeEventObj?.proktorIds || activeEventObj.proktorIds.length === 0) return 'Belum ada pengawas ditugaskan';
        const names = allTeachers
            .filter(t => activeEventObj.proktorIds.includes(t.profileId))
            .map(t => t.namaLengkap);
        return names.length > 0 ? names.join(', ') : `${activeEventObj.proktorIds.length} Pengawas Terdaftar`;
    }, [activeEventObj, allTeachers]);

    // Active token for selected mapel or first exam
    const currentActiveExam = selectedMapelFilter !== 'ALL'
        ? exams.find(e => e.id == selectedMapelFilter)
        : exams[0];

    return (
        <div className="security-token animate-fade-in">
            {/* PAGE HEADER */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={32} color="#2563eb" /> Dashboard Pengawasan Ujian & Proktor
                    </h1>
                    <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                        Pemantauan langsung peserta ujian real-time, filter mata pelajaran & kelas, serta manajemen token & pengawas.
                    </p>
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={15} color="#2563eb" />
                        <span><strong>Pengawas / Proktor:</strong> {assignedProctorNames}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {(userRole === 'ADMIN' || userRole === 'TU' || isProktor) && (
                        <button
                            className="btn-action-proktor"
                            onClick={() => {
                                setSelectedProktorIds(activeEventObj?.proktorIds || []);
                                setIsProktorModalOpen(true);
                            }}
                            title="Tugaskan Pengawas / Proktor kapan saja (di awal atau saat ujian berjalan)"
                        >
                            <Users size={16} /> Kelola Pengawas / Proktor
                        </button>
                    )}

                    <button
                        className={`btn-autorefresh ${autoRefresh ? 'active' : ''}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        title={autoRefresh ? 'Auto refresh aktif (tiap 15 dtk)' : 'Auto refresh nonaktif'}
                    >
                        <Activity size={16} className={autoRefresh ? 'pulse-icon' : ''} />
                        <span>{autoRefresh ? 'Live 15s' : 'Auto Off'}</span>
                    </button>

                    <button
                        className="btn-refresh-manual"
                        onClick={() => refreshMonitoringData()}
                        disabled={loadingMonitoring}
                        title="Perbarui data sekarang"
                    >
                        <RefreshCw size={16} className={loadingMonitoring ? 'spin-icon' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* KPI STAT CARDS */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <Users size={22} />
                    </div>
                    <div className="kpi-data">
                        <div className="kpi-val">{kpiStats.total}</div>
                        <div className="kpi-label">Total Siswa Terdaftar</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                        <Clock size={22} />
                    </div>
                    <div className="kpi-data">
                        <div className="kpi-val" style={{ color: '#d97706' }}>{kpiStats.belumMulai}</div>
                        <div className="kpi-label">Belum Ujian / Masuk</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                        <Activity size={22} className="pulse-icon" />
                    </div>
                    <div className="kpi-data">
                        <div className="kpi-val" style={{ color: '#16a34a' }}>{kpiStats.sedang}</div>
                        <div className="kpi-label">Sedang Mengerjakan ({kpiStats.online} Online)</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: '#f1f5f9', color: '#3b82f6' }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div className="kpi-data">
                        <div className="kpi-val" style={{ color: '#2563eb' }}>{kpiStats.selesai}</div>
                        <div className="kpi-label">Sudah Selesai Ujian</div>
                    </div>
                </div>

                {currentActiveExam && (
                    <div className="kpi-card token-card" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Token: {currentActiveExam.namaMapel}
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '2px', color: '#fbbf24', marginTop: '2px' }}>
                                {currentActiveExam.token || '---'}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                onClick={() => handleCopyToken(currentActiveExam.token, currentActiveExam.id)}
                                style={{ background: '#334155', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                                title="Salin Token"
                            >
                                {copiedTokenId === currentActiveExam.id ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
                            </button>
                            <button
                                onClick={() => handleRefreshToken(currentActiveExam.id)}
                                style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                                title="Perbarui Token Baru"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN FILTER BAR (FILTER UTAMA: MAPEL, KELAS, STATUS, SEARCH) */}
            <div className="card filter-card" style={{ marginBottom: '20px', padding: '18px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#0f172a', fontWeight: 700, fontSize: '0.95rem' }}>
                    <Filter size={18} color="#2563eb" /> Filter Pengawasan & Pencarian
                </div>

                <div className="filters-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
                    {/* 1. Filter Event */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Event Ujian</label>
                        <select className="styled-select" value={selectedEventId} onChange={handleEventChange}>
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.namaEvent} ({ev.semester} - {ev.tahunAjaran})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Filter Mata Pelajaran (Filter Utama) */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Mata Pelajaran (Filter Utama)</label>
                        <select className="styled-select" value={selectedMapelFilter} onChange={handleMapelFilterChange}>
                            <option value="ALL">-- Semua Mata Pelajaran --</option>
                            {exams.map(ex => (
                                <option key={ex.id} value={ex.id}>
                                    {ex.namaMapel} ({ex.namaGuru})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Filter Kelas */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Filter Kelas</label>
                        <select className="styled-select" value={selectedKelasFilter} onChange={(e) => setSelectedKelasFilter(e.target.value)}>
                            <option value="ALL">-- Semua Kelas --</option>
                            {availableClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    {/* 4. Filter Status Ujian */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Status Pengerjaan</label>
                        <select className="styled-select" value={selectedStatusFilter} onChange={(e) => setSelectedStatusFilter(e.target.value)}>
                            <option value="ALL">-- Semua Status --</option>
                            <option value="BELUM_MULAI">Belum Ujian / Masuk</option>
                            <option value="SEDANG_MENGERJAKAN">Sedang Mengerjakan</option>
                            <option value="SELESAI">Sudah Selesai</option>
                        </select>
                    </div>

                    {/* 5. Search Bar */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Cari Nama / NISN</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                className="styled-input"
                                placeholder="Ketik nama atau NIS..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: '36px' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* TAB SWITCHER */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                    onClick={() => setActiveTab('monitoring')}
                    className={`tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
                >
                    <List size={18} /> Tabel Pengawasan Siswa ({filteredMonitoringList.length})
                </button>
                <button
                    onClick={() => setActiveTab('token_list')}
                    className={`tab-btn ${activeTab === 'token_list' ? 'active' : ''}`}
                >
                    <Key size={18} /> Daftar Jadwal & Token Mapel ({exams.length})
                </button>
            </div>

            {/* TAB 1: TABEL PENGAWASAN PESERTA REAL-TIME */}
            {activeTab === 'monitoring' && (
                <div className="card table-card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={18} color="#16a34a" /> Data Pemantauan Peserta
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                (Terakhir diperbarui: {lastUpdated.toLocaleTimeString('id-ID')})
                            </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                            Menampilkan <strong>{filteredMonitoringList.length}</strong> dari <strong>{monitoringData.length}</strong> peserta
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="monitor-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                                    <th>NISN</th>
                                    <th>Nama Siswa</th>
                                    <th>Kelas</th>
                                    <th>Mata Pelajaran</th>
                                    <th>Status Ujian</th>
                                    <th>Waktu Masuk & Selesai</th>
                                    <th>Sisa Waktu</th>
                                    <th>Sesi Perangkat</th>
                                    <th style={{ textAlign: 'center' }}>Aksi Pengawas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingMonitoring && monitoringData.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                            <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                                            Memuat data pemantauan peserta...
                                        </td>
                                    </tr>
                                ) : filteredMonitoringList.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                            Tidak ada peserta yang cocok dengan filter yang dipilih.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMonitoringList.map((std, idx) => {
                                        const isFinished = std.isFinished;
                                        const isOngoing = !isFinished && (std.isOnline || std.waktuMulai);
                                        const isBelum = !isFinished && !isOngoing;

                                        let statusBadgeClass = 'badge-belum';
                                        let statusBadgeText = 'Belum Ujian';
                                        if (isFinished) {
                                            statusBadgeClass = 'badge-selesai';
                                            statusBadgeText = 'Selesai';
                                        } else if (isOngoing) {
                                            statusBadgeClass = 'badge-ongoing';
                                            statusBadgeText = 'Sedang Mengerjakan';
                                        }

                                        let timeString = '-';
                                        if (std.waktuMulai) {
                                            const start = new Date(std.waktuMulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                            const end = std.waktuSelesai
                                                ? new Date(std.waktuSelesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                : '...';
                                            timeString = `${start} - ${end}`;
                                        }

                                        let sisaWaktuStr = '-';
                                        if (isFinished) {
                                            sisaWaktuStr = 'Tuntas';
                                        } else if (isOngoing && std.sisaWaktuDetik !== null && std.sisaWaktuDetik !== undefined) {
                                            const mins = Math.floor(std.sisaWaktuDetik / 60);
                                            const secs = std.sisaWaktuDetik % 60;
                                            sisaWaktuStr = `${mins}m ${secs}s`;
                                        }

                                        return (
                                            <tr key={`${std.siswaId}-${std.ujianId || idx}`} className={isOngoing ? 'row-ongoing' : ''}>
                                                <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                                <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{std.nisn || '-'}</span></td>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{std.namaSiswa}</div>
                                                </td>
                                                <td>
                                                    <span className="badge-kelas">{std.namaKelas || 'Tanpa Kelas'}</span>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: '#334155' }}>{std.namaMapel || '-'}</span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${statusBadgeClass}`}>
                                                        {isFinished && <CheckCircle2 size={12} />}
                                                        {isOngoing && <Activity size={12} className="pulse-icon" />}
                                                        {isBelum && <Clock size={12} />}
                                                        {statusBadgeText}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                    {timeString}
                                                </td>
                                                <td style={{ fontSize: '0.85rem', fontWeight: 700, color: isFinished ? '#2563eb' : isOngoing ? '#16a34a' : '#64748b' }}>
                                                    {sisaWaktuStr}
                                                </td>
                                                <td>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: std.isOnline ? '#16a34a' : '#94a3b8' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: std.isOnline ? '#22c55e' : '#cbd5e1' }}></span>
                                                        {std.isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={() => handleResetPeserta(std.nisn, std.namaSiswa, std.ujianId)}
                                                            className="btn-reset-session"
                                                            title="Gunakan jika siswa terkendala perangkat atau browser tertutup"
                                                        >
                                                            Reset Login
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetUjianSiswa(std.siswaId, std.namaSiswa, std.ujianId)}
                                                            className="btn-reset-exam-action"
                                                            style={{
                                                                background: '#fff7ed',
                                                                color: '#c2410c',
                                                                border: '1px solid #fed7aa',
                                                                padding: '5px 10px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                            title="Hapus status pengerjaan dan jawaban agar siswa bisa mengulang ujian dari awal"
                                                        >
                                                            <RotateCcw size={11} /> Ulangi Ujian
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: DAFTAR JADWAL & TOKEN MAPEL */}
            {activeTab === 'token_list' && (
                <div className="card table-card" style={{ padding: 0 }}>
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>Daftar Token & Jadwal Ujian Mata Pelajaran</h3>
                    </div>
                    <div className="table-responsive">
                        <table className="monitor-table">
                            <thead>
                                <tr>
                                    <th>Mata Pelajaran</th>
                                    <th>Guru Pengampu</th>
                                    <th>Waktu Pelaksanaan</th>
                                    <th>Durasi</th>
                                    <th>Token Akses Siswa</th>
                                    <th style={{ textAlign: 'center' }}>Aksi Token</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exams.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                                            Tidak ada ujian ditemukan pada event ini.
                                        </td>
                                    </tr>
                                ) : (
                                    exams.map(exam => {
                                        const start = new Date(exam.waktuMulai).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
                                        const end = new Date(exam.waktuSelesai).toLocaleString('id-ID', { timeStyle: 'short' });

                                        return (
                                            <tr key={exam.id}>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{exam.namaMapel}</div>
                                                </td>
                                                <td>{exam.namaGuru}</td>
                                                <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                    {start} - {end}
                                                </td>
                                                <td>{exam.durasi || 60} Menit</td>
                                                <td>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: '#92400e', letterSpacing: '1px' }}>
                                                        <Key size={15} />
                                                        <span>{exam.token || '---'}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                        <button
                                                            onClick={() => handleCopyToken(exam.token, exam.id)}
                                                            className="btn-table-action"
                                                            title="Salin Token"
                                                        >
                                                            {copiedTokenId === exam.id ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleRefreshToken(exam.id)}
                                                            className="btn-table-action"
                                                            title="Buat Token Baru"
                                                        >
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL: TUGASKAN PENGAWAS / PROKTOR (BISA DIAWAL ATAU SAAT BERJALAN) */}
            {isProktorModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '540px' }}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Users size={20} color="#2563eb" /> Kelola Pengawas / Proktor
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    Tugaskan pengawas ujian kapan saja (baik di awal atau saat ujian sedang berjalan).
                                </p>
                            </div>
                            <button onClick={() => setIsProktorModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <X size={20} color="#64748b" />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '20px' }}>
                            <div style={{ position: 'relative', marginBottom: '14px' }}>
                                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    className="styled-input"
                                    placeholder="Cari nama guru..."
                                    value={teacherSearch}
                                    onChange={(e) => setTeacherSearch(e.target.value)}
                                    style={{ paddingLeft: '36px' }}
                                />
                            </div>

                            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px', background: '#f8fafc' }}>
                                {filteredTeachers.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                        Tidak ada guru ditemukan.
                                    </div>
                                ) : (
                                    filteredTeachers.map(t => {
                                        const pId = t.profileId;
                                        const isChecked = selectedProktorIds.includes(pId);

                                        return (
                                            <label
                                                key={t.id || t.profileId}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '10px 14px',
                                                    borderRadius: '8px',
                                                    marginBottom: '4px',
                                                    background: isChecked ? '#eff6ff' : 'white',
                                                    border: `1px solid ${isChecked ? '#bfdbfe' : '#e2e8f0'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            const check = e.target.checked;
                                                            setSelectedProktorIds(prev =>
                                                                check
                                                                    ? (prev.includes(pId) ? prev : [...prev, pId])
                                                                    : prev.filter(id => id !== pId)
                                                            );
                                                        }}
                                                        style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{t.namaLengkap}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.email || t.username}</div>
                                                    </div>
                                                </div>

                                                {isChecked && (
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>
                                                        Proktor Aktif
                                                    </span>
                                                )}
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '10px' }}>
                                Total dipilih: <strong>{selectedProktorIds.length}</strong> pengawas
                            </div>
                        </div>

                        <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
                            <button
                                onClick={() => setIsProktorModalOpen(false)}
                                style={{ background: 'white', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveProktors}
                                disabled={savingProktor}
                                style={{ background: '#2563eb', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                {savingProktor ? <RefreshCw size={14} className="spin-icon" /> : <Check size={16} />}
                                {savingProktor ? 'Menyimpan...' : 'Simpan Pengawas'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .security-token { padding: 0; }
                .card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }

                /* Action buttons */
                .btn-action-proktor { display: flex; align-items: center; gap: 8px; background: #2563eb; color: white; border: none; padding: 10px 18px; borderRadius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(37,99,235,0.2); }
                .btn-action-proktor:hover { background: #1d4ed8; transform: translateY(-1px); }

                .btn-autorefresh { display: flex; align-items: center; gap: 6px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .btn-autorefresh.active { background: #ecfdf5; color: #059669; border-color: #a7f3d0; }

                .btn-refresh-manual { display: flex; align-items: center; gap: 6px; background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .btn-refresh-manual:hover { background: #f1f5f9; }

                /* KPI Grid */
                .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
                .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .kpi-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .kpi-val { font-size: 1.5rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
                .kpi-label { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
                .token-card { display: flex; justify-content: space-between; align-items: center; }

                /* Inputs */
                .styled-select, .styled-input { width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 0.9rem; color: #1e293b; outline: none; transition: all 0.2s; background: #f8fafc; }
                .styled-select:focus, .styled-input:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

                /* Tabs */
                .tab-btn { display: flex; align-items: center; gap: 8px; background: transparent; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 0.9rem; color: #64748b; cursor: pointer; transition: all 0.2s; }
                .tab-btn.active { background: white; color: #2563eb; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }

                /* Tables */
                .table-responsive { width: 100%; overflow-x: auto; }
                .monitor-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                .monitor-table th { text-align: left; padding: 14px 18px; background: #f8fafc; color: #64748b; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
                .monitor-table td { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .monitor-table tr:hover { background: #f8fafc; }
                .monitor-table tr.row-ongoing { background: #f0fdf420; }

                .badge-kelas { background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
                
                .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
                .badge-belum { background: #fffbeb; color: #b45309; }
                .badge-ongoing { background: #dcfce7; color: #15803d; }
                .badge-selesai { background: #eff6ff; color: #1d4ed8; }

                .btn-reset-session { background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
                .btn-reset-session:hover { background: #e11d48; color: white; }

                .btn-table-action { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px; color: #475569; cursor: pointer; }
                .btn-table-action:hover { background: #f1f5f9; }

                /* Modal */
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 20px; backdrop-filter: blur(4px); }
                .modal-content { background: white; border-radius: 20px; width: 100%; max-width: 500px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); }
                .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }

                /* Animations */
                .spin-icon { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .pulse-icon { animation: pulse 1.5s ease-in-out infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.15); } }

                .animate-fade-in { animation: fadeIn 0.25s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

                /* Dark Theme */
                [data-theme="dark"] .page-header h1 { color: #f8fafc; }
                [data-theme="dark"] .card { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .kpi-card { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .kpi-val { color: #f8fafc; }
                [data-theme="dark"] .styled-select, [data-theme="dark"] .styled-input { background: #0f172a; border-color: #334155; color: #f8fafc; }
                [data-theme="dark"] .styled-select:focus, [data-theme="dark"] .styled-input:focus { background: #0f172a; border-color: #3b82f6; }
                [data-theme="dark"] .monitor-table th { background: #0f172a; color: #94a3b8; border-color: #334155; }
                [data-theme="dark"] .monitor-table td { border-bottom-color: #334155; color: #cbd5e1; }
                [data-theme="dark"] .monitor-table tr:hover { background: #0f172a50; }
                [data-theme="dark"] .tab-btn { color: #94a3b8; }
                [data-theme="dark"] .tab-btn.active { background: #1e293b; color: #60a5fa; }
                [data-theme="dark"] .modal-content { background: #1e293b; color: #f8fafc; border: 1px solid #334155; }
                [data-theme="dark"] .modal-header, [data-theme="dark"] .modal-footer { background: #0f172a; border-color: #334155; }
            `}</style>
        </div>
    );
};

export default SecurityToken;
