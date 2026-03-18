import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BookOpen,
    FileText,
    Search,
    Loader2,
    ExternalLink,
    Bell,
    CheckCircle,
    Clock,
    History,
    ChevronRight,
    ArrowLeft,
    MessageSquare,
    Send,
    MessageCircle,
    Upload,
    X,
    Eye,
    Download,
    EyeOff
} from 'lucide-react';

const StudentMaterials = () => {
    const [materials, setMaterials] = useState([]);
    const [babs, setBabs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubject, setSelectedSubject] = useState(null);

    // Q&A State
    const [questions, setQuestions] = useState({}); // { babId: [questions] }
    const [newQuestion, setNewQuestion] = useState('');

    // Preview State
    const [previewFile, setPreviewFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [askingBabId, setAskingBabId] = useState(null);

    // Attendance State
    const [attendedBabs, setAttendedBabs] = useState({}); // { babId: boolean }

    // Upload Task State
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedBabId, setSelectedBabId] = useState('');
    const [mySubmissions, setMySubmissions] = useState([]);

    const token = localStorage.getItem('token');
    const headers = React.useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    useEffect(() => {
        fetchMaterials();
        fetchMySubmissions();
    }, []);

    const fetchMySubmissions = async () => {
        try {
            const res = await axios.get('/api/materi/student/my-submissions', { headers });
            console.log('Submissions fetched:', res.data.length);
            // Case-insensitive filtering for submissions
            const filtered = res.data.filter(s =>
                s.subjectName?.trim().toLowerCase() === selectedSubject?.trim().toLowerCase()
            );
            console.log(`Fetched ${res.data.length} submissions total, ${filtered.length} for ${selectedSubject}`);
            setMySubmissions(res.data);
        } catch (err) {
            console.error('Failed to fetch my submissions:', err);
        }
    };

    const fetchMaterials = async () => {
        try {
            const [matRes, babRes] = await Promise.all([
                axios.get('/api/materi/student/my', { headers }),
                axios.get('/api/bab/my', { headers })
            ]);
            setMaterials(matRes.data);
            setBabs(babRes.data);
            setLoading(false);

            // Initial fetch of questions for babs if a subject is already selected (for refresh)
            // Initial fetch for babs
            if (selectedSubject) {
                const subjectBabs = babRes.data.filter(b => matRes.data.some(m => m.namaMapel === selectedSubject && m.babId === b.id));
                subjectBabs.forEach(bab => {
                    fetchQuestionsForBab(bab.id);
                    fetchAttendanceStatus(bab.id);
                });
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setLoading(false);
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

    const handleAskQuestion = async (babId) => {
        if (!newQuestion.trim()) return;
        try {
            await axios.post(`/api/bab-questions/bab/${babId}`, newQuestion, {
                headers: { ...headers, 'Content-Type': 'text/plain' }
            });
            setNewQuestion('');
            setAskingBabId(null);
            fetchQuestionsForBab(babId);
        } catch (err) {
            alert('Gagal mengirim pertanyaan');
        }
    };

    // Use effect to fetch questions when subject changes
    useEffect(() => {
        if (selectedSubject) {
            const subjectBabs = babs.filter(b => materials.some(m => m.namaMapel === selectedSubject && m.babId === b.id));
            subjectBabs.forEach(bab => {
                fetchQuestionsForBab(bab.id);
                fetchAttendanceStatus(bab.id);
            });
            fetchMySubmissions(); // Also fetch submissions whenever subject changes
        }
    }, [selectedSubject]);

    const fetchAttendanceStatus = async (babId) => {
        try {
            const res = await axios.get(`/api/bab-attendance/${babId}/check`, { headers });
            setAttendedBabs(prev => ({ ...prev, [babId]: res.data }));
        } catch (err) {
            console.error('Failed to fetch attendance:', err);
        }
    };

    const handleMarkAttendance = async (babId) => {
        try {
            await axios.post(`/api/bab-attendance/${babId}/attend`, {}, { headers });
            setAttendedBabs(prev => ({ ...prev, [babId]: true }));
            // Success animation or feedback
        } catch (err) {
            alert('Gagal melakukan presensi');
        }
    };

    const handleUploadTask = async (teacherEmail, subjectName) => {
        if (!selectedFile) {
            alert('Silakan pilih file terlebih dahulu');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('teacherEmail', teacherEmail);
        formData.append('subjectName', subjectName);
        if (selectedBabId) formData.append('babId', selectedBabId);

        setIsUploading(true);
        try {
            await axios.post('/api/materi/student/upload-tugas', formData, {
                headers: {
                    ...headers,
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('Tugas berhasil diunggah ke BaknusDrive Anda dan dibagikan ke Guru!');
            setSelectedFile(null);
            setSelectedBabId('');
            fetchMySubmissions();
            // Reset input file if possible or just rely on state
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Gagal mengunggah tugas. Silakan coba lagi.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleViewMateri = async (materi) => {
        // Mark as viewed in backend
        if (!materi.isViewed) {
            try {
                await axios.post(`/api/materi/${materi.id}/log-view`, {}, { headers });
                // Update local state to remove the "NEW" badge
                setMaterials(materials.map(m =>
                    m.id === materi.id ? { ...m, isViewed: true } : m
                ));
            } catch (err) {
                console.error('Failed to log view:', err);
            }
        }

        // Extract file ID properly (handles both /view/ID and /file/ID/download)
        const getFileId = (link) => {
            if (!link) return null;
            const segs = link.split('/');
            // Try to find a pure numeric segment
            for (let i = segs.length - 1; i >= 0; i--) {
                if (/^\d+$/.test(segs[i])) return segs[i];
            }
            // Fallback for simple local relative paths
            const match = link.match(/\/view\/(\d+)/);
            return match ? match[1] : null;
        };

        const fileId = getFileId(materi.driveLink);
        if (!fileId) {
            console.warn("Could not extract file ID from:", materi.driveLink);
            return;
        }

        // Default: use proxy URL
        const publicUrl = window.location.origin + `/api/materi/view/${fileId}/${encodeURIComponent(materi.fileName)}`;
        let viewerUrl = publicUrl;

        // For Office Docs, use our new internal Collabora endpoint from BaknusClass backend
        if (/\.(docx|doc|pptx|ppt|xlsx|xls)$/i.test(materi.fileName)) {
            try {
                // We useaxios with the existing headers if they exist, or just fetch
                const response = await fetch(`/api/materi/view/collabora/${fileId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.url) {
                        viewerUrl = data.url;
                    }
                } else {
                    // Fallback to Google if internal backend fails
                    viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`;
                }
            } catch (error) {
                console.error("Failed to fetch internal viewer URL:", error);
                viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`;
            }
        }

        setPreviewUrl(viewerUrl);
        setPreviewFile({ ...materi, extractedId: fileId });
    };

    // Group materials by subject for the main list
    const subjects = [...new Set(materials.map(m => m.namaMapel))].map(name => {
        const subjectMaterials = materials.filter(m => m.namaMapel === name);
        const lastUpdate = new Date(Math.max(...subjectMaterials.map(m => new Date(m.uploadedAt))));
        const newCount = subjectMaterials.filter(m => !m.isViewed).length;
        return { name, lastUpdate, newCount, totalMaterials: subjectMaterials.length };
    });

    const filteredSubjects = subjects.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const newMateriCount = materials.filter(m => !m.isViewed).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        );
    }

    return (
        <div className="student-materi">
            <div className="page-header">
                <div className="header-content">
                    <h1>Materi Pelajaran</h1>
                    <p>Akses materi pembelajaran dari guru-guru Anda</p>
                </div>
                {newMateriCount > 0 && (
                    <div className="notification-badge">
                        <Bell className="animate-bounce" size={20} />
                        <span>{newMateriCount} Materi Baru</span>
                    </div>
                )}
            </div>

            {/* Subject List View */}
            {!selectedSubject ? (
                <>
                    <div className="search-section">
                        <div className="search-bar">
                            <Search size={20} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Cari mata pelajaran..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {filteredSubjects.length === 0 ? (
                        <div className="empty-state">
                            <BookOpen size={80} className="text-slate-200 mb-4" />
                            <h3>Tidak Menemukan Mata Pelajaran</h3>
                            <p>Coba gunakan kata kunci lain atau tunggu update dari guru Anda.</p>
                        </div>
                    ) : (
                        <div className="subjects-grid">
                            {filteredSubjects.map((s, idx) => (
                                <div
                                    key={idx}
                                    className={`subject-card ${s.newCount > 0 ? 'has-new' : ''}`}
                                    onClick={() => setSelectedSubject(s.name)}
                                >
                                    <div className="subject-icon">
                                        <BookOpen size={32} />
                                    </div>
                                    <div className="subject-info">
                                        <h3>{s.name}</h3>
                                        <div className="subject-meta">
                                            <span>{s.totalMaterials} Materi</span>
                                            <span className="dot">•</span>
                                            <span>Update {s.lastUpdate.toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    {s.newCount > 0 && (
                                        <div className="new-badge">{s.newCount} BARU</div>
                                    )}
                                    <div className="subject-arrow">
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* Detailed Subject Structure View */
                <div className="subject-detail-view">
                    <button className="back-btn" onClick={() => setSelectedSubject(null)}>
                        <ArrowLeft size={18} />
                        <span>Kembali ke Daftar Mata Pelajaran</span>
                    </button>

                    <div className="detail-header">
                        <h1>{selectedSubject}</h1>
                        <p>Struktur materi pelajaran dan bimbingan guru</p>
                    </div>

                    {/* Task Submission Section */}
                    {materials.find(m => m.namaMapel === selectedSubject) && (
                        <div className="task-upload-section animate-fade-in">
                            <div className="section-gradient-bg"></div>
                            <div className="upload-content">
                                <div className="upload-info">
                                    <div className="upload-icon-wrapper">
                                        <Upload className="upload-icon" size={18} />
                                    </div>
                                    <div className="upload-text">
                                        <h3>Pengumpulan Tugas & Resume</h3>
                                        <p>File akan tersimpan di BaknusDrive Anda dan otomatis dibagikan ke guru mata pelajaran.</p>
                                    </div>
                                </div>
                                <div className="upload-controls" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 1.5fr auto', gap: '15px', alignItems: 'center' }}>
                                    <div className="bab-selector-wrapper">
                                        <select
                                            className="bab-dropdown-pro"
                                            value={selectedBabId}
                                            onChange={(e) => setSelectedBabId(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                borderRadius: '16px',
                                                border: '2px solid #e2e8f0',
                                                background: 'white',
                                                fontSize: '0.85rem',
                                                fontWeight: '800',
                                                color: '#1e293b',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="">-- Pilih Bab (Opsional) --</option>
                                            {babs.filter(b => materials.some(m => m.namaMapel === selectedSubject && m.babId === b.id))
                                                .sort((a, b) => a.urutan - b.urutan)
                                                .map(b => (
                                                    <option
                                                        key={b.id}
                                                        value={b.id}
                                                        disabled={b.isDeadlineActive && new Date(b.deadlineTugas) < new Date()}
                                                    >
                                                        {b.namaBab} {b.isDeadlineActive && new Date(b.deadlineTugas) < new Date() ? ' (Deadline Lewat)' : ''}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <input
                                        type="file"
                                        id="task-file-input"
                                        className="hidden"
                                        onChange={(e) => setSelectedFile(e.target.files[0])}
                                    />
                                    <label htmlFor="task-file-input" className={`file-label ${selectedFile ? 'file-selected' : ''}`}>
                                        <div className="file-label-content">
                                            {selectedFile ? (
                                                <>
                                                    <div className="check-icon-bg">
                                                        <CheckCircle size={12} />
                                                    </div>
                                                    <div className="file-info-compact">
                                                        <span className="file-name-text">{selectedFile.name}</span>
                                                        <span className="file-ready-text">File siap dikirim</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="upload-placeholder-icon">
                                                        <Upload size={15} />
                                                    </div>
                                                    <div className="file-info-compact">
                                                        <span className="placeholder-text">Klik untuk pilih file</span>
                                                        <span className="format-text">PDF, DOCX, ZIP (Maks 10MB)</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                    <button
                                        className={`upload-submit-btn ${!selectedFile || isUploading ? 'disabled' : ''}`}
                                        disabled={!selectedFile || isUploading}
                                        onClick={() => {
                                            const mat = materials.find(m => m.namaMapel === selectedSubject);
                                            handleUploadTask(mat?.emailGuru || '', selectedSubject);
                                        }}
                                    >
                                        {isUploading ? (
                                            <div className="btn-loading">
                                                <Loader2 className="animate-spin" size={15} />
                                                <span>Mengirim...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Send size={15} />
                                                <span>Kirim Tugas</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submission History Sub-section */}
                    {mySubmissions.filter(s => {
                        const match = s.subjectName?.trim().toLowerCase() === selectedSubject?.trim().toLowerCase();
                        if (!match && s.subjectName) {
                            console.log(`Mismatch: '${s.subjectName}' vs '${selectedSubject}'`);
                        }
                        return match;
                    }).length > 0 && (
                            <div className="submission-history-section animate-fade-in">
                                <div className="history-header">
                                    <div className="header-label">
                                        <History size={18} />
                                        <span>Track Your Progress</span>
                                    </div>
                                </div>
                                <div className="submissions-compact-grid">
                                    {mySubmissions.filter(s =>
                                        s.subjectName?.trim().toLowerCase() === selectedSubject?.trim().toLowerCase()
                                    ).map((sub, idx) => (
                                        <div key={idx} className="submission-row">
                                            <div className="sub-icon">
                                                <div className="status-dot-absolute pulse-green"></div>
                                                <FileText size={16} />
                                            </div>
                                            <div className="sub-details">
                                                <span className="sub-filename" title={sub.fileName}>{sub.fileName}</span>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span className="sub-time" style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: '800' }}>
                                                        {sub.babName || 'Tugas Umum'}
                                                    </span>
                                                    <span className="sub-time">
                                                        {new Date(sub.submittedAt).toLocaleString('id-ID', {
                                                            day: '2-digit',
                                                            month: 'long',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })} WIB
                                                    </span>
                                                </div>
                                            </div>
                                            <a href={sub.driveLink} target="_blank" rel="noopener noreferrer" className="sub-link">
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    <div className="babs-list">
                        {/* Chapters for this subject */}
                        {babs.filter(b => materials.some(m => m.namaMapel === selectedSubject && m.babId === b.id))
                            .sort((a, b) => a.urutan - b.urutan)
                            .map((bab) => (
                                <div key={bab.id} className="bab-container">
                                    <div className="bab-header">
                                        <div className="bab-header-top">
                                            <h2>{bab.namaBab}</h2>
                                            {bab.isDeadlineActive && bab.deadlineTugas && (
                                                <div className={`deadline-tag ${new Date(bab.deadlineTugas) < new Date() ? 'expired' : ''}`} style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: '800',
                                                    padding: '4px 12px',
                                                    borderRadius: '50px',
                                                    background: new Date(bab.deadlineTugas) < new Date() ? '#fef2f2' : '#f5f3ff',
                                                    color: new Date(bab.deadlineTugas) < new Date() ? '#ef4444' : '#6366f1',
                                                    border: `1px solid ${new Date(bab.deadlineTugas) < new Date() ? '#fee2e2' : '#e0e7ff'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <Clock size={12} />
                                                    <span>Batas: {new Date(bab.deadlineTugas).toLocaleString('id-ID', {
                                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    })}</span>
                                                    {new Date(bab.deadlineTugas) < new Date() && <span style={{ textTransform: 'uppercase' }}>• Berakhir</span>}
                                                </div>
                                            )}
                                            {attendedBabs[bab.id] ? (
                                                <div className="attendance-badge success">
                                                    <CheckCircle size={14} />
                                                    <span>Sudah Hadir</span>
                                                </div>
                                            ) : (
                                                <button
                                                    className="attendance-btn"
                                                    onClick={() => handleMarkAttendance(bab.id)}
                                                >
                                                    <Clock size={14} />
                                                    Presensi Sekarang
                                                </button>
                                            )}
                                        </div>
                                        {bab.prolog && <p className="prolog-text">{bab.prolog}</p>}
                                    </div>
                                    <div className="materi-items">
                                        {materials.filter(m => m.namaMapel === selectedSubject && m.babId === bab.id).map(m => (
                                            <div
                                                key={m.id}
                                                className={`materi-row ${!m.isViewed ? 'is-new' : ''}`}
                                                onClick={() => handleViewMateri(m)}
                                            >
                                                <div className="materi-icon">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="materi-name">
                                                    <h4>{m.namaMateri}</h4>
                                                    <span>{m.fileName}</span>
                                                </div>
                                                <div className="materi-status">
                                                    {!m.isViewed && <span className="badge-new">BARU</span>}
                                                    {m.isViewed ? <CheckCircle size={18} className="viewed-icon" /> : <ExternalLink size={18} />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Q&A / Interaction Section */}
                                    <div className="bab-footer">
                                        <div className="discussion-area">
                                            <div className="discussion-header" onClick={() => setAskingBabId(askingBabId === bab.id ? null : bab.id)}>
                                                <MessageSquare size={16} />
                                                <span>Diskusi & Pertanyaan ({questions[bab.id]?.length || 0})</span>
                                                {questions[bab.id]?.some(q => q.jawaban && !q.isRead) && <span className="new-reply-dot"></span>}
                                            </div>

                                            {(askingBabId === bab.id || (questions[bab.id] && questions[bab.id].length > 0)) && (
                                                <div className="discussion-content">
                                                    {questions[bab.id]?.map((q) => (
                                                        <div key={q.id} className="question-bubble">
                                                            <div className="q-user">
                                                                <strong>Anda</strong>
                                                                <span>{new Date(q.askedAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="q-text">{q.pertanyaan}</p>
                                                            {q.jawaban && (
                                                                <div className="a-bubble">
                                                                    <div className="a-user">
                                                                        <strong>Guru</strong>
                                                                        <span>Dijawab</span>
                                                                    </div>
                                                                    <p className="a-text">{q.jawaban}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}

                                                    <div className="ask-box">
                                                        <textarea
                                                            placeholder="Tanyakan sesuatu tentang bab ini..."
                                                            value={newQuestion}
                                                            onChange={(e) => setNewQuestion(e.target.value)}
                                                        />
                                                        <button onClick={() => handleAskQuestion(bab.id)}>
                                                            <Send size={14} /> Kirim
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        }

                        {/* Materials without Chapter */}
                        {materials.filter(m => m.namaMapel === selectedSubject && !m.babId).length > 0 && (
                            <div className="bab-container others">
                                <div className="bab-header">
                                    <h2>Materi Umum / Lainnya</h2>
                                </div>
                                <div className="materi-items">
                                    {materials.filter(m => m.namaMapel === selectedSubject && !m.babId).map(m => (
                                        <div
                                            key={m.id}
                                            className={`materi-row ${!m.isViewed ? 'is-new' : ''}`}
                                            onClick={() => handleViewMateri(m)}
                                        >
                                            <div className="materi-icon">
                                                <FileText size={20} />
                                            </div>
                                            <div className="materi-name">
                                                <h4>{m.namaMateri}</h4>
                                                <span>{m.fileName}</span>
                                            </div>
                                            <div className="materi-status">
                                                {!m.isViewed && <span className="badge-new">BARU</span>}
                                                {m.isViewed ? <CheckCircle size={18} className="viewed-icon" /> : <ExternalLink size={18} />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(babs.filter(b => materials.some(m => m.namaMapel === selectedSubject && m.babId === b.id)).length === 0 &&
                            materials.filter(m => m.namaMapel === selectedSubject && !m.babId).length === 0) && (
                                <div className="empty-subject">
                                    <p>Belum ada materi yang diunggah untuk mata pelajaran ini.</p>
                                </div>
                            )}
                    </div>
                </div>
            )}

            {/* Aether-Premium Preview Modal */}
            {previewFile && (
                <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
                    <div className="preview-container animate-aether-zoom" onClick={e => e.stopPropagation()}>
                        <div className="preview-header">
                            <div className="preview-title">
                                <div className="p-icon-bg">
                                    <FileText size={16} />
                                </div>
                                <div className="p-text">
                                    <h4>{previewFile.namaMateri}</h4>
                                    <span>{previewFile.fileName}</span>
                                </div>
                            </div>
                            <div className="preview-actions">
                                <a
                                    href={`/api/materi/view/${previewFile.extractedId}?download=true`}
                                    download={previewFile.fileName}
                                    className="p-btn download"
                                    title="Download File"
                                >
                                    <Download size={18} />
                                </a>
                                <button className="p-btn close" onClick={() => setPreviewFile(null)} title="Close">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="preview-content">
                            {/\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.fileName) ? (
                                <div className="image-preview">
                                    <img src={previewUrl} alt={previewFile.fileName} />
                                </div>
                            ) : (
                                <iframe
                                    src={previewUrl}
                                    title={previewFile.fileName}
                                    className="preview-iframe"
                                    frameBorder="0"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .student-materi { padding: 10px; }
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                }
                .header-content h1 { font-size: 2.2rem; font-weight: 800; color: #1e293b; margin: 0; }
                .header-content p { color: #64748b; font-size: 1.1rem; margin-top: 4px; }

                .notification-badge {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #fef2f2;
                    color: #ef4444;
                    padding: 12px 20px;
                    border-radius: 50px;
                    font-weight: 700;
                    border: 1px solid #fee2e2;
                }

                .search-section { margin-bottom: 40px; }
                .search-bar {
                    position: relative;
                    max-width: 600px;
                }
                .search-icon {
                    position: absolute;
                    left: 20px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                }
                .search-bar input {
                    width: 100%;
                    padding: 16px 20px 16px 55px;
                    border-radius: 20px;
                    border: 2px solid #f1f5f9;
                    background: white;
                    font-size: 1rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    transition: all 0.3s;
                }
                .search-bar input:focus {
                    border-color: #6366f1;
                    box-shadow: 0 10px 15px -3px rgba(99,102,241,0.1);
                    outline: none;
                }

                .subjects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 25px;
                }

                .subject-card {
                    background: white;
                    border-radius: 28px;
                    padding: 30px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .subject-card:hover {
                    transform: translateY(-8px) scale(1.02);
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                    border-color: #6366f140;
                }
                .subject-card.has-new {
                    border-left: 8px solid #6366f1;
                }
                .subject-card::before {
                    content: ''; position: absolute; inset: 0; border-radius: 28px;
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), transparent);
                    opacity: 0; transition: opacity 0.3s;
                }
                .subject-card:hover::before { opacity: 1; }

                .subject-icon {
                    width: 80px;
                    height: 80px;
                    background: #f8fafc;
                    border-radius: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6366f1;
                }
                .subject-info h3 { font-size: 1.4rem; font-weight: 800; color: #1e293b; margin: 0 0 8px 0; }
                .subject-meta { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.9rem; font-weight: 600; }
                .dot { color: #cbd5e1; }
                .new-badge {
                    position: absolute;
                    top: 20px; right: 20px;
                    background: #6366f1;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 50px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                }
                .subject-arrow { margin-left: auto; color: #cbd5e1; }

                /* Subject Detail View Styles */
                .subject-detail-view {
                    animation: fadeIn 0.4s ease;
                }
                .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 18px;
                    background: white;
                    color: #64748b;
                    border-radius: 14px;
                    border: 1px solid #e2e8f0;
                    font-weight: 600;
                    margin-bottom: 30px;
                    transition: all 0.2s;
                }
                .back-btn:hover { background: #f8fafc; color: #1e293b; }
                
                .detail-header { margin-bottom: 25px; }
                .detail-header h1 { font-size: 1.8rem; font-weight: 950; color: #0f172a; margin-bottom: 5px; letter-spacing: -0.04em; }
                .detail-header p { font-size: 0.95rem; color: #64748b; font-weight: 500; }

                .bab-container {
                    background: white;
                    border-radius: 24px;
                    padding: 25px;
                    margin-bottom: 30px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.03);
                }
                .bab-header { margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
                .bab-header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
                .bab-header h2 { font-size: 1.25rem; font-weight: 850; color: #1e293b; margin: 0; }
                
                .attendance-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    border-radius: 50px;
                    font-size: 0.8rem;
                    font-weight: 700;
                }
                .attendance-badge.success { background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; }
                
                .attendance-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: #6366f1;
                    color: white;
                    border-radius: 12px;
                    border: none;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .attendance-btn:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 8px 16px rgba(99, 102, 241, 0.4); }

                .prolog-text { font-size: 0.9rem; color: #64748b; line-height: 1.6; }

                .materi-items { display: flex; flex-direction: column; gap: 10px; }
                .materi-row {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 14px 20px;
                    background: #f8fafc;
                    border-radius: 16px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .materi-row:hover {
                    background: white;
                    border-color: #6366f140;
                    transform: translateX(8px);
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .materi-row.is-new { border-left: 5px solid #6366f1; }
                .materi-icon { color: #6366f1; }
                .materi-name h4 { margin: 0; font-size: 0.95rem; font-weight: 750; color: #1e293b; }
                .materi-name span { font-size: 0.8rem; color: #94a3b8; }
                .materi-status { margin-left: auto; display: flex; align-items: center; gap: 12px; color: #cbd5e1; }
                .badge-new { background: #fee2e2; color: #ef4444; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; }
                .viewed-icon { color: #10b981; }

                .empty-subject { text-align: center; padding: 40px; color: #94a3b8; font-weight: 600; }

                [data-theme="dark"] .subject-card,
                [data-theme="dark"] .bab-container,
                [data-theme="dark"] .back-btn {
                    background: #1e293b;
                    border-color: #334155;
                }
                [data-theme="dark"] .subject-info h3,
                [data-theme="dark"] .detail-header h1,
                [data-theme="dark"] .bab-header h2,
                [data-theme="dark"] .materi-name h4 {
                    color: #f8fafc;
                }
                [data-theme="dark"] .materi-row { background: #0f172a; border-color: #334155; }
                [data-theme="dark"] .materi-row:hover { background: #1e293b; }
                [data-theme="dark"] .subject-icon { background: #0f172a; }
                [data-theme="dark"] .back-btn { color: #cbd5e1; }
                [data-theme="dark"] .bab-header { border-bottom-color: #334155; }
                [data-theme="dark"] .prolog-text { color: #94a3b8; }

                /* Discussion Styles */
                .bab-footer { margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                .discussion-header { display: flex; align-items: center; gap: 8px; color: #6366f1; font-weight: 700; cursor: pointer; font-size: 0.95rem; }
                .discussion-header:hover { color: #4f46e5; }
                .new-reply-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; margin-left: 4px; }
                
                .discussion-content { margin-top: 20px; display: flex; flex-direction: column; gap: 15px; animation: slideDown 0.3s ease; }
                .question-bubble { background: #f8fafc; border-radius: 18px; padding: 15px; border: 1px solid #e2e8f0; }
                .q-user { display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; margin-bottom: 6px; }
                .q-text { color: #1e293b; font-weight: 500; font-size: 0.95rem; }
                
                .a-bubble { margin-top: 12px; background: white; border-radius: 14px; padding: 12px; border-left: 4px solid #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .a-user { display: flex; justify-content: space-between; font-size: 0.8rem; color: #10b981; font-weight: 700; margin-bottom: 4px; }
                .a-text { color: #334155; font-size: 0.9rem; }

                .ask-box { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
                .ask-box textarea { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; min-height: 80px; font-family: inherit; font-size: 0.9rem; }
                .ask-box button { align-self: flex-end; display: flex; align-items: center; gap: 8px; background: #6366f1; color: white; padding: 8px 18px; border-radius: 10px; font-weight: 600; border: none; cursor: pointer; transition: 0.2s; }
                .ask-box button:hover { background: #4f46e5; transform: scale(1.05); }

                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

                [data-theme="dark"] .bab-footer { border-top-color: #334155; }
                [data-theme="dark"] .discussion-header { color: #818cf8; }
                [data-theme="dark"] .question-bubble { 
                    background: linear-gradient(135deg, #0f172a 0%, #171e2e 100%); 
                    border-color: #334155; 
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
                }
                [data-theme="dark"] .q-text { color: #f1f5f9; }
                [data-theme="dark"] .q-user { color: #64748b; }
                [data-theme="dark"] .a-bubble { 
                    background: #1e293b; 
                    border-color: #064e3b; 
                    border-left-color: #10b981;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
                }
                [data-theme="dark"] .a-text { color: #cbd5e1; }
                [data-theme="dark"] .ask-box textarea { 
                    background: #0f172a; 
                    color: white; 
                    border-color: #334155; 
                }
                [data-theme="dark"] .bab-header h2 { color: #f8fafc; }
                [data-theme="dark"] .attendance-badge.success { background: #064e3b33; color: #4ade80; border-color: #065f46; }
                [data-theme="dark"] .attendance-btn { background: #4f46e5; }

                /* Original Animations and Styles below...

                /* Aether-Premium UI - The New Standard */
                /* Aether-Premium UI - Ultra Compact */
                .task-upload-section {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(40px) saturate(220%);
                    -webkit-backdrop-filter: blur(40px) saturate(220%);
                    border-radius: 24px;
                    padding: 25px;
                    margin-bottom: 30px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    position: relative;
                    overflow: hidden;
                    box-shadow: 
                        0 20px 60px -15px rgba(0, 0, 0, 0.08),
                        0 10px 30px -20px rgba(0, 0, 0, 0.08),
                        inset 0 0 0 1px rgba(255, 255, 255, 0.15);
                    animation: aetherEntrance 0.7s cubic-bezier(0.19, 1, 0.22, 1);
                }
                @keyframes aetherEntrance { 
                    from { opacity: 0; transform: translateY(20px) scale(0.99); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                
                .section-gradient-bg {
                    position: absolute;
                    top: -50%; left: -50%; width: 220%; height: 220%;
                    background: radial-gradient(circle at center, rgba(99, 102, 241, 0.2) 0%, transparent 40%),
                                radial-gradient(circle at 80% 20%, rgba(167, 139, 250, 0.1) 0%, transparent 40%),
                                radial-gradient(circle at 20% 80%, rgba(244, 114, 182, 0.1) 0%, transparent 40%);
                    animation: auroraMotion 20s linear infinite;
                    pointer-events: none;
                }
                @keyframes auroraMotion { 
                    0% { transform: translate(0, 0) rotate(0deg); }
                    50% { transform: translate(-2%, -2%) rotate(2deg); }
                    100% { transform: translate(0, 0) rotate(360deg); } 
                }

                .task-upload-section::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 6px;
                    background: linear-gradient(90deg, #6366f1, #a78bfa, #f472b6, #6366f1);
                    background-size: 300% 100%;
                    animation: glowBar 5s linear infinite;
                }
                @keyframes glowBar { 0% { background-position: 100% 0%; } 100% { background-position: 0% 0%; } }

                .upload-content { display: flex; flex-direction: column; gap: 20px; z-index: 20; position: relative; }
                .upload-info { display: flex; align-items: center; gap: 18px; }
                .upload-icon-wrapper {
                    width: 52px; height: 52px;
                    background: linear-gradient(135deg, #6366f1 0%, #4438ca 100%);
                    border-radius: 16px;
                    display: flex; align-items: center; justify-content: center;
                    color: white;
                    box-shadow: 0 10px 25px -10px rgba(99, 102, 241, 0.4);
                    transform: rotate(-3deg);
                    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
                }
                .upload-icon-wrapper:hover { transform: rotate(0deg) scale(1.1); }
                
                .upload-text h3 { margin: 0; font-size: 1.4rem; font-weight: 1000; color: #0f172a; letter-spacing: -0.04em; line-height: 1.1; }
                .upload-text p { margin: 5px 0 0 0; font-size: 0.9rem; color: #475569; font-weight: 500; line-height: 1.4; max-width: 450px; }

                .upload-controls { 
                    display: grid; 
                    grid-template-columns: 1fr auto;
                    gap: 15px; 
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.45);
                    backdrop-filter: blur(15px);
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);
                }
                .file-label {
                    background: white;
                    padding: 0 18px;
                    min-height: 52px;
                    border: 2px dashed #e2e8f0;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                    display: flex; align-items: center; justify-content: flex-start;
                }
                .file-label-content { display: flex; align-items: center; gap: 15px; flex: 1; }
                .upload-placeholder-icon { 
                    width: 34px; height: 34px; 
                    background: #f8fafc; 
                    border-radius: 10px; 
                    display: flex; align-items: center; justify-content: center; 
                    color: #94a3b8;
                    transition: all 0.3s;
                }
                .file-label:hover .upload-placeholder-icon { background: #eef2ff; color: #6366f1; transform: translateY(-2px); }
                
                .placeholder-text { font-size: 0.95rem; font-weight: 1000; color: #1e293b; letter-spacing: -0.02em; }
                .format-text { font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-top: 1px; }

                .file-selected {
                    background: linear-gradient(to right, #fafff8, #ffffff);
                    border-color: #10b981;
                    border-style: solid;
                    box-shadow: 0 10px 30px -10px rgba(16, 185, 129, 0.15);
                }
                .file-ready-text { font-size: 0.75rem; color: #059669; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                .check-icon-bg { 
                    width: 32px; height: 32px; 
                    background: #10b981; 
                    color: white; 
                    border-radius: 8px; 
                    display: flex; align-items: center; justify-content: center; 
                    box-shadow: 0 5px 10px rgba(16, 185, 129, 0.25);
                    animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes bounceIn { 0% { transform: scale(0.5); } 80% { transform: scale(1.1); } 100% { transform: scale(1); } }

                .upload-submit-btn {
                    padding: 0 24px;
                    min-height: 52px;
                    background: #0f172a;
                    color: white;
                    border-radius: 16px;
                    border: none;
                    font-size: 1rem;
                    font-weight: 1000;
                    cursor: pointer;
                    transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                    display: flex; align-items: center; justify-content: center; gap: 12px;
                }
                .upload-submit-btn:not(.disabled) {
                    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
                    box-shadow: 0 15px 35px -10px rgba(99, 102, 241, 0.4);
                }
                .upload-submit-btn:hover:not(.disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px -10px rgba(99, 102, 241, 0.45); }

                /* Aether Submission History - Compact */
                .submission-history-section {
                    background: rgba(255, 255, 255, 0.4);
                    backdrop-filter: blur(25px);
                    border-radius: 24px;
                    padding: 28px;
                    margin-bottom: 40px;
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 0 12px 30px -15px rgba(0,0,0,0.06);
                }
                .history-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
                .header-label { 
                    font-size: 1.3rem; font-weight: 1000; color: #0f172a; letter-spacing: -0.04em; 
                    background: linear-gradient(135deg, #0f172a 0%, #475569 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .submissions-compact-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 15px;
                }
                .submission-row {
                    background: white;
                    border-radius: 18px;
                    padding: 15px;
                    display: flex; align-items: center; gap: 14px;
                    border: 1px solid #f8fafc;
                    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
                    position: relative;
                }
                .submission-row:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 20px 40px -15px rgba(99, 102, 241, 0.15);
                    border-color: rgba(99, 102, 241, 0.15);
                }
                .sub-icon { 
                    width: 44px; height: 44px; 
                    background: #f5f3ff; color: #6366f1; 
                    border-radius: 10px; 
                    display: flex; align-items: center; justify-content: center;
                }
                .sub-filename { font-size: 1rem; font-weight: 1000; color: #1e293b; margin-bottom: 2px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .sub-time { font-size: 0.8rem; color: #94a3b8; font-weight: 750; }
                
                .sub-link {
                    width: 40px; height: 40px; 
                    background: #f1f5f9; color: #475569; 
                    border-radius: 10px; 
                    display: flex; align-items: center; justify-content: center; 
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                    border: 1px solid #e2e8f0;
                }
                .sub-link:hover { 
                    background: #6366f1; color: white; border-color: #6366f1; 
                    transform: rotate(90deg) scale(1.1);
                    box-shadow: 0 8px 15px rgba(99, 102, 241, 0.25);
                }

                [data-theme="dark"] .task-upload-section { background: rgba(15, 23, 42, 0.85); border-color: rgba(99, 102, 241, 0.4); }
                [data-theme="dark"] .upload-text h3 { color: #f8fafc; }
                [data-theme="dark"] .upload-text p { color: #cbd5e1; }
                [data-theme="dark"] .upload-controls { background: rgba(31, 41, 55, 0.8); }
                [data-theme="dark"] .file-label { background: #0f172a; border-color: #1e293b; }
                [data-theme="dark"] .placeholder-text { color: #f1f5f9; }
                [data-theme="dark"] .submission-history-section { background: rgba(31, 41, 55, 0.6); }
                [data-theme="dark"] .submission-row { background: #111827; border-color: #1f2937; }
                [data-theme="dark"] .sub-filename { color: #f9fafb; }
                [data-theme="dark"] .header-label { background: linear-gradient(135deg, #f9fafb 0%, #9ca3af 100%); -webkit-background-clip: text; }
                [data-theme="dark"] .sub-icon { background: #0f172a; color: #818cf8; }
                [data-theme="dark"] .sub-link { background: #0f172a; border-color: #1f2937; color: #9ca3af; }

                .hidden { display: none; }
                .animate-fade-in { animation: fadeIn 1.5s cubic-bezier(0.19, 1, 0.22, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

                .status-dot-absolute {
                    position: absolute;
                    top: -5px; right: -5px;
                    width: 14px; height: 14px;
                    border-radius: 50%;
                    border: 3px solid white;
                    z-index: 10;
                }
                .pulse-green { 
                    background: #10b981; 
                    box-shadow: 0 0 10px #10b981;
                    animation: statusPulse 2s infinite; 
                }
                @keyframes statusPulse { 
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.3); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                [data-theme="dark"] .status-dot-absolute { border-color: #111827; }

                .empty-state {
                    text-align: center;
                    padding: 80px 40px;
                    background: rgba(248, 250, 252, 0.6);
                    border-radius: 32px;
                    border: 3px dashed #e2e8f0;
                    color: #94a3b8;
                    font-size: 1.2rem;
                    font-weight: 1000;
                    letter-spacing: -0.02em;
                }
                [data-theme="dark"] .empty-state { background: rgba(17, 24, 39, 0.6); border-color: #1f2937; }

                /* Aether Preview Modal Styles */
                .preview-overlay {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(20px) saturate(180%);
                    -webkit-backdrop-filter: blur(20px) saturate(180%);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 10000;
                    padding: 40px;
                    animation: aetherFadeIn 0.3s ease;
                }
                @keyframes aetherFadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .preview-container {
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(40px);
                    width: 100%; height: 100%;
                    max-width: 1400px; max-height: 900px;
                    border-radius: 32px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    box-shadow: 0 50px 100px -20px rgba(0,0,0,0.3);
                    display: flex; flex-direction: column;
                    overflow: hidden;
                    position: relative;
                }
                .animate-aether-zoom { animation: aetherZoom 0.5s cubic-bezier(0.19, 1, 0.22, 1); }
                @keyframes aetherZoom { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

                .preview-header {
                    padding: 20px 30px;
                    background: rgba(255, 255, 255, 0.8);
                    border-bottom: 1px solid rgba(226, 232, 240, 0.5);
                    display: flex; align-items: center; justify-content: space-between;
                    backdrop-filter: blur(10px);
                    z-index: 20;
                }
                .preview-title { display: flex; align-items: center; gap: 16px; }
                .p-icon-bg { 
                    width: 40px; height: 40px; background: #6366f1; color: white; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                }
                .p-text h4 { margin: 0; font-size: 1.1rem; font-weight: 850; color: #0f172a; }
                .p-text span { font-size: 0.85rem; color: #64748b; font-weight: 500; }

                .preview-actions { display: flex; align-items: center; gap: 12px; }
                .p-btn {
                    width: 44px; height: 44px; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    border: 1px solid #e2e8f0; background: white; color: #475569;
                    cursor: pointer; transition: all 0.3s;
                }
                .p-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                .p-btn.close:hover { background: #fee2e2; color: #ef4444; border-color: #fee2e2; }
                .p-btn.download:hover { background: #f0fdf4; color: #10b981; border-color: #f0fdf4; }

                .preview-content { flex: 1; background: #f8fafc; position: relative; overflow: hidden; }
                .preview-iframe { width: 100%; height: 100%; border: none; }
                
                .image-preview {
                    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                    padding: 40px; overflow: auto;
                }
                .image-preview img {
                    max-width: 100%; max-height: 100%; object-fit: contain;
                    border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,0.15);
                    animation: imgEntrance 0.8s cubic-bezier(0.19, 1, 0.22, 1);
                }
                @keyframes imgEntrance { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

                [data-theme="dark"] .preview-container { background: rgba(15, 23, 42, 0.95); border-color: rgba(99, 102, 241, 0.2); }
                [data-theme="dark"] .preview-header { background: rgba(30, 41, 59, 0.8); border-bottom-color: rgba(99, 102, 241, 0.2); }
                [data-theme="dark"] .p-text h4 { color: #f1f5f9; }
                [data-theme="dark"] .p-text span { color: #94a3b8; }
                [data-theme="dark"] .p-btn { background: #0f172a; border-color: #1e293b; color: #cbd5e1; }
                [data-theme="dark"] .preview-content { background: #020617; }
                
                @media (max-width: 768px) {
                    .preview-overlay { padding: 0; }
                    .preview-container { border-radius: 0; max-height: 100vh; }
                }

            `}
            </style>
        </div>
    );
};

export default StudentMaterials;
