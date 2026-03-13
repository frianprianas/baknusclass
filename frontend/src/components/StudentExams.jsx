import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    BookOpen,
    Clock,
    Play,
    CheckCircle,
    AlertCircle,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Send,
    Edit3,
    Shield,
    LayoutGrid,
    X,
    User,
    Check
} from 'lucide-react';

const StudentExams = () => {
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(false);

    // Exam Taking State
    const [currentExam, setCurrentExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({}); // { soalId: text }
    const [raguState, setRaguState] = useState({}); // { soalId: boolean }
    const [currentIndex, setCurrentIndex] = useState(0);
    const [tokenInput, setTokenInput] = useState('');
    const [showTokenOverlay, setShowTokenOverlay] = useState(null); // Exam object
    const [timer, setTimer] = useState(0); // seconds remaining
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    // CBT Design State
    const [showNav, setShowNav] = useState(false);
    const [fontSizeScale, setFontSizeScale] = useState(1);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    let userEmail = user.email;
    if (!userEmail && token) {
        try { userEmail = JSON.parse(atob(token.split('.')[1])).sub; } catch (e) { }
    }

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (currentExam || showTokenOverlay || showFinishConfirm) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [currentExam, showTokenOverlay, showFinishConfirm]);

    const fetchEvents = async () => {
        try {
            const resp = await axios.get('/api/exam/event', { headers });
            setEvents(resp.data);
            if (resp.data.length > 0) {
                const active = resp.data.find(e => e.statusAktif) || resp.data[0];
                handleSelectEvent(active);
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    };

    const handleSelectEvent = async (event) => {
        setSelectedEvent(event);
        setLoading(true);
        try {
            const resp = await axios.get(`/api/exam/ujian-mapel/siswa?eventId=${event.id}`, { headers });
            setExams(resp.data);
        } catch (err) {
            console.error('Error fetching student exams:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStartClick = (exam) => {
        setShowTokenOverlay(exam);
        setTokenInput('');
    };

    const handleVerifyToken = async () => {
        try {
            let deviceId = localStorage.getItem('deviceId');
            if (!deviceId) {
                deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now();
                localStorage.setItem('deviceId', deviceId);
            }

            const resp = await axios.post(`/api/exam/ujian-mapel/${showTokenOverlay.id}/validate-token?token=${tokenInput}&deviceId=${deviceId}`, {}, { headers });
            if (resp.data === true) {
                startExam(showTokenOverlay);
                setShowTokenOverlay(null);
            } else {
                alert('Token Ujian Salah!');
            }
        } catch (err) {
            if (err.response && err.response.data && typeof err.response.data === 'string') {
                alert(err.response.data);
            } else {
                alert('Gagal verifikasi token. ' + (err.response?.data?.message || ''));
            }
        }
    };

    const startExam = async (exam) => {
        setLoading(true);
        try {
            const resp = await axios.get(`/api/exam/soal-essay/ujian/${exam.id}`, { headers });
            setQuestions(resp.data);
            setCurrentExam(exam);
            setCurrentIndex(0);
            setTimer(exam.durasi * 60);

            // Initialize empty answers
            const initialAnswers = {};
            resp.data.forEach(q => {
                initialAnswers[q.id] = '';
            });
            setAnswers(initialAnswers);

            // Fetch existing answers to resume progress
            const answersResp = await axios.get(`/api/exam/jawaban/siswa/${user.profileId}`, { headers });
            const existingAnswers = {};
            const existingRagu = {};
            answersResp.data.forEach(ans => {
                existingAnswers[ans.soalId] = ans.teksJawaban;
                existingRagu[ans.soalId] = ans.raguRagu;
            });

            setAnswers(prev => ({ ...prev, ...existingAnswers }));
            setRaguState(prev => ({ ...prev, ...existingRagu }));

            // Start keep-alive heartbeats
            const keepAliveInterval = setInterval(() => {
                axios.post(`/api/exam/ujian-mapel/${exam.id}/keep-alive?nisn=${user.username}&nama=${user.name}`, {}, { headers })
                    .catch(() => console.log('Keep-alive failed'));
            }, 30000);

            // Save interval to handle cleanup later if needed
            setCurrentExam(prev => ({ ...prev, keepAliveInterval }));

        } catch (err) {
            console.error('Failed to start exam:', err);
            if (err.response) {
                alert(`Gagal mengambil soal: ${err.response.data.message || err.response.statusText}`);
            } else {
                alert('Gagal mengambil soal! Pastikan server berjalan dan koneksi stabil.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Timer Logic
    useEffect(() => {
        let interval = null;
        if (currentExam && timer > 0) {
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else if (timer === 0 && currentExam) {
            confirmFinishExam(true); // force finish
        }
        return () => clearInterval(interval);
    }, [currentExam, timer]);

    const [isSaving, setIsSaving] = useState(false);

    const saveAnswer = async (soalId, text, isRagu = false) => {
        if (!text || !user.profileId) return;
        setIsSaving(true);
        try {
            const payload = {
                soalId,
                siswaId: user.profileId,
                teksJawaban: text,
                raguRagu: isRagu
            };
            await axios.post('/api/exam/jawaban/submit', payload, { headers });
        } catch (err) {
            console.error('Auto-save failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = () => {
        const qId = questions[currentIndex].id;
        saveAnswer(qId, answers[qId], raguState[qId]);
        setCurrentIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        const qId = questions[currentIndex].id;
        saveAnswer(qId, answers[qId], raguState[qId]);
        setCurrentIndex(prev => prev - 1);
    };

    const handleFinishExam = async () => {
        // Final save before confirmation opens
        const qId = questions[currentIndex]?.id;
        await saveAnswer(qId, answers[qId], raguState[qId]);
        setShowFinishConfirm(true);
    };

    const toggleRagu = () => {
        const qId = questions[currentIndex].id;
        const newRagu = !raguState[qId];
        setRaguState(prev => ({ ...prev, [qId]: newRagu }));
        saveAnswer(qId, answers[qId], newRagu);
    };

    const confirmFinishExam = async (forced = false) => {
        setLoading(true);
        try {
            await axios.post(`/api/exam/ujian-mapel/${currentExam.id}/finish`, {}, { headers });

            // Save finished state locally as backup
            const finishedExams = JSON.parse(localStorage.getItem('finishedExams') || '{}');
            finishedExams[`${user.profileId}_${currentExam.id}`] = true;
            localStorage.setItem('finishedExams', JSON.stringify(finishedExams));

            setShowFinishConfirm(false);
            if (!forced) alert('Ujian Selesai! Jawaban Anda telah tersimpan dan akan segera dinilai oleh sistem & Guru.');
            else alert('Waktu habis! Ujian telah diselesaikan otomatis.');

            if (currentExam.keepAliveInterval) clearInterval(currentExam.keepAliveInterval);
            setCurrentExam(null);
            setQuestions([]);
            fetchEvents(); // Refresh data to get updated isFinished states
        } catch (err) {
            alert('Gagal menyelesaikan ujian ke server. Hubungi pengawas!');
            setLoading(false);
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    };

    if (currentExam) {
        // EXAM TAKING VIEW
        const q = questions[currentIndex];

        let fontClass = '';
        if (fontSizeScale === 2) fontClass = 'text-lg';
        if (fontSizeScale === 3) fontClass = 'text-xl';

        return (
            <div className="cbt-layout">
                <header className="cbt-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="cbt-logo-circle">
                            <BookOpen size={24} color="#1e88e5" />
                        </div>
                        <div className="cbt-title">
                            <strong>IT Support Baknus 666</strong>
                            <span>Application</span>
                        </div>
                    </div>
                    <div className="cbt-userinfo">
                        <User size={18} />
                        <span>{user.name}</span>
                    </div>
                </header>

                <div className="cbt-body">
                    <aside className="cbt-sidebar">
                        <div className="sidebar-title">
                            <LayoutGrid size={18} />
                            <span>Nomor Soal</span>
                        </div>
                        <div className="sidebar-grid">
                            {questions.map((sq, idx) => {
                                const isFilled = !!answers[sq.id];
                                const isRagu = !!raguState[sq.id];
                                let statusClass = '';
                                if (isRagu) statusClass = 'ragu';
                                else if (isFilled) statusClass = 'filled';

                                return (
                                    <button
                                        key={sq.id}
                                        className={`nav-btn ${currentIndex === idx ? 'active' : ''} ${statusClass}`}
                                        onClick={() => setCurrentIndex(idx)}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="sidebar-legend">
                            <div className="legend-item"><span className="dot current"></span> Sedang Dibuka</div>
                            <div className="legend-item"><span className="dot filled"></span> Sudah Terisi</div>
                            <div className="legend-item"><span className="dot ragu"></span> Ragu - Ragu</div>
                            <div className="legend-item"><span className="dot empty"></span> Belum Diisi</div>
                        </div>
                    </aside>

                    <main className="cbt-main">
                        <div className="cbt-container">
                            <div className="cbt-topbar">
                                <div className="cbt-topbar-left">
                                    <div className="cbt-soal-number">Soal Nomor <strong>{currentIndex + 1}</strong></div>
                                    <div className="cbt-font-controls">
                                        Ukuran font soal:
                                        <span className={`font-small ${fontSizeScale === 1 ? 'active-font' : ''}`} onClick={() => setFontSizeScale(1)}>A</span>
                                        <span className={`font-medium ${fontSizeScale === 2 ? 'active-font' : ''}`} onClick={() => setFontSizeScale(2)}>A</span>
                                        <span className={`font-large ${fontSizeScale === 3 ? 'active-font' : ''}`} onClick={() => setFontSizeScale(3)}>A</span>
                                    </div>
                                </div>

                                <div className="cbt-topbar-center">
                                    <button className="cbt-info-btn">INFORMASI SOAL</button>
                                </div>

                                <div className="cbt-topbar-right">
                                    <div className={`cbt-timer ${timer < 300 ? 'cbt-timer-urgent' : ''}`}>
                                        Sisa Waktu: {formatTime(timer)}
                                    </div>
                                    <button className="cbt-nav-toggle-btn" onClick={() => setShowNav(true)}>
                                        Daftar Soal
                                        <LayoutGrid size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="cbt-content-area">
                                <div className="cbt-question-box">
                                    <h3 className="cbt-instruction">Ketikkan jawabanmu!</h3>
                                    <div className={`cbt-question-text ${fontClass}`} dangerouslySetInnerHTML={{ __html: q?.pertanyaan }}></div>

                                    <div className="cbt-answer-area">
                                        <textarea
                                            className={fontClass}
                                            value={answers[q?.id] || ''}
                                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                            placeholder="Ketik jawaban Anda di sini..."
                                            rows={8}
                                        />
                                        <div className="cbt-save-indicator">
                                            <Clock size={12} className={isSaving ? 'animate-spin' : ''} />
                                            {isSaving ? 'Sedang menyimpan draft otomatis...' : 'Jawaban tersimpan di memori server'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="cbt-footer">
                                <button className="cbt-footer-btn cbt-btn-prev" disabled={currentIndex === 0} onClick={handlePrev}>
                                    <div className="icon-circle"><ChevronLeft size={16} strokeWidth={3} /></div> Soal sebelumnya
                                </button>

                                <button className={`cbt-footer-btn cbt-btn-ragu ${raguState[q?.id] ? 'active' : ''}`} onClick={toggleRagu}>
                                    <div className={`checkbox-square ${raguState[q?.id] ? 'checked' : ''}`}></div> {raguState[q?.id] ? 'Batal Ragu' : 'Ragu - Ragu'}
                                </button>

                                {currentIndex === questions.length - 1 ? (
                                    <button className="cbt-footer-btn cbt-btn-next finish" onClick={handleFinishExam}>
                                        Selesai <div className="icon-circle"><Check size={16} strokeWidth={3} /></div>
                                    </button>
                                ) : (
                                    <button className="cbt-footer-btn cbt-btn-next" onClick={handleNext}>
                                        Soal berikutnya <div className="icon-circle"><ChevronRight size={16} strokeWidth={3} /></div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </main>
                </div>

                {showFinishConfirm && (
                    <div className="modal-overlay">
                        <div className="modal-content token-modal" style={{ maxWidth: '500px', textAlign: 'center' }}>
                            <div className="shield-icon" style={{ color: '#ef4444', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                                <AlertCircle size={64} />
                            </div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1e293b', marginBottom: '16px' }}>Selesaikan Ujian?</h2>

                            <div style={{ background: '#fff1f2', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #fecaca' }}>
                                <p style={{ color: '#991b1b', fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>
                                    {questions.filter(q => !answers[q.id] || answers[q.id].trim() === '').length > 0
                                        ? `PERINGATAN: Masih ada ${questions.filter(q => !answers[q.id] || answers[q.id].trim() === '').length} soal yang BELUM Anda jawab!`
                                        : 'Hebat! Anda telah menjawab semua soal.'}
                                </p>
                            </div>

                            <p style={{ color: '#475569', fontSize: '1rem', lineHeight: '1.6', marginBottom: '32px' }}>
                                Apakah Anda benar-benar ingin mengakhiri ujian <strong>{currentExam.namaMapel}</strong>?
                                Setelah ini, Anda tidak bisa kembali untuk mengubah jawaban.
                            </p>

                            <div className="modal-actions">
                                <button className="btn-cancel" onClick={() => setShowFinishConfirm(false)} style={{ fontSize: '1rem', padding: '14px' }}>Batal, Cek Lagi</button>
                                <button className="btn-confirm" onClick={() => confirmFinishExam(false)} style={{ background: '#10b981', fontSize: '1rem', padding: '14px' }}>Ya, Saya Selesai</button>
                            </div>
                        </div>
                    </div>
                )}

                <style>{`
                    .cbt-layout { display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: #eef2f6; position: fixed; top: 0; left: 0; width: 100%; z-index: 2000; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; overflow: hidden; }
                    .cbt-header { background: #1e88e5; color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex-shrink: 0; }
                    .cbt-logo-circle { background: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                    .cbt-title { display: flex; flex-direction: column; line-height: 1.1; }
                    .cbt-title strong { font-size: 1.25rem; font-weight: 800; letter-spacing: 0.5px; margin:0; }
                    .cbt-title span { font-size: 0.8rem; font-weight: 400; opacity: 0.9; }
                    .cbt-userinfo { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 1rem; }
                    
                    .cbt-main { flex: 1; display: flex; justify-content: center; padding: 24px; overflow-y: auto; }
                    .cbt-container { background: white; width: 100%; max-width: 1300px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
                    
                    .cbt-topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; border-bottom: 2px solid #f1f5f9; flex-wrap: wrap; gap: 16px; min-height: 80px; }
                    .cbt-soal-number { font-size: 1.2rem; color: #475569; }
                    .cbt-soal-number strong { font-size: 1.4rem; color: #0284c7; }
                    .cbt-font-controls { font-size: 0.8rem; color: #64748b; margin-top: 4px; display: flex; align-items: center; gap: 8px; }
                    .cbt-font-controls span { cursor: pointer; transition: color 0.2s; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; }
                    .cbt-font-controls span:hover { background: #f1f5f9; color: #0284c7; }
                    .active-font { background: #e0f2fe; color: #0284c7 !important; border: 1px solid #bae6fd; }
                    .font-small { font-size: 0.8rem; }
                    .font-medium { font-size: 1rem; }
                    .font-large { font-size: 1.2rem; }
                    
                    .cbt-info-btn { background: #007bff; color: white; border: none; padding: 10px 48px; border-radius: 50px; font-weight: 700; font-size: 0.85rem; letter-spacing: 1px; cursor: pointer; transition: background 0.2s; }
                    .cbt-info-btn:hover { background: #0069d9; }
                    
                    .cbt-topbar-right { display: flex; align-items: center; gap: 16px; }
                    .cbt-timer { border: 1px solid #f87171; color: #334155; padding: 8px 20px; border-radius: 50px; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; }
                    .cbt-timer-urgent { background: #fef2f2; color: #ef4444; border-color: #ef4444; animation: pulse 1s infinite; }
                    .cbt-nav-toggle-btn { background: #007bff; color: white; border: none; padding: 10px 24px; border-radius: 50px; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background 0.2s; }
                    .cbt-nav-toggle-btn:hover { background: #0069d9; }
                    
                    .cbt-content-area { padding: 40px; flex: 1; border-bottom: 2px solid #f1f5f9; display: flex; justify-content: center; background: #fff; }
                    .cbt-question-box { width: 100%; max-width: 1000px; padding: 32px; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); height: fit-content; }
                    .cbt-instruction { color: #0ea5e9; font-weight: 600; font-size: 1.15rem; margin-bottom: 24px; margin-top: 0; }
                    .cbt-question-text { color: #1e293b; line-height: 1.7; margin-bottom: 32px; font-weight: 500; font-size: 1.15rem; }
                    .cbt-question-text.text-lg { font-size: 1.3rem; }
                    .cbt-question-text.text-xl { font-size: 1.5rem; }
                    
                    .cbt-answer-area textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; font-family: inherit; resize: vertical; outline: none; transition: border-color 0.2s; font-size: 1.1rem; }
                    .cbt-answer-area textarea.text-lg { font-size: 1.25rem; }
                    .cbt-answer-area textarea.text-xl { font-size: 1.4rem; }
                    .cbt-answer-area textarea:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1); }
                    .cbt-save-indicator { font-size: 0.85rem; color: #94a3b8; margin-top: 10px; display: flex; align-items: center; gap: 6px; font-style: italic; }
                    
                    .cbt-footer { display: flex; justify-content: space-between; padding: 24px 40px; background: white; align-items: center; border-top: 1px solid #e2e8f0; }
                    .cbt-footer-btn { display: flex; align-items: center; gap: 10px; padding: 10px 24px; border-radius: 50px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; border: none; color: white; }
                    .cbt-footer-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                    
                    .cbt-btn-prev { background: #ef4444; }
                    .cbt-btn-prev:hover:not(:disabled) { background: #dc2626; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
                    
                    .cbt-btn-ragu { background: #f59e0b; color: white; }
                    .cbt-btn-ragu:hover { background: #d97706; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
                    
                    .cbt-btn-next { background: #3b82f6; }
                    .cbt-btn-next.finish { background: #10b981; }
                    .cbt-btn-next:hover:not(:disabled) { background: #2563eb; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
                    .cbt-btn-next.finish:hover:not(:disabled) { background: #059669; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
                    
                    .icon-circle { background: white; color: inherit; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
                    .cbt-btn-prev .icon-circle { color: #ef4444; }
                    .cbt-btn-next .icon-circle { color: #3b82f6; }
                    .cbt-body { flex: 1; display: flex; overflow: hidden; background: #f8fafc; }
                    .cbt-sidebar { width: 320px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 24px; }
                    .sidebar-title { display: flex; align-items: center; gap: 10px; font-weight: 800; color: #1e293b; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }
                    .sidebar-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; overflow-y: auto; flex: 1; padding-bottom: 20px; align-content: start; }
                    .nav-btn { aspect-ratio: 1; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; cursor: pointer; background: white; color: #64748b; font-size: 1rem; transition: all 0.2s; }
                    .nav-btn:hover { border-color: #3b82f6; color: #3b82f6; }
                    .nav-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; transform: scale(1.05); }
                    .nav-btn.filled { background: #dcfce7; border-color: #86efac; color: #166534; }
                    .nav-btn.filled.active { background: #22c55e; border-color: #22c55e; color: white; }
                    .nav-btn.ragu { background: #fef3c7; border-color: #fcd34d; color: #b45309; }
                    .nav-btn.ragu.active { background: #f59e0b; border-color: #f59e0b; color: white; }
                    
                    .sidebar-legend { border-top: 1px solid #f1f5f9; padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #64748b; font-weight: 600; }
                    .dot { width: 10px; height: 10px; border-radius: 2px; }
                    .dot.current { background: #3b82f6; }
                    .dot.filled { background: #dcfce7; border: 1px solid #86efac; }
                    .dot.ragu { background: #fef3c7; border: 1px solid #fcd34d; }
                    .dot.empty { background: white; border: 1px solid #cbd5e1; }

                    .cbt-main { flex: 1; overflow-y: auto; padding: 32px; display: flex; justify-content: center; width: 100%; }
                    .cbt-container { background: white; width: 100%; max-width: 900px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); display: flex; flex-direction: column; overflow: hidden; height: fit-content; margin-bottom: 24px; }
                    
                    .cbt-topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; border-bottom: 2px solid #f1f5f9; flex-wrap: wrap; gap: 16px; min-height: 80px; background: #fff; }
 
                    .cbt-nav-toggle-btn { display: none; }
                    
                    @media (max-width: 1024px) {
                        .cbt-sidebar { display: none; }
                        .cbt-nav-toggle-btn { display: flex; }
                    }

                    @media (max-width: 768px) {
                        .cbt-header { padding: 12px 16px; }
                        .cbt-title strong { font-size: 1rem; }
                        .cbt-userinfo { display: none; }
                        .cbt-topbar { padding: 12px 16px; flex-direction: column; align-items: flex-start; gap: 8px; }
                        .cbt-topbar-right { width: 100%; justify-content: space-between; }
                        .cbt-content-area { padding: 16px; }
                        .cbt-question-box { padding: 16px; border: none; box-shadow: none; }
                        .cbt-footer { padding: 16px; flex-wrap: wrap; gap: 10px; }
                        .cbt-footer-btn { flex: 1; min-width: 120px; justify-content: center; font-size: 0.8rem; padding: 10px 12px; }
                        .cbt-btn-ragu { order: 3; width: 100%; }
                        .cbt-btn-prev { order: 1; }
                        .cbt-btn-next { order: 2; }
                    }
                    
                    .cbt-modal-overlay { display: none; }
                    .cbt-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
                    .cbt-modal-head h3 { margin: 0; font-size: 1.4rem; color: #0f172a; font-weight: 800; }
                    .cbt-close-nav { background: #f1f5f9; border: none; cursor: pointer; color: #475569; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;}
                    .cbt-close-nav:hover { background: #e2e8f0; color: #0f172a; }
                    .cbt-modal-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; overflow-y: auto; align-content: start; }
                    
                    .cbt-nav-num { aspect-ratio: 1; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; cursor: pointer; background: white; color: #64748b; font-size: 1.15rem; transition: all 0.2s; }
                    .cbt-nav-num:hover { border-color: #0ea5e9; color: #0ea5e9; }
                    .cbt-nav-num.active { background: #0ea5e9; color: white; border-color: #0ea5e9; transform: scale(1.05); }
                    .cbt-nav-num.filled { background: #dcfce7; border-color: #86efac; color: #166534; }
                    .cbt-nav-num.filled.active { background: #10b981; border-color: #10b981; color: white; transform: scale(1.05); }
                    .cbt-nav-num.ragu { background: #fef3c7; border-color: #fcd34d; color: #b45309; }
                    .cbt-nav-num.ragu.active { background: #f59e0b; border-color: #f59e0b; color: white; transform: scale(1.05); }

                    .animate-spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }

                    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 4000; padding: 20px; }
                    .modal-content { background: white; border-radius: 24px; width: 100%; max-width: 500px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                    @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                    
                    .modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
                    .btn-cancel { padding: 14px; border-radius: 12px; border: 2px solid #e2e8f0; background: #f8fafc; color: #475569; font-weight: 700; cursor: pointer; transition: all 0.2s; }
                    .btn-cancel:hover { background: #f1f5f9; border-color: #cbd5e1; }
                    .btn-confirm { padding: 14px; border-radius: 12px; background: #3b82f6; color: white; border: none; font-weight: 800; cursor: pointer; transition: all 0.2s; }
                    .btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 8px 15px -3px rgba(0,0,0,0.1); }
                `}</style>
            </div>
        );
    }

    return (
        <div className="student-home animate-fade-in" style={{ padding: '32px' }}>
            <div className="page-header mb-8">
                <h1>Daftar Ujian Tersedia</h1>
                <p>Silakan pilih jadwal ujian yang sedang berlangsung.</p>
            </div>

            <div className="events-bar mb-8">
                {events.map(ev => (
                    <button
                        key={ev.id}
                        className={`event-btn ${selectedEvent?.id === ev.id ? 'active' : ''}`}
                        onClick={() => handleSelectEvent(ev)}
                    >
                        {ev.namaEvent}
                        {ev.statusAktif && <span className="status-dot"></span>}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center p-20">Memuat data...</div>
            ) : exams.length > 0 ? (
                <div className="exams-grid">
                    {exams.map(ex => (
                        <div key={ex.id} className="student-exam-card">
                            <div className="exam-card-head">
                                <div className="subject-icon">
                                    <BookOpen size={24} />
                                </div>
                                <div className="duration-tag">{ex.durasi} Menit</div>
                            </div>
                            <h3>{ex.namaMapel}</h3>
                            <p className="teacher">{ex.namaGuru}</p>

                            <div className="exam-times">
                                <div className="time-item">
                                    <Clock size={14} />
                                    <span>Mulai: {new Date(ex.waktuMulai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="time-item">
                                    <Clock size={14} />
                                    <span>Selesai: {new Date(ex.waktuSelesai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>

                            {ex.isFinished || JSON.parse(localStorage.getItem('finishedExams') || '{}')[`${user.profileId}_${ex.id}`] ? (
                                <button className="start-btn" style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} disabled>
                                    <CheckCircle size={18} />
                                    Selesai Dikerjakan
                                </button>
                            ) : (
                                <button className="start-btn" onClick={() => handleStartClick(ex)}>
                                    <Play size={18} />
                                    Ikuti Ujian
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <AlertCircle size={48} />
                    <h3>Tidak ada ujian ditemukan</h3>
                    <p>Belum ada jadwal ujian untuk kelas Anda di event ini.</p>
                </div>
            )}

            {showTokenOverlay && (
                <div className="modal-overlay">
                    <div className="modal-content token-modal">
                        <div className="shield-icon">
                            <Shield size={40} />
                        </div>
                        <h2>Token Keamanan</h2>
                        <p>Masukkan token yang diberikan oleh pengawas untuk memulai ujian <strong>{showTokenOverlay.namaMapel}</strong>.</p>

                        <input
                            type="text"
                            placeholder="6 Karakter Token..."
                            maxLength={6}
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                            className="token-field"
                        />

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowTokenOverlay(null)}>Batal</button>
                            <button className="btn-confirm" onClick={handleVerifyToken} disabled={tokenInput.length < 5}>
                                Konfirmasi & Mulai
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showFinishConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content token-modal" style={{ maxWidth: '450px' }}>
                        <div className="shield-icon" style={{ color: '#ef4444' }}>
                            <AlertCircle size={48} />
                        </div>
                        <h2>Selesaikan Ujian?</h2>
                        <p style={{ marginBottom: '16px' }}>
                            Apakah Anda yakin ingin menyelesaikan ujian ini?
                            <br /><br />
                            <strong>Mohon diperhatikan:</strong> Anda hanya dapat mengerjakan ujian ini <strong>SATU KALI</strong>.
                            Setelah Anda klik <em>"Ya, Selesaikan"</em>, seluruh jawaban Anda akan dikirim ke server dan Anda tidak dapat mengubahnya kembali.
                        </p>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowFinishConfirm(false)}>Batal, Cek Ulang</button>
                            <button className="btn-confirm" onClick={() => confirmFinishExam(false)} style={{ background: '#ef4444' }}>
                                Ya, Selesaikan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .student-home { padding: 32px; }
                @media (max-width: 768px) {
                    .student-home { padding: 16px; }
                    .page-header h1 { font-size: 1.5rem; }
                    .events-bar { overflow-x: auto; padding-bottom: 8px; width: 100%; }
                    .event-btn { white-space: nowrap; padding: 10px 16px; }
                    .exams-grid { grid-template-columns: 1fr; }
                }
                .events-bar { display: flex; gap: 12px; }
                .event-btn { padding: 12px 24px; border-radius: 14px; border: 1px solid #e2e8f0; background: white; font-weight: 700; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
                .event-btn.active { border-color: #3b82f6; background: #eff6ff; color: #3b82f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .status-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block; }

                .exams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
                .student-exam-card { background: white; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0; transition: all 0.3s; }
                .student-exam-card:hover { transform: translateY(-4px); border-color: #3b82f6; box-shadow: 0 12px 20px -5px rgba(0,0,0,0.1); }
                
                .exam-card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
                .subject-icon { background: #f1f5f9; color: #3b82f6; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .duration-tag { background: #fef9c3; color: #854d0e; padding: 4px 12px; border-radius: 50px; font-size: 0.75rem; font-weight: 700; }
                
                .student-exam-card h3 { font-size: 1.1rem; color: #1e293b; margin-bottom: 4px; }
                .teacher { color: #94a3b8; font-size: 0.85rem; margin-bottom: 16px; font-weight: 600; }
                
                .exam-times { background: #f8fafc; padding: 12px; border-radius: 12px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px; }
                .time-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #64748b; font-weight: 600; }
                
                .start-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
                .start-btn:hover { background: #2563eb; box-shadow: 0 8px 15px -3px rgba(59,130,246,0.3); }

                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 4000; padding: 20px; }
                .modal-content { background: white; border-radius: 24px; width: 100%; max-width: 500px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

                .token-modal { text-align: center; }
                .shield-icon { color: #3b82f6; margin-bottom: 20px; display: flex; justify-content: center; }
                .token-field { width: 100%; border: 3px solid #e2e8f0; border-radius: 16px; padding: 20px; font-size: 2rem; text-align: center; letter-spacing: 6px; font-family: 'JetBrains Mono', monospace; font-weight: 950; margin: 24px 0; outline: none; transition: border-color 0.2s; background: #f8fafc; color: #1e293b; }
                .token-field:focus { border-color: #3b82f6; background: white; }
                .modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
                .btn-cancel { padding: 14px; border-radius: 12px; border: 2px solid #e2e8f0; background: #f8fafc; color: #475569; font-weight: 700; cursor: pointer; transition: all 0.2s; }
                .btn-cancel:hover { background: #f1f5f9; border-color: #cbd5e1; }
                .btn-confirm { padding: 14px; border-radius: 12px; background: #3b82f6; color: white; border: none; font-weight: 800; cursor: pointer; transition: all 0.2s; }
                .btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 8px 15px -3px rgba(0,0,0,0.1); }
                .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
            `}</style>
        </div>
    );
};

export default StudentExams;
