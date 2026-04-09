import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BAKNUS_MAIL_URL } from '../config';
import {
  Home,
  BookOpen,
  Users,
  FileText,
  Layout,
  Settings,
  LogOut,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Moon,
  Sun,
  User,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

const Sidebar = ({ activePage, setActivePage }) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isProctor, setIsProctor] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'SISWA';
  const token = localStorage.getItem('token');

  let userEmail = user.email;
  // Fallback to JWT sub
  if (!userEmail && token) {
    try { userEmail = JSON.parse(atob(token.split('.')[1])).sub; } catch (e) { }
  }

  useEffect(() => {
    if (role === 'GURU') {
      checkProctorStatus();
    }
  }, [role]);

  const checkProctorStatus = async () => {
    if (!token || !user.profileId) return;
    try {
      const res = await axios.get('/api/exam/event', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const activeEvents = res.data.filter(e => e.statusAktif);
      const isAssigned = activeEvents.some(ev => ev.proktorIds?.includes(user.profileId));
      setIsProctor(isAssigned);
    } catch (err) {
      console.error('Proctor check failed', err);
    }
  };

  const handleMenuClick = (id) => {
    setActivePage(id);
    if (id === 'dashboard') navigate('/dashboard');
    if (id === 'users') navigate('/users');
    // Add more navigation logic for other menu items as needed
    if (id === 'exams') navigate('/exams');
    if (id === 'exam_scoring') navigate('/exam-scoring');
    if (id === 'student_exams') navigate('/student-exams');
    if (id === 'master_data') navigate('/master-data');
    if (id === 'security' || id === 'monitoring') navigate('/security');
    if (id === 'settings') navigate('/settings');
    if (id === 'subject_management') navigate('/subject-management');
    if (id === 'materi_student') navigate('/student-materi');
    if (id === 'forum') navigate('/forum');
    if (id === 'sync_siswa') navigate('/sync-siswa');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['ADMIN', 'TU', 'GURU', 'SISWA'] },
    { id: 'monitoring', label: 'Pengawasan Ujian', icon: ShieldCheck, roles: isProctor ? ['GURU'] : [] },
    { id: 'exams', label: 'Manajemen Ujian', icon: BookOpen, roles: ['ADMIN', 'TU', 'GURU'] },
    { id: 'subject_management', label: 'Manajemen Mapel', icon: BookOpen, roles: ['GURU'] },
    { id: 'materi_student', label: 'Materi Pelajaran', icon: BookOpen, roles: ['SISWA'] },
    { id: 'exam_scoring', label: 'Koreksi & Nilai', icon: FileText, roles: ['ADMIN', 'TU', 'GURU'] },
    { id: 'forum', label: 'Forum Diskusi', icon: MessageCircle, roles: ['ADMIN', 'GURU', 'SISWA'] },
    { id: 'student_exams', label: 'Daftar Ujian', icon: FileText, roles: ['ADMIN', 'SISWA'] },
    { id: 'master_data', label: 'Data Master', icon: Layout, roles: ['ADMIN', 'TU'] },
    { id: 'users', label: 'Manajemen User', icon: Users, roles: ['ADMIN', 'TU'] },
    { id: 'sync_siswa', label: 'Sinkronisasi Siswa', icon: RefreshCw, roles: ['ADMIN', 'TU'] },
    { id: 'security', label: 'Token & Keamanan', icon: ShieldCheck, roles: ['ADMIN', 'TU'] },
    { id: 'settings', label: 'Pengaturan', icon: Settings, roles: ['ADMIN'] },
  ];

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));

  const getRoleLabel = (r) => {
    switch (r) {
      case 'ADMIN': return 'Super Admin';
      case 'GURU': return 'Tenaga Pengajar';
      case 'TU': return 'Staf Tata Usaha';
      case 'SISWA': return 'Siswa / Peserta';
      default: return r;
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <img src="/bclogo.png" alt="BaknusClass Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        <div className="brand-name">
          <span>Baknus</span>Class
        </div>
      </div>

      <div className="sidebar-menu">
        {filteredMenu.map((item) => (
          <button
            key={item.id}
            className={`menu-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => handleMenuClick(item.id)}
          >
            <item.icon size={20} className="menu-icon" />
            <span className="menu-label">{item.label}</span>
            {activePage === item.id && <ChevronRight size={16} className="active-indicator" />}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar" style={{ position: 'relative', overflow: 'hidden' }}>
            <img
              src={`${BAKNUS_MAIL_URL}/api/auth/avatar/${userEmail}`}
              alt=""
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerText = user.name?.charAt(0) || 'U';
              }}
            />
          </div>
          <div className="user-details">
            <p className="user-name">{user.name || 'User'}</p>
            <p className="user-role">
              {getRoleLabel(role)}
              {userEmail && (
                <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px', color: '#94a3b8', fontWeight: '700' }}>
                  {role === 'SISWA' ? 'NIS' : 'NIP'}: {userEmail.split('@')[0]}
                </span>
              )}
            </p>
          </div>
        </div>
        <button className="theme-toggle-btn" onClick={() => window.open(BAKNUS_MAIL_URL, '_blank')} style={{ background: '#eff6ff', color: '#1e40af', marginBottom: '12px' }}>
          <User size={18} />
          <span>Kelola Profil</span>
          <ExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.6 }} />
        </button>
        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          width: 100%;
          height: 100vh;
          background: white;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
        }

        .sidebar-brand {
          padding: 30px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #f3f4f6;
        }

        .brand-logo {
          background: #3b82f6;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.2rem;
        }

        .brand-name {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e3a8a;
          letter-spacing: -0.5px;
        }

        .brand-name span {
          color: #3b82f6;
        }

        .sidebar-menu {
          flex: 1;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sidebar-menu::-webkit-scrollbar {
          width: 5px;
        }

        .sidebar-menu::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-menu::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }

        .sidebar-menu::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }

        .menu-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 12px;
          color: #64748b;
          background: transparent;
          transition: all 0.2s ease;
          position: relative;
        }

        .menu-item:hover {
          background: #f8fafc;
          color: #3b82f6;
        }

        .menu-item.active {
          background: #eff6ff;
          color: #3b82f6;
          font-weight: 600;
        }

        .menu-icon {
          margin-right: 12px;
        }

        .menu-label {
          font-size: 0.95rem;
          flex: 1;
          text-align: left;
        }

        .active-indicator {
          margin-left: auto;
        }

        .sidebar-footer {
          padding: 24px;
          border-top: 1px solid #f3f4f6;
          background: #fcfcfc;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          background: #e0e7ff;
          color: #4338ca;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }

        .user-details {
          overflow: hidden;
        }

        .user-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: #1e293b;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: 0.8rem;
          color: #64748b;
        }

        .logout-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: #fee2e2;
          color: #ef4444;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .logout-button:hover {
          background: #fecaca;
        }

        .theme-toggle-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: #f3f4f6;
          color: #4b5563;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 12px;
          transition: all 0.2s ease;
        }

        .theme-toggle-btn:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
