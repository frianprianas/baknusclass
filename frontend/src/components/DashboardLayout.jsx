import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';

const DashboardLayout = () => {
    const [activePage, setActivePage] = useState('dashboard');
    const location = useLocation();
    const token = localStorage.getItem('token');

    // Authentication Guard
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Keep activePage in sync with URL
    useEffect(() => {
        const path = location.pathname.split('/')[1];
        if (path) setActivePage(path);
    }, [location]);

    return (
        <div className="dashboard-layout">
            <Sidebar activePage={activePage} setActivePage={setActivePage} />
            <main className="main-content">
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

                .main-content {
                    flex: 1;
                    margin-left: 280px;
                    display: flex;
                    flex-direction: column;
                }

                .content-inner {
                    padding: 40px;
                    max-width: 1400px;
                    width: 100%;
                    margin: 0 auto;
                }

                .animate-fade-in {
                    animation: fadeIn 0.5s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 768px) {
                    .main-content {
                        margin-left: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default DashboardLayout;
