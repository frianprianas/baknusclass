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
    ChevronRight,
    ArrowLeft,
    MessageSquare,
    Send,
    MessageCircle
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
    const [askingBabId, setAskingBabId] = useState(null);

    // Attendance State
    const [attendedBabs, setAttendedBabs] = useState({}); // { babId: boolean }

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchMaterials();
    }, []);

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

        // Open the link (if it exists) or handle as needed
        if (materi.driveLink) {
            window.open(materi.driveLink, '_blank');
        } else {
            alert('Tautan file tidak tersedia.');
        }
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

                    <div className="babs-list">
                        {/* Chapters for this subject */}
                        {babs.filter(b => materials.some(m => m.namaMapel === selectedSubject && m.babId === b.id))
                            .sort((a, b) => a.urutan - b.urutan)
                            .map((bab) => (
                                <div key={bab.id} className="bab-container">
                                    <div className="bab-header">
                                        <div className="bab-header-top">
                                            <h2>{bab.namaBab}</h2>
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
                
                .detail-header { margin-bottom: 40px; }
                .detail-header h1 { font-size: 2.5rem; font-weight: 900; color: #0f172a; margin-bottom: 8px; }
                .detail-header p { font-size: 1.1rem; color: #64748b; }

                .bab-container {
                    background: white;
                    border-radius: 32px;
                    padding: 35px;
                    margin-bottom: 40px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.03);
                }
                .bab-header { margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; }
                .bab-header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
                .bab-header h2 { font-size: 1.5rem; font-weight: 800; color: #1e293b; margin: 0; }
                
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

                .prolog-text { font-size: 1rem; color: #64748b; line-height: 1.6; }

                .materi-items { display: flex; flex-direction: column; gap: 12px; }
                .materi-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 18px 24px;
                    background: #f8fafc;
                    border-radius: 18px;
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
                .materi-name h4 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e293b; }
                .materi-name span { font-size: 0.85rem; color: #94a3b8; }
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

                .empty-state {
                    text-align: center;
                    padding: 80px 20px;
                    background: #f8fafc;
                    border-radius: 32px;
                    border: 2px dashed #e2e8f0;
                    color: #94a3b8;
                }
            `}
            </style>
        </div>
    );
};

export default StudentMaterials;
