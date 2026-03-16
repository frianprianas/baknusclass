import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, School, GraduationCap, ShieldAlert, Bot, AlertTriangle, LogOut, RefreshCcw, Download } from 'lucide-react';

const Settings = () => {
    const [settings, setSettings] = useState({
        school_name: '',
        school_address: '',
        school_contact: '',
        active_academic_year: '',
        active_semester: 'Ganjil',
        exam_strict_mode: 'false',
        exam_late_tolerance: '15',
        exam_session_limit: '1_device',
        ai_priority_provider: 'gemini',
        ai_api_key: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/settings', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSettings(prev => ({ ...prev, ...res.data }));
        } catch (error) {
            console.error('Error fetching settings', error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/settings', settings, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage('Pengaturan berhasil disimpan!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error saving settings', error);
            setMessage('Gagal menyimpan pengaturan.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForceLogout = () => {
        if (window.confirm('Yakin ingin mengeluarkan (force logout) semua siswa yang sedang login?')) {
            setMessage('Fitur Force Logout segera diimplementasi ke backend.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleClearCache = () => {
        if (window.confirm('Yakin ingin membersihkan Cache/Redis dari jadwal & histori sementara?')) {
            setMessage('Fitur Clear Cache Redis segera diimplementasi ke backend.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleBackup = () => {
        setMessage('Memproses pembuatan Backup Database (Excel)...');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="animate-fade-in pb-8">
            <div className="page-header" style={{ marginBottom: "20px" }}>
                <div>
                    <h1>Pengaturan Sistem</h1>
                    <p>Konfigurasi profil institusi dan sistem akademik</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="primary-btn"
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px" }}
                >
                    <Save size={18} />
                    <span>{isLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
            </div>

            {message && (
                <div className={message.includes('berhasil') ? 'success-msg' : 'error-msg'} style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontWeight: '500'
                }}>
                    {message}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '30px', alignItems: 'start' }}>

                {/* Profil Institusi */}
                <div className="table-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                        <School size={20} style={{ color: 'var(--primary)' }} />
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Profil Institusi</h2>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Nama Sekolah</label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    name="school_name"
                                    value={settings.school_name || ''}
                                    onChange={handleChange}
                                    placeholder="Contoh: SMK Bakti Nusantara 666"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Alamat Lengkap</label>
                            <div className="input-wrapper">
                                <textarea
                                    name="school_address"
                                    value={settings.school_address || ''}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Jalan, Kota, Provinsi..."
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', resize: 'vertical' }}
                                ></textarea>
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Kontak / Telepon</label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    name="school_contact"
                                    value={settings.school_contact || ''}
                                    onChange={handleChange}
                                    placeholder="Contoh: (022) 123456"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sistem Akademik */}
                <div className="table-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                        <GraduationCap size={20} style={{ color: 'var(--primary)' }} />
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Sistem Akademik</h2>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Tahun Ajaran Aktif</label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    name="active_academic_year"
                                    value={settings.active_academic_year || ''}
                                    onChange={handleChange}
                                    placeholder="Contoh: 2025/2026"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Semester Aktif</label>
                            <div className="input-wrapper">
                                <select
                                    name="active_semester"
                                    value={settings.active_semester || 'Ganjil'}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'transparent' }}
                                >
                                    <option value="Ganjil">Ganjil</option>
                                    <option value="Genap">Genap</option>
                                </select>
                            </div>
                        </div>

                        <div className="note-box" style={{ padding: '15px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', border: '1px solid rgba(26, 115, 232, 0.2)' }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--primary-dark)', lineHeight: '1.6' }}>
                                <strong>Catatan:</strong> Pengaturan Tahun Ajaran dan Semester akan menjadi <i>default value</i> saat pembuatan data baru (misal: Ujian Baru) untuk mempermudah alur kerja.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Keamanan & Aturan Ujian */}
                <div className="table-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                        <ShieldAlert size={20} style={{ color: 'var(--primary)' }} />
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Keamanan & Aturan Ujian</h2>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                Mode Keamanan Ketat (Strict Mode)
                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: settings.exam_strict_mode === 'true' ? '#dcfce7' : '#f1f5f9', color: settings.exam_strict_mode === 'true' ? '#166534' : '#64748b' }}>
                                    {settings.exam_strict_mode === 'true' ? 'Aktif' : 'Non-Aktif'}
                                </span>
                            </label>
                            <div className="input-wrapper">
                                <select
                                    name="exam_strict_mode"
                                    value={settings.exam_strict_mode || 'false'}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'transparent' }}
                                >
                                    <option value="false">Non-Aktif (Bebas pindah tab)</option>
                                    <option value="true">Aktif (Blokir jika pindah tab/browser)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Toleransi Keterlambatan (Menit)</label>
                            <div className="input-wrapper">
                                <input
                                    type="number"
                                    name="exam_late_tolerance"
                                    value={settings.exam_late_tolerance || '15'}
                                    onChange={handleChange}
                                    min="0"
                                    placeholder="Contoh: 15"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Batas Sesi Ujian Siswa</label>
                            <div className="input-wrapper">
                                <select
                                    name="exam_session_limit"
                                    value={settings.exam_session_limit || '1_device'}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'transparent' }}
                                >
                                    <option value="1_device">Maksimal 1 Perangkat (Strict)</option>
                                    <option value="multi_device">Multi Perangkat (Izinkan login ganda)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integrasi & AI Scoring */}
                <div className="table-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                        <Bot size={20} style={{ color: 'var(--primary)' }} />
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Integrasi & AI Scoring</h2>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Provider AI Prioritas</label>
                            <div className="input-wrapper">
                                <select
                                    name="ai_priority_provider"
                                    value={settings.ai_priority_provider || 'gemini'}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'transparent' }}
                                >
                                    <option value="gemini">Google Gemini (Default)</option>
                                    <option value="grok">xAI Grok</option>
                                    <option value="openai">OpenAI (GPT)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Model AI (Opsional)</label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    name="ai_model"
                                    value={settings.ai_model || ''}
                                    onChange={handleChange}
                                    placeholder="Contoh: gemini-1.5-flash, grok-beta, gpt-4o-mini"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>Kunci API (API Key)</label>
                            <div className="input-wrapper">
                                <input
                                    type="password"
                                    name="ai_api_key"
                                    value={settings.ai_api_key || ''}
                                    onChange={handleChange}
                                    placeholder="Masukkan API Key (Opsional jika via environment)"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div className="note-box" style={{ padding: '15px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', border: '1px solid rgba(26, 115, 232, 0.2)' }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--primary-dark)', lineHeight: '1.6' }}>
                                <strong>Catatan:</strong> Jika API Key tidak diisi di sini, sistem akan mencoba menggunakan API Key yang ada pada berkas konfigurasi <code>application.yml</code>. Pengisian di form ini akan menimpa (override) pengaturan default sistem.
                                <br /><br />
                                <strong>Model AI:</strong> Biarkan kosong untuk menggunakan model default (Gemini: <code>gemini-2.0-flash</code>, Grok: <code>grok-beta</code>, OpenAI: <code>gpt-4o-mini</code>).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Zona Berbahaya */}
                <div className="table-card" style={{ padding: '0', overflow: 'hidden', gridColumn: '1 / -1' }}>
                    <div className="card-header danger-zone-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', backgroundColor: 'var(--danger-light, #fef2f2)', borderBottom: '1px solid var(--danger-border, #fca5a5)' }}>
                        <AlertTriangle size={20} style={{ color: 'var(--danger, #ef4444)' }} />
                        <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--danger-dark, #b91c1c)' }}>Zona Berbahaya (Danger Zone)</h2>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="danger-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', paddingBottom: '15px', borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <h4 style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>Force Logout Semua Siswa</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Hapus semua sesi login siswa yang aktif dan paksa mereka untuk login kembali.</p>
                            </div>
                            <button onClick={handleForceLogout} style={{ padding: '8px 16px', backgroundColor: 'var(--danger, #ef4444)', color: 'white', borderRadius: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LogOut size={16} />
                                Force Logout
                            </button>
                        </div>

                        <div className="danger-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', paddingBottom: '15px', borderBottom: '1px solid var(--border)' }}>
                            <div>
                                <h4 style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>Clear Cache / Reset Temporary Ujian</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Menghapus data Cache Redis jika ada masalah sinkronisasi jadwal atau histori ujian sementara.</p>
                            </div>
                            <button onClick={handleClearCache} style={{ padding: '8px 16px', backgroundColor: '#f59e0b', color: 'white', borderRadius: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCcw size={16} />
                                Clear Cache
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                            <div>
                                <h4 style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>Backup / Export Database Nilai</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Unduh (download) seluruh data nilai siswa, soal, dan rekaman ujian ke dalam format Excel.</p>
                            </div>
                            <button onClick={handleBackup} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', borderRadius: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Download size={16} />
                                Backup Database
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            <style>{`
            /* Settings Specific Styles */
            [data-theme="dark"] .table-card {
                background-color: #1e293b;
                border: 1px solid #334155 !important;
            }

            [data-theme="dark"] .card-header {
                border-bottom: 1px solid #334155 !important;
                background-color: rgba(255, 255, 255, 0.02) !important;
            }

            [data-theme="dark"] .form-group label {
                color: #94a3b8 !important;
            }

            [data-theme="dark"] input,
            [data-theme="dark"] select,
            [data-theme="dark"] textarea {
                background-color: #0f172a !important;
                border: 1px solid #334155 !important;
                color: #f8fafc !important;
            }

            [data-theme="dark"] .danger-zone-header {
                background-color: #450a0a !important;
                border-bottom: 1px solid #7f1d1d !important;
            }

            [data-theme="dark"] .danger-zone-header h2 {
                color: #fca5a5 !important;
            }

            [data-theme="dark"] .note-box {
                background-color: rgba(59, 130, 246, 0.1) !important;
                border: 1px solid rgba(59, 130, 246, 0.2) !important;
                color: #93c5fd !important;
            }

            [data-theme="dark"] .note-box strong {
                color: #60a5fa !important;
            }

            [data-theme="dark"] .danger-item {
                border-bottom: 1px solid #334155 !important;
            }

            [data-theme="dark"] .success-msg {
                background-color: #064e3b !important;
                color: #a7f3d0 !important;
                border: 1px solid #065f46 !important;
            }

            [data-theme="dark"] .error-msg {
                background-color: #450a0a !important;
                color: #fca5a5 !important;
                border: 1px solid #7f1d1d !important;
            }
            
            [data-theme="dark"] h4 {
                color: #f1f5f9 !important;
            }
        `}</style>
        </div>
    );
};

export default Settings;
