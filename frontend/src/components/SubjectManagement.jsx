import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BookOpen,
    Upload,
    FileText,
    Trash2,
    Plus,
    ChevronRight,
    ExternalLink,
    Search,
    Loader2,
    CheckCircle2,
    X,
    History,
    Eye,
    Clock,
    User,
    MessageSquare,
    Send,
    Check,
    Users
} from 'lucide-react';

const SubjectManagement = () => {
    const [uploadForm, setUploadForm] = useState({
        namaMateri: '',
        babId: '',
        file: null
    });
    const [assignments, setAssignments] = useState([]);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [viewLogs, setViewLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // List of Babs for selected assignment
    const [babs, setBabs] = useState([]);
    const [showBabModal, setShowBabModal] = useState(false);
    const [babForm, setBabForm] = useState({
        id: null,
        namaBab: '',
        prolog: '',
        urutan: 1
    });

    // Q&A state
    const [questions, setQuestions] = useState({}); // { babId: [questions] }
    const [answerText, setAnswerText] = useState('');
    const [answeringId, setAnsweringId] = useState(null);

    // Attendance State
    const [attendance, setAttendance] = useState({}); // { babId: [attendances] }
    const [isSyncing, setIsSyncing] = useState({}); // { babId: boolean }

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchAssignments();
    }, []);

    useEffect(() => {
        if (selectedAssignment && babs.length > 0) {
            babs.forEach(bab => {
                fetchQuestionsForBab(bab.id);
                fetchAttendanceForBab(bab.id);
            });
        }
    }, [selectedAssignment, babs.length]);

    const fetchAssignments = async () => {
        try {
            const res = await axios.get('/api/enrollment/guru-mapel/my', { headers });
            setAssignments(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch assignments:', err);
            setLoading(false);
        }
    };

    const fetchMaterials = async (assignmentId) => {
        try {
            const res = await axios.get(`/api/materi/assignment/${assignmentId}`, { headers });
            setMaterials(res.data);
            fetchNotifications();
        } catch (err) {
            console.error('Failed to fetch materials:', err);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/api/materi/teacher/notifications', { headers });
            setViewLogs(res.data);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    const fetchBabs = async (assignmentId) => {
        try {
            const res = await axios.get(`/api/bab/assignment/${assignmentId}`, { headers });
            setBabs(res.data);
        } catch (err) {
            console.error('Failed to fetch babs:', err);
        }
    };

    const fetchQuestionsForBab = async (babId) => {
        try {
            const res = await axios.get(`/api/bab-questions/bab/${babId}`, { headers });
            setQuestions(prev => ({ ...prev, [babId]: res.data }));
        } catch (err) {
            console.error('Failed to fetch questions:', err);
        }
    };

    const fetchAttendanceForBab = async (babId) => {
        try {
            const res = await axios.get(`/api/bab-attendance/${babId}`, { headers });
            setAttendance(prev => ({ ...prev, [babId]: res.data }));
        } catch (err) {
            console.error('Failed to fetch attendance:', err);
        }
    };

    const handleSyncToDrive = async (babId) => {
        setIsSyncing(prev => ({ ...prev, [babId]: true }));
        try {
            await axios.post(`/api/bab-attendance/${babId}/sync`, {}, { headers });
            alert('Berhasil disinkronkan ke BaknusDrive!');
        } catch (err) {
            alert('Gagal sinkronisasi');
        } finally {
            setIsSyncing(prev => ({ ...prev, [babId]: false }));
        }
    };

    const handleSaveAnswer = async (questionId, babId) => {
        if (!answerText.trim()) return;
        try {
            await axios.put(`/api/bab-questions/${questionId}/answer`, answerText, {
                headers: { ...headers, 'Content-Type': 'text/plain' }
            });
            setAnsweringId(null);
            setAnswerText('');
            fetchQuestions(babId);
        } catch (err) {
            alert('Gagal mengirim jawaban');
        }
    };

    const handleSelectAssignment = (assignment) => {
        setSelectedAssignment(assignment);
        fetchMaterials(assignment.id);
        fetchBabs(assignment.id);
    };

    const handleSaveBab = async (e) => {
        e.preventDefault();
        try {
            if (babForm.id) {
                await axios.put(`/api/bab/${babForm.id}`, { ...babForm, guruMapelId: selectedAssignment.id }, { headers });
            } else {
                await axios.post('/api/bab', { ...babForm, guruMapelId: selectedAssignment.id }, { headers });
            }
            setShowBabModal(false);
            setBabForm({ id: null, namaBab: '', prolog: '', urutan: babs.length + 1 });
            fetchBabs(selectedAssignment.id);
        } catch (err) {
            alert('Gagal menyimpan bab');
        }
    };

    const handleDeleteBab = async (id) => {
        if (!window.confirm('Yakin ingin menghapus bab ini? (Materi di dalamnya akan dipindahkan ke "Lainnya")')) return;
        try {
            await axios.delete(`/api/bab/${id}`, { headers });
            fetchBabs(selectedAssignment.id);
            fetchMaterials(selectedAssignment.id);
        } catch (err) {
            alert('Gagal menghapus bab');
        }
    };

    const handleFileChange = (e) => {
        setUploadForm({ ...uploadForm, file: e.target.files[0] });
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadForm.file || !uploadForm.namaMateri) {
            alert('Harap isi nama materi dan pilih file');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('guruMapelId', selectedAssignment.id);
        formData.append('namaMateri', uploadForm.namaMateri);
        if (uploadForm.babId) formData.append('babId', uploadForm.babId);
        formData.append('file', uploadForm.file);

        try {
            await axios.post('/api/materi/upload', formData, {
                headers: {
                    ...headers,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setUploadForm({ namaMateri: '', babId: '', file: null });
            fetchMaterials(selectedAssignment.id);
            alert('Materi berhasil diunggah!');
        } catch (err) {
            alert('Gagal mengunggah materi');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus materi ini?')) return;
        try {
            await axios.delete(`/api/materi/${id}`, { headers });
            fetchMaterials(selectedAssignment.id);
        } catch (err) {
            alert('Gagal menghapus materi');
        }
    };

    const filteredAssignments = assignments.filter(as =>
        as.namaMapel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        as.namaKelas.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    return (
        <div className="subject-mgmt">
            <div className="page-header">
                <div>
                    <h1>Manajemen Mata Pelajaran</h1>
                    <p>Kelola materi dan dokumen untuk mata pelajaran yang Anda ampu</p>
                </div>
            </div>

            <div className="content-grid">
                {/* Left side: List of Subjects */}
                <div className="side-panel">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Cari mata pelajaran atau kelas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="assignment-list">
                        {filteredAssignments.map((as) => (
                            <div
                                key={as.id}
                                className={`assignment-card ${selectedAssignment?.id === as.id ? 'active' : ''}`}
                                onClick={() => handleSelectAssignment(as)}
                            >
                                <div className="card-icon">
                                    <BookOpen size={20} />
                                </div>
                                <div className="card-info">
                                    <h4>{as.namaMapel}</h4>
                                    <span>{as.namaKelas}</span>
                                </div>
                                <ChevronRight size={18} className="arrow" />
                            </div>
                        ))}
                        {filteredAssignments.length === 0 && (
                            <p className="empty-msg">Tidak ada mata pelajaran ditemukan.</p>
                        )}
                    </div>
                </div>

                {/* Right side: Materials Management */}
                <div className="main-panel">
                    {!selectedAssignment ? (
                        <div className="empty-state">
                            <BookOpen size={64} className="mb-4 text-slate-300" />
                            <h3>Pilih Mata Pelajaran</h3>
                            <p>Silakan pilih mata pelajaran di sebelah kiri untuk mengelola materi.</p>
                        </div>
                    ) : (
                        <div className="material-container">
                            <div className="container-header">
                                <div>
                                    <h2>{selectedAssignment.namaMapel}</h2>
                                    <p>Kelas: {selectedAssignment.namaKelas}</p>
                                </div>
                                <button className="btn-upload-toggle" onClick={() => document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' })}>
                                    <Plus size={18} />
                                    <span>Unggah Baru</span>
                                </button>
                            </div>

                            <div className="materials-list">
                                <div className="section-header-bab">
                                    <h3>Struktur Materi & Bab</h3>
                                    <button className="btn-manage-bab" onClick={() => {
                                        setBabForm({ id: null, namaBab: '', prolog: '', urutan: babs.length + 1 });
                                        setShowBabModal(true);
                                    }}>
                                        <Plus size={16} />
                                        <span>Kelola Bab</span>
                                    </button>
                                </div>

                                {babs.length === 0 && materials.length === 0 ? (
                                    <div className="no-materials">
                                        <FileText size={48} className="text-slate-200" />
                                        <p>Belum ada bab atau materi yang diunggah.</p>
                                    </div>
                                ) : (
                                    <div className="babs-container">
                                        {/* Materials grouped by Bab */}
                                        {babs.map((bab) => (
                                            <div key={bab.id} className="bab-group">
                                                <div className="bab-header-row">
                                                    <div className="bab-info">
                                                        <h4>{bab.namaBab}</h4>
                                                        {bab.prolog && <p className="bab-prolog">{bab.prolog}</p>}
                                                    </div>
                                                    <div className="bab-actions">
                                                        <button className="btn-edit-bab" onClick={() => {
                                                            setBabForm(bab);
                                                            setShowBabModal(true);
                                                        }}>
                                                            Edit
                                                        </button>
                                                        <button className="btn-delete-bab" onClick={() => handleDeleteBab(bab.id)}>
                                                            Hapus
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="materials-grid">
                                                    {materials.filter(m => m.babId === bab.id).map((m) => (
                                                        <div key={m.id} className="material-item">
                                                            <div className="file-icon">
                                                                <div className="icon-wrapper">
                                                                    <FileText size={24} />
                                                                </div>
                                                            </div>
                                                            <div className="file-details">
                                                                <h4>{m.namaMateri}</h4>
                                                                <p>{m.fileName}</p>
                                                            </div>
                                                            <div className="file-actions">
                                                                <button className="btn-delete" title="Hapus" onClick={() => handleDelete(m.id)}>
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {materials.filter(m => m.babId === bab.id).length === 0 && (
                                                        <p className="no-materi-bab">Belum ada materi di bab ini.</p>
                                                    )}
                                                </div>

                                                {/* Q&A Section inside Bab - Premium Version */}
                                                <div className="qa-premium-container">
                                                    <div className="qa-header-premium">
                                                        <div className="header-icon-wrapper">
                                                            <MessageSquare size={18} />
                                                        </div>
                                                        <div className="header-text">
                                                            <h4>Diskusi Bab</h4>
                                                            <p>{questions[bab.id]?.length || 0} Pertanyaan Siswa</p>
                                                        </div>
                                                    </div>

                                                    <div className="questions-stream">
                                                        {questions[bab.id]?.length > 0 ? (
                                                            questions[bab.id].map((q, qIdx) => (
                                                                <div key={q.id} className={`qa-card-pro ${q.jawaban ? 'resolved' : 'pending'}`}>
                                                                    <div className="q-pro-header">
                                                                        <div className="author-info">
                                                                            <div className={`avatar-pro color-${qIdx % 5}`}>
                                                                                {q.namaSiswa.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div className="author-details">
                                                                                <span className="name">{q.namaSiswa}</span>
                                                                                <span className="timestamp">
                                                                                    <Clock size={10} />
                                                                                    {new Date(q.askedAt).toLocaleDateString('id-ID')}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className={`status-badge ${q.jawaban ? 'answered' : 'waiting'}`}>
                                                                            <div className="badge-dot"></div>
                                                                            <span>{q.jawaban ? 'Terjawab' : 'Menunggu'}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="q-pro-body">
                                                                        <p className="question-text">{q.pertanyaan}</p>

                                                                        {q.jawaban ? (
                                                                            <div className="answer-pro-bubble">
                                                                                <div className="a-pro-icon">
                                                                                    <Check size={14} />
                                                                                </div>
                                                                                <div className="a-pro-text">
                                                                                    <div className="a-pro-label">Amanat Anda:</div>
                                                                                    <p>{q.jawaban}</p>
                                                                                </div>
                                                                            </div>
                                                                        ) : answeringId === q.id ? (
                                                                            <div className="answer-pro-form">
                                                                                <div className="form-glow"></div>
                                                                                <textarea
                                                                                    placeholder="Bagikan pengetahuan Anda..."
                                                                                    value={answerText}
                                                                                    onChange={(e) => setAnswerText(e.target.value)}
                                                                                    autoFocus
                                                                                />
                                                                                <div className="form-footer">
                                                                                    <button className="btn-pro-cancel" onClick={() => setAnsweringId(null)}>Batalkan</button>
                                                                                    <button className="btn-pro-submit" onClick={() => handleSaveAnswer(q.id, bab.id)}>
                                                                                        <Send size={14} /> Kirim Jawaban
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                className="btn-pro-respond"
                                                                                onClick={() => {
                                                                                    setAnsweringId(q.id);
                                                                                    setAnswerText('');
                                                                                }}
                                                                            >
                                                                                Tanggapi Sekarang
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="qa-empty-state">
                                                                <p>Belum ada diskusi di bab ini.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Attendance Section inside Bab */}
                                                <div className="attendance-pro-container">
                                                    <div className="att-header-pro">
                                                        <div className="att-header-left">
                                                            <div className="att-icon-box">
                                                                <Users size={16} />
                                                            </div>
                                                            <div className="att-title-group">
                                                                <h5>Kehadiran Siswa</h5>
                                                                <span>{attendance[bab.id]?.length || 0} Siswa Hadir</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className={`btn-sync-drive ${isSyncing[bab.id] ? 'syncing' : ''}`}
                                                            onClick={() => handleSyncToDrive(bab.id)}
                                                            disabled={isSyncing[bab.id]}
                                                        >
                                                            {isSyncing[bab.id] ? <Loader2 className="spin" size={14} /> : <ExternalLink size={14} />}
                                                            <span>{isSyncing[bab.id] ? 'Menyingkronkan...' : 'Sync ke Drive'}</span>
                                                        </button>
                                                    </div>

                                                    <div className="attendance-list-detailed">
                                                        {attendance[bab.id]?.length > 0 ? (
                                                            <div className="att-students-grid">
                                                                {attendance[bab.id].map((att, idx) => (
                                                                    <div key={idx} className="att-student-pill">
                                                                        <div className="att-pill-avatar">
                                                                            {att.namaSiswa.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="att-pill-info">
                                                                            <span className="att-pill-name">{att.namaSiswa}</span>
                                                                            <span className="att-pill-class">{att.kelas}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="no-attendance">Belum ada siswa yang hadir di bab ini.</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Materials without Bab */}
                                        {materials.filter(m => !m.babId).length > 0 && (
                                            <div className="bab-group others">
                                                <div className="bab-header-row">
                                                    <h4>Materi Lainnya</h4>
                                                </div>
                                                <div className="materials-grid">
                                                    {materials.filter(m => !m.babId).map((m) => (
                                                        <div key={m.id} className="material-item">
                                                            <div className="file-icon">
                                                                <div className="icon-wrapper">
                                                                    <FileText size={24} />
                                                                </div>
                                                            </div>
                                                            <div className="file-details">
                                                                <h4>{m.namaMateri}</h4>
                                                                <p>{m.fileName}</p>
                                                            </div>
                                                            <div className="file-actions">
                                                                <button className="btn-delete" title="Hapus" onClick={() => handleDelete(m.id)}>
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="view-history-section">
                                <div className="section-header">
                                    <div className="header-title">
                                        <div className="icon-pill">
                                            <History size={20} />
                                        </div>
                                        <h3>Riwayat Penayangan Siswa</h3>
                                    </div>
                                    <div className="view-stats">
                                        <Eye size={16} />
                                        <span>Total {viewLogs.filter(log => materials.some(m => m.namaMateri === log.materiName)).length} Kunjungan</span>
                                    </div>
                                </div>

                                {viewLogs.filter(log => materials.some(m => m.namaMateri === log.materiName)).length === 0 ? (
                                    <div className="empty-history">
                                        <div className="empty-icon-wrapper">
                                            <User size={40} />
                                        </div>
                                        <p>Belum ada siswa yang melihat materi.</p>
                                        <span>Aktivitas siswa akan muncul di sini secara otomatis.</span>
                                    </div>
                                ) : (
                                    <div className="history-stack">
                                        {viewLogs.filter(log => materials.some(m => m.namaMateri === log.materiName)).map((log, idx) => (
                                            <div key={idx} className="history-card-premium">
                                                <div className="card-accent"></div>
                                                <div className="student-profile">
                                                    <div className={`student-avatar color-${idx % 5}`}>
                                                        {log.siswaName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="student-info">
                                                        <span className="student-name">{log.siswaName}</span>
                                                        <div className="view-detail">
                                                            <FileText size={12} />
                                                            <span>{log.materiName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="view-time">
                                                    <Clock size={14} />
                                                    <span>{new Date(log.viewedAt).toLocaleString('id-ID', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div id="upload-section" className="upload-section">
                                <h3>Tambah Materi Baru</h3>
                                <form onSubmit={handleUpload} className="upload-form">
                                    <div className="form-group">
                                        <label>Nama Materi</label>
                                        <input
                                            type="text"
                                            placeholder="Contoh: Modul Bab 1 - Pengenalan"
                                            value={uploadForm.namaMateri}
                                            onChange={(e) => setUploadForm({ ...uploadForm, namaMateri: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Masukan ke Bab (Opsional)</label>
                                        <select
                                            value={uploadForm?.babId || ''}
                                            onChange={(e) => setUploadForm({ ...uploadForm, babId: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0' }}
                                        >
                                            <option value="">-- Pilih Bab --</option>
                                            {babs.map(b => (
                                                <option key={b.id} value={b.id}>{b.namaBab}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>File (PDF, Docx, PPTX)</label>
                                        <div className="file-input-wrapper">
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.ppt,.pptx"
                                                onChange={handleFileChange}
                                                id="materi-file"
                                            />
                                            <label htmlFor="materi-file" className="file-label">
                                                <Upload size={18} className="mr-2" />
                                                {uploadForm.file ? uploadForm.file.name : 'Pilih file'}
                                            </label>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        className={`btn-submit ${uploading ? 'loading' : ''}`}
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin mr-2" />
                                                Mengunggah ke Drive...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={18} className="mr-2" />
                                                Simpan & Upload ke BaknusDrive
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bab Management Modal */}
            {showBabModal && (
                <div className="modal-overlay">
                    <div className="modal-content-bab">
                        <div className="modal-header">
                            <h2>{babForm.id ? 'Edit Bab' : 'Tambah Bab Baru'}</h2>
                            <button className="btn-close" onClick={() => setShowBabModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveBab}>
                            <div className="form-group-bab">
                                <label>Nama Bab</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Bab 1: Dasar Pemrograman"
                                    value={babForm.namaBab}
                                    onChange={(e) => setBabForm({ ...babForm, namaBab: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group-bab">
                                <label>Prolog / Pengenalan Bab</label>
                                <textarea
                                    placeholder="Tuliskan gambaran singkat mengenai bab ini..."
                                    value={babForm.prolog}
                                    onChange={(e) => setBabForm({ ...babForm, prolog: e.target.value })}
                                    rows="4"
                                />
                            </div>
                            <div className="form-group-bab">
                                <label>Urutan Tampil</label>
                                <input
                                    type="number"
                                    value={babForm.urutan}
                                    onChange={(e) => setBabForm({ ...babForm, urutan: parseInt(e.target.value) })}
                                    min="1"
                                    required
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowBabModal(false)}>Batal</button>
                                <button type="submit" className="btn-save">Simpan Bab</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .subject-mgmt { padding: 0; }
                .page-header { margin-bottom: 30px; }
                .page-header h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
                .page-header p { color: #64748b; font-size: 1.1rem; }

                .content-grid {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: 30px;
                    align-items: start;
                }

                /* Side Panel */
                .side-panel {
                    background: white;
                    border-radius: 24px;
                    padding: 24px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }

                .search-box {
                    position: relative;
                    margin-bottom: 24px;
                }
                .search-icon {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                }
                .search-box input {
                    width: 100%;
                    padding: 12px 12px 12px 42px;
                    border: 2px solid #f1f5f9;
                    border-radius: 14px;
                    background: #f8fafc;
                    transition: all 0.2s;
                }
                .search-box input:focus {
                    border-color: #3b82f6;
                    background: white;
                    outline: none;
                }

                .assignment-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .assignment-card {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                .assignment-card:hover {
                    background: #f1f5f9;
                }
                .assignment-card.active {
                    background: #eff6ff;
                    border-color: #bfdbfe;
                }
                .card-icon {
                    width: 44px;
                    height: 44px;
                    background: #f8fafc;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .active .card-icon {
                    background: #3b82f6;
                    color: white;
                }
                .card-info h4 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #1e293b; }
                .card-info span { font-size: 0.8rem; color: #64748b; font-weight: 500; }
                .arrow { margin-left: auto; color: #cbd5e1; opacity: 0; transition: all 0.2s; }
                .assignment-card:hover .arrow { opacity: 1; transform: translateX(4px); }
                .active .arrow { opacity: 1; color: #3b82f6; }

                /* Main Panel */
                .main-panel {
                    min-height: 600px;
                }
                .empty-state {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    border-radius: 32px;
                    border: 2px dashed #e2e8f0;
                    color: #64748b;
                }

                .material-container {
                    background: white;
                    border-radius: 32px;
                    padding: 40px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
                }

                .container-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 40px;
                }
                .container-header h2 { font-size: 1.75rem; font-weight: 800; color: #0f172a; margin: 0; }
                .container-header p { color: #64748b; margin: 4px 0 0 0; }
                
                .btn-upload-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #3b82f6;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 14px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(59,130,246,0.3);
                }
                .btn-upload-toggle:hover {
                    background: #2563eb;
                    transform: translateY(-2px);
                }

                .materials-list h3, .upload-section h3 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .materials-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
                .material-item {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding: 20px;
                    background: #f8fafc;
                    border-radius: 20px;
                    border: 1px solid #f1f5f9;
                    transition: all 0.2s;
                }
                .material-item:hover {
                    background: white;
                    border-color: #3b82f640;
                    box-shadow: 0 4px 12px -2px rgba(0,0,0,0.05);
                    transform: translateX(4px);
                }
                .icon-wrapper {
                    width: 50px;
                    height: 50px;
                    background: white;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #3b82f6;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .file-details h4 { margin: 0; font-size: 1rem; color: #1e293b; }
                .file-details p { margin: 2px 0; font-size: 0.85rem; color: #64748b; word-break: break-all; }
                .file-details .date { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }

                .file-actions { margin-left: auto; }
                .btn-delete {
                    padding: 8px;
                    color: #ef4444;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    border-radius: 10px;
                    transition: all 0.2s;
                }
                .btn-delete:hover {
                    background: #fef2f2;
                }

                .no-materials {
                    text-align: center;
                    padding: 60px;
                    background: #f8fafc;
                    border-radius: 24px;
                    color: #94a3b8;
                }

                .upload-section {
                    margin-top: 50px;
                    padding-top: 40px;
                    border-top: 1px solid #f1f5f9;
                }
                .upload-form {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    background: #f8fafc;
                    padding: 24px;
                    border-radius: 20px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .form-group label { font-size: 0.9rem; font-weight: 600; color: #475569; }
                .form-group input[type="text"] {
                    padding: 12px 16px;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    outline: none;
                    transition: all 0.2s;
                }
                .form-group input[type="text"]:focus { border-color: #3b82f6; }

                .file-input-wrapper {
                    position: relative;
                }
                .file-input-wrapper input[type="file"] {
                    position: absolute;
                    width: 0.1px;
                    height: 0.1px;
                    opacity: 0;
                }
                .file-label {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px 16px;
                    background: white;
                    border: 2px dashed #cbd5e1;
                    border-radius: 12px;
                    cursor: pointer;
                    color: #64748b;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .file-label:hover { border-color: #3b82f6; color: #3b82f6; }

                .btn-submit {
                    grid-column: span 2;
                    margin-top: 12px;
                    padding: 14px;
                    border-radius: 12px;
                    background: #0f172a;
                    color: white;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-submit:hover:not(:disabled) { background: #1e293b; transform: translateY(-2px); }
                .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

                /* Bab Specific Styles */
                .section-header-bab {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .btn-manage-bab {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background: #f1f5f9;
                    color: #475569;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 0.85rem;
                }
                .btn-manage-bab:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }

                .bab-group {
                    margin-bottom: 30px;
                    border-radius: 24px;
                    overflow: hidden;
                    border: 1px solid #f1f5f9;
                }
                .bab-group.others { border-style: dashed; }
                
                .bab-header-row {
                    background: #f8fafc;
                    padding: 20px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 1px solid #f1f5f9;
                }
                .bab-info h4 { margin: 0; font-size: 1.1rem; color: #1e293b; font-weight: 800; }
                .bab-prolog { margin: 6px 0 0 0; font-size: 0.9rem; color: #64748b; line-height: 1.5; }
                
                .bab-actions { display: flex; gap: 10px; }
                .btn-edit-bab, .btn-delete-bab {
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 6px;
                }
                .btn-edit-bab { background: #eff6ff; color: #3b82f6; }
                .btn-delete-bab { background: #fef2f2; color: #ef4444; }

                .no-materi-bab {
                    padding: 20px;
                    text-align: center;
                    color: #94a3b8;
                    font-size: 0.85rem;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }
                .modal-content-bab {
                    background: white;
                    width: 100%;
                    max-width: 500px;
                    border-radius: 28px;
                    padding: 32px;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .modal-header h2 { margin: 0; font-size: 1.5rem; font-weight: 800; }
                .btn-close { background: #f8fafc; padding: 6px; border-radius: 50%; color: #64748b; }
                
                .form-group-bab { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
                .form-group-bab label { font-weight: 600; color: #475569; font-size: 0.9rem; }
                .form-group-bab input, .form-group-bab textarea {
                    padding: 12px 16px;
                    border: 2px solid #f1f5f9;
                    border-radius: 12px;
                    outline: none;
                }
                .form-group-bab input:focus, .form-group-bab textarea:focus { border-color: #3b82f6; }

                .modal-footer { display: flex; gap: 12px; margin-top: 30px; }
                .btn-cancel { flex: 1; padding: 12px; background: #f1f5f9; border-radius: 12px; font-weight: 700; color: #475569; }
                .btn-save { flex: 2; padding: 12px; background: #3b82f6; color: white; border-radius: 12px; font-weight: 700; }

                /* Dark mode bab adjustments */
                [data-theme="dark"] .bab-group { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .bab-header-row { background: #0f172a; border-bottom-color: #334155; }
                [data-theme="dark"] .bab-info h4 { color: #f8fafc; }
                [data-theme="dark"] .bab-prolog { color: #94a3b8; }
                [data-theme="dark"] .btn-manage-bab { background: #334155; color: #cbd5e1; }
                [data-theme="dark"] .modal-content-bab { background: #1e293b; color: #f8fafc; }
                [data-theme="dark"] .form-group-bab label { color: #94a3b8; }
                [data-theme="dark"] .form-group-bab input, [data-theme="dark"] .form-group-bab textarea { background: #0f172a; border-color: #334155; color: white; }
                [data-theme="dark"] .btn-cancel { background: #0f172a; color: #94a3b8; }
                [data-theme="dark"] .btn-upload-toggle { box-shadow: 0 4px 15px rgba(59,130,246,0.3); }

                .assignment-card.active {
                    background: #eff6ff;
                    border-color: #bfdbfe;
                }

                /* Pro Visual Q&A Interface */
                .qa-premium-container {
                    margin-top: 40px;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-radius: 28px;
                    border: 1px solid #e2e8f0;
                    padding: 4px;
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
                }

                .qa-header-premium {
                    padding: 24px;
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    background: white;
                    border-radius: 24px;
                    margin: 4px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                }

                .header-icon-wrapper {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    color: white;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 16px -4px rgba(99, 102, 241, 0.4);
                }

                .header-text h4 { margin: 0; font-size: 1.1rem; font-weight: 850; color: #0f172a; letter-spacing: -0.02em; }
                .header-text p { margin: 2px 0 0 0; font-size: 0.85rem; color: #64748b; font-weight: 600; }

                .questions-stream {
                    padding: 24px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                }

                .qa-card-pro {
                    background: white;
                    border-radius: 24px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .qa-card-pro:hover {
                    box-shadow: 0 12px 24px -10px rgba(0,0,0,0.08);
                    transform: translateY(-2px);
                    border-color: #e2e8f0;
                }

                .q-pro-header {
                    padding: 18px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #f8fafc;
                }

                .author-info { display: flex; align-items: center; gap: 12px; }
                .avatar-pro {
                    width: 40px;
                    height: 40px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 800;
                    font-size: 1rem;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                }

                .author-details .name { display: block; font-weight: 750; color: #1e293b; font-size: 0.95rem; }
                .author-details .timestamp { display: flex; align-items: center; gap: 4px; color: #94a3b8; font-size: 0.75rem; font-weight: 500; }

                .status-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .status-badge.waiting { background: #fff7ed; color: #ed8936; border: 1px solid #ffedd5; }
                .status-badge.answered { background: #f0fdf4; color: #16a34a; border: 1px solid #dcfce7; }
                
                .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
                .waiting .badge-dot { animation: pulseGlow 2s infinite; }

                .q-pro-body { padding: 20px; }
                .question-text {
                    font-size: 1.05rem;
                    color: #334155;
                    font-weight: 600;
                    line-height: 1.6;
                    margin: 0 0 20px 0;
                    padding-left: 4px;
                }

                .answer-pro-bubble {
                    display: flex;
                    gap: 12px;
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 20px;
                    border: 1px solid #eef2ff;
                    position: relative;
                }

                .a-pro-icon {
                    width: 28px;
                    height: 28px;
                    background: #6366f1;
                    color: white;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .a-pro-label { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #6366f1; margin-bottom: 4px; letter-spacing: 0.05em; }
                .a-pro-text p { margin: 0; color: #1e293b; font-size: 0.95rem; font-weight: 500; line-height: 1.6; }

                .btn-pro-respond {
                    width: 100%;
                    padding: 12px;
                    border-radius: 14px;
                    background: #f1f5f9;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-pro-respond:hover { background: #6366f1; color: white; border-color: #6366f1; box-shadow: 0 8px 16px -4px rgba(99, 102, 241, 0.4); }

                .answer-pro-form {
                    position: relative;
                    padding: 4px;
                }

                .answer-pro-form textarea {
                    width: 100%;
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 18px;
                    padding: 16px;
                    font-family: inherit;
                    font-size: 1rem;
                    min-height: 120px;
                    transition: all 0.2s;
                    resize: none;
                }

                .answer-pro-form textarea:focus {
                    background: white;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                    outline: none;
                }

                .form-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 15px;
                }

                .btn-pro-cancel { background: transparent; border: none; color: #94a3b8; font-weight: 700; cursor: pointer; padding: 10px 20px; border-radius: 12px; }
                .btn-pro-cancel:hover { background: #f1f5f9; color: #64748b; }

                .btn-pro-submit {
                    background: #0f172a;
                    color: white;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 14px;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.3);
                }

                .btn-pro-submit:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.4); }

                /* Attendance Pro Section Styles */
                .attendance-pro-container {
                    margin-top: 20px;
                    background: white;
                    border-radius: 20px;
                    border: 1px solid #f1f5f9;
                    padding: 18px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                }

                .att-header-pro {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .att-header-left { display: flex; align-items: center; gap: 12px; }
                .att-icon-box {
                    width: 32px;
                    height: 32px;
                    background: #f0f9ff;
                    color: #0ea5e9;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .att-title-group h5 { margin: 0; font-size: 0.9rem; font-weight: 850; color: #0f172a; }
                .att-title-group span { font-size: 0.75rem; color: #64748b; font-weight: 600; }

                .btn-sync-drive {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    color: #475569;
                    font-size: 0.75rem;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-sync-drive:hover { background: #0ea5e9; color: white; border-color: #0ea5e9; }
                .btn-sync-drive.syncing { opacity: 0.7; cursor: not-allowed; }

                .attendance-list-detailed {
                    padding-top: 15px;
                    border-top: 1px solid #f8fafc;
                }

                .att-students-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .att-student-pill {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 6px 14px;
                    border-radius: 50px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .att-student-pill:hover {
                    background: white;
                    border-color: #0ea5e9;
                    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
                    transform: translateY(-2px);
                }

                .att-pill-avatar {
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #6366f1, #a855f7);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 800;
                    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
                }

                .att-pill-info {
                    display: flex;
                    flex-direction: column;
                }

                .att-pill-name {
                    font-size: 0.82rem;
                    font-weight: 750;
                    color: #1e293b;
                    line-height: 1.2;
                }

                .att-pill-class {
                    font-size: 0.65rem;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .no-attendance { font-size: 0.8rem; color: #94a3b8; font-weight: 600; font-style: italic; }

                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                @keyframes pulseGlow { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }

                /* View History Section */
                .view-history-section {
                    margin-top: 60px;
                }
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .header-title h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #1e293b;
                }
                .icon-pill {
                    width: 40px;
                    height: 40px;
                    background: #f1f5f9;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #475569;
                }
                .view-stats {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #f0f9ff;
                    color: #0369a1;
                    padding: 6px 14px;
                    border-radius: 50px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    border: 1px solid #e0f2fe;
                }

                .empty-history {
                    background: #f8fafc;
                    border: 2px dashed #e2e8f0;
                    border-radius: 24px;
                    padding: 40px;
                    text-align: center;
                }
                .empty-icon-wrapper {
                    width: 70px;
                    height: 70px;
                    background: white;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    color: #cbd5e1;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .empty-history p { color: #475569; font-weight: 700; margin: 0; }
                .empty-history span { color: #94a3b8; font-size: 0.85rem; }

                .history-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .history-card-premium {
                    background: white;
                    border: 1px solid #f1f5f9;
                    border-radius: 18px;
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .history-card-premium:hover {
                    border-color: #3b82f640;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
                    transform: translateX(6px);
                }
                .card-accent {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: #3b82f6;
                    opacity: 0;
                    transition: all 0.2s;
                }
                .history-card-premium:hover .card-accent { opacity: 1; }

                .student-profile {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .student-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 1.1rem;
                    color: white;
                }
                .color-0 { background: linear-gradient(135deg, #6366f1, #4f46e5); }
                .color-1 { background: linear-gradient(135deg, #ec4899, #d946ef); }
                .color-2 { background: linear-gradient(135deg, #10b981, #059669); }
                .color-3 { background: linear-gradient(135deg, #f59e0b, #d97706); }
                .color-4 { background: linear-gradient(135deg, #06b6d4, #0891b2); }

                .student-name {
                    display: block;
                    font-weight: 700;
                    color: #1e293b;
                    font-size: 0.95rem;
                }
                .view-detail {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #64748b;
                    font-size: 0.8rem;
                }
                .view-time {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #94a3b8;
                    font-size: 0.8rem;
                    font-weight: 500;
                    background: #f8fafc;
                    padding: 6px 12px;
                    border-radius: 10px;
                }

                @media (max-width: 1024px) {
                    .content-grid { grid-template-columns: 1fr; }
                    .side-panel { grid-row: 2; }
                    .upload-form { grid-template-columns: 1fr; }
                    .btn-submit { grid-column: auto; }
                }

                /* Dark Mode Overrides for Subject Management */
                [data-theme="dark"] .side-panel,
                [data-theme="dark"] .material-container {
                    background: #1e293b;
                    border-color: #334155;
                }

                [data-theme="dark"] .page-header h1,
                [data-theme="dark"] .container-header h2,
                [data-theme="dark"] .materials-list h3,
                [data-theme="dark"] .upload-section h3,
                [data-theme="dark"] .header-title h3,
                [data-theme="dark"] .student-name,
                [data-theme="dark"] .card-info h4,
                [data-theme="dark"] .file-details h4 {
                    color: #f8fafc;
                }

                [data-theme="dark"] .search-box input,
                [data-theme="dark"] .form-group input[type="text"],
                [data-theme="dark"] .file-label {
                    background: #0f172a;
                    border-color: #334155;
                    color: #f1f5f9;
                }

                [data-theme="dark"] .assignment-card:hover {
                    background: #334155;
                }

                [data-theme="dark"] .assignment-card.active {
                    background: #1e40af30;
                    border-color: #3b82f6;
                }

                [data-theme="dark"] .card-icon {
                    background: #0f172a;
                    color: #94a3b8;
                }

                [data-theme="dark"] .active .card-icon {
                    background: #3b82f6;
                    color: white;
                }

                [data-theme="dark"] .material-item {
                    background: #0f172a;
                    border-color: #334155;
                }

                [data-theme="dark"] .material-item:hover {
                    background: #1e293b;
                    border-color: #3b82f640;
                }

                [data-theme="dark"] .icon-wrapper {
                    background: #1e293b;
                    color: #60a5fa;
                }

                [data-theme="dark"] .upload-form {
                    background: #0f172a;
                }

                [data-theme="dark"] .history-card-premium {
                    background: #0f172a;
                    border-color: #334155;
                }

                [data-theme="dark"] .history-card-premium:hover {
                    background: #1e293b;
                    border-color: #3b82f640;
                }

                [data-theme="dark"] .icon-pill {
                    background: #334155;
                    color: #cbd5e1;
                }

                [data-theme="dark"] .view-time {
                    background: #334155;
                    color: #94a3b8;
                }

                [data-theme="dark"] .empty-history {
                    background: #0f172a;
                    border-color: #334155;
                }

                [data-theme="dark"] .empty-icon-wrapper {
                    background: #1e293b;
                    color: #475569;
                }

                [data-theme="dark"] .form-group label {
                    color: #cbd5e1;
                }

                /* Pro Q&A Dark Mode Refinements */
                [data-theme="dark"] .qa-premium-container {
                    background: linear-gradient(135deg, #0f172a 0%, #111827 100%);
                    border-color: #1e293b;
                }
                [data-theme="dark"] .qa-header-premium {
                    background: #1e293b;
                    border-bottom-color: #334155;
                }
                [data-theme="dark"] .qa-card-pro {
                    background: #0f172a;
                    border-color: #1e293b;
                }
                [data-theme="dark"] .q-pro-header {
                    border-bottom-color: #1e293b;
                }
                [data-theme="dark"] .answer-pro-bubble {
                    background: #111827;
                    border-color: #1e293b;
                }
                [data-theme="dark"] .btn-pro-respond {
                    background: #1e293b;
                    border-color: #334155;
                    color: #94a3b8;
                }
                [data-theme="dark"] .btn-pro-respond:hover {
                    color: white;
                }
                [data-theme="dark"] .answer-pro-form textarea {
                    background: #111827;
                    border-color: #1e293b;
                }
                [data-theme="dark"] .status-badge.waiting {
                    background: #431407;
                    color: #fb923c;
                    border-color: #7c2d12;
                }
                [data-theme="dark"] .status-badge.answered {
                    background: #064e3b;
                    color: #4ade80;
                    border-color: #065f46;
                }

                /* Attendance Dark Mode */
                [data-theme="dark"] .attendance-pro-container { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .att-title-group h5 { color: #f8fafc; }
                [data-theme="dark"] .btn-sync-drive { background: #0f172a; border-color: #334155; color: #cbd5e1; }
                [data-theme="dark"] .attendance-list-detailed { border-color: #334155; }
                [data-theme="dark"] .att-student-pill { background: #0f172a; border-color: #334155; }
                [data-theme="dark"] .att-student-pill:hover { background: #1e293b; border-color: #0ea5e9; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2); }
                [data-theme="dark"] .att-pill-name { color: #f1f5f9; }
                [data-theme="dark"] .att-pill-class { color: #94a3b8; }
            `}
            </style>
        </div>
    );
};

export default SubjectManagement;
