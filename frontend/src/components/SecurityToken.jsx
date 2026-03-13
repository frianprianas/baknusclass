import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, RefreshCw, Clock, Key, Calendar, Activity, X } from 'lucide-react';

const SecurityToken = () => {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState('');
    const [myAssignments, setMyAssignments] = useState([]);

    const [monitoringData, setMonitoringData] = useState(null);
    const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);
    const [monitoringExamName, setMonitoringExamName] = useState('');

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        let role = 'GURU';
        if (userStr) {
            const userObj = JSON.parse(userStr);
            role = userObj.role || 'GURU';
            setUserRole(role);
        }

        fetchEvents();
        if (role === 'GURU') {
            fetchMyAssignments();
        }
    }, []);

    const fetchEvents = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get('/api/exam/event', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const activeEvents = res.data.filter(e => e.statusAktif);
            setEvents(activeEvents);
            if (activeEvents.length > 0) {
                setSelectedEventId(activeEvents[0].id);
                fetchExams(activeEvents[0].id);
            }
        } catch (err) {
            console.error('Fetch errors', err);
        }
    };

    const fetchMyAssignments = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get('/api/enrollment/guru-mapel/my', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMyAssignments(res.data);
        } catch (err) {
            console.error('Fetch assignments error:', err);
        }
    };

    const fetchExams = async (eventId) => {
        if (!eventId) return;
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`/api/exam/ujian-mapel/event/${eventId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExams(res.data);
        } catch (err) {
            console.error('Fetch exams error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEventChange = (e) => {
        const id = e.target.value;
        setSelectedEventId(id);
        fetchExams(id);
    };

    const handleRefreshToken = async (id) => {
        if (!window.confirm('Generate ulang token ujian ini? Semua peserta mungkin harus login ulang atau menggunakan token baru.')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`/api/exam/ujian-mapel/${id}/refresh-token`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchExams(selectedEventId);
            alert('Token berhasil di perbarui!');
        } catch (err) {
            alert('Gagal refresh token');
        }
    };

    const handleOpenMonitor = async (exam) => {
        setMonitoringExamName(exam.namaMapel);
        setIsMonitoringModalOpen(true);
        setMonitoringData(null);
        await refreshMonitoring(exam.id);
    };

    const refreshMonitoring = async (examId) => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`/api/exam/ujian-mapel/${examId}/monitoring`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Auto sort: online on top, finished at bottom
            const sortedData = res.data.sort((a, b) => {
                if (a.isFinished && !b.isFinished) return 1;
                if (!a.isFinished && b.isFinished) return -1;
                if (a.isOnline && !b.isOnline) return -1;
                if (!a.isOnline && b.isOnline) return 1;
                return a.namaSiswa.localeCompare(b.namaSiswa);
            });
            setMonitoringData(sortedData);
        } catch (err) {
            console.error('Failed to monitor', err);
        }
    };

    const handleResetPeserta = async (nisn) => {
        if (!window.confirm(`Yakin ingin mereset sesi login untuk peserta dengan NISN: ${nisn}? Peserta akan bisa login kembali dari perangkat baru.`)) return;
        const token = localStorage.getItem('token');
        try {
            // Find current exam ID
            const examId = filteredExams.find(e => e.namaMapel === monitoringExamName)?.id;
            if (!examId) return;

            await axios.post(`/api/exam/ujian-mapel/${examId}/reset-peserta?nisn=${nisn}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Sesi login peserta berhasil direset!');
            refreshMonitoring(examId);
        } catch (err) {
            alert('Gagal mereset sesi peserta');
        }
    };

    const activeEventObj = events.find(e => e.id == selectedEventId);
    const userProfileId = JSON.parse(localStorage.getItem('user') || '{}').profileId;
    const isProktor = activeEventObj?.proktorIds?.includes(userProfileId);

    const filteredExams = userRole === 'ADMIN' || userRole === 'TU' || isProktor ? exams : exams.filter(exam => {
        return myAssignments.some(assign => assign.id === exam.guruMapelId);
    });

    return (
        <div className="security-token animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Token & Keamanan Ujian</h1>
                    <p>Monitoring event aktif dan manajemen keamanan akses ujian</p>
                </div>
            </div>

            <div className="content-grid">
                <div className="card event-selector-card">
                    <div className="card-header">
                        <Calendar size={20} className="icon-blue" />
                        <h3>Pilih Event Aktif</h3>
                    </div>
                    <div className="card-body">
                        {events.length === 0 ? (
                            <p className="no-data">Belum ada event ujian yang aktif.</p>
                        ) : (
                            <select
                                className="styled-select"
                                value={selectedEventId}
                                onChange={handleEventChange}
                            >
                                {events.map(ev => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.namaEvent} ({ev.semester} - {ev.tahunAjaran})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="card token-list-card">
                    <div className="card-header">
                        <ShieldCheck size={20} className="icon-green" />
                        <h3>Daftar Token Ujian</h3>
                    </div>
                    <div className="card-body p-0">
                        {loading ? (
                            <div className="loading-state">Memuat data...</div>
                        ) : filteredExams.length === 0 ? (
                            <div className="empty-state">
                                Tidak ada ujian yang ditemukan untuk event ini.
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="token-table">
                                    <thead>
                                        <tr>
                                            <th>Mata Pelajaran</th>
                                            <th>Guru</th>
                                            <th>Waktu Pelaksanaan</th>
                                            <th>Aksi & Pantau</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredExams.map(exam => {
                                            const start = new Date(exam.waktuMulai).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
                                            const end = new Date(exam.waktuSelesai).toLocaleString('id-ID', { timeStyle: 'short' });

                                            const now = new Date();
                                            const isOngoing = now >= new Date(exam.waktuMulai) && now <= new Date(exam.waktuSelesai);
                                            const isDone = now > new Date(exam.waktuSelesai);

                                            return (
                                                <tr key={exam.id}>
                                                    <td>
                                                        <div className="mapel-name">{exam.namaMapel}</div>
                                                        <div className={`status-badge ${isOngoing ? 'ongoing' : isDone ? 'done' : 'upcoming'}`}>
                                                            {isOngoing ? 'Sedang Berjalan' : isDone ? 'Selesai' : 'Akan Datang'}
                                                        </div>
                                                    </td>
                                                    <td>{exam.namaGuru}</td>
                                                    <td>
                                                        <div className="time-info">
                                                            <Clock size={14} />
                                                            <span>{start} - {end}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="token-display">
                                                            <Key size={16} />
                                                            <span>{exam.token || '---'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                className="btn-refresh"
                                                                onClick={() => handleRefreshToken(exam.id)}
                                                                title="Buat Token Baru"
                                                            >
                                                                <RefreshCw size={16} />
                                                                <span>Refresh</span>
                                                            </button>
                                                            <button
                                                                className="btn-monitor"
                                                                onClick={() => handleOpenMonitor(exam)}
                                                                title="Pantau Peserta Ujian"
                                                            >
                                                                <Activity size={16} />
                                                                <span>Pantau</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isMonitoringModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content monitor-modal">
                        <div className="modal-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Pantau Peserta Ujian</h3>
                                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '4px 0 0 0' }}>{monitoringExamName}</p>
                            </div>
                            <button onClick={() => setIsMonitoringModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <X size={24} color="#64748b" />
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px' }}>
                            {!monitoringData ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Memuat data peserta...</div>
                            ) : monitoringData.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Belum ada siswa yang dikaitkan pada mapel ini.</div>
                            ) : (
                                <div className="monitor-grid">
                                    {monitoringData.map((std) => (
                                        <div key={std.siswaId} className={`monitor-card ${std.isFinished ? 'finished' : std.isOnline ? 'online' : 'offline'}`}>
                                            <div className="monitor-status-dot" style={{ background: std.isFinished ? '#3b82f6' : std.isOnline ? '#10b981' : '#ef4444' }}></div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{std.namaSiswa}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>NIS: {std.nisn}</div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: std.isFinished ? '#3b82f6' : std.isOnline ? '#10b981' : '#ef4444' }}>
                                                    {std.isFinished ? 'Selesai' : std.isOnline ? 'Online Mengerjakan' : 'Offline / Tidak Aktif'}
                                                </div>
                                                <button
                                                    onClick={() => handleResetPeserta(std.nisn)}
                                                    style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: '#ffe4e6', color: '#e11d48', border: '1px solid #fda4af', cursor: 'pointer', fontWeight: 600 }}
                                                >
                                                    Reset Login
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .security-token { padding: 0; }
                .page-header { margin-bottom: 30px; }
                .page-header h1 { font-size: 1.8rem; color: #1e293b; margin-bottom: 5px; }
                .page-header p { color: #64748b; }
                .content-grid { display: grid; gap: 24px; }
                .card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
                .card-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
                .card-header h3 { margin: 0; font-size: 1.1rem; color: #0f172a; font-weight: 700; }
                .icon-blue { color: #3b82f6; }
                .icon-green { color: #10b981; }
                .card-body { padding: 24px; }
                .p-0 { padding: 0; }
                .styled-select { width: 100%; max-width: 400px; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1rem; color: #1e293b; outline: none; transition: all 0.2s; background: #f8fafc; }
                .styled-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); background: white; }
                .token-table { width: 100%; border-collapse: collapse; }
                .token-table th { text-align: left; padding: 16px 24px; background: #f8fafc; color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                .token-table td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .mapel-name { font-weight: 700; color: #0f172a; margin-bottom: 6px; }
                .status-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
                .status-badge.ongoing { background: #dcfce7; color: #166534; }
                .status-badge.done { background: #f1f5f9; color: #64748b; }
                .status-badge.upcoming { background: #dbeafe; color: #1e40af; }
                .time-info { display: flex; align-items: center; gap: 6px; color: #475569; font-size: 0.9rem; }
                .token-display { display: inline-flex; align-items: center; gap: 8px; background: #fffbeb; border: 1px solid #fde68a; padding: 6px 12px; border-radius: 8px; color: #92400e; font-weight: 700; font-family: monospace; font-size: 1.1rem; letter-spacing: 2px; }
                .btn-refresh { display: flex; align-items: center; gap: 6px; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .btn-refresh:hover { background: #3b82f6; color: white; }
                .btn-monitor { display: flex; align-items: center; gap: 6px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .btn-monitor:hover { background: #16a34a; color: white; }
                .loading-state, .empty-state, .no-data { padding: 40px; text-align: center; color: #64748b; font-style: italic; }
                
                /* Modal Styles */
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; backdrop-filter: blur(4px); }
                .monitor-modal { background: white; border-radius: 20px; width: 100%; max-width: 600px; overflow: hidden; display: flex; flex-direction: column; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
                
                .monitor-grid { display: flex; flex-direction: column; gap: 10px; }
                .monitor-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; transition: all 0.2s; }
                .monitor-card.online { border-left: 4px solid #10b981; background: #f0fdf4; border-color: #bbf7d0; }
                .monitor-card.offline { border-left: 4px solid #ef4444; background: #fef2f2; border-color: #fca5a5; opacity: 0.8; }
                .monitor-card.finished { border-left: 4px solid #3b82f6; background: #eff6ff; border-color: #bfdbfe; opacity: 0.7; }
                .monitor-status-dot { width: 10px; height: 10px; border-radius: 50%; }

                .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}
            </style>
        </div>
    );
};

export default SecurityToken;
