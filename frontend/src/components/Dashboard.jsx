import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import {
  Users,
  GraduationCap,
  BookMarked,
  ClipboardCheck,
  Bell,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [proctorEvents, setProctorEvents] = useState([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  let userEmail = user.email;
  if (!userEmail && token) {
    try { userEmail = JSON.parse(atob(token.split('.')[1])).sub; } catch (e) { }
  }

    const [myExams, setMyExams] = useState([]);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('/api/dashboard/summary', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSummary(response.data);
            } catch (err) {
                console.error('Failed to fetch dashboard summary', err);
            } finally {
                setLoading(false);
            }
        };

        const fetchMyExams = async () => {
            if (user.role !== 'GURU' || !token) return;
            try {
                const res = await axios.get(`/api/exam/ujian-mapel/guru/${user.profileId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMyExams(res.data);
            } catch (e) { console.error(e); }
        };

        const checkProctorStatus = async () => {
            if (!token || user.role !== 'GURU') return;
            try {
                const res = await axios.get('/api/exam/event', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const active = res.data.filter(e => e.statusAktif && e.proktorIds?.includes(user.profileId));
                setProctorEvents(active);
            } catch (e) { console.error(e); }
        };

        const checkStudentExams = async () => {
            if (user.role !== 'SISWA' || !token) return;
            try {
                const resp = await axios.get('/api/exam/event', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const hasActiveEvent = resp.data.some(e => e.statusAktif);
                if (hasActiveEvent) {
                    navigate('/student-exams');
                }
            } catch (e) { console.error(e); }
        };

        if (['TU', 'GURU', 'ADMIN'].includes(user.role)) {
            fetchSummary();
        }
        if (user.role === 'GURU') fetchMyExams();
        checkProctorStatus();
        if (user.role === 'SISWA') checkStudentExams();
    }, []);

  const dataCards = [
    { label: 'Total Siswa', value: summary?.totalSiswa || 0, icon: Users, color: '#3b82f6' },
    { label: 'Total Guru', value: summary?.totalGuru || 0, icon: GraduationCap, color: '#8b5cf6' },
    { label: 'Mata Pelajaran', value: summary?.totalMapel || 0, icon: BookMarked, color: '#10b981' },
    { label: 'Ujian Berlangsung', value: summary?.totalUjianAktif || 0, icon: ClipboardCheck, color: '#f59e0b' },
  ];

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1>Statistik Sistem</h1>
          <p>Ringkasan data BaknusClass hari ini</p>
        </div>
        <button className="primary-btn">
          <span>Laporan Lengkap</span>
          <ArrowUpRight size={16} />
        </button>
      </div>

      {user.role === 'SISWA' && (
        <div className="student-welcome-alert">
          <div className="alert-icon">✨</div>
          <div className="alert-content">
            <h3>Selamat Datang, {user.name}! {userEmail && `(NIS: ${userEmail.split('@')[0]})`}</h3>
            <p>Isilah Semua data dengan Jujur, Karena Kejujuran lebih penting dari Nilai, Terima kasih, Selamat Beribadah salam SaJuTa.</p>
          </div>
        </div>
      )}

      {user.role === 'GURU' && proctorEvents.length > 0 && (
        <div className="proctor-alert" onClick={() => navigate('/security')}>
          <div className="alert-icon-ring">
            <ShieldCheck size={32} />
          </div>
          <div className="alert-body">
            <div className="alert-tag">TUGAS PENGAWASAN AKTIF</div>
            <h3>Anda ditugaskan sebagai Proktor!</h3>
            <p>Anda memiliki tugas pengawasan pada event: <strong>{proctorEvents.map(e => e.namaEvent).join(', ')}</strong>. Klik di sini untuk memantau aktivitas siswa.</p>
          </div>
          <button className="monitor-btn" onClick={(e) => { e.stopPropagation(); navigate('/security'); }}>
            <Activity size={18} />
            Pantau Sekarang
          </button>
        </div>
      )}

      <div className="stats-grid">
        {dataCards.map((card, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
              <card.icon size={24} />
            </div>
            <div className="stat-info">
              <p className="stat-label">{card.label}</p>
              <h3 className="stat-value">{loading ? '...' : card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {user.role === 'GURU' ? (
          <div className="chart-container">
            <div className="container-header">
              <h3>Jadwal Ujian Anda</h3>
              <p>Daftar ujian yang Anda ampu pada event aktif</p>
            </div>
            <div className="my-exams-list">
              {myExams.length > 0 ? (
                <div className="table-responsive">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Mata Pelajaran</th>
                        <th>Event</th>
                        <th>Waktu</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myExams.map((ex, i) => (
                        <tr key={i}>
                          <td><strong>{ex.namaMapel}</strong></td>
                          <td><span className="badge-event">{ex.namaEvent}</span></td>
                          <td>{new Date(ex.waktuMulai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <button className="small-action-btn" onClick={() => navigate('/exams')}>Kelola</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-exams">
                  <BookMarked size={48} />
                  <p>Belum ada jadwal ujian untuk Anda.</p>
                  <button onClick={() => navigate('/exams')}>Buat Jadwal</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="chart-container">
            <div className="container-header">
              <h3>Sebaran Nilai Siswa</h3>
              <p>Data rata-rata nilai seluruh siswa</p>
            </div>
            <div className="placeholder-chart">
              <div className="bar-group">
                {(summary?.sebaranNilaiSiswa || []).map((item, idx) => {
                  const maxCount = Math.max(...(summary?.sebaranNilaiSiswa?.map(s => s.count) || [1]));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 5;
                  return (
                    <div
                      key={idx}
                      className="bar"
                      style={{
                        height: `${height}%`,
                        background: item.range === '80-100' ? '#10b981' : item.range === '60-79' ? '#3b82f6' : '#f59e0b'
                      }}
                      title={`${item.range}: ${item.count} siswa`}
                    ></div>
                  );
                })}
              </div>
              <div className="chart-labels">
                {(summary?.sebaranNilaiSiswa || []).map((item, idx) => (
                  <span key={idx}>{item.range}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="activity-container">
          <div className="container-header">
            <h3>Aktivitas Terakhir</h3>
            <button className="text-link">Lihat Semua</button>
          </div>
          <div className="activity-list">
            {summary?.aktivitasTerakhir && summary.aktivitasTerakhir.length > 0 ? (
              summary.aktivitasTerakhir.map((act, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-dot"></div>
                  <div className="activity-info">
                    <p className="activity-text"><strong>{act.user}</strong> {act.action}</p>
                    <p className="activity-time">{act.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">Belum ada aktivitas penyelesaian ujian terbaru.</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .student-welcome-alert {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          padding: 24px;
          border-radius: 20px;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
        }
        .alert-icon { font-size: 2rem; }
        .alert-content h3 { margin-bottom: 4px; font-weight: 800; }
        .alert-content p { opacity: 0.9; font-weight: 500; }

        .proctor-alert {
          background: white;
          border: 3px solid #3b82f6;
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          gap: 24px;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }
        .proctor-alert:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 25px -5px rgba(59, 130, 246, 0.2);
          border-color: #2563eb;
        }
        .alert-icon-ring {
          width: 64px;
          height: 64px;
          background: #eff6ff;
          color: #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .alert-body { flex: 1; }
        .alert-tag {
          display: inline-block;
          background: #3b82f6;
          color: white;
          padding: 4px 12px;
          border-radius: 50px;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .alert-body h3 { font-size: 1.25rem; color: #1e293b; font-weight: 800; margin-bottom: 4px; }
        .alert-body p { color: #64748b; font-size: 0.95rem; }
        .monitor-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }



        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .dashboard-header h1 {
          font-size: 1.75rem;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .dashboard-header p {
          color: #64748b;
        }

        @media (max-width: 640px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .dashboard-header h1 { font-size: 1.4rem; }
        }

        .primary-btn {
          background: #3b82f6;
          color: white;
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
          border: none;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }

        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 640px) {
          .stats-grid { 
            grid-template-columns: 1fr; 
            gap: 16px;
          }
          .stat-card { padding: 16px; }
        }

        .stat-card {
          background: white;
          padding: 24px;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-label {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: 24px;
        }

        .chart-container, .activity-container {
          background: white;
          padding: 24px;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
        }

        .container-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .container-header h3 {
          font-size: 1.1rem;
          color: #1e293b;
        }

        .container-header p {
          font-size: 0.85rem;
          color: #64748b;
        }

        .placeholder-chart {
          height: 250px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .bar-group {
          display: flex;
          align-items: flex-end;
          gap: 30px;
          height: 100%;
          padding: 0 20px;
        }

        .bar {
          flex: 1;
          background: #e2e8f0;
          border-radius: 6px 6px 0 0;
          transition: all 0.5s ease;
        }

        .chart-labels {
          display: flex;
          justify-content: space-between;
          padding: 15px 10px 0;
          color: #94a3b8;
          font-size: 0.75rem;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .activity-item {
          display: flex;
          gap: 16px;
        }

        .activity-dot {
          width: 10px;
          height: 10px;
          background: #3b82f6;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .activity-text {
          font-size: 0.9rem;
          color: #334155;
          margin-bottom: 2px;
        }

        .activity-time {
          font-size: 0.8rem;
          color: #94a3b8;
        }

        .text-link {
          background: none;
          color: #3b82f6;
          font-size: 0.85rem;
          font-weight: 600;
          border: none;
        }

        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .dashboard-grid { grid-template-columns: 1fr; }
        }

        /* Dark Mode Overrides for Dashboard */
        [data-theme="dark"] .top-nav-standalone,
        [data-theme="dark"] .stat-card,
        [data-theme="dark"] .chart-container,
        [data-theme="dark"] .activity-container,
        [data-theme="dark"] .proctor-alert {
          background: #1e293b;
          border-color: #334155;
        }

        [data-theme="dark"] .proctor-alert {
          border-color: #3b82f640;
        }

        [data-theme="dark"] .proctor-alert:hover {
          background: #1e293b;
          border-color: #3b82f6;
        }

        [data-theme="dark"] .alert-icon-ring {
          background: #0f172a;
          color: #60a5fa;
        }

        [data-theme="dark"] .alert-body h3,
        [data-theme="dark"] .dashboard-header h1,
        [data-theme="dark"] .container-header h3,
        [data-theme="dark"] .stat-value,
        [data-theme="dark"] .welcome-text span,
        [data-theme="dark"] .search-bar input {
          color: #f8fafc;
        }

        [data-theme="dark"] .alert-body p,
        [data-theme="dark"] .dashboard-header p,
        [data-theme="dark"] .container-header p,
        [data-theme="dark"] .stat-label,
        [data-theme="dark"] .welcome-text p,
        [data-theme="dark"] .activity-time {
          color: #94a3b8;
        }

        [data-theme="dark"] .search-bar {
          background: #0f172a;
          border: 1px solid #334155;
        }

        [data-theme="dark"] .v-divider {
          background: #334155;
        }

        [data-theme="dark"] .activity-text {
          color: #cbd5e1;
        }

        [data-theme="dark"] .activity-text strong {
          color: #f8fafc;
        }

        [data-theme="dark"] .activity-item {
          border-left-color: #334155;
        }

        [data-theme="dark"] .activity-dot {
          background: #3b82f6;
          box-shadow: 0 0 0 4px #1e293b;
        }

        .dashboard-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .dashboard-table th {
          text-align: left;
          padding: 12px 16px;
          color: #64748b;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #f1f5f9;
        }
        .dashboard-table td {
          padding: 16px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 0.9rem;
        }
        .badge-event {
          background: #eff6ff;
          color: #3b82f6;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .small-action-btn {
          background: white;
          border: 1.5px solid #e2e8f0;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #1e293b;
          transition: all 0.2s;
        }
        .small-action-btn:hover {
          background: #f8fafc;
          border-color: #3b82f6;
          color: #3b82f6;
        }
        .empty-exams {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #94a3b8;
          text-align: center;
        }
        .empty-exams p {
          margin: 16px 0;
          font-weight: 500;
        }
        .empty-exams button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 24px;
          border-radius: 10px;
          font-weight: 600;
        }

        [data-theme="dark"] .dashboard-table th,
        [data-theme="dark"] .dashboard-table td {
          border-bottom-color: #334155;
        }
        [data-theme="dark"] .badge-event {
          background: #3b82f620;
        }
        [data-theme="dark"] .small-action-btn {
          background: #0f172a;
          border-color: #334155;
          color: #f8fafc;
        }

      `}</style>
    </div>
  );
};

export default Dashboard;
