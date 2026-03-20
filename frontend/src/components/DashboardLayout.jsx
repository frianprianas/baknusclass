import { Outlet, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X, Search, Bell } from 'lucide-react';
import axios from 'axios';

const DashboardLayout = () => {
    const [activePage, setActivePage] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [summary, setSummary] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Authentication Guard
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Keep activePage in sync with URL
    useEffect(() => {
        const path = location.pathname.split('/')[1];
        if (path) setActivePage(path);
        // Close sidebar on navigation on mobile
        setIsSidebarOpen(false);
    }, [location]);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await axios.get('/api/dashboard/summary', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSummary(res.data);
            } catch (err) {
                console.error('Failed to fetch summary in layout', err);
            }
        };
        fetchSummary();
        // Refresh every 5 mins
        const interval = setInterval(fetchSummary, 300000);
        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        if (summary?.aktivitasTerakhir?.length > 0) {
            const lastSeen = localStorage.getItem('lastSeenActivity');
            const latest = summary.aktivitasTerakhir[0].date + summary.aktivitasTerakhir[0].user;
            if (lastSeen !== latest) {
                setUnreadCount(summary.aktivitasTerakhir.length);
            }
        }
    }, [summary]);

    const handleBellClick = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications && summary?.aktivitasTerakhir?.length > 0) {
            const latest = summary.aktivitasTerakhir[0].date + summary.aktivitasTerakhir[0].user;
            localStorage.setItem('lastSeenActivity', latest);
            setUnreadCount(0);
        }
    };

    return (
        <div className="dashboard-layout">
            <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

            <div className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`}>
                <Sidebar activePage={activePage} setActivePage={setActivePage} />
            </div>

            <main className="main-content">
                <header className="global-top-nav">
                    <button className="mobile-menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    <div className="top-nav-search">
                        <Search size={18} />
                        <input type="text" placeholder="Cari data..." />
                    </div>

                    <div className="top-nav-right">
                        <div style={{ position: 'relative', marginRight: '15px' }}>
                            <button className="nav-icon-btn" onClick={handleBellClick}>
                                <Bell size={20} />
                                {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
                            </button>

                            {showNotifications && (
                                <div className="layout-notif-dropdown animate-slide-up">
                                    <div className="notif-header">
                                        <h4>Notifikasi</h4>
                                        {unreadCount > 0 && <span className="unread-tag">{unreadCount} Baru</span>}
                                    </div>
                                    <div className="notif-body">
                                        {summary?.aktivitasTerakhir && summary.aktivitasTerakhir.length > 0 ? (
                                            summary.aktivitasTerakhir.map((act, i) => (
                                                <div key={i} className="notif-item">
                                                    <div className="notif-dot"></div>
                                                    <div className="notif-content">
                                                        <p><strong>{act.user}</strong> {act.action}</p>
                                                        <span className="notif-time">{act.date}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="notif-empty">Tidak ada notifikasi baru</div>
                                        )}
                                    </div>
                                    <div className="notif-footer">
                                        <button onClick={() => { setShowNotifications(false); navigate('/exam-scoring'); }}>Lihat Semua</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="user-welcome">
                            <span>{user.name || 'User'}</span>
                        </div>
                    </div>
                </header>

                <div className="content-inner animate-fade-in">
                    <Outlet />
                </div>
            </main>

            <style>{`
                .dashboard-layout {
                    display: flex;
                    min-height: 100vh;
                    background-color: #f8fafc;
                }

                .sidebar-container {
                    width: 280px;
                    transition: transform 0.3s ease;
                    z-index: 1000;
                }

                .main-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }

                .global-top-nav {
                    height: 70px;
                    background: white;
                    border-bottom: 1px solid #e5e7eb;
                    padding: 0 40px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: sticky;
                    top: 0;
                    z-index: 90;
                }

                .mobile-menu-toggle {
                    display: none;
                    background: none;
                    border: none;
                    color: #64748b;
                }

                .top-nav-search {
                    display: flex;
                    align-items: center;
                    background: #f1f5f9;
                    padding: 8px 16px;
                    border-radius: 12px;
                    width: 300px;
                    color: #94a3b8;
                    gap: 10px;
                }

                .top-nav-search input {
                    background: transparent;
                    border: none;
                    outline: none;
                    font-size: 0.9rem;
                    width: 100%;
                }

                .top-nav-right {
                    display: flex;
                    align-items: center;
                }

                .nav-icon-btn {
                    position: relative;
                    background: none;
                    border: none;
                    color: #64748b;
                    padding: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }

                .nav-icon-btn:hover {
                    color: #3b82f6;
                }

                .nav-badge {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: #ef4444;
                    color: white;
                    font-size: 0.6rem;
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    border: 1px solid white;
                }

                .layout-notif-dropdown {
                    position: absolute;
                    top: 45px;
                    right: -70px;
                    width: 320px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
                    border: 1px solid #e5e7eb;
                    overflow: hidden;
                    z-index: 2000;
                }

                .notif-header {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .notif-header h4 { margin: 0; font-size: 0.9rem; font-weight: 700; }

                .unread-tag {
                    background: #3b82f6;
                    color: white;
                    font-size: 0.65rem;
                    padding: 2px 8px;
                    border-radius: 50px;
                }

                .notif-body {
                    max-height: 300px;
                    overflow-y: auto;
                }

                .notif-item {
                    padding: 12px 16px;
                    display: flex;
                    gap: 12px;
                    border-bottom: 1px solid #f8fafc;
                }

                .notif-dot {
                    width: 8px;
                    height: 8px;
                    background: #3b82f6;
                    border-radius: 50%;
                    margin-top: 4px;
                }

                .notif-content p {
                    margin: 0;
                    font-size: 0.8rem;
                    line-height: 1.4;
                    color: #475569;
                }

                .notif-time {
                    font-size: 0.7rem;
                    color: #94a3b8;
                }

                .notif-footer {
                    padding: 10px;
                    text-align: center;
                    border-top: 1px solid #f1f5f9;
                }

                .notif-footer button {
                    background: none;
                    border: none;
                    color: #3b82f6;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .user-welcome span {
                    font-weight: 700;
                    color: #1e293b;
                }

                .content-inner {
                    padding: 40px;
                    max-width: 1400px;
                    width: 100%;
                    margin: 0 auto;
                }

                .sidebar-overlay {
                    display: none;
                }

                @media (max-width: 1024px) {
                    .sidebar-container {
                        position: fixed;
                        left: 0;
                        top: 0;
                        height: 100vh;
                        transform: translateX(-100%);
                        background: white;
                    }

                    .sidebar-container.open {
                        transform: translateX(0);
                    }

                    .global-top-nav {
                        padding: 0 20px;
                    }

                    .mobile-menu-toggle {
                        display: block;
                    }

                    .top-nav-search {
                        width: auto;
                        flex: 1;
                        margin: 0 15px;
                    }

                    .content-inner {
                        padding: 20px;
                    }

                    .sidebar-overlay.active {
                        display: block;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 999;
                        backdrop-filter: blur(4px);
                    }
                    
                    .layout-notif-dropdown {
                        right: -30px;
                        width: 280px;
                    }
                }

                @media (max-width: 640px) {
                    .user-welcome, .top-nav-search { display: none; }
                }

                [data-theme="dark"] .global-top-nav,
                [data-theme="dark"] .layout-notif-dropdown {
                    background: #1e293b;
                    border-color: #334155;
                }
                [data-theme="dark"] .top-nav-search,
                [data-theme="dark"] .notif-header,
                [data-theme="dark"] .notif-footer {
                    background: #0f172a;
                    border-bottom-color: #334155;
                    border-top-color: #334155;
                }
                [data-theme="dark"] .top-nav-search input,
                [data-theme="dark"] .user-welcome span,
                [data-theme="dark"] .notif-header h4,
                [data-theme="dark"] .notif-content p,
                [data-theme="dark"] .notif-content strong {
                    color: #f8fafc;
                }
                [data-theme="dark"] .notif-item {
                    border-bottom-color: #334155;
                }
                [data-theme="dark"] .sidebar-container {
                    background: #1e293b;
                }
                [data-theme="dark"] .dashboard-layout {
                    background: #0f172a;
                }
                [data-theme="dark"] .nav-badge {
                    border-color: #1e293b;
                }
            `}</style>
        </div>
    );
};

export default DashboardLayout;
