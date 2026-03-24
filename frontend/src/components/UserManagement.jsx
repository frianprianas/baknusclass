import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BAKNUS_MAIL_URL } from '../config';
import {
    Users,
    RefreshCw,
    Search,
    Filter,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Mail,
    Shield,
    Edit,
    ExternalLink
} from 'lucide-react';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        namaLengkap: '',
        kelasId: '',
        nisn: '',
        nip: '',
        phoneNumber: ''
    });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [classList, setClassList] = useState([]);
    const [updating, setUpdating] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data);
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMasterData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const kRes = await axios.get('/api/master/kelas', { headers });
            setClassList(kRes.data);
        } catch (err) {
            console.error('Failed to fetch master data', err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchMasterData();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/users/sync-mailcow', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchUsers();
            alert('Sinkronisasi massal dengan Email Sekolah berhasil!');
        } catch (err) {
            alert('Gagal melakukan sinkronisasi: ' + (err.response?.data?.message || err.message));
        } finally {
            setSyncing(false);
        }
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setFormData({
            namaLengkap: user.namaLengkap || '',
            kelasId: user.kelasId || '',
            nisn: user.nisn || '',
            nip: user.nip || '',
            phoneNumber: user.phoneNumber || ''
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setUpdating(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/users/${selectedUser.id}/profile`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditModalOpen(false);
            fetchUsers();
            alert('Data user berhasil diperbarui!');
        } catch (err) {
            alert('Gagal memperbarui data: ' + (err.response?.data?.message || err.message));
        } finally {
            setUpdating(false);
        }
    };

    const [syncingProfile, setSyncingProfile] = useState(false);
    const handleSyncProfile = async () => {
        if (!selectedUser?.email) return;
        setSyncingProfile(true);
        try {
            const response = await axios.get(`${BAKNUS_MAIL_URL}/api/auth/info/${selectedUser.email}`);
            const profile = response.data;
            setFormData({
                ...formData,
                namaLengkap: profile.displayName || formData.namaLengkap,
                phoneNumber: profile.phoneNumber || formData.phoneNumber
            });
            alert('Data profil berhasil ditarik dari sistem Email Sekolah!');
        } catch (err) {
            console.error('Failed to sync profile', err);
            alert('Gagal menarik profil: Sistem BaknusMail mungkin sedang tidak dapat dijangkau.');
        } finally {
            setSyncingProfile(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.namaLengkap?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination logic
    const indexOfLastUser = currentPage * rowsPerPage;
    const indexOfFirstUser = indexOfLastUser - rowsPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleToggleStatus = async (user) => {
        const action = (user.active || user.isActive) ? 'menonaktifkan' : 'mengaktifkan';
        if (!window.confirm(`Yakin ingin ${action} user ini?`)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/users/${user.id}/toggle-status`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (err) {
            alert('Gagal mengubah status: ' + (err.response?.data?.message || err.message));
        }
    };

    const getRoleBadge = (role) => {
        let color = '#64748b';
        let bg = '#f1f5f9';

        switch (role) {
            case 'ADMIN': color = '#ef4444'; bg = '#fee2e2'; break;
            case 'GURU': color = '#3b82f6'; bg = '#eff6ff'; break;
            case 'TU': color = '#8b5cf6'; bg = '#f5f3ff'; break;
            case 'SISWA': color = '#10b981'; bg = '#ecfdf5'; break;
        }

        return (
            <span style={{
                backgroundColor: bg,
                color: color,
                padding: '4px 12px',
                borderRadius: '50px',
                fontSize: '0.75rem',
                fontWeight: '600'
            }}>
                {role}
            </span>
        );
    };

    return (
        <div className="user-management animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Manajemen User</h1>
                    <p>Kelola dan sinkronisasi akun dengan Email Sekolah</p>
                </div>
                <button
                    className={`sync-btn ${syncing ? 'loading' : ''}`}
                    onClick={handleSync}
                    disabled={syncing}
                >
                    <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                    <span>{syncing ? 'Sinkronisasi...' : 'Sync with Email Sekolah'}</span>
                </button>
            </div>

            <div className="table-card">
                <div className="table-actions">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Cari nama, email, atau username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="filters">
                        <button className="filter-btn">
                            <Filter size={18} />
                            <span>Filter</span>
                        </button>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Info Tambahan</th>
                                <th>WhatsApp</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center">Memuat data...</td></tr>
                            ) : currentUsers.length === 0 ? (
                                <tr><td colSpan="6" className="text-center">Tidak ada user ditemukan.</td></tr>
                            ) : (
                                currentUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar-small" style={{ position: 'relative', overflow: 'hidden' }}>
                                                    <img
                                                        src={`${BAKNUS_MAIL_URL}/api/auth/avatar/${user.email}`}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.parentElement.innerText = user.username?.charAt(0).toUpperCase();
                                                        }}
                                                    />
                                                </div>
                                                <div className="user-meta">
                                                    <p className="full-name">{user.namaLengkap || 'No Name'}</p>
                                                    <p className="email">{user.email}</p>
                                                    <p className="username">@{user.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{getRoleBadge(user.role)}</td>
                                        <td>
                                            <div className="status-cell">
                                                {(user.active || user.isActive) ? (
                                                    <><CheckCircle2 size={16} color="#10b981" /> <span style={{ color: '#10b981' }}>Aktif</span></>
                                                ) : (
                                                    <><XCircle size={16} color="#ef4444" /> <span style={{ color: '#ef4444' }}>Nonaktif</span></>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="extra-info">
                                                {user.role === 'SISWA' && (
                                                    <span className="info-tag">Kelas: {user.namaKelas || '-'}</span>
                                                )}
                                                {user.role === 'GURU' && (
                                                    <span className="info-tag">Mapel: {user.mapelNames?.length || 0}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {user.phoneNumber ? (
                                                <a
                                                    href={`https://wa.me/${user.phoneNumber.replace(/[^0-9]/g, '')}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ color: '#10b981', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                >
                                                    <MessageCircle size={16} />
                                                    {user.phoneNumber}
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    className="lengkapi-btn"
                                                    onClick={() => handleEdit(user)}
                                                    title="Edit / Lengkapi Data"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="toggle-status-btn"
                                                    style={{
                                                        backgroundColor: (user.active || user.isActive) ? '#ef4444' : '#10b981',
                                                        color: 'white', border: 'none', padding: '6px 10px',
                                                        borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    onClick={() => handleToggleStatus(user)}
                                                    title={(user.active || user.isActive) ? 'Nonaktifkan User' : 'Aktifkan User'}
                                                >
                                                    {(user.active || user.isActive) ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && filteredUsers.length > 0 && (
                    <div className="pagination-container">
                        <div className="pagination-info">
                            Menampilkan {indexOfFirstUser + 1} - {Math.min(indexOfLastUser, filteredUsers.length)} dari {filteredUsers.length} user
                        </div>
                        <div className="pagination-buttons">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="page-btn"
                            >
                                Sebelumnya
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => handlePageChange(i + 1)}
                                    className={`page - num ${currentPage === i + 1 ? 'active' : ''} `}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="page-btn"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedUser && (
                <div className="modal-overlay">
                    <div className="modal-content animate-slide-up">
                        <div className="modal-header">
                            <h3>Edit Data User</h3>
                            <button className="close-btn" onClick={() => setIsEditModalOpen(false)}>
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div style={{
                            margin: '0 24px 20px', padding: '12px 16px', borderRadius: '12px',
                            background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.85rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <ExternalLink size={16} />
                                <strong style={{ fontWeight: '700' }}>Pusat Akun BaknusMail</strong>
                            </div>
                            Nama Lengkap dan Nomor WA dikelola secara terpusat. Jika ingin mengubahnya, silakan arahkan user ke
                            <a href={BAKNUS_MAIL_URL} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: '700', marginLeft: '4px', textDecoration: 'underline' }}>
                                {BAKNUS_MAIL_URL.replace('https://', '')}
                            </a>
                        </div>
                        <form onSubmit={handleUpdateProfile}>
                            <div className="form-group">
                                <label>Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={formData.namaLengkap}
                                    onChange={(e) => setFormData({ ...formData, namaLengkap: e.target.value })}
                                    placeholder="Masukkan nama lengkap..."
                                    required
                                />
                            </div>

                            {selectedUser.role === 'SISWA' && (
                                <>
                                    <div className="form-group">
                                        <label>NISN</label>
                                        <input
                                            type="text"
                                            value={formData.nisn}
                                            onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                                            placeholder="Masukkan NISN siswa..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Kelas</label>
                                        <select
                                            value={formData.kelasId}
                                            onChange={(e) => setFormData({ ...formData, kelasId: e.target.value })}
                                        >
                                            <option value="">-- Pilih Kelas --</option>
                                            {classList.map(k => (
                                                <option key={k.id} value={k.id}>{k.tingkat} - {k.namaKelas}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {(selectedUser.role === 'GURU' || selectedUser.role === 'TU' || selectedUser.role === 'ADMIN') && (
                                <div className="form-group">
                                    <label>NIP</label>
                                    <input
                                        type="text"
                                        value={formData.nip}
                                        onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                                        placeholder="Masukkan NIP..."
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label>Nomor WhatsApp</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                        placeholder="Contoh: 08123456789"
                                    />
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
                                        onClick={handleSyncProfile}
                                        disabled={syncingProfile}
                                    >
                                        {syncingProfile ? '...' : 'Sync Profile & WA'}
                                    </button>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '8px 0 0' }}>
                                * Untuk mengatur mata pelajaran yang diampu, gunakan menu <strong>Data Master → Guru Pengampu</strong>
                            </p>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={updating}>
                                    {updating ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )
            }

            <style>{`
                .user-management {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    gap: 20px;
                }

                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .sync-btn { width: 100%; justify-content: center; }
                    .table-actions { flex-direction: column; gap: 15px; }
                    .search-box { width: 100% !important; }
                    .filters { width: 100%; }
                    .filter-btn { width: 100%; justify-content: center; }
                }

                .page-header h1 {
                    font-size: 1.75rem;
                    color: #1e293b;
                    margin-bottom: 4px;
                }

                .page-header p {
                    color: #64748b;
                }

                .sync-btn {
                    background: #3b82f6;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    transition: all 0.2s;
                }

                .sync-btn:hover:not(:disabled) {
                    background: #2563eb;
                    transform: translateY(-1px);
                }

                .sync-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .table-card {
                    background: white;
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    overflow: hidden;
                }

                .table-actions {
                    padding: 20px;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 8px 14px;
                    border-radius: 10px;
                    width: 300px;
                    color: #94a3b8;
                }

                .search-box input {
                    background: transparent;
                    border: none;
                    outline: none;
                    margin-left: 10px;
                    width: 100%;
                    color: #1e293b;
                }

                .filter-btn {
                    background: white;
                    border: 1px solid #e2e8f0;
                    padding: 8px 16px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #64748b;
                    font-weight: 500;
                }

                .table-responsive {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                .user-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 800px;
                }

                .user-table th {
                    text-align: left;
                    padding: 16px 20px;
                    background: #f8fafc;
                    color: #64748b;
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .user-table td {
                    padding: 16px 20px;
                    border-bottom: 1px solid #f1f5f9;
                    vertical-align: middle;
                }

                .user-cell {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .user-avatar-small {
                    width: 36px;
                    height: 36px;
                    background: #e0e7ff;
                    color: #4338ca;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.9rem;
                }

                .full-name {
                    font-weight: 700;
                    color: #0f172a;
                    font-size: 0.95rem;
                    margin-bottom: 2px;
                }

                .email {
                    font-weight: 600;
                    color: #1e293b;
                    font-size: 0.9rem;
                }

                .username {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .lengkapi-btn {
                    background-color: #3b82f6;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .lengkapi-btn:hover {
                    background-color: #2563eb;
                    transform: translateY(-1px);
                }

                .info-tag {
                    display: inline-block;
                    background: #f1f5f9;
                    color: #475569;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    background: white;
                    width: 100%;
                    max-width: 500px;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .modal-header h3 {
                    margin: 0;
                    color: #1e293b;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                }

                .form-group {
                    margin-bottom: 16px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #475569;
                }

                .form-group input, .form-group select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.9rem;
                }

                .mapel-assignment-list {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    max-height: 250px;
                    overflow-y: auto;
                    padding: 8px;
                }

                .mapel-assignment-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    border-radius: 8px;
                    transition: all 0.2s;
                    margin-bottom: 4px;
                }

                .mapel-assignment-row:hover {
                    background: #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }

                .mapel-assignment-row.active {
                    background: #eff6ff;
                    border: 1px solid #dbeafe;
                }

                .mapel-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    flex: 1;
                }

                .checkbox-custom {
                    width: 18px;
                    height: 18px;
                    border: 2px solid #cbd5e1;
                    border-radius: 4px;
                    position: relative;
                    transition: all 0.2s;
                }

                .checkbox-custom.checked {
                    background: #3b82f6;
                    border-color: #3b82f6;
                }

                .checkbox-custom.checked::after {
                    content: '✓';
                    position: absolute;
                    color: white;
                    font-size: 12px;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }

                .kelas-mini-select {
                    width: 160px;
                    padding: 4px 8px !important;
                    font-size: 0.8rem !important;
                    border: 1px solid #3b82f6 !important;
                    border-radius: 6px !important;
                    background: white !important;
                    outline: none;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                }

                .btn-primary {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                }

                .btn-secondary {
                    background: #f1f5f9;
                    color: #475569;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                }

                .status-cell {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                }

                .last-login {
                    color: #64748b;
                    font-size: 0.85rem;
                }

                .text-center { text-align: center !important; }

                .pagination-container {
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1px solid #f1f5f9;
                    background: #f8fafc;
                }

                .pagination-info {
                    font-size: 0.85rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .pagination-buttons {
                    display: flex;
                    gap: 8px;
                }

                .page-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .page-btn:hover:not(:disabled) {
                    border-color: #3b82f6;
                    color: #3b82f6;
                }

                .page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-num {
                    width: 34px;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .page-num:hover {
                    border-color: #3b82f6;
                    color: #3b82f6;
                }

                .page-num.active {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
                }

                [data-theme="dark"] .pagination-container {
                    background: #1e293b;
                    border-top-color: #334155;
                }

                [data-theme="dark"] .pagination-info {
                    color: #94a3b8;
                }

                [data-theme="dark"] .page-btn, [data-theme="dark"] .page-num {
                    background: #0f172a;
                    border-color: #334155;
                    color: #cbd5e1;
                }

                [data-theme="dark"] .page-btn:hover:not(:disabled), [data-theme="dark"] .page-num:hover {
                    border-color: #3b82f6;
                    color: #3b82f6;
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    );
};

export default UserManagement;
