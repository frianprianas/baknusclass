import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
    UserCheck,
    Download,
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Search,
    Copy,
    Check,
    ArrowRight,
    Users,
    Info,
    Trash2
} from 'lucide-react';

const CekAkun = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [dataResult, setDataResult] = useState(null);
    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'TIDAK_DITEMUKAN' | 'KELAS_BERBEDA' | 'VALID'
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef(null);

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Download Template Excel
    const handleDownloadTemplate = async () => {
        setDownloadingTemplate(true);
        try {
            const resp = await axios.get('/api/users/cek-akun/template', {
                headers,
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'template_cek_akun_siswa.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading template:', err);
            alert('Gagal mengunduh template Excel: ' + (err.response?.data?.message || err.message));
        } finally {
            setDownloadingTemplate(false);
        }
    };

    // 2. Upload & Verify
    const handleVerifyExcel = async (e) => {
        if (e) e.preventDefault();
        if (!file) {
            alert('Silakan pilih file Excel (.xlsx) terlebih dahulu!');
            return;
        }

        setLoading(true);
        setDataResult(null);
        setActiveTab('ALL');
        setSearchQuery('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const resp = await axios.post('/api/users/cek-akun/verify', formData, {
                headers: {
                    ...headers,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (resp.data) {
                setDataResult(resp.data);
                // If there are missing users, default to showing them first for quick action
                if (resp.data.totalTidakDitemukan > 0) {
                    setActiveTab('TIDAK_DITEMUKAN');
                } else if (resp.data.totalKelasBerbeda > 0) {
                    setActiveTab('KELAS_BERBEDA');
                } else {
                    setActiveTab('ALL');
                }
            }
        } catch (err) {
            console.error('Verification failed:', err);
            alert('Gagal melakukan pengecekan akun: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // 3. Copy missing users to clipboard
    const handleCopyMissing = () => {
        if (!dataResult || !dataResult.results) return;
        const missing = dataResult.results.filter(r => r.status === 'TIDAK_DITEMUKAN');
        if (missing.length === 0) {
            alert('Tidak ada siswa yang berstatus belum terdaftar.');
            return;
        }

        let text = "DAFTAR SISWA BELUM MEMILIKI AKUN DI BAKNUSCLASS:\n";
        text += "--------------------------------------------------------\n";
        text += "NO\tNIS/NISN\tNAMA SISWA\tKELAS\n";
        missing.forEach((item, idx) => {
            text += `${idx + 1}\t${item.nisnInput || '-'}\t${item.namaInput || '-'}\t${item.kelasInput || '-'}\n`;
        });

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        alert(`Berhasil menyalin ${missing.length} data siswa yang belum terdaftar ke clipboard!`);
    };

    // Filter results
    const filteredResults = (dataResult?.results || []).filter(item => {
        // Tab Filter
        if (activeTab === 'TIDAK_DITEMUKAN' && item.status !== 'TIDAK_DITEMUKAN') return false;
        if (activeTab === 'KELAS_BERBEDA' && item.status !== 'KELAS_BERBEDA') return false;
        if (activeTab === 'VALID' && item.status !== 'VALID') return false;

        // Search Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchNisn = (item.nisnInput || '').toLowerCase().includes(q);
            const matchNama = (item.namaInput || '').toLowerCase().includes(q);
            const matchKelas = (item.kelasInput || '').toLowerCase().includes(q);
            const matchDbNama = (item.dbNama || '').toLowerCase().includes(q);
            const matchDbEmail = (item.dbEmail || '').toLowerCase().includes(q);
            return matchNisn || matchNama || matchKelas || matchDbNama || matchDbEmail;
        }

        return true;
    });

    return (
        <div className="cek-akun-container animate-fade-in" style={{ padding: '32px' }}>
            {/* Page Header */}
            <div className="page-header mb-6">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)',
                        color: 'white'
                    }}>
                        <UserCheck size={26} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>
                            Cek Akun Siswa & Validasi Kelas
                        </h1>
                        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '0.9rem' }}>
                            Unggah data dari file Excel untuk memverifikasi ketersediaan akun di database dan kesesuaian kelas siswa.
                        </p>
                    </div>
                </div>
            </div>

            {/* Step 1 & 2 Action Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '28px' }}>
                {/* Download Template Card */}
                <div style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '20px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <span style={{
                                background: '#eff6ff',
                                color: '#2563eb',
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                            }}>
                                1
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                                Download Template Excel
                            </h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
                            Unduh format resmi template (.xlsx). File berisi kolom standar: <strong>NIS/NISN</strong>, <strong>Nama Siswa</strong>, dan <strong>Kelas</strong>.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        disabled={downloadingTemplate}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            color: '#2563eb',
                            border: '1.5px solid #bfdbfe',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            cursor: downloadingTemplate ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.08)'
                        }}
                    >
                        {downloadingTemplate ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                <span>Mengunduh Template...</span>
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                <span>Download Template .xlsx</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Upload & Verify Card */}
                <div style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '20px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <span style={{
                                background: '#f5f3ff',
                                color: '#7c3aed',
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                            }}>
                                2
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                                Upload & Mulai Pengecekan
                            </h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
                            Pilih file Excel yang sudah diisi naskah data siswa dari Dapodik/PPDB untuk diperiksa otomatis ke database.
                        </p>

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed #cbd5e1',
                                borderRadius: '12px',
                                padding: '14px 16px',
                                textAlign: 'center',
                                background: file ? '#f5f3ff' : '#f8fafc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                marginBottom: '16px'
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setFile(e.target.files[0]);
                                    }
                                }}
                            />
                            <FileSpreadsheet size={24} color="#7c3aed" />
                            {file ? (
                                <div style={{ textAlign: 'left', flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#4c1d95', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                        {file.name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        {(file.size / 1024).toFixed(1)} KB — Klik untuk ganti
                                    </div>
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                                    Klik untuk memilih file Excel (.xlsx)
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleVerifyExcel}
                        disabled={loading || !file}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            background: loading || !file
                                ? '#94a3b8'
                                : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            cursor: loading || !file ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                <span>Sedang Memeriksa Database...</span>
                            </>
                        ) : (
                            <>
                                <UserCheck size={18} />
                                <span>Mulai Pengecekan Akun</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results Section */}
            {dataResult && (
                <div className="animate-slide-up">
                    {/* Metrics Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        {/* Total Baris */}
                        <div style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            padding: '18px 20px',
                            border: '1.5px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                        }}>
                            <div style={{ background: '#f1f5f9', color: '#475569', padding: '12px', borderRadius: '12px' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>TOTAL DIPERIKSA</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b' }}>{dataResult.totalBaris}</div>
                            </div>
                        </div>

                        {/* Valid */}
                        <div style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            padding: '18px 20px',
                            border: '1.5px solid #bbf7d0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                        }}>
                            <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '12px' }}>
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>AKUN & KELAS SESUAI</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#15803d' }}>{dataResult.totalValid}</div>
                            </div>
                        </div>

                        {/* Tidak Ditemukan */}
                        <div style={{
                            background: '#fff1f2',
                            borderRadius: '16px',
                            padding: '18px 20px',
                            border: '1.5px solid #fecdd3',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                        }}>
                            <div style={{ background: '#ffe4e6', color: '#be123c', padding: '12px', borderRadius: '12px' }}>
                                <XCircle size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9f1239' }}>BELUM TERDAFTAR</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#e11d48' }}>{dataResult.totalTidakDitemukan}</div>
                            </div>
                        </div>

                        {/* Kelas Berbeda */}
                        <div style={{
                            background: '#fffbeb',
                            borderRadius: '16px',
                            padding: '18px 20px',
                            border: '1.5px solid #fde68a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                        }}>
                            <div style={{ background: '#fef3c7', color: '#b45309', padding: '12px', borderRadius: '12px' }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e' }}>KELAS BERBEDA</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706' }}>{dataResult.totalKelasBerbeda}</div>
                            </div>
                        </div>
                    </div>

                    {/* Filter Toolbar & Actions */}
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        border: '1.5px solid #e2e8f0',
                        padding: '20px 24px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px'
                    }}>
                        {/* Tab Switcher */}
                        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setActiveTab('ALL')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    background: activeTab === 'ALL' ? '#ffffff' : 'transparent',
                                    color: activeTab === 'ALL' ? '#1e293b' : '#64748b',
                                    boxShadow: activeTab === 'ALL' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                                }}
                            >
                                Semua ({dataResult.totalBaris})
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('TIDAK_DITEMUKAN')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    background: activeTab === 'TIDAK_DITEMUKAN' ? '#ffe4e6' : 'transparent',
                                    color: activeTab === 'TIDAK_DITEMUKAN' ? '#be123c' : '#64748b',
                                    boxShadow: activeTab === 'TIDAK_DITEMUKAN' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                                }}
                            >
                                ❌ Belum Terdaftar ({dataResult.totalTidakDitemukan})
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('KELAS_BERBEDA')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    background: activeTab === 'KELAS_BERBEDA' ? '#fef3c7' : 'transparent',
                                    color: activeTab === 'KELAS_BERBEDA' ? '#b45309' : '#64748b',
                                    boxShadow: activeTab === 'KELAS_BERBEDA' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                                }}
                            >
                                ⚠️ Kelas Berbeda ({dataResult.totalKelasBerbeda})
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('VALID')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    background: activeTab === 'VALID' ? '#dcfce7' : 'transparent',
                                    color: activeTab === 'VALID' ? '#15803d' : '#64748b',
                                    boxShadow: activeTab === 'VALID' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                                }}
                            >
                                ✅ Sesuai ({dataResult.totalValid})
                            </button>
                        </div>

                        {/* Search & Copy Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ position: 'relative', minWidth: '240px' }}>
                                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    placeholder="Cari nama / NISN..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px 8px 36px',
                                        borderRadius: '10px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {dataResult.totalTidakDitemukan > 0 && (
                                <button
                                    type="button"
                                    onClick={handleCopyMissing}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '9px 16px',
                                        borderRadius: '10px',
                                        background: '#fff1f2',
                                        color: '#be123c',
                                        border: '1.5px solid #fecdd3',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(225, 29, 72, 0.1)'
                                    }}
                                    title="Salin daftar siswa yang belum terdaftar ke clipboard"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    <span>{copied ? 'Tersalin!' : 'Salin Siswa Belum Ada'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table Results */}
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        border: '1.5px solid #e2e8f0',
                        overflow: 'hidden',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontWeight: 800, fontSize: '0.8rem' }}>
                                        <th style={{ padding: '14px 18px', width: '50px', textAlign: 'center' }}>NO</th>
                                        <th style={{ padding: '14px 18px' }}>DATA EXCEL (INPUT)</th>
                                        <th style={{ padding: '14px 18px' }}>KELAS DI EXCEL</th>
                                        <th style={{ padding: '14px 18px' }}>DATA DI DATABASE (SISTEM)</th>
                                        <th style={{ padding: '14px 18px' }}>STATUS & KETERANGAN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredResults.length > 0 ? (
                                        filteredResults.map((item, idx) => {
                                            const isMissing = item.status === 'TIDAK_DITEMUKAN';
                                            const isMismatch = item.status === 'KELAS_BERBEDA';
                                            const isValid = item.status === 'VALID';

                                            return (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        borderBottom: '1px solid #f1f5f9',
                                                        background: isMissing
                                                            ? '#fff5f5'
                                                            : isMismatch
                                                            ? '#fffbeb'
                                                            : idx % 2 === 0 ? '#ffffff' : '#fafafa',
                                                        transition: 'background 0.2s'
                                                    }}
                                                >
                                                    {/* No */}
                                                    <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                                                        {item.rowNum}
                                                    </td>

                                                    {/* Data Input Excel */}
                                                    <td style={{ padding: '14px 18px' }}>
                                                        <div style={{ fontWeight: 800, color: '#1e293b' }}>
                                                            {item.namaInput || '(Nama Kosong)'}
                                                        </div>
                                                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                                                            NISN: <strong>{item.nisnInput || '-'}</strong>
                                                        </div>
                                                    </td>

                                                    {/* Kelas Input */}
                                                    <td style={{ padding: '14px 18px' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            background: '#f1f5f9',
                                                            color: '#334155',
                                                            fontWeight: 700,
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem'
                                                        }}>
                                                            {item.kelasInput || '(Kosong)'}
                                                        </span>
                                                    </td>

                                                    {/* Data in DB */}
                                                    <td style={{ padding: '14px 18px' }}>
                                                        {item.dbNama ? (
                                                            <div>
                                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                                                    {item.dbNama}
                                                                </div>
                                                                <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                                                    <span>Kelas DB: <strong style={{ color: isMismatch ? '#b45309' : '#059669' }}>{item.dbKelas}</strong></span>
                                                                    {item.dbEmail && <span>• {item.dbEmail}</span>}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem' }}>
                                                                Belum ada di database
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Status & Keterangan */}
                                                    <td style={{ padding: '14px 18px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            {isMissing && (
                                                                <span style={{
                                                                    background: '#fee2e2',
                                                                    color: '#dc2626',
                                                                    fontWeight: 800,
                                                                    padding: '4px 10px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.75rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}>
                                                                    <XCircle size={13} /> TIDAK DITEMUKAN
                                                                </span>
                                                            )}
                                                            {isMismatch && (
                                                                <span style={{
                                                                    background: '#fef3c7',
                                                                    color: '#b45309',
                                                                    fontWeight: 800,
                                                                    padding: '4px 10px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.75rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}>
                                                                    <AlertTriangle size={13} /> KELAS BERBEDA
                                                                </span>
                                                            )}
                                                            {isValid && (
                                                                <span style={{
                                                                    background: '#dcfce7',
                                                                    color: '#15803d',
                                                                    fontWeight: 800,
                                                                    padding: '4px 10px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.75rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}>
                                                                    <CheckCircle2 size={13} /> SESUAI
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: isMissing ? '#be123c' : isMismatch ? '#92400e' : '#166534', fontWeight: 600 }}>
                                                            {item.keterangan}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                                                Tidak ada data yang cocok dengan kriteria filter saat ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CekAkun;
