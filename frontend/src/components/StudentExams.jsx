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
    Check,
    Award,
    Sparkles,
    RefreshCw
} from 'lucide-react';

const StudentExams = () => {
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(false);

    const [showTokenOverlay, setShowTokenOverlay] = useState(null);
    const [tokenInput, setTokenInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Transcript State
    const [transcriptData, setTranscriptData] = useState(null);
    const [showTranscript, setShowTranscript] = useState(false);

    // AI Recommendation State
    const [aiSaran, setAiSaran] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiGenerated, setAiGenerated] = useState({});

    // Exam Taking State
    const [currentExam, setCurrentExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({}); // { soalId: text }
    const [raguState, setRaguState] = useState({}); // { soalId: boolean }
    const [currentIndex, setCurrentIndex] = useState(0);
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
            if (currentExam) document.body.classList.add('is-exam-active');
        } else {
            document.body.style.overflow = 'unset';
            document.body.classList.remove('is-exam-active');
        }
        return () => {
            document.body.style.overflow = 'unset';
            document.body.classList.remove('is-exam-active');
        };
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
        setAiSaran(null);
        try {
            const resp = await axios.get(`/api/exam/ujian-mapel/siswa?eventId=${event.id}`, { headers });
            setExams(resp.data);
            generateAiSaran(resp.data);
        } catch (err) {
            console.error('Error fetching student exams:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateAiSaran = async (examList, force = false) => {
        const examsWithScores = examList.filter(e => e.tampilkanNilai && e.nilaiAkhir !== null && e.nilaiAkhir !== undefined);
        if (examsWithScores.length < 1) return;

        const cacheKey = examsWithScores.map(e => `${e.id}:${e.nilaiAkhir}`).join('|');
        if (!force && aiGenerated[cacheKey]) {
            setAiSaran(aiGenerated[cacheKey]);
            return;
        }

        setAiLoading(true);
        try {
            // Fetch full Q&A detail for each exam with published scores
            const hasilPerMapel = await Promise.all(
                examsWithScores.map(async (ex) => {
                    try {
                        // Fetch questions
                        const qResp = await axios.get(`/api/exam/soal-essay/ujian/${ex.id}`, { headers });
                        const qs = qResp.data;

                        // Fetch student answers for this exam
                        const aResp = await axios.get(`/api/exam/jawaban/siswa/${user.profileId}`, { headers });
                        const userAnswers = aResp.data.filter(a => qs.some(q => q.id === a.soalId));

                        // Strip HTML tags for cleaner AI context
                        const stripHtml = (html) => html ? html.replace(/<[^>]*>/g, '').trim() : '';

                        const daftarJawaban = qs.map(q => {
                            const ans = userAnswers.find(a => a.soalId === q.id) || {};
                            return {
                                soal: stripHtml(q.pertanyaan),
                                jawabSiswa: ans.teksJawaban || '(Tidak ada jawaban)',
                                skor: ans.skorFinalGuru !== undefined && ans.skorFinalGuru !== null ? ans.skorFinalGuru : null,
                                bobotMaksimal: q.bobotNilai || 100
                            };
                        });

                        return {
                            namaMapel: ex.namaMapel,
                            nilaiAkhir: ex.nilaiAkhir,
                            daftarJawaban
                        };
                    } catch (err) {
                        // Fallback: just send the score if fetching Q&A fails
                        return { namaMapel: ex.namaMapel, nilaiAkhir: ex.nilaiAkhir, daftarJawaban: [] };
                    }
                })
            );

            const namaSiswa = user.namaLengkap || user.username || 'Siswa';
            const resp = await axios.post('/api/exam/saran-nilai/generate', { namaSiswa, hasilPerMapel }, { headers });
            setAiSaran(resp.data);
            setAiGenerated(prev => ({ ...prev, [cacheKey]: resp.data }));
        } catch (err) {
            console.error('Error generating AI recommendation:', err);
        } finally {
            setAiLoading(false);
        }
    };

    const handleStartClick = (exam) => {
        setTokenInput('');
        setShowTokenOverlay(exam);
    };

    const handleViewTranscript = async (exam) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch questions
            const qResp = await axios.get(`/api/exam/soal-essay/ujian/${exam.id}`, { headers });
            const qs = qResp.data;

            // Fetch answers
            const aResp = await axios.get(`/api/exam/jawaban/siswa/${user.profileId}`, { headers });
            const userAnswers = aResp.data.filter(a => qs.some(q => q.id === a.soalId));

            const compiledList = qs.map((q, i) => {
                const ans = userAnswers.find(a => a.soalId === q.id) || {};
                return {
                    no: i + 1,
                    pertanyaan: q.pertanyaan,
                    bobot: q.bobotNilai,
                    jawabanSiswa: ans.teksJawaban || 'Tidak ada jawaban',
                    skorGuru: ans.skorFinalGuru !== null && ans.skorFinalGuru !== undefined ? ans.skorFinalGuru : null,
                    saranAi: ans.alasanAi || 'Tidak ada catatan'
                };
            });

            let totalSkor = 0;
            let fullyGraded = true;
            compiledList.forEach(item => {
                if (item.skorGuru !== null) totalSkor += item.skorGuru;
                else fullyGraded = false;
            });
            const finalScore = qs.length > 0 ? (totalSkor / qs.length).toFixed(1) : 0;

            setTranscriptData({ exam, compiledList, finalScore, fullyGraded });
            setShowTranscript(true);
        } catch (err) {
            console.error(err);
            alert('Gagal memuat transkrip nilai.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyToken = async (e) => {
        setIsSubmitting(true);
        try {
            let deviceId = localStorage.getItem('deviceId');
            if (!deviceId) {
                deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now();
                localStorage.setItem('deviceId', deviceId);
            }

            const trimmedToken = tokenInput.trim();
            const resp = await axios.post(`/api/exam/ujian-mapel/${showTokenOverlay.id}/validate-token?ujianToken=${trimmedToken}&deviceId=${deviceId}`, {}, { headers });
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
                    
                    /* Dark Mode support for CBT Layout */
                    [data-theme="dark"] .cbt-layout { background: #0f172a; color: #f8fafc; }
                    [data-theme="dark"] .cbt-main { background: #0f172a; }
                    [data-theme="dark"] .cbt-body { background: #0f172a; }
                    [data-theme="dark"] .cbt-sidebar { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .cbt-container { background: #1e293b; color: #f8fafc; box-shadow: none; }
                    [data-theme="dark"] .cbt-topbar { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .cbt-content-area { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .cbt-question-box { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .cbt-footer { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .cbt-answer-area textarea { background: #0f172a; color: #f8fafc; border-color: #334155; }
                    [data-theme="dark"] .cbt-answer-area textarea:focus { border-color: #3b82f6; }
                    [data-theme="dark"] .nav-btn { background: #0f172a; color: #94a3b8; border-color: #334155; }
                    [data-theme="dark"] .icon-circle { background: #1e293b; }
                    [data-theme="dark"] .cbt-question-text { color: #f8fafc; }
                    [data-theme="dark"] .cbt-font-controls span { color: #94a3b8; }
                    [data-theme="dark"] .cbt-font-controls span:hover { background: #334155; color: #3b82f6; }
                    [data-theme="dark"] .active-font { background: #334155 !important; border-color: #475569; color: #3b82f6 !important; }
                    [data-theme="dark"] .sidebar-legend { border-color: #334155; }
                    [data-theme="dark"] .sidebar-title { border-color: #334155; color: #e2e8f0; }
                    [data-theme="dark"] .cbt-soal-number { color: #cbd5e1; }
                    [data-theme="dark"] .cbt-timer { color: #cbd5e1; border-color: #ef4444; }
                    [data-theme="dark"] .cbt-timer-urgent { background: #450a0a; color: #fca5a5; }
                    [data-theme="dark"] .cbt-instruction { color: #38bdf8; }
                    [data-theme="dark"] .modal-content.token-modal { background: #1e293b; }
                    [data-theme="dark"] .modal-content { background: #1e293b; color: #f8fafc; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                    [data-theme="dark"] .modal-content h2, [data-theme="dark"] .modal-content h3 { color: #f8fafc !important; }
                    [data-theme="dark"] .modal-content p { color: #cbd5e1 !important; }
                    [data-theme="dark"] .token-field { background: #0f172a; color: #f8fafc; border-color: #334155; }
                    [data-theme="dark"] .token-field:focus { background: #0f172a; border-color: #3b82f6; }
                    [data-theme="dark"] .btn-cancel { background: #0f172a; color: #cbd5e1; border-color: #334155; }
                    [data-theme="dark"] .btn-cancel:hover { background: #334155; color: #f8fafc; }
                    [data-theme="dark"] .modal-overlay { background: rgba(0, 0, 0, 0.8); }
                    [data-theme="dark"] .cbt-modal-head { border-color: #334155; }
                    [data-theme="dark"] .cbt-close-nav { background: #0f172a; color: #94a3b8; }
                    [data-theme="dark"] .cbt-close-nav:hover { background: #334155; color: #f8fafc; }
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
                <>
                    {(aiSaran || aiLoading) && (
                        <div className="ai-saran-card" style={{ marginBottom: '28px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 32px -8px rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.2)' }}>
                            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                                        <Sparkles size={22} color="white" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem', fontWeight: '800' }}>Saran dari BaknusAI</h3>
                                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>Rekomendasi personal berdasarkan hasil ujian Anda</p>
                                    </div>
                                </div>
                                {aiSaran && !aiLoading && (
                                    <button
                                        onClick={() => generateAiSaran(exams, true)}
                                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                                    >
                                        <RefreshCw size={14} /> Refresh
                                    </button>
                                )}
                            </div>
                            <div className="ai-saran-body" style={{ padding: '24px 28px' }}>
                                {aiLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div className="ai-thinking-dots" style={{ display: 'flex', gap: '6px' }}>
                                            <span></span><span></span><span></span>
                                        </div>
                                        <p className="ai-saran-text" style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>BaknusAI sedang menganalisis hasil ujian Anda...</p>
                                    </div>
                                ) : (
                                    <p className="ai-saran-text" style={{ margin: 0, lineHeight: '1.8', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{aiSaran}</p>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="exams-grid">
                        {exams.map(ex => (
                            <div key={ex.id} className="student-exam-card">
                                <div className="exam-card-head">
                                    <div className="subject-icon">
                                        <BookOpen size={24} />
                                    </div>
                                    <div className="duration-tag">{ex.durasi} Menit</div>
                                    {ex.tampilkanNilai && ex.nilaiAkhir !== null && (
                                        <div className="score-badge" style={{ background: '#ecfdf5', color: '#059669', padding: '6px 14px', borderRadius: '50px', fontSize: '0.9rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #10b981', boxShadow: '0 2px 4px rgba(16,185,129,0.1)' }}>
                                            <Award size={16} /> {ex.nilaiAkhir}
                                        </div>
                                    )}
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
                                    ex.tampilkanNilai ? (
                                        <button className="start-btn" style={{ background: '#ecfdf5', color: '#10b981', borderColor: '#10b981' }} onClick={() => handleViewTranscript(ex)}>
                                            <Award size={18} />
                                            Lihat Transkrip Nilai
                                        </button>
                                    ) : (
                                        <button className="start-btn" style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} disabled>
                                            <CheckCircle size={18} />
                                            Selesai Dikerjakan
                                        </button>
                                    )
                                ) : (
                                    <button className="start-btn" onClick={() => handleStartClick(ex)}>
                                        <Play size={18} />
                                        Ikuti Ujian
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </>
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

            {showTranscript && transcriptData && (
                <div className="modal-overlay animate-fade-in" onClick={() => setShowTranscript(false)}>
                    <div className="modal-content" style={{ maxWidth: '800px', padding: '0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ background: '#3b82f6', color: 'white', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Award size={24} /> Transkrip Nilai</h2>
                                <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{transcriptData.exam.namaMapel} - {transcriptData.exam.namaGuru}</p>
                            </div>
                            <button onClick={() => setShowTranscript(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                        </div>
                        <div className="transcript-scroll-area" style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto', background: 'var(--bg-color, white)' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                                <div className="transcript-nilai-box" style={{ padding: '24px 48px', borderRadius: '20px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Nilai Akhir</span>
                                    <div style={{ fontSize: '3.5rem', fontWeight: '950', color: transcriptData.fullyGraded ? '#059669' : '#f59e0b', lineHeight: 1, marginTop: '8px' }}>
                                        {transcriptData.finalScore}
                                        <small style={{ fontSize: '1.2rem', color: '#94a3b8' }}>/ 100</small>
                                    </div>
                                    {!transcriptData.fullyGraded && <p style={{ color: '#f59e0b', fontSize: '0.85rem', marginTop: '12px', fontWeight: 'bold' }}>Sebagian jawaban belum dinilai oleh Guru</p>}
                                </div>
                            </div>

                            <h3 className="transcript-detail-title" style={{ paddingBottom: '12px', marginBottom: '20px' }}>Detail Evaluasi Jawaban</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {transcriptData.compiledList.map((item, idx) => (
                                    <div key={idx} className="transcript-item-card" style={{ padding: '24px', borderRadius: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <span style={{ fontWeight: '900', color: '#3b82f6', fontSize: '1.1rem' }}>Soal No. {item.no}</span>
                                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>Bobot Maksimal: {item.bobot}</span>
                                        </div>
                                        <div className="transcript-q-text" dangerouslySetInnerHTML={{ __html: item.pertanyaan }}></div>

                                        <div className="transcript-ans-box" style={{ padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
                                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Jawaban Anda</p>
                                            <p className="transcript-ans-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{item.jawabanSiswa}</p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            <div className="transcript-score-box" style={{ padding: '20px 48px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Nilai Diperoleh</span>
                                                <strong className="transcript-score-value" style={{ fontSize: '2.5rem', lineHeight: 1, marginTop: '8px' }}>{item.skorGuru !== null ? item.skorGuru : '-'}</strong>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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

                /* AI Recommendation Card */
                .ai-saran-card { }
                .ai-saran-body { background: white; }
                .ai-saran-text { color: #334155; }
                [data-theme="dark"] .ai-saran-body { background: #1e293b; }
                [data-theme="dark"] .ai-saran-text { color: #cbd5e1; }

                /* Animated thinking dots */
                .ai-thinking-dots span { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #7c3aed; animation: bounceDot 1.2s infinite ease-in-out; }
                .ai-thinking-dots span:nth-child(1) { animation-delay: 0s; }
                .ai-thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
                .ai-thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes bounceDot { 0%, 100% { transform: scale(0.6); opacity: 0.4; } 50% { transform: scale(1); opacity: 1; } }

                .transcript-nilai-box { background: #f8fafc; border-color: #e2e8f0; }
                .transcript-item-card { background: #f8fafc; border-color: #e2e8f0; }
                .transcript-q-text { color: #334155; }
                .transcript-ans-box { background: white; border-left-color: #cbd5e1; }
                .transcript-ans-text { color: #475569; }
                .transcript-score-box { background: white; border-color: #e2e8f0; }
                .transcript-score-value { color: #1e293b; }

                /* Dark Mode for Transcript */
                [data-theme="dark"] .transcript-scroll-area { background: #0f172a !important; }
                [data-theme="dark"] .transcript-nilai-box { background: #1e293b; border-color: #334155 !important; }
                [data-theme="dark"] .transcript-detail-title { color: #e2e8f0 !important; border-bottom-color: #334155 !important; }
                [data-theme="dark"] .transcript-item-card { background: #1e293b !important; border-color: #334155 !important; }
                [data-theme="dark"] .transcript-q-text, [data-theme="dark"] .transcript-q-text * { color: #f8fafc !important; }
                [data-theme="dark"] .transcript-ans-box { background: #0f172a !important; border-left-color: #475569 !important; }
                [data-theme="dark"] .transcript-ans-text { color: #cbd5e1 !important; }
                [data-theme="dark"] .transcript-score-box { background: #0f172a !important; border-color: #334155 !important; }
                [data-theme="dark"] .transcript-score-value { color: #f8fafc !important; }
            `}</style>
        </div>
    );
};

export default StudentExams;
