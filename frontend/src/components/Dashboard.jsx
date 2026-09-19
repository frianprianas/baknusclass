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
  Activity,
  BookOpen,
  ChevronRight,
  Play,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [proctorEvents, setProctorEvents] = useState([]);
  const [internalTopics, setInternalTopics] = useState([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  // Student Dashboard States
  const [studentSubjects, setStudentSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [activeExamEvents, setActiveExamEvents] = useState([]);
  const [studentMateriCount, setStudentMateriCount] = useState(0);
  const [subjectSearchTerm, setSubjectSearchTerm] = useState('');

  if (!token) {
    navigate('/login');
    return null;
  }

  // Force relogin if profileId is missing for GURU
  if (user.role === 'GURU' && !user.profileId) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    alert('Sesi Anda perlu diperbarui. Silakan login kembali.');
    navigate('/login');
    return null;
  }

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

    const fetchStudentDashboardData = async () => {
      if (user.role !== 'SISWA' || !token) return;
      setLoadingSubjects(true);
      try {
        // 1. Fetch student's enrolled subjects
        let subjects = [];
        try {
          const subResp = await axios.get('/api/enrollment/siswa-mapel/my', {
            headers: { Authorization: `Bearer ${token}` }
          });
          subjects = subResp.data || [];
        } catch (e) {
          if (user.profileId) {
            try {
              const subResp2 = await axios.get(`/api/enrollment/siswa-mapel/siswa/${user.profileId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              subjects = subResp2.data || [];
            } catch (e2) {}
          }
        }
        setStudentSubjects(subjects);

        // 2. Check active exam events (do NOT auto-redirect, show alert instead)
        try {
          const eventResp = await axios.get('/api/exam/event', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const active = (eventResp.data || []).filter(e => e.statusAktif);
          setActiveExamEvents(active);
        } catch (e) {}

        // 3. Check materials count for student
        try {
          const matResp = await axios.get('/api/materi/student/my', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setStudentMateriCount((matResp.data || []).length);
        } catch (e) {}
      } catch (err) {
        console.error('Failed to load student dashboard data', err);
      } finally {
        setLoadingSubjects(false);
        setLoading(false);
      }
    };

    const fetchInternalTopics = async () => {
      if (!['TU', 'GURU', 'ADMIN'].includes(user.role) || !token) return;
      try {
        const res = await axios.get('/api/forum/topik/guru-only', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInternalTopics(res.data.slice(0, 5));
      } catch (e) { console.error(e); }
    };

    if (['TU', 'GURU', 'ADMIN'].includes(user.role)) {
      fetchSummary();
      fetchInternalTopics();
    }
    if (user.role === 'GURU') fetchMyExams();
    checkProctorStatus();
    if (user.role === 'SISWA') fetchStudentDashboardData();
  }, []);

  const getSubjectColor = (idx) => {
    const colors = [
      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
      'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)'
    ];
    return colors[idx % colors.length];
  };

  const filteredMapel = studentSubjects.filter(m =>
    (m.namaMapel || '').toLowerCase().includes(subjectSearchTerm.toLowerCase()) ||
    (m.namaGuru || '').toLowerCase().includes(subjectSearchTerm.toLowerCase()) ||
    (m.kodeMapel || '').toLowerCase().includes(subjectSearchTerm.toLowerCase())
  );

  const dataCards = [
    { label: 'Total Siswa', value: summary?.totalSiswa || 0, icon: Users, color: '#3b82f6' },
    { label: 'Total Guru', value: summary?.totalGuru || 0, icon: GraduationCap, color: '#8b5cf6' },
    { label: 'Mata Pelajaran', value: summary?.totalMapel || 0, icon: BookMarked, color: '#10b981' },
    { label: 'Ujian Berlangsung', value: summary?.totalUjianAktif || 0, icon: ClipboardCheck, color: '#f59e0b' },
  ];

  return (
    <div>
      {user.role === 'SISWA' ? (
        /* ==================== TAMPILAN DASHBOARD UTAMA SISWA ==================== */
        <div className="student-dashboard-wrapper animate-fade-in">
          <div className="dashboard-header">
            <div>
              <h1>Dashboard Siswa</h1>
              <p>Selamat datang di portal pembelajaran dan ujian BaknusClass</p>
            </div>
          </div>

          {/* Welcome Alert */}
          <div className="student-welcome-alert">
            <div className="alert-icon">✨</div>
            <div className="alert-content">
              <h3>Selamat Datang, {user.name}! {userEmail && `(NIS: ${userEmail.split('@')[0]})`}</h3>
              <p>
                {studentSubjects[0]?.namaKelas ? `Kelas: ${studentSubjects[0].namaKelas} • ` : ''}
                Isilah semua data dengan jujur, karena kejujuran lebih penting dari nilai. Semangat belajar!
              </p>
            </div>
          </div>

          {/* Active Exam Banner */}
          {activeExamEvents.length > 0 && (
            <div className="student-exam-alert" onClick={() => navigate('/student-exams')}>
              <div className="exam-alert-icon-ring">
                <ClipboardCheck size={28} />
              </div>
              <div className="exam-alert-body">
                <div className="exam-alert-tag">SESI UJIAN BERLANGSUNG</div>
                <h3>Jadwal Ujian Aktif Tersedia!</h3>
                <p>
                  Ada <strong>{activeExamEvents.length} event ujian aktif</strong> ({activeExamEvents.map(e => e.namaEvent).join(', ')}). 
                  Klik di sini untuk langsung masuk ke ruang ujian CBT.
                </p>
              </div>
              <button className="btn-enter-cbt" onClick={(e) => { e.stopPropagation(); navigate('/student-exams'); }}>
                <Play size={16} />
                <span>Buka Ujian CBT</span>
              </button>
            </div>
          )}

          {/* Student Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                <BookMarked size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Mata Pelajaran Terdaftar</p>
                <h3 className="stat-value">{loadingSubjects ? '...' : studentSubjects.length} Mapel</h3>
              </div>
            </div>

            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/student-materi')}>
              <div className="stat-icon" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
                <BookOpen size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Materi Pembelajaran</p>
                <h3 className="stat-value">{studentMateriCount} Materi</h3>
              </div>
            </div>

            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/student-exams')}>
              <div className="stat-icon" style={{ backgroundColor: activeExamEvents.length > 0 ? '#f59e0b15' : '#64748b15', color: activeExamEvents.length > 0 ? '#f59e0b' : '#64748b' }}>
                <ClipboardCheck size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Status Ujian Hari Ini</p>
                <h3 className="stat-value" style={{ fontSize: '1.2rem', color: activeExamEvents.length > 0 ? '#d97706' : '#64748b' }}>
                  {activeExamEvents.length > 0 ? `${activeExamEvents.length} Ujian Aktif` : 'Tidak Ada Ujian'}
                </h3>
              </div>
            </div>

            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/forum')}>
              <div className="stat-icon" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                <Users size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Forum Diskusi</p>
                <h3 className="stat-value">Aktif</h3>
              </div>
            </div>
          </div>

          {/* Main Section: Daftar Mata Pelajaran */}
          <div className="student-subjects-section">
            <div className="section-head-bar">
              <div>
                <h2>Daftar Mata Pelajaran Anda</h2>
                <p>Mata pelajaran yang Anda ikuti pada semester ini beserta materi dan jadwal ujiannya</p>
              </div>
              <div className="search-box-student">
                <Search size={18} className="search-icon-sm" />
                <input
                  type="text"
                  placeholder="Cari mata pelajaran / guru..."
                  value={subjectSearchTerm}
                  onChange={(e) => setSubjectSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loadingSubjects ? (
              <div className="loading-container-student">
                <p>Memuat daftar mata pelajaran Anda...</p>
              </div>
            ) : filteredMapel.length === 0 ? (
              <div className="empty-mapel-card">
                <BookMarked size={56} style={{ color: '#94a3b8', marginBottom: '16px' }} />
                <h3>{studentSubjects.length === 0 ? 'Belum Ada Mata Pelajaran Terdaftar' : 'Mata Pelajaran Tidak Ditemukan'}</h3>
                <p>
                  {studentSubjects.length === 0
                    ? 'Akun Anda belum terdaftar di kelas atau mata pelajaran apapun. Silakan hubungi Wali Kelas atau Admin Kurikulum.'
                    : `Tidak ada mata pelajaran yang cocok dengan pencarian "${subjectSearchTerm}".`}
                </p>
              </div>
            ) : (
              <div className="student-mapel-grid">
                {filteredMapel.map((m, idx) => (
                  <div key={m.id || idx} className="mapel-card-modern">
                    <div className="mapel-card-top">
                      <div className="mapel-icon-bubble" style={{ background: getSubjectColor(idx) }}>
                        <BookOpen size={22} color="white" />
                      </div>
                      <div className="mapel-badges">
                        {m.kodeMapel && <span className="badge-kode">{m.kodeMapel}</span>}
                        {m.namaKelas && <span className="badge-kelas">{m.namaKelas}</span>}
                      </div>
                    </div>

                    <div className="mapel-card-content">
                      <h3 title={m.namaMapel}>{m.namaMapel}</h3>
                      <div className="mapel-guru-info">
                        <span className="guru-label">Guru Pengampu:</span>
                        <p className="guru-name">👨‍🏫 {m.namaGuru || 'Guru Bidang Studi'}</p>
                      </div>
                    </div>

                    <div className="mapel-card-actions">
                      <button
                        type="button"
                        className="btn-action-materi"
                        onClick={() => navigate('/student-materi')}
                        title="Buka Materi Pembelajaran & Tugas"
                      >
                        <BookOpen size={15} />
                        <span>Materi & Tugas</span>
                      </button>
                      <button
                        type="button"
                        className="btn-action-cbt"
                        onClick={() => navigate('/student-exams')}
                        title="Buka Ruang Ujian CBT"
                      >
                        <FileText size={15} />
                        <span>Ujian CBT</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== TAMPILAN DASHBOARD GURU, TU, ADMIN ==================== */
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

            {['TU', 'GURU', 'ADMIN'].includes(user.role) && (
              <div className="activity-container" style={{ marginTop: '24px' }}>
                <div className="container-header">
                  <h3>Forum Diskusi Guru</h3>
                  <button className="text-link" onClick={() => navigate('/forum')}>Lihat Forum</button>
                </div>
                <div className="activity-list">
                  {internalTopics && internalTopics.length > 0 ? (
                    internalTopics.map((topic, i) => (
                      <div key={i} className="activity-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/forum')}>
                        <div className="activity-dot" style={{ backgroundColor: '#f59e0b', boxShadow: '0 0 0 4px #fef3c7' }}></div>
                        <div className="activity-info">
                          <p className="activity-text">
                            <strong>{topic.judul}</strong>
                          </p>
                          <p className="activity-time">
                            {topic.namaGuru} &bull; {topic.jumlahKomentar} balasan
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">Belum ada topik diskusi internal.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

        .student-exam-alert {
          background: white;
          border: 2px solid #f59e0b;
          border-radius: 20px;
          padding: 20px 24px;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          gap: 20px;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 10px 25px -5px rgba(245, 158, 11, 0.15);
        }
        .student-exam-alert:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 30px -5px rgba(245, 158, 11, 0.25);
          border-color: #d97706;
        }
        .exam-alert-icon-ring {
          width: 56px;
          height: 56px;
          background: #fef3c7;
          color: #d97706;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .exam-alert-body { flex: 1; }
        .exam-alert-tag {
          display: inline-block;
          background: #f59e0b;
          color: white;
          padding: 3px 10px;
          border-radius: 50px;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .exam-alert-body h3 { font-size: 1.15rem; color: #1e293b; font-weight: 800; margin-bottom: 4px; }
        .exam-alert-body p { color: #64748b; font-size: 0.9rem; margin: 0; }
        .btn-enter-cbt {
          background: #f59e0b;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          transition: all 0.2s;
          cursor: pointer;
        }
        .btn-enter-cbt:hover { background: #d97706; transform: scale(1.03); }

        .student-subjects-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          margin-bottom: 32px;
        }
        .section-head-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .section-head-bar h2 { font-size: 1.45rem; color: #1e293b; font-weight: 800; margin-bottom: 4px; }
        .section-head-bar p { color: #64748b; font-size: 0.9rem; margin: 0; }
        .search-box-student {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 8px 14px;
          width: 280px;
          transition: all 0.2s;
        }
        .search-box-student:focus-within {
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .search-box-student input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.88rem;
          width: 100%;
          color: #1e293b;
        }
        .search-icon-sm { color: #94a3b8; }

        .student-mapel-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .mapel-card-modern {
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 20px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .mapel-card-modern:hover {
          transform: translateY(-4px);
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 14px 25px -5px rgba(59, 130, 246, 0.12);
        }
        .mapel-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .mapel-icon-bubble {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
        }
        .mapel-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .badge-kode {
          background: #eef2ff;
          color: #4f46e5;
          border: 1px solid #c7d2fe;
          font-size: 0.72rem;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .badge-kelas {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
          font-size: 0.72rem;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .mapel-card-content { margin-bottom: 20px; }
        .mapel-card-content h3 {
          font-size: 1.15rem;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 10px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .mapel-guru-info {
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
        }
        .guru-label { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 2px; }
        .guru-name { font-size: 0.88rem; font-weight: 700; color: #334155; margin: 0; }

        .mapel-card-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .btn-action-materi {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-action-materi:hover { background: #2563eb; }
        .btn-action-cbt {
          background: white;
          color: #475569;
          border: 1.5px solid #cbd5e1;
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-action-cbt:hover { background: #f1f5f9; border-color: #94a3b8; color: #1e293b; }

        .loading-container-student {
          text-align: center;
          padding: 48px;
          color: #64748b;
          font-weight: 600;
        }
        .empty-mapel-card {
          text-align: center;
          padding: 48px 24px;
          background: #f8fafc;
          border: 2px dashed #cbd5e1;
          border-radius: 16px;
        }
        .empty-mapel-card h3 { color: #1e293b; font-weight: 800; margin-bottom: 8px; }
        .empty-mapel-card p { color: #64748b; font-size: 0.95rem; max-width: 480px; margin: 0 auto; }

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
          flex-shrink: 0;
        }

        .stat-label {
          color: #64748b;
          font-size: 0.875rem;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .stat-value {
          font-size: 1.5rem;
          color: #1e293b;
          font-weight: 700;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr; }
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
          align-items: center;
          margin-bottom: 24px;
        }

        .container-header h3 {
          font-size: 1.125rem;
          color: #1e293b;
          font-weight: 600;
        }

        .container-header p {
          color: #64748b;
          font-size: 0.875rem;
        }

        .placeholder-chart {
          height: 250px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding-top: 20px;
        }

        .bar-group {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 200px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
        }

        .bar {
          width: 40px;
          border-radius: 6px 6px 0 0;
          transition: height 0.5s ease;
        }

        .chart-labels {
          display: flex;
          justify-content: space-around;
          margin-top: 8px;
          color: #64748b;
          font-size: 0.75rem;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .activity-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .activity-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .activity-text {
          font-size: 0.875rem;
          color: #1e293b;
          line-height: 1.4;
        }

        .activity-time {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 2px;
        }

        .text-link {
          background: none;
          border: none;
          color: #3b82f6;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
        }

        .empty-state {
          color: #94a3b8;
          font-style: italic;
          font-size: 0.875rem;
          text-align: center;
          padding: 24px 0;
        }

        .dashboard-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .dashboard-table th {
          text-align: left;
          padding: 10px;
          border-bottom: 2px solid #e2e8f0;
          color: #64748b;
        }
        .dashboard-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .badge-event {
          background: #eff6ff;
          color: #3b82f6;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .small-action-btn {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #475569;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
        }
        .small-action-btn:hover {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        .empty-exams {
          text-align: center;
          padding: 32px;
          color: #94a3b8;
        }
        .empty-exams button {
          margin-top: 12px;
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
        }

        /* Dark Mode */
        [data-theme="dark"] .dashboard-header h1 { color: #f8fafc; }
        [data-theme="dark"] .dashboard-header p { color: #94a3b8; }
        [data-theme="dark"] .stat-card {
          background: #1e293b;
          border-color: #334155;
        }
        [data-theme="dark"] .stat-label { color: #94a3b8; }
        [data-theme="dark"] .stat-value { color: #f8fafc; }
        [data-theme="dark"] .chart-container,
        [data-theme="dark"] .activity-container {
          background: #1e293b;
          border-color: #334155;
        }
        [data-theme="dark"] .container-header h3 { color: #f8fafc; }
        [data-theme="dark"] .container-header p { color: #94a3b8; }
        [data-theme="dark"] .activity-text { color: #f8fafc; }
        [data-theme="dark"] .activity-time { color: #64748b; }
        [data-theme="dark"] .proctor-alert {
          background: #1e293b;
          border-color: #3b82f6;
        }
        [data-theme="dark"] .alert-body h3 { color: #f8fafc; }
        [data-theme="dark"] .alert-body p { color: #94a3b8; }
        [data-theme="dark"] .alert-icon-ring { background: #0f172a; }
        [data-theme="dark"] .dashboard-table th { border-color: #334155; color: #94a3b8; }
        [data-theme="dark"] .dashboard-table td { border-color: #334155; color: #f8fafc; }
        [data-theme="dark"] .badge-event { background: #0f172a; color: #60a5fa; }
        [data-theme="dark"] .small-action-btn { background: #0f172a; border-color: #334155; color: #cbd5e1; }
        [data-theme="dark"] .small-action-btn:hover { background: #3b82f6; color: white; }

        [data-theme="dark"] .student-exam-alert { background: #1e293b; border-color: #f59e0b; }
        [data-theme="dark"] .exam-alert-body h3 { color: #f8fafc; }
        [data-theme="dark"] .exam-alert-body p { color: #cbd5e1; }
        [data-theme="dark"] .student-subjects-section { background: #1e293b; border-color: #334155; }
        [data-theme="dark"] .section-head-bar h2 { color: #f8fafc; }
        [data-theme="dark"] .section-head-bar p { color: #94a3b8; }
        [data-theme="dark"] .search-box-student { background: #0f172a; border-color: #334155; }
        [data-theme="dark"] .search-box-student input { color: #f8fafc; }
        [data-theme="dark"] .mapel-card-modern { background: #0f172a; border-color: #334155; }
        [data-theme="dark"] .mapel-card-modern:hover { background: #1e293b; border-color: #3b82f6; }
        [data-theme="dark"] .mapel-card-content h3 { color: #f8fafc; }
        [data-theme="dark"] .mapel-guru-info { background: #1e293b; border-color: #334155; }
        [data-theme="dark"] .guru-name { color: #cbd5e1; }
        [data-theme="dark"] .btn-action-cbt { background: #1e293b; border-color: #475569; color: #cbd5e1; }
        [data-theme="dark"] .btn-action-cbt:hover { background: #334155; color: #f8fafc; }
        [data-theme="dark"] .empty-mapel-card { background: #0f172a; border-color: #334155; }
        [data-theme="dark"] .empty-mapel-card h3 { color: #f8fafc; }
      `}</style>
    </div>
  );
};

export default Dashboard;
