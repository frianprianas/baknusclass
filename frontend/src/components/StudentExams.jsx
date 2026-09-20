import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    BookOpen,
    Lock,
    Clock,
    Play,
    CheckCircle,
    CheckCircle2,
    CheckSquare,
    AlertCircle,
    XCircle,
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
    RotateCcw,
    HelpCircle,
    RefreshCw,
    Brush,
    Maximize
} from 'lucide-react';
import Whiteboard from './Whiteboard';

const StudentExams = () => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 15000);
        return () => clearInterval(timer);
    }, []);
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
    const keysPressedRef = useRef(new Set());
    const ctrlKeySequenceRef = useRef([]);
    const allowExitFullscreenRef = useRef(false);
    const isFinishingRef = useRef(false);
    const confirmFinishExamRef = useRef(null);

    const enterFullscreen = () => {
        const elem = document.documentElement;
        try {
            if (elem.requestFullscreen) {
                elem.requestFullscreen().then(() => {
                    // Lock Escape key via Keyboard Lock API (Chromium browsers)
                    if (navigator.keyboard && typeof navigator.keyboard.lock === 'function') {
                        navigator.keyboard.lock(['Escape', 'F11']).catch(() => {});
                    }
                }).catch(() => {});
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } catch (e) {}
    };

    const exitFullscreenManually = () => {
        try {
            if (navigator.keyboard && typeof navigator.keyboard.unlock === 'function') {
                navigator.keyboard.unlock();
            }
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        } catch (e) {}
    };
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({}); // { soalId: text }
    const answersRef = useRef({});
    const [raguState, setRaguState] = useState({}); // { soalId: boolean }
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timer, setTimer] = useState(0); // seconds remaining
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);
    const [whiteboards, setWhiteboards] = useState({}); // { soalId: base64 }
    const [showWhiteboard, setShowWhiteboard] = useState({}); // { soalId: boolean }

    // CBT Design State
    const [showNav, setShowNav] = useState(false);
    const [showPracticeResult, setShowPracticeResult] = useState(false);
    const [practiceResult, setPracticeResult] = useState(null);
    const [fontSizeScale, setFontSizeScale] = useState(1);
    const [showQuestionInfoModal, setShowQuestionInfoModal] = useState(false);
    const [enlargedImg, setEnlargedImg] = useState(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const effectiveSiswaId = user.profileId || user.userId || user.id;

    let userEmail = user.email;
    if (!userEmail && token) {
        try { userEmail = JSON.parse(atob(token.split('.')[1])).sub; } catch (e) { }
    }

    useEffect(() => {
        fetchEvents();
    }, []);

    // Fullscreen & Lockdown (Escape, F11, X close protection, Ctrl+B+H)
    useEffect(() => {
        if (!currentExam) {
            allowExitFullscreenRef.current = false;
            keysPressedRef.current.clear();
            ctrlKeySequenceRef.current = [];
            return;
        }

        // Enter fullscreen immediately
        enterFullscreen();

        const handleKeyDown = (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            keysPressedRef.current.add(key);

            // Block Escape key from exiting fullscreen or closing modals unless unlocked
            if (e.key === 'Escape' || e.code === 'Escape') {
                if (!allowExitFullscreenRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // Block F11 (browser fullscreen toggle)
            if (e.key === 'F11') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Block common tab/window closure and refresh shortcuts (Ctrl+W, Ctrl+R, F5)
            if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (key === 'r' || key === 'w' || key === 'q'))) {
                if (!allowExitFullscreenRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // Secret Proctor Unlock: Ctrl + B + H
            if (e.ctrlKey || e.metaKey) {
                if (key === 'b' || key === 'h') {
                    ctrlKeySequenceRef.current.push(key);
                    if (ctrlKeySequenceRef.current.length > 4) {
                        ctrlKeySequenceRef.current.shift();
                    }
                }

                const simultaneousBH = keysPressedRef.current.has('b') && keysPressedRef.current.has('h');
                const recentKeys = ctrlKeySequenceRef.current.join('');
                const sequenceBH = recentKeys.endsWith('bh') || recentKeys.endsWith('hb');

                if (simultaneousBH || sequenceBH) {
                    e.preventDefault();
                    e.stopPropagation();
                    allowExitFullscreenRef.current = true;
                    exitFullscreenManually();
                    ctrlKeySequenceRef.current = [];
                    alert('Akses Pengawas: Mode Layar Penuh Berhasil Dinonaktifkan.');
                    return;
                }
            }
        };

        const handleKeyUp = (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            keysPressedRef.current.delete(key);
            if (!e.ctrlKey && !e.metaKey) {
                ctrlKeySequenceRef.current = [];
            }
        };

        const handleFullscreenChange = () => {
            const isFull = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );

            if (!isFull && !allowExitFullscreenRef.current) {
                enterFullscreen();
            }
        };

        // Prevent browser close (X button or Alt+F4) via beforeunload prompt
        const handleBeforeUnload = (e) => {
            if (!allowExitFullscreenRef.current) {
                e.preventDefault();
                e.returnValue = 'Ujian sedang berlangsung! Jangan menutup atau meninggalkan halaman ini.';
                return e.returnValue;
            }
        };

        // Disable right-click inspect/context menu during exam
        const handleContextMenu = (e) => {
            if (!allowExitFullscreenRef.current) {
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, [currentExam]);

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

    const DEFAULT_PRACTICE_EVENT = {
        id: 'event_latihan_cbt',
        namaEvent: '🎯 Simulasi & Latihan CBT',
        kodeEvent: 'SIMULASI_CBT',
        statusAktif: true,
        deskripsi: 'Event latihan mandiri tanpa batas waktu untuk mencoba sistem dan seluruh format soal'
    };

    const fetchEvents = async () => {
        try {
            const resp = await axios.get('/api/exam/event', { headers });
            const dbEvents = resp.data || [];
            
            // Check if DB already has a simulation/latihan event
            const hasLatihan = dbEvents.some(e => 
                (e.kodeEvent && e.kodeEvent.toUpperCase() === 'SIMULASI_CBT') ||
                (e.namaEvent && e.namaEvent.toLowerCase().includes('latihan'))
            );

            // Urutkan event yang paling baru dibuat (ID terbesar) di urutan paling awal
            dbEvents.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

            // Munculkan event yang terakhir dibuat di paling awal, dan latihan default di akhir
            const allEvents = hasLatihan ? dbEvents : [...dbEvents, DEFAULT_PRACTICE_EVENT];
            setEvents(allEvents);

            if (allEvents.length > 0) {
                // Pilih event yang paling baru dibuat dan aktif, atau event pertama
                const active = allEvents.find(e => e.statusAktif) || allEvents[0];
                handleSelectEvent(active);
            }
        } catch (err) {
            console.error('Error fetching events:', err);
            // Fallback so student can ALWAYS practice even if server or DB is booting
            setEvents([DEFAULT_PRACTICE_EVENT]);
            handleSelectEvent(DEFAULT_PRACTICE_EVENT);
        }
    };

    const handleSelectEvent = async (event) => {
        setSelectedEvent(event);
        setLoading(true);
        setAiSaran(null);

        const isLatihanEvent = event.id === 'event_latihan_cbt' || 
            (event.kodeEvent && event.kodeEvent.toUpperCase() === 'SIMULASI_CBT') ||
            (event.namaEvent && (event.namaEvent.toLowerCase().includes('latihan') || event.namaEvent.toLowerCase().includes('simulasi')));

        const defaultSimulasiExam = {
            id: 'practice_default_simulasi',
            namaMapel: 'Simulasi CBT Standar (Coba Semua Tipe Soal)',
            namaGuru: 'Sistem CBT BaknusClass',
            durasi: 0,
            waktuMulai: new Date().toISOString(),
            waktuSelesai: new Date(Date.now() + 864000000).toISOString(),
            isPractice: true,
            tampilkanNilai: true,
            nilaiAkhir: null
        };

        if (event.id === 'event_latihan_cbt') {
            setExams([defaultSimulasiExam]);
            setLoading(false);
            return;
        }

        try {
            const resp = await axios.get(`/api/exam/ujian-mapel/siswa?eventId=${event.id}`, { headers });
            let rawList = resp.data || [];

            // Ensure 100% unique exams (prevent duplicate cards by ID or by Subject + Teacher + StartTime)
            const uniqueExams = [];
            const seenIds = new Set();
            const seenSignatures = new Set();
            for (const ex of rawList) {
                if (!ex || !ex.id) continue;
                const sig = (ex.namaMapel || '') + '___' + (ex.namaGuru || '') + '___' + (ex.waktuMulai || '');
                if (!seenIds.has(ex.id) && !seenSignatures.has(sig)) {
                    seenIds.add(ex.id);
                    seenSignatures.add(sig);
                    uniqueExams.push(ex);
                }
            }
            let examList = uniqueExams.filter(e => e.statusAktif !== false);

            // If it's a Latihan / Simulasi event:
            if (isLatihanEvent) {
                if (examList.length === 0) {
                    examList = [defaultSimulasiExam];
                } else if (!seenIds.has(defaultSimulasiExam.id)) {
                    examList = [...examList, defaultSimulasiExam];
                }
            }

            setExams(examList);
            generateAiSaran(examList);
        } catch (err) {
            console.error('Error fetching student exams:', err);
            if (isLatihanEvent) {
                setExams([defaultSimulasiExam]);
            }
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
                        const aResp = await axios.get(`/api/exam/jawaban/siswa/${effectiveSiswaId}`, { headers });
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


    const handleStartPractice = () => {
        const practiceExam = {
            id: 'practice_default_simulasi',
            namaMapel: 'Simulasi & Latihan Ujian CBT',
            namaEvent: 'Latihan Mandiri Tanpa Batas Waktu',
            durasi: 0,
            isPractice: true,
            isFinished: false
        };

        const sampleQuestions = [
            {
                id: 'prak_q1',
                nomorSoal: 1,
                qType: 'pg',
                tipeSoal: 'PG_BIASA',
                pertanyaan: '<p>Berdasarkan letak astronomisnya di antara 6° LU – 11° LS, Indonesia berada di kawasan beriklim...</p>',
                pilihanA: 'Tropis dengan penyinaran matahari sepanjang tahun',
                pilihanB: 'Kutub dingin abadi',
                pilihanC: 'Gurun subtropis gersang',
                pilihanD: 'Sedang dengan 4 musim berbeda',
                pilihanE: 'Tundra pegunungan',
                kunciJawaban: 'A',
                bobotNilai: 25,
                pembahasan: 'Indonesia dilalui oleh garis khatulistiwa sehingga beriklim tropis dengan temperatur hangat dan curah hujan cukup.'
            },
            {
                id: 'prak_q2',
                nomorSoal: 2,
                qType: 'pg',
                tipeSoal: 'PG_KOMPLEKS',
                pertanyaan: '<p>Manakah di antara protokol berikut yang <strong>menggunakan enkripsi kriptografi untuk keamanan data</strong>? <em>(Pilihan Ganda Kompleks: Anda dapat memilih lebih dari satu jawaban yang benar)</em></p>',
                pilihanA: 'HTTPS (Port 443 - Enkripsi TLS/SSL)',
                pilihanB: 'HTTP biasa (Port 80 - Plaintext tidak terenkripsi)',
                pilihanC: 'SSH (Port 22 - Secure Shell dengan public/private key)',
                pilihanD: 'Telnet (Port 23 - Plaintext tanpa enkripsi)',
                pilihanE: 'TFTP tanpa autentikasi',
                kunciJawaban: 'A,C',
                bobotNilai: 25,
                pembahasan: 'HTTPS dan SSH adalah protokol yang menerapkan enkripsi kriptografi modern untuk melindungi kerahasiaan komunikasi data.'
            },
            {
                id: 'prak_q3',
                nomorSoal: 3,
                qType: 'pg',
                tipeSoal: 'BENAR_SALAH',
                pertanyaan: '<p><strong>Pernyataan:</strong><br/>RAM (Random Access Memory) adalah media penyimpanan yang bersifat <em>non-volatile</em>, artinya seluruh file dan aplikasi akan tetap tersimpan aman saat komputer dimatikan.</p>',
                pilihanA: 'Benar',
                pilihanB: 'Salah',
                kunciJawaban: 'B',
                bobotNilai: 25,
                pembahasan: 'Pernyataan ini SALAH. RAM bersifat volatile (data terhapus saat daya listrik mati). Penyimpanan non-volatile adalah Harddisk atau SSD.'
            },
            {
                id: 'prak_q4',
                nomorSoal: 4,
                qType: 'essay',
                pertanyaan: '<p>Jelaskan fungsi perangkat <strong>Switch</strong> dalam topologi jaringan LAN, dan silakan klik tombol <strong>"Buka Whiteboard Corat-coret"</strong> di bawah untuk menggambar sketsa sederhana koneksi antara Switch ke PC Client!</p>',
                kunciJawaban: 'Switch berfungsi sebagai sentral penghubung perangkat pada jaringan lokal (LAN) dan menyaring lalu lintas data berdasarkan MAC address.',
                bobotNilai: 25,
                pembahasan: 'Fitur Whiteboard memungkinkan siswa dan guru mencorat-coret skema topologi atau rumus matematika secara langsung!'
            }
        ];

        setQuestions(sampleQuestions);
        allowExitFullscreenRef.current = false;
        enterFullscreen();
        setCurrentExam(practiceExam);
        setCurrentIndex(0);
        setTimer(0);

        const initialAnswers = {};
        sampleQuestions.forEach(q => {
            initialAnswers[q.id] = '';
        });
        setAnswers(initialAnswers);
        setRaguState({});
        setWhiteboards({});
    };

        const handleResetAdminTrial = async (exam) => {
        if (!window.confirm(`Hapus seluruh data hasil uji coba Anda untuk ujian "${exam.namaMapel}"?\n\nJawaban, skor, dan status pengerjaan Anda akan dihapus bersih dari database sehingga ujian dapat diuji coba ulang dari nomor 1.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post(`/api/exam/ujian-mapel/${exam.id}/reset-siswa/${effectiveSiswaId}`, {}, { headers });
            alert(`Berhasil! Data hasil uji coba Anda pada ujian "${exam.namaMapel}" telah dibersihkan dari database.`);
            if (selectedEvent) {
                handleSelectEvent(selectedEvent);
            }
        } catch (err) {
            console.error('Failed to reset admin trial:', err);
            alert('Gagal mereset hasil uji coba: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleStartClick = (exam) => {
        if (exam.isPractice || exam.id === 'practice_default_simulasi') {
            handleStartPractice();
            return;
        }

        if (user.role === 'ADMIN' && exam.token) {
            setTokenInput(exam.token);
        } else {
            setTokenInput('');
        }
        setShowTokenOverlay(exam);
    };

    const handleViewTranscript = async (exam) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch questions & answers for both PG and Essay
            const [qResp, pgResp, aResp, pgAResp] = await Promise.all([
                axios.get(`/api/exam/soal-essay/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/soal-pg/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/jawaban/siswa/${effectiveSiswaId}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/jawaban-pg/siswa/${effectiveSiswaId}/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] }))
            ]);

            const pgQs = (pgResp.data || []).map(q => ({ ...q, qType: 'pg' }));
            const essayQs = (qResp.data || []).map(q => ({ ...q, qType: 'essay' }));
            const qs = [...pgQs, ...essayQs];

            const userEssayAnswers = (aResp.data || []).filter(a => essayQs.some(q => q.id === a.soalId));
            const userPgAnswers = pgAResp.data || [];

            const compiledList = qs.map((q, i) => {
                if (q.qType === 'pg') {
                    const ans = userPgAnswers.find(a => (a.soalId === q.id || a.soalPGId === q.id)) || {};
                    return {
                        no: i + 1,
                        qType: 'pg',
                        tipeSoal: q.tipeSoal,
                        pertanyaan: q.pertanyaan,
                        pilihanA: q.pilihanA,
                        pilihanB: q.pilihanB,
                        pilihanC: q.pilihanC,
                        pilihanD: q.pilihanD,
                        pilihanE: q.pilihanE,
                        kunciJawaban: q.kunciJawaban,
                        bobot: q.bobotNilai || 2,
                        jawabanSiswa: ans.jawaban || ans.jawabanDipilih || 'Tidak ada jawaban',
                        skorGuru: ans.skor !== null && ans.skor !== undefined ? ans.skor : 0,
                        saranAi: (ans.isCorrect || (ans.skor && ans.skor >= (q.bobotNilai || 2))) ? 'Benar (Otomatis)' : ((ans.skor && ans.skor > 0) ? `Benar Sebagian (${ans.skor} Poin)` : 'Salah (Otomatis)')
                    };
                } else {
                    const ans = userEssayAnswers.find(a => a.soalId === q.id) || {};
                    return {
                        no: i + 1,
                        qType: 'essay',
                        pertanyaan: q.pertanyaan,
                        bobot: q.bobotNilai || 10,
                        jawabanSiswa: ans.teksJawaban || 'Tidak ada jawaban',
                        skorGuru: ans.skorFinalGuru !== null && ans.skorFinalGuru !== undefined ? ans.skorFinalGuru : null,
                        saranAi: ans.alasanAi || 'Tidak ada catatan'
                    };
                }
            });

            let totalSkor = 0;
            let totalBobot = 0;
            let fullyGraded = true;
            compiledList.forEach(item => {
                totalBobot += (item.bobot || 1);
                if (item.skorGuru !== null) totalSkor += item.skorGuru;
                else fullyGraded = false;
            });
            const finalScore = totalBobot > 0 ? ((totalSkor / totalBobot) * 100).toFixed(1) : 0;

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
        if (e) e.preventDefault();
        const trimmedToken = tokenInput.trim().toUpperCase();
        if (!trimmedToken) {
            alert('Masukkan token ujian terlebih dahulu!');
            return;
        }
        setIsSubmitting(true);
        try {
            let deviceId = localStorage.getItem('deviceId');
            if (!deviceId) {
                deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now();
                localStorage.setItem('deviceId', deviceId);
            }

            const resp = await axios.post(`/api/exam/ujian-mapel/${showTokenOverlay.id}/validate-token?ujianToken=${trimmedToken}&deviceId=${deviceId}`, {}, { headers });
            if (resp.data === true) {
                const examToStart = showTokenOverlay;
                setShowTokenOverlay(null);
                startExam(examToStart);
            } else {
                alert('Token Ujian Salah! Silakan cek kembali token yang diberikan pengawas ujian.');
            }
        } catch (err) {
            if (err.response && err.response.data && typeof err.response.data === 'string') {
                alert(err.response.data);
            } else {
                alert('Gagal verifikasi token: ' + (err.response?.data?.message || 'Token Ujian Salah'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const startExam = async (exam) => {
        setLoading(true);
        try {
            if (!exam.isPractice && exam.id !== 'practice_default_simulasi') {
                let deviceId = localStorage.getItem('deviceId') || ('dev_' + Math.random().toString(36).substring(2) + Date.now());
                localStorage.setItem('deviceId', deviceId);
            }

            // Fetch both PG and Essay questions in parallel
            const [pgResp, essayResp] = await Promise.all([
                axios.get(`/api/exam/soal-pg/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/soal-essay/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] }))
            ]);

            const pgQuestions = (pgResp.data || []).map(q => {
                let resolvedTipe = (q.tipeSoal || '').toUpperCase().trim();
                const pertHtml = (q.pertanyaan || '').toLowerCase();
                const isBS = resolvedTipe === 'BENAR_SALAH' || (
                    q.pilihanA && q.pilihanB &&
                    (q.pilihanA.trim().toLowerCase() === 'benar' || q.pilihanA.trim().toLowerCase() === 'true') &&
                    (q.pilihanB.trim().toLowerCase() === 'salah' || q.pilihanB.trim().toLowerCase() === 'false') &&
                    (!q.pilihanC || q.pilihanC === '-' || q.pilihanC.trim() === '')
                );
                const hasComplexTextHint = pertHtml.includes('lebih dari') || 
                                          pertHtml.includes('kompleks') || 
                                          pertHtml.includes('pilih 2') ||
                                          pertHtml.includes('pilihan 2') ||
                                          pertHtml.includes('pilihlah 2') ||
                                          pertHtml.includes('pilih 3') ||
                                          pertHtml.includes('pilihan 3') ||
                                          pertHtml.includes('pilihlah 3') ||
                                          pertHtml.includes('pilih dua') ||
                                          pertHtml.includes('pilihlah dua') ||
                                          pertHtml.includes('pilih tiga') ||
                                          pertHtml.includes('pilihlah tiga') ||
                                          pertHtml.includes('jawaban benar lebih') ||
                                          pertHtml.includes('bisa lebih') ||
                                          pertHtml.includes('dapat lebih') ||
                                          pertHtml.includes('centang') ||
                                          pertHtml.includes('kotak centang') ||
                                          pertHtml.includes('checkbox') ||
                                          pertHtml.includes('multi');

                const isKompleks = !isBS && (
                    resolvedTipe.includes('KOMPLEKS') ||
                    (q.kunciJawaban && (q.kunciJawaban.includes(',') || q.kunciJawaban.includes(';') || q.kunciJawaban.trim().length > 1)) ||
                    hasComplexTextHint
                );

                if (isBS) resolvedTipe = 'BENAR_SALAH';
                else if (isKompleks) resolvedTipe = 'PG_KOMPLEKS';
                else resolvedTipe = 'PG_BIASA';

                return {
                    ...q,
                    qType: 'pg',
                    tipeSoal: resolvedTipe
                };
            });
            const essayQuestions = (essayResp.data || []).map(q => ({ ...q, qType: 'essay' }));
            const allQuestions = [...pgQuestions, ...essayQuestions];

            if (allQuestions.length === 0) {
                alert('Ujian ini belum memiliki soal!');
                setLoading(false);
                return;
            }

            allowExitFullscreenRef.current = false;
            enterFullscreen();
            setQuestions(allQuestions);
            setCurrentExam(exam);
            setCurrentIndex(0);
            const initialSeconds = (exam.sisaWaktuDetik !== undefined && exam.sisaWaktuDetik !== null)
                ? Math.max(0, exam.sisaWaktuDetik)
                : (exam.durasi ? exam.durasi * 60 : 0);
            setTimer(initialSeconds);

            // Initialize empty answers
            const initialAnswers = {};
            allQuestions.forEach(q => {
                initialAnswers[q.id] = '';
            });
            setAnswers(initialAnswers);

            // Fetch existing answers for both Essay and PG
            const [essayAnswersResp, pgAnswersResp] = await Promise.all([
                axios.get(`/api/exam/jawaban/siswa/${effectiveSiswaId}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/jawaban-pg/siswa/${effectiveSiswaId}/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] }))
            ]);

            const existingAnswers = {};
            const existingRagu = {};
            const existingWhiteboards = {};

            (essayAnswersResp.data || []).forEach(ans => {
                existingAnswers[ans.soalId] = ans.teksJawaban;
                existingRagu[ans.soalId] = ans.raguRagu;
                existingWhiteboards[ans.soalId] = ans.whiteboardData;
            });

            (pgAnswersResp.data || []).forEach(ans => {
                const sId = ans.soalPGId || ans.soalId;
                existingAnswers[sId] = ans.jawabanDipilih || ans.jawaban || '';
                existingRagu[sId] = ans.raguRagu;
            });

            answersRef.current = { ...initialAnswers, ...existingAnswers };
            setAnswers(prev => ({ ...prev, ...existingAnswers }));
            setRaguState(prev => ({ ...prev, ...existingRagu }));
            setWhiteboards(prev => ({ ...prev, ...existingWhiteboards }));

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

    // Timer Logic: Auto-send exam to server when time expires
    useEffect(() => {
        let interval = null;
        if (currentExam && currentExam.durasi > 0 && timer > 0) {
            interval = setInterval(() => {
                setTimer(prev => Math.max(0, prev - 1));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentExam, timer > 0]);

    useEffect(() => {
        if (currentExam && currentExam.durasi > 0 && timer === 0 && !isFinishingRef.current) {
            if (confirmFinishExamRef.current) {
                confirmFinishExamRef.current(true);
            }
        }
    }, [currentExam, timer]);

    const [isSaving, setIsSaving] = useState(false);

    const handleToggleComplexOption = (soalId, opt) => {
        const currentStr = answersRef.current[soalId] !== undefined ? answersRef.current[soalId] : (answers[soalId] || '');
        const currentKeys = currentStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        let newKeys;
        if (currentKeys.includes(opt)) {
            newKeys = currentKeys.filter(k => k !== opt);
        } else {
            newKeys = [...currentKeys, opt].sort();
        }
        const val = newKeys.join(',');
        answersRef.current[soalId] = val;
        setAnswers(prev => ({
            ...prev,
            [soalId]: val
        }));
        saveAnswerPG(soalId, val, raguState[soalId]);
    };

    const saveAnswerPG = async (soalId, selectedOption, isRagu = false) => {
        const effectiveSiswaId = user.profileId || user.userId || user.id;
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const payload = {
                soalId,
                soalPGId: soalId,
                siswaId: effectiveSiswaId,
                jawaban: selectedOption || '',
                jawabanDipilih: selectedOption || '',
                raguRagu: isRagu
            };
            await axios.post('/api/exam/jawaban-pg/submit', payload, { headers });
        } catch (err) {
            console.error('Auto-save PG failed', err);
        } finally {
            setIsSaving(false);
        }
    };

    const saveCurrentAnswer = (soalId, textOrChoice, isRagu, wbData) => {
        const q = questions.find(item => item.id === soalId);
        if (q?.qType === 'pg') {
            return saveAnswerPG(soalId, textOrChoice, isRagu);
        } else {
            return saveAnswer(soalId, textOrChoice, isRagu, wbData);
        }
    };

    const saveAnswer = async (soalId, text, isRagu = false, wbData = null) => {
        if (!effectiveSiswaId) return;
        setIsSaving(true);
        try {
            const payload = {
                soalId,
                siswaId: effectiveSiswaId,
                teksJawaban: text || '',
                raguRagu: isRagu,
                whiteboardData: wbData || whiteboards[soalId] || null
            };
            await axios.post('/api/exam/jawaban/submit', payload, { headers });
        } catch (err) {
            console.error('Auto-save failed');
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = () => {
        const q = questions[currentIndex];
        if (q && q.qType === 'essay') {
            saveAnswer(q.id, answersRef.current[q.id] || answers[q.id], raguState[q.id], whiteboards[q.id]);
        }
        setCurrentIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        const q = questions[currentIndex];
        if (q && q.qType === 'essay') {
            saveAnswer(q.id, answersRef.current[q.id] || answers[q.id], raguState[q.id], whiteboards[q.id]);
        }
        setCurrentIndex(prev => prev - 1);
    };

    const handleFinishExam = async () => {
        const q = questions[currentIndex];
        if (q) {
            await saveCurrentAnswer(q.id, answers[q.id], raguState[q.id], whiteboards[q.id]);
        }
        setShowFinishConfirm(true);
    };

    const toggleRagu = () => {
        const q = questions[currentIndex];
        if (!q) return;
        const newRagu = !raguState[q.id];
        setRaguState(prev => ({ ...prev, [q.id]: newRagu }));
        saveCurrentAnswer(q.id, answers[q.id], newRagu, whiteboards[q.id]);
    };

    const confirmFinishExam = async (forced = false) => {
        if (isFinishingRef.current) return;
        isFinishingRef.current = true;
        setLoading(true);
        setShowFinishConfirm(false);

        try {
            // 1. Flush answer for currently active question
            const currentQ = questions[currentIndex];
            if (currentQ) {
                const currentAns = answersRef.current[currentQ.id] !== undefined ? answersRef.current[currentQ.id] : answers[currentQ.id];
                if (currentQ.qType === 'pg') {
                    if (currentAns !== undefined && currentAns !== null && currentAns !== '') {
                        await saveAnswerPG(currentQ.id, currentAns, raguState[currentQ.id]).catch(() => {});
                    }
                } else if (currentQ.qType === 'essay') {
                    await saveAnswer(currentQ.id, currentAns || '', raguState[currentQ.id], whiteboards[currentQ.id]).catch(() => {});
                }
            }

            // 2. Safety flush all PG answers before marking finished
            const pgQuestionsToSave = questions.filter(q => q.qType === 'pg');
            if (pgQuestionsToSave.length > 0) {
                await Promise.all(pgQuestionsToSave.map(q => {
                    const ansVal = answersRef.current[q.id] !== undefined ? answersRef.current[q.id] : answers[q.id];
                    if (ansVal !== undefined && ansVal !== null && ansVal !== '') {
                        return saveAnswerPG(q.id, ansVal, raguState[q.id]);
                    }
                    return Promise.resolve();
                }));
            }

            // 3. Mark exam as finished on server (auto-grading is triggered on server)
            await axios.post(`/api/exam/ujian-mapel/${currentExam.id}/finish`, {}, { headers });

            // 4. Save finished state locally as backup
            const finishedExams = JSON.parse(localStorage.getItem('finishedExams') || '{}');
            finishedExams[`${user.profileId}_${currentExam.id}`] = true;
            localStorage.setItem('finishedExams', JSON.stringify(finishedExams));

            // 5. Release fullscreen
            allowExitFullscreenRef.current = true;
            exitFullscreenManually();

            if (currentExam.keepAliveInterval) clearInterval(currentExam.keepAliveInterval);

            // 6. Close exam view immediately
            setCurrentExam(null);
            setQuestions([]);
            setShowFinishConfirm(false);
            setShowTokenOverlay(null);

            // 7. Refresh list
            await fetchEvents();

            // 8. Inform student
            if (forced) {
                alert('⏱️ Waktu ujian telah habis! Seluruh jawaban Anda telah otomatis tersimpan dan dikirimkan ke server.');
            } else {
                alert('Ujian Selesai! Jawaban Anda telah tersimpan dan akan segera dinilai oleh sistem & Guru.');
            }
        } catch (err) {
            console.error('Finish exam error:', err);
            allowExitFullscreenRef.current = true;
            exitFullscreenManually();
            if (forced) {
                setCurrentExam(null);
                setQuestions([]);
                alert('⏱️ Waktu ujian telah habis. Jawaban Anda telah direkam di server.');
                fetchEvents();
            } else {
                alert('Gagal menyelesaikan ujian ke server. Hubungi pengawas!');
            }
        } finally {
            setLoading(false);
            isFinishingRef.current = false;
        }
    };
    confirmFinishExamRef.current = confirmFinishExam;

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
            <div className="cbt-layout" onClick={() => { if (!allowExitFullscreenRef.current && !document.fullscreenElement) enterFullscreen(); }}>

                <header className="cbt-header">
                    <div className="cbt-header-left">
                        <div className="cbt-logo-circle">
                            <BookOpen size={22} color="#1d4ed8" />
                        </div>
                        <div className="cbt-title">
                            <strong>{currentExam?.namaMapel || 'Ujian CBT BaknusClass'}</strong>
                            <span>{currentExam?.namaEvent || 'SMK Bakti Nusantara 666'}</span>
                        </div>
                    </div>
                    <div className="cbt-header-right">
                        <div className="cbt-userinfo">
                            <div className="cbt-user-icon"><User size={16} /></div>
                            <span>{user.name}</span>
                        </div>
                    </div>
                </header>

                <div className="cbt-body">
                    <aside className={`cbt-sidebar ${showNav ? 'mobile-open' : ''}`}>
                        <div className="sidebar-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LayoutGrid size={18} />
                                <span>Nomor Soal</span>
                            </div>
                            <button
                                type="button"
                                className="sidebar-close-mobile"
                                onClick={() => setShowNav(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
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
                                        onClick={() => { setCurrentIndex(idx); setShowNav(false); }}
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
                    {showNav && <div className="cbt-sidebar-backdrop" onClick={() => setShowNav(false)}></div>}

                    <main className="cbt-main">
                        <div className="cbt-container">
                            <div className="cbt-topbar">
                                <div className="cbt-topbar-left">
                                    <div className="cbt-soal-number" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div>Soal Nomor <strong>{currentIndex + 1}</strong></div>
                                        <span className={`cbt-badge-type ${
                                            q?.qType === 'pg'
                                                ? (q.tipeSoal === 'BENAR_SALAH' ? 'badge-tf' : q.tipeSoal === 'BS_MAJEMUK' ? 'badge-bs-majemuk' : q.tipeSoal === 'PG_KOMPLEKS' ? 'badge-complex' : 'badge-pg')
                                                : 'badge-essay'
                                        }`}>
                                            {q?.qType === 'pg'
                                                ? (q.tipeSoal === 'BENAR_SALAH' ? '⚖️ Benar / Salah (1 Opsi)' : q.tipeSoal === 'BS_MAJEMUK' ? '📊 Tabel Benar / Salah (Poin per Butir)' : q.tipeSoal === 'PG_KOMPLEKS' ? '☑️ PG Kompleks (Multi Jawaban Benar)' : '🔘 Pilihan Ganda (1 Jawaban Benar)')
                                                : '📝 Soal Essay / Uraian'}
                                        </span>
                                    </div>
                                    <div className="cbt-font-controls">
                                        Ukuran font soal:
                                        <span className={`font-small ${fontSizeScale === 1 ? 'active-font' : ''}`} onClick={() => setFontSizeScale(1)}>A</span>
                                        <span className={`font-medium ${fontSizeScale === 2 ? 'active-font' : ''}`} onClick={() => setFontSizeScale(2)}>A</span>
                                        <span className={`font-large ${fontSizeScale === 3 ? 'active-font' : ''}`} onClick={() => setFontSizeScale(3)}>A</span>
                                    </div>
                                </div>

                                <div className="cbt-topbar-center">
                                    <button type="button" className="cbt-info-btn" onClick={() => setShowQuestionInfoModal(true)}>INFORMASI SOAL</button>
                                </div>

                                <div className="cbt-topbar-right">
                                    <div className={`cbt-timer ${(currentExam?.durasi > 0 && timer < 300) ? 'cbt-timer-urgent' : ''} ${currentExam?.durasi === 0 ? 'cbt-timer-unlimited' : ''}`}>
                                        {currentExam?.durasi === 0 ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Sparkles size={14} color="#0284c7" />
                                                <strong>Tanpa Batas Waktu</strong>
                                                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(Mode Latihan)</span>
                                            </span>
                                        ) : (
                                            <span>Sisa Waktu: {formatTime(timer)}</span>
                                        )}
                                    </div>
                                    <button className="cbt-nav-toggle-btn" onClick={() => setShowNav(true)}>
                                        Daftar Soal
                                        <LayoutGrid size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="cbt-content-area">
                                <div className="cbt-question-box">
                                    {/* Banner Keterangan Format & Petunjuk Soal untuk Siswa */}
                                    <div className={`cbt-soal-instruction-banner ${
                                        q?.qType === 'pg'
                                            ? (q.tipeSoal === 'BENAR_SALAH' ? 'banner-tf' : q.tipeSoal === 'BS_MAJEMUK' ? 'banner-bs-majemuk' : q.tipeSoal === 'PG_KOMPLEKS' ? 'banner-kompleks' : 'banner-pg')
                                            : 'banner-essay'
                                    }`}>
                                        <div className="csi-icon">
                                            {q?.qType === 'pg' ? (
                                                q.tipeSoal === 'BENAR_SALAH' ? '⚖️' :
                                                q.tipeSoal === 'BS_MAJEMUK' ? '📊' :
                                                q.tipeSoal === 'PG_KOMPLEKS' ? '☑️' : '🔘'
                                            ) : '📝'}
                                        </div>
                                        <div className="csi-content">
                                            <div className="csi-title">
                                                {q?.qType === 'pg' ? (
                                                    q.tipeSoal === 'BENAR_SALAH'
                                                        ? 'Soal Pernyataan: Benar atau Salah'
                                                        : q.tipeSoal === 'BS_MAJEMUK'
                                                            ? 'Soal Tabel Pernyataan: Benar atau Salah (Poin per Butir)'
                                                            : q.tipeSoal === 'PG_KOMPLEKS'
                                                                ? 'Soal Pilihan Ganda Kompleks (Bisa 2 atau Lebih Jawaban Benar)'
                                                                : 'Soal Pilihan Ganda (1 Jawaban Benar)'
                                                ) : 'Soal Essay / Uraian Terbuka'}
                                            </div>
                                            <div className="csi-desc">
                                                {q?.qType === 'pg' ? (
                                                    q.tipeSoal === 'BENAR_SALAH'
                                                        ? 'Tentukan apakah pernyataan pada soal ini Benar atau Salah. Pilih salah satu tombol di bawah.'
                                                        : q.tipeSoal === 'BS_MAJEMUK'
                                                            ? 'Tentukan Benar atau Salah pada setiap butir pernyataan di dalam tabel. Setiap jawaban yang tepat mendapatkan poin mandiri.'
                                                            : q.tipeSoal === 'PG_KOMPLEKS'
                                                                ? 'Soal ini memiliki lebih dari 1 pilihan jawaban yang benar (misal: 2 pilihan benar atau lebih). Centang semua pilihan yang kamu anggap benar!'
                                                                : 'Pilihlah salah satu jawaban yang paling tepat dari pilihan A sampai E di bawah.'
                                                ) : 'Tuliskan uraian atau penjelasan lengkap jawaban Anda pada kolom jawaban di bawah ini.'}
                                            </div>
                                        </div>
                                        <div className="csi-chip">
                                            {q?.qType === 'pg' ? (
                                                q.tipeSoal === 'BENAR_SALAH' ? '1 Opsi Benar/Salah' :
                                                q.tipeSoal === 'BS_MAJEMUK' ? 'Nilai per Butir' :
                                                q.tipeSoal === 'PG_KOMPLEKS' ? 'Bisa >1 Jawaban' : 'Pilih 1 Jawaban'
                                            ) : 'Teks Terbuka'}
                                        </div>
                                    </div>

                                    <div
                                        className={`cbt-question-text ${fontClass}`}
                                        onClick={(e) => {
                                            if (e.target.tagName === 'IMG') {
                                                setEnlargedImg(e.target.src);
                                            }
                                        }}
                                        dangerouslySetInnerHTML={{ __html: q?.pertanyaan }}
                                    ></div>

                                    <div className="cbt-answer-area">
                                        {q?.qType === 'pg' ? (
                                            <div className="cbt-pg-answer-container">
                                                {/* TIPE 1: KHUSUS SOAL BENAR / SALAH (DESAIN EKSKLUSIF BUKAN PILIHAN GANDA BIASA) */}
                                                {q.tipeSoal === 'BENAR_SALAH' ? (
                                                    <div className="cbt-tf-decision-container">
                                                        <div className="cbt-tf-header-guide">
                                                            <div className="tf-guide-icon">⚖️</div>
                                                            <div className="tf-guide-text">
                                                                <strong>Keputusan Pernyataan: Benar atau Salah</strong>
                                                                <p>Telaah pernyataan di atas secara saksama, lalu klik salah satu kartu keputusan di bawah:</p>
                                                            </div>
                                                        </div>

                                                        <div className="cbt-tf-decision-cards">
                                                            {/* Kartu Keputusan: BENAR */}
                                                            <button
                                                                type="button"
                                                                className={`tf-decision-card card-true ${(answers[q.id] === 'A' || answers[q.id] === 'Benar') ? 'selected-true' : ''}`}
                                                                onClick={() => {
                                                                    const val = 'A';
                                                                    answersRef.current[q.id] = val;
                                                                    setAnswers(prev => ({ ...prev, [q.id]: val }));
                                                                    saveAnswerPG(q.id, val, raguState[q.id]);
                                                                }}
                                                            >
                                                                <div className="tf-card-icon-wrapper true-icon">
                                                                    <CheckCircle2 size={36} />
                                                                </div>
                                                                <div className="tf-card-info">
                                                                    <span className="tf-card-title">BENAR</span>
                                                                    <span className="tf-card-subtitle">Pernyataan pada soal ini tepat & sesuai fakta</span>
                                                                </div>
                                                                {(answers[q.id] === 'A' || answers[q.id] === 'Benar') ? (
                                                                    <div className="tf-choice-badge chosen-true">
                                                                        <Check size={16} strokeWidth={3} /> Pilihan Anda
                                                                    </div>
                                                                ) : (
                                                                    <div className="tf-choice-prompt">Klik Jika Benar</div>
                                                                )}
                                                            </button>

                                                            {/* Kartu Keputusan: SALAH */}
                                                            <button
                                                                type="button"
                                                                className={`tf-decision-card card-false ${(answers[q.id] === 'B' || answers[q.id] === 'Salah') ? 'selected-false' : ''}`}
                                                                onClick={() => {
                                                                    const val = 'B';
                                                                    answersRef.current[q.id] = val;
                                                                    setAnswers(prev => ({ ...prev, [q.id]: val }));
                                                                    saveAnswerPG(q.id, val, raguState[q.id]);
                                                                }}
                                                            >
                                                                <div className="tf-card-icon-wrapper false-icon">
                                                                    <XCircle size={36} />
                                                                </div>
                                                                <div className="tf-card-info">
                                                                    <span className="tf-card-title">SALAH</span>
                                                                    <span className="tf-card-subtitle">Pernyataan pada soal ini tidak tepat / keliru</span>
                                                                </div>
                                                                {(answers[q.id] === 'B' || answers[q.id] === 'Salah') ? (
                                                                    <div className="tf-choice-badge chosen-false">
                                                                        <Check size={16} strokeWidth={3} /> Pilihan Anda
                                                                    </div>
                                                                ) : (
                                                                    <div className="tf-choice-prompt">Klik Jika Salah</div>
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* Status Bar Keputusan */}
                                                        <div className="tf-status-bar">
                                                            {(answers[q.id] === 'A' || answers[q.id] === 'Benar') ? (
                                                                <div className="tf-status-msg is-true">
                                                                    <CheckCircle2 size={16} /> Anda memutuskan: <strong>PERNYATAAN BENAR</strong> (Tersimpan otomatis)
                                                                </div>
                                                            ) : (answers[q.id] === 'B' || answers[q.id] === 'Salah') ? (
                                                                <div className="tf-status-msg is-false">
                                                                    <XCircle size={16} /> Anda memutuskan: <strong>PERNYATAAN SALAH</strong> (Tersimpan otomatis)
                                                                </div>
                                                            ) : (
                                                                <div className="tf-status-msg is-empty">
                                                                    <AlertCircle size={16} /> Anda belum memilih. Silakan klik kartu <b>BENAR</b> atau <b>SALAH</b> di atas.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : q.tipeSoal === 'BS_MAJEMUK' ? (
                                                    /* TIPE KHUSUS: TABEL BENAR / SALAH (BS MAJEMUK DENGAN POIN PER BUTIR) */
                                                    <div className="cbt-bs-majemuk-container">
                                                        <div className="bs-majemuk-table-wrap">
                                                            <table className="cbt-matrix-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                                                                        <th>Pernyataan</th>
                                                                        <th style={{ width: '130px', textAlign: 'center' }}>Benar</th>
                                                                        <th style={{ width: '130px', textAlign: 'center' }}>Salah</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {['A', 'B', 'C', 'D', 'E'].map((opt, idx) => {
                                                                        const stmtText = q[`pilihan${opt}`];
                                                                        if (!stmtText || stmtText === '-') return null;

                                                                        const rawAns = answers[q.id] || '';
                                                                        const chosenList = rawAns.split(',');
                                                                        const currentChoice = (chosenList[idx] || '').trim().toUpperCase();

                                                                        return (
                                                                            <tr key={opt} className={`matrix-row ${currentChoice ? 'row-answered' : ''}`}>
                                                                                <td className="matrix-cell-num">{idx + 1}</td>
                                                                                <td className="matrix-cell-text" dangerouslySetInnerHTML={{ __html: stmtText }}></td>
                                                                                <td className="matrix-cell-choice">
                                                                                    <button
                                                                                        type="button"
                                                                                        className={`btn-matrix-choice choice-true ${currentChoice === 'B' ? 'selected' : ''}`}
                                                                                        onClick={() => {
                                                                                            const totalOpts = ['A', 'B', 'C', 'D', 'E'].filter(o => q[`pilihan${o}`] && q[`pilihan${o}`] !== '-').length;
                                                                                            const arr = chosenList.slice(0, totalOpts);
                                                                                            while (arr.length < totalOpts) arr.push('');
                                                                                            arr[idx] = 'B';
                                                                                            const newAns = arr.join(',');
                                                                                            answersRef.current[q.id] = newAns;
                                                                                            setAnswers(prev => ({ ...prev, [q.id]: newAns }));
                                                                                            saveAnswerPG(q.id, newAns, raguState[q.id]);
                                                                                        }}
                                                                                    >
                                                                                        <CheckCircle2 size={16} />
                                                                                        <span>BENAR</span>
                                                                                    </button>
                                                                                </td>
                                                                                <td className="matrix-cell-choice">
                                                                                    <button
                                                                                        type="button"
                                                                                        className={`btn-matrix-choice choice-false ${currentChoice === 'S' ? 'selected' : ''}`}
                                                                                        onClick={() => {
                                                                                            const totalOpts = ['A', 'B', 'C', 'D', 'E'].filter(o => q[`pilihan${o}`] && q[`pilihan${o}`] !== '-').length;
                                                                                            const arr = chosenList.slice(0, totalOpts);
                                                                                            while (arr.length < totalOpts) arr.push('');
                                                                                            arr[idx] = 'S';
                                                                                            const newAns = arr.join(',');
                                                                                            answersRef.current[q.id] = newAns;
                                                                                            setAnswers(prev => ({ ...prev, [q.id]: newAns }));
                                                                                            saveAnswerPG(q.id, newAns, raguState[q.id]);
                                                                                        }}
                                                                                    >
                                                                                        <XCircle size={16} />
                                                                                        <span>SALAH</span>
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Status Bar Pengerjaan Tabel */}
                                                        {(() => {
                                                            const totalStmts = ['A', 'B', 'C', 'D', 'E'].filter(o => q[`pilihan${o}`] && q[`pilihan${o}`] !== '-').length;
                                                            const rawAns = answers[q.id] || '';
                                                            const chosenList = rawAns.split(',').filter(x => x && x.trim() !== '');
                                                            const answeredCount = chosenList.length;
                                                            const isComplete = answeredCount === totalStmts;

                                                            return (
                                                                <div className="tf-status-bar" style={{ marginTop: '16px' }}>
                                                                    {isComplete ? (
                                                                        <div className="tf-status-msg is-true">
                                                                            <CheckCircle2 size={16} /> Seluruh {totalStmts} butir pernyataan telah Anda jawab (Tersimpan otomatis)
                                                                        </div>
                                                                    ) : answeredCount > 0 ? (
                                                                        <div className="tf-status-msg" style={{ color: '#0284c7', background: '#eff6ff' }}>
                                                                            <Clock size={16} /> Terjawab {answeredCount} dari {totalStmts} butir. Masih ada {totalStmts - answeredCount} butir belum dipilih.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="tf-status-msg is-empty">
                                                                            <AlertCircle size={16} /> Silakan tentukan Benar atau Salah pada setiap baris pernyataan di atas.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : q.tipeSoal === 'PG_KOMPLEKS' ? (
                                                    /* TIPE 2: PILIHAN GANDA KOMPLEKS (BISA >1 JAWABAN BENAR DENGAN CHECKBOXES) */
                                                    <div className="cbt-complex-options">
                                                        <div className="cbt-pg-tip-box complex-tip">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <CheckSquare size={18} />
                                                                <span><strong>Soal Pilihan Ganda Kompleks:</strong> Centang semua opsi yang menurutmu benar (bisa 2 atau lebih jawaban).</span>
                                                            </div>
                                                            <div className="cbt-complex-pill">
                                                                {((answers[q.id] || '').split(',').filter(Boolean).length)} Opsi Terpilih
                                                            </div>
                                                        </div>
                                                        <div className="cbt-opt-list">
                                                            {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                                const optText = q[`pilihan${opt}`];
                                                                if (!optText || optText === '-') return null;
                                                                const currentKeys = (answers[q.id] || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                                                const isChecked = currentKeys.includes(opt);

                                                                return (
                                                                    <div
                                                                        key={opt}
                                                                        className={`cbt-opt-row complex-row ${isChecked ? 'selected' : ''}`}
                                                                        onClick={() => handleToggleComplexOption(q.id, opt)}
                                                                    >
                                                                        <div className={`cbt-checkbox-box ${isChecked ? 'checked' : ''}`}>
                                                                            {isChecked ? <Check size={18} strokeWidth={3} /> : null}
                                                                        </div>
                                                                        <div className="cbt-opt-letter-tag">{opt}</div>
                                                                        <div
                                                                            className={`cbt-opt-text ${fontClass}`}
                                                                            dangerouslySetInnerHTML={{ __html: optText }}
                                                                            onClick={(e) => {
                                                                                if (e.target.tagName === 'IMG') {
                                                                                    e.stopPropagation();
                                                                                    setEnlargedImg(e.target.src);
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* TIPE 3: PILIHAN GANDA BIASA (1 KUNCI DENGAN RADIO BUTTON) */
                                                    <div className="cbt-single-options">
                                                        <div className="cbt-pg-tip-box single-tip">
                                                            <CheckCircle size={18} />
                                                            <span><strong>Pilihan Ganda Tunggal:</strong> Pilihlah salah satu jawaban yang paling tepat (1 jawaban).</span>
                                                        </div>
                                                        <div className="cbt-opt-list">
                                                            {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                                const optText = q[`pilihan${opt}`];
                                                                if (!optText || optText === '-') return null;
                                                                const isSelected = answers[q.id] === opt;

                                                                return (
                                                                    <div
                                                                        key={opt}
                                                                        className={`cbt-opt-row single-row ${isSelected ? 'selected' : ''}`}
                                                                        onClick={() => {
                                                                            answersRef.current[q.id] = opt;
                                                                            setAnswers(prev => ({ ...prev, [q.id]: opt }));
                                                                            saveAnswerPG(q.id, opt, raguState[q.id]);
                                                                        }}
                                                                    >
                                                                        <div className={`cbt-opt-radio ${isSelected ? 'selected' : ''}`}>
                                                                            {opt}
                                                                        </div>
                                                                        <div
                                                                            className={`cbt-opt-text ${fontClass}`}
                                                                            dangerouslySetInnerHTML={{ __html: optText }}
                                                                            onClick={(e) => {
                                                                                if (e.target.tagName === 'IMG') {
                                                                                    e.stopPropagation();
                                                                                    setEnlargedImg(e.target.src);
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="cbt-save-indicator" style={{ marginTop: '20px' }}>
                                                    <Clock size={12} className={isSaving ? 'animate-spin' : ''} />
                                                    {isSaving ? 'Sedang menyimpan draft otomatis...' : 'Jawaban tersimpan di server'}
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <h3 className="cbt-instruction" style={{ margin: 0 }}>Ketikkan jawabanmu!</h3>
                                                    <button
                                                        onClick={() => setShowWhiteboard({ ...showWhiteboard, [q.id]: !showWhiteboard[q.id] })}
                                                        style={{ background: showWhiteboard[q.id] ? '#ef4444' : '#1e88e5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                    >
                                                        <Brush size={16} /> {showWhiteboard[q.id] ? 'Tutup Whiteboard' : 'Buka Whiteboard Corat-coret'}
                                                    </button>
                                                </div>

                                                {showWhiteboard[q?.id] && (
                                                    <Whiteboard
                                                        initialData={whiteboards[q?.id]}
                                                        onSave={(data) => {
                                                            setWhiteboards({ ...whiteboards, [q.id]: data });
                                                            saveAnswer(q.id, answers[q.id], raguState[q.id], data);
                                                        }}
                                                        onClear={() => {
                                                            setWhiteboards({ ...whiteboards, [q.id]: null });
                                                            saveAnswer(q.id, answers[q.id], raguState[q.id], null);
                                                        }}
                                                    />
                                                )}

                                                <textarea
                                                    className={fontClass}
                                                    value={answers[q?.id] || ''}
                                                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                                    placeholder="Ketik jawaban Anda di sini..."
                                                    rows={showWhiteboard[q.id] ? 4 : 8}
                                                    style={{ marginTop: showWhiteboard[q.id] ? '16px' : '0' }}
                                                />
                                                <div className="cbt-save-indicator">
                                                    <Clock size={12} className={isSaving ? 'animate-spin' : ''} />
                                                    {isSaving ? 'Sedang menyimpan draft otomatis...' : 'Jawaban tersimpan di memori server'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="cbt-footer">
                                <button className="cbt-footer-btn cbt-btn-prev" disabled={currentIndex === 0} onClick={handlePrev} title="Soal sebelumnya">
                                    <div className="icon-circle"><ChevronLeft size={16} strokeWidth={2.5} /></div>
                                    <span>Soal Sebelumnya</span>
                                </button>

                                <button className={`cbt-footer-btn cbt-btn-ragu ${raguState[q?.id] ? 'active' : ''}`} onClick={toggleRagu} title="Tandai ragu-ragu">
                                    <div className={`checkbox-square ${raguState[q?.id] ? 'checked' : ''}`}></div>
                                    <span>{raguState[q?.id] ? 'Batal Ragu' : 'Ragu - Ragu'}</span>
                                </button>

                                {currentIndex === questions.length - 1 ? (
                                    <button className="cbt-footer-btn cbt-btn-next finish" onClick={handleFinishExam} title="Selesai dan kirim jawaban">
                                        <span>Selesai Ujian</span>
                                        <div className="icon-circle"><Check size={16} strokeWidth={2.5} /></div>
                                    </button>
                                ) : (
                                    <button className="cbt-footer-btn cbt-btn-next" onClick={handleNext} title="Soal berikutnya">
                                        <span>Soal Berikutnya</span>
                                        <div className="icon-circle"><ChevronRight size={16} strokeWidth={2.5} /></div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </main>
                </div>


                {/* Modal Hasil Latihan & Pembahasan */}
                {showPracticeResult && practiceResult && (
                    <div className="modal-overlay">
                        <div className="modal-content practice-result-modal">
                            <div className="practice-modal-header">
                                <div className="practice-score-circle">
                                    <span className="score-num">{practiceResult.totalScore}</span>
                                    <span className="score-max">/ {practiceResult.maxScore}</span>
                                </div>
                                <h2>Hasil Latihan & Uji Coba CBT</h2>
                                <p>Hebat! Anda telah mencoba seluruh tipe soal CBT BaknusClass. Berikut ulasan jawaban Anda:</p>
                            </div>

                            <div className="practice-review-list">
                                {practiceResult.reviewDetails.map((item, idx) => (
                                    <div key={item.id || idx} className={`review-card ${item.isCorrect ? 'is-correct' : 'is-wrong'}`}>
                                        <div className="review-card-head">
                                            <span className="review-q-num">Soal #{idx + 1}</span>
                                            <span className="review-q-type">
                                                {item.tipeSoal === 'BENAR_SALAH' ? 'Benar / Salah' : item.tipeSoal === 'PG_KOMPLEKS' ? 'PG Kompleks' : item.qType === 'pg' ? 'Pilihan Ganda' : 'Essay + Whiteboard'}
                                            </span>
                                            <span className={`review-status ${item.isCorrect ? 'text-green' : 'text-orange'}`}>
                                                {item.isCorrect ? '✅ Tepat / Dijawab' : '❌ Perlu Diperbaiki'} (+{item.scoreEarned} Poin)
                                            </span>
                                        </div>
                                        <div className="review-pertanyaan" dangerouslySetInnerHTML={{ __html: item.pertanyaan }}></div>
                                        <div className="review-ans-grid">
                                            <div className="review-ans-box user">
                                                <label>Jawaban Anda:</label>
                                                <span>{item.jawabanSiswa || '(Tidak dijawab)'}</span>
                                            </div>
                                            <div className="review-ans-box key">
                                                <label>Kunci Jawaban:</label>
                                                <span>{item.kunciJawaban}</span>
                                            </div>
                                        </div>
                                        {item.pembahasan && (
                                            <div className="review-pembahasan">
                                                <strong>💡 Pembahasan:</strong> {item.pembahasan}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="practice-modal-actions">
                                <button className="btn-retry-practice" onClick={handleStartPractice}>
                                    <RotateCcw size={16} /> Coba Latihan Lagi
                                </button>
                                <button className="btn-close-practice" onClick={() => setShowPracticeResult(false)}>
                                    <Check size={16} /> Tutup & Kembali
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Informasi Detail Soal */}
                {showQuestionInfoModal && q && (
                    <div className="modal-overlay" style={{ zIndex: 9999 }}>
                        <div className="modal-content" style={{ maxWidth: '520px', borderRadius: '20px', padding: '28px', background: 'var(--card-bg, #ffffff)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: '#eff6ff', color: '#2563eb', padding: '10px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <BookOpen size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Informasi Soal #{currentIndex + 1}</h3>
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{currentExam?.namaMapel}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowQuestionInfoModal(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                                >
                                    <X size={22} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Tipe / Format Soal</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                                        {q.qType === 'pg'
                                            ? (q.tipeSoal === 'BENAR_SALAH'
                                                ? '⚖️ Pernyataan Benar atau Salah (1 Pilihan)'
                                                : q.tipeSoal === 'PG_KOMPLEKS'
                                                    ? '☑️ Pilihan Ganda Kompleks (Bisa >1 Jawaban Benar)'
                                                    : '🔘 Pilihan Ganda Biasa (1 Jawaban Benar)')
                                            : '📝 Soal Essay / Uraian Terbuka'}
                                    </div>
                                </div>

                                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Petunjuk Pengerjaan</div>
                                    <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                                        {q.qType === 'pg'
                                            ? (q.tipeSoal === 'BENAR_SALAH'
                                                ? 'Baca pernyataan pada soal dengan cermat, lalu pilih tombol BENAR jika pernyataan sesuai, atau SALAH jika pernyataan tidak sesuai.'
                                                : q.tipeSoal === 'PG_KOMPLEKS'
                                                    ? 'Klik pada opsi jawaban (A sampai E) untuk memilih. Soal ini memiliki lebih dari 1 pilihan benar (misalnya 2 atau 3 opsi benar). Anda dapat memilih beberapa opsi sekaligus.'
                                                    : 'Klik salah satu opsi (A sampai E) yang Anda anggap paling tepat. Hanya 1 pilihan yang dapat dipilih.')
                                            : 'Ketik uraian atau penjelasan lengkap jawaban Anda pada area teks. Anda juga dapat menggunakan papan gambar/coretan (Whiteboard) jika diperlukan rumus/diagram.'}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: '14px', border: '1.5px solid #bbf7d0' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 800 }}>BOBOT SOAL</div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#15803d' }}>{q.bobotNilai || 2} Poin</div>
                                    </div>
                                    <div style={{ background: (answers[q.id] && String(answers[q.id]).trim() !== '') ? '#eff6ff' : '#fff1f2', padding: '12px 14px', borderRadius: '14px', border: (answers[q.id] && String(answers[q.id]).trim() !== '') ? '1.5px solid #bfdbfe' : '1.5px solid #fecaca' }}>
                                        <div style={{ fontSize: '0.75rem', color: (answers[q.id] && String(answers[q.id]).trim() !== '') ? '#1e40af' : '#991b1b', fontWeight: 800 }}>STATUS JAWABAN</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: (answers[q.id] && String(answers[q.id]).trim() !== '') ? '#1d4ed8' : '#b91c1c' }}>
                                            {(answers[q.id] && String(answers[q.id]).trim() !== '') ? '✅ Sudah Terisi' : '⚠️ Belum Diisi'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowQuestionInfoModal(false)}
                                style={{ width: '100%', padding: '12px', borderRadius: '14px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}
                            >
                                Kembali Kerjakan Soal
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Zoom Gambar Soal untuk Siswa */}
            {enlargedImg && (
                <div
                    className="img-lightbox-backdrop"
                    onClick={() => setEnlargedImg(null)}
                    style={{ zIndex: 99999 }}
                >
                    <div className="img-lightbox-wrapper" onClick={(e) => e.stopPropagation()}>
                        <div className="img-lightbox-header">
                            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Lihat Detail Gambar Soal</span>
                            <button
                                type="button"
                                className="img-lightbox-close"
                                onClick={() => setEnlargedImg(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="img-lightbox-content">
                            <img src={enlargedImg} alt="Detail Gambar Soal" />
                        </div>
                    </div>
                </div>
            )}

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
                    
                    
                    /* Instruction Banner di Atas Soal untuk Siswa */
                    .cbt-soal-instruction-banner {
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 12px 18px;
                        border-radius: 14px;
                        margin-bottom: 20px;
                        border: 1.5px solid transparent;
                        animation: fadeIn 0.25s ease;
                    }
                    .cbt-soal-instruction-banner.banner-pg {
                        background: #eff6ff;
                        border-color: #bfdbfe;
                        color: #1e40af;
                    }
                    .cbt-soal-instruction-banner.banner-kompleks {
                        background: #f5f3ff;
                        border-color: #ddd6fe;
                        color: #5b21b6;
                    }
                    .cbt-soal-instruction-banner.banner-tf {
                        background: #fffbeb;
                        border-color: #fde68a;
                        color: #92400e;
                    }
                    .cbt-soal-instruction-banner.banner-essay {
                        background: #f0fdf4;
                        border-color: #bbf7d0;
                        color: #166534;
                    }
                    .csi-icon {
                        font-size: 1.6rem;
                        line-height: 1;
                        flex-shrink: 0;
                    }
                    .csi-content {
                        flex: 1;
                    }
                    .csi-title {
                        font-weight: 800;
                        font-size: 0.95rem;
                        margin-bottom: 2px;
                    }
                    .csi-desc {
                        font-size: 0.83rem;
                        line-height: 1.4;
                        opacity: 0.9;
                    }
                    .csi-chip {
                        padding: 4px 12px;
                        border-radius: 9999px;
                        font-size: 0.75rem;
                        font-weight: 800;
                        background: rgba(255, 255, 255, 0.85);
                        white-space: nowrap;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.06);
                        flex-shrink: 0;
                    }
                    /* Dark Mode overrides */
                    body.dark-theme .cbt-soal-instruction-banner.banner-pg,
                    .dark .cbt-soal-instruction-banner.banner-pg {
                        background: rgba(30, 58, 138, 0.35);
                        border-color: #1d4ed8;
                        color: #93c5fd;
                    }
                    body.dark-theme .cbt-soal-instruction-banner.banner-kompleks,
                    .dark .cbt-soal-instruction-banner.banner-kompleks {
                        background: rgba(88, 28, 135, 0.35);
                        border-color: #7c3aed;
                        color: #c4b5fd;
                    }
                    body.dark-theme .cbt-soal-instruction-banner.banner-tf,
                    .dark .cbt-soal-instruction-banner.banner-tf {
                        background: rgba(120, 53, 15, 0.35);
                        border-color: #d97706;
                        color: #fde68a;
                    }
                    body.dark-theme .cbt-soal-instruction-banner.banner-essay,
                    .dark .cbt-soal-instruction-banner.banner-essay {
                        background: rgba(20, 83, 45, 0.35);
                        border-color: #16a34a;
                        color: #86efac;
                    }
                    body.dark-theme .csi-chip,
                    .dark .csi-chip {
                        background: rgba(15, 23, 42, 0.85);
                        color: inherit;
                    }
                    
                    /* CBT Question Image Styling */
                    .cbt-question-text img {
                        max-width: 100%;
                        max-height: 420px;
                        object-fit: contain;
                        border-radius: 14px;
                        margin: 16px auto;
                        display: block;
                        border: 1.5px solid #e2e8f0;
                        background: #ffffff;
                        padding: 6px;
                        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
                        cursor: zoom-in;
                        transition: transform 0.2s;
                    }
                    .cbt-question-text img:hover {
                        transform: scale(1.01);
                    }
                    body.dark-theme .cbt-question-text img,
                    .dark .cbt-question-text img {
                        border-color: #334155;
                        background: #1e293b;
                    }

                    /* Lightbox Modal */
                    .img-lightbox-backdrop {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(15, 23, 42, 0.85);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 24px;
                        animation: fadeIn 0.2s ease;
                    }
                    .img-lightbox-wrapper {
                        background: #ffffff;
                        border-radius: 20px;
                        max-width: 90vw;
                        max-height: 90vh;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    }
                    .img-lightbox-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 14px 20px;
                        background: #f8fafc;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .img-lightbox-close {
                        background: none;
                        border: none;
                        cursor: pointer;
                        color: #64748b;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 8px;
                    }
                    .img-lightbox-close:hover {
                        background: #fee2e2;
                        color: #b91c1c;
                    }
                    .img-lightbox-content {
                        padding: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #0f172a;
                        overflow: auto;
                        max-height: calc(90vh - 60px);
                    }
                    .img-lightbox-content img {
                        max-width: 100%;
                        max-height: calc(90vh - 90px);
                        object-fit: contain;
                        border-radius: 8px;
                    }
                    body.dark-theme .img-lightbox-wrapper,
                    .dark .img-lightbox-wrapper {
                        background: #1e293b;
                    }
                    body.dark-theme .img-lightbox-header,
                    .dark .img-lightbox-header {
                        background: #0f172a;
                        border-color: #334155;
                        color: #f1f5f9;
                    }

                    
                    /* Benar / Salah Decision Panel UI (Sangat Beda dari Pilihan Ganda) */
                    .cbt-tf-decision-container {
                        margin-top: 10px;
                        animation: fadeIn 0.3s ease;
                    }
                    .cbt-tf-header-guide {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        background: #fffbeb;
                        border: 1.5px solid #fde68a;
                        padding: 12px 18px;
                        border-radius: 14px;
                        margin-bottom: 20px;
                    }
                    .tf-guide-icon {
                        font-size: 1.8rem;
                        line-height: 1;
                    }
                    .tf-guide-text strong {
                        display: block;
                        font-size: 0.95rem;
                        color: #92400e;
                        font-weight: 800;
                    }
                    .tf-guide-text p {
                        margin: 2px 0 0 0;
                        font-size: 0.83rem;
                        color: #b45309;
                    }

                    .cbt-tf-decision-cards {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 16px;
                    }
                    @media (max-width: 640px) {
                        .cbt-tf-decision-cards {
                            grid-template-columns: 1fr;
                        }
                    }
                    .tf-decision-card {
                        background: #ffffff;
                        border: 2.5px solid #e2e8f0;
                        border-radius: 20px;
                        padding: 24px 20px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative;
                        outline: none;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                    }
                    .tf-decision-card:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.1);
                    }
                    .tf-card-icon-wrapper {
                        width: 72px;
                        height: 72px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 14px;
                        transition: all 0.25s;
                    }
                    .true-icon {
                        background: #ecfdf5;
                        color: #059669;
                    }
                    .false-icon {
                        background: #fff1f2;
                        color: #e11d48;
                    }
                    .tf-card-title {
                        display: block;
                        font-size: 1.6rem;
                        font-weight: 950;
                        letter-spacing: 0.5px;
                        margin-bottom: 4px;
                    }
                    .card-true .tf-card-title {
                        color: #047857;
                    }
                    .card-false .tf-card-title {
                        color: #be123c;
                    }
                    .tf-card-subtitle {
                        font-size: 0.84rem;
                        color: #64748b;
                        line-height: 1.4;
                        margin-bottom: 16px;
                    }

                    /* Selected State for True */
                    .tf-decision-card.card-true.selected-true {
                        border-color: #10b981;
                        background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%);
                        box-shadow: 0 12px 30px -4px rgba(16, 185, 129, 0.3);
                        transform: translateY(-2px);
                    }
                    .tf-decision-card.card-true.selected-true .true-icon {
                        background: #10b981;
                        color: #ffffff;
                        transform: scale(1.1);
                    }

                    /* Selected State for False */
                    .tf-decision-card.card-false.selected-false {
                        border-color: #f43f5e;
                        background: linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%);
                        box-shadow: 0 12px 30px -4px rgba(244, 63, 94, 0.3);
                        transform: translateY(-2px);
                    }
                    .tf-decision-card.card-false.selected-false .false-icon {
                        background: #f43f5e;
                        color: #ffffff;
                        transform: scale(1.1);
                    }

                    .tf-choice-badge {
                        padding: 8px 18px;
                        border-radius: 50px;
                        font-size: 0.85rem;
                        font-weight: 900;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    }
                    .tf-choice-badge.chosen-true {
                        background: #059669;
                        color: #ffffff;
                        box-shadow: 0 4px 10px rgba(5, 150, 105, 0.3);
                    }
                    .tf-choice-badge.chosen-false {
                        background: #e11d48;
                        color: #ffffff;
                        box-shadow: 0 4px 10px rgba(225, 29, 72, 0.3);
                    }
                    .tf-choice-prompt {
                        padding: 6px 16px;
                        border-radius: 50px;
                        font-size: 0.8rem;
                        font-weight: 700;
                        background: #f1f5f9;
                        color: #64748b;
                        border: 1px solid #e2e8f0;
                    }

                    .tf-status-bar {
                        padding: 12px 18px;
                        border-radius: 14px;
                        border: 1px solid #e2e8f0;
                        background: #f8fafc;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .tf-status-msg {
                        font-size: 0.88rem;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        font-weight: 600;
                    }
                    .tf-status-msg.is-true {
                        color: #047857;
                    }
                    .tf-status-msg.is-false {
                        color: #be123c;
                    }
                    .tf-status-msg.is-empty {
                        color: #64748b;
                    }

                    /* Complex PG Options & Checkboxes */
                    .cbt-pg-tip-box.complex-tip {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 10px;
                        background: #f5f3ff;
                        border: 1.5px solid #ddd6fe;
                        color: #5b21b6;
                        padding: 12px 18px;
                        border-radius: 14px;
                        margin-bottom: 18px;
                    }
                    .cbt-complex-pill {
                        background: #6d28d9;
                        color: #ffffff;
                        padding: 4px 12px;
                        border-radius: 50px;
                        font-size: 0.8rem;
                        font-weight: 900;
                        letter-spacing: 0.3px;
                    }
                    .cbt-pg-tip-box.single-tip {
                        background: #eff6ff;
                        border: 1.5px solid #bfdbfe;
                        color: #1e40af;
                        padding: 12px 18px;
                        border-radius: 14px;
                        margin-bottom: 18px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    /* Checkbox styling */
                    
                    /* BS Majemuk Matrix Table Styles */
                    .banner-bs-majemuk { background: #f0fdf4; border: 1.5px solid #86efac; color: #15803d; }
                    .banner-bs-majemuk .csi-icon { background: #dcfce7; color: #166534; }
                    .banner-bs-majemuk .csi-title { color: #15803d; }
                    .banner-bs-majemuk .csi-chip { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    .badge-bs-majemuk { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }

                    .cbt-bs-majemuk-container { margin-top: 18px; }
                    .bs-majemuk-table-wrap { overflow-x: auto; border-radius: 16px; border: 1.5px solid #e2e8f0; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                    .cbt-matrix-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
                    .cbt-matrix-table th { background: #f8fafc; padding: 14px 18px; color: #475569; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.03em; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; }
                    .cbt-matrix-table td { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                    .matrix-row.row-answered { background: #fcfcfd; }
                    .matrix-row:hover { background: #f8fafc; }
                    .matrix-cell-num { text-align: center; font-weight: 800; color: #64748b; font-size: 0.9rem; }
                    .matrix-cell-text { color: #1e293b; line-height: 1.6; }
                    .matrix-cell-choice { text-align: center; padding: 12px !important; }
                    .btn-matrix-choice { width: 100%; max-width: 120px; padding: 10px 14px; border-radius: 12px; font-size: 0.82rem; font-weight: 800; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
                    .btn-matrix-choice:hover { background: #f1f5f9; transform: translateY(-1px); }
                    .btn-matrix-choice.choice-true.selected { background: #ecfdf5; border-color: #10b981; color: #059669; box-shadow: 0 4px 10px rgba(16,185,129,0.25); }
                    .btn-matrix-choice.choice-false.selected { background: #fff1f2; border-color: #f43f5e; color: #e11d48; box-shadow: 0 4px 10px rgba(244,63,94,0.25); }

                    [data-theme="dark"] .bs-majemuk-table-wrap { background: #1e293b; border-color: #334155; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
                    [data-theme="dark"] .cbt-matrix-table th { background: #0f172a; border-color: #334155; color: #94a3b8; }
                    [data-theme="dark"] .cbt-matrix-table td { border-color: #334155; }
                    [data-theme="dark"] .matrix-row.row-answered { background: rgba(30,41,59,0.7); }
                    [data-theme="dark"] .matrix-row:hover { background: #33415520; }
                    [data-theme="dark"] .matrix-cell-num { color: #94a3b8; }
                    [data-theme="dark"] .matrix-cell-text { color: #f8fafc; }
                    [data-theme="dark"] .btn-matrix-choice { background: #0f172a; border-color: #475569; color: #cbd5e1; }
                    [data-theme="dark"] .btn-matrix-choice:hover { background: #334155; color: #f8fafc; }

                    .cbt-opt-row.complex-row {
                        border: 2px solid #e2e8f0;
                        border-radius: 16px;
                        padding: 14px 18px;
                        margin-bottom: 12px;
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        background: #ffffff;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .cbt-opt-row.complex-row:hover {
                        border-color: #818cf8;
                        background: #faf5ff;
                    }
                    .cbt-opt-row.complex-row.selected {
                        border-color: #6366f1;
                        background: #f5f3ff;
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
                    }
                    .cbt-checkbox-box {
                        width: 28px;
                        height: 28px;
                        min-width: 28px;
                        border-radius: 8px;
                        border: 2px solid #cbd5e1;
                        background: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        transition: all 0.2s;
                    }
                    .cbt-checkbox-box.checked {
                        background: #6366f1;
                        border-color: #6366f1;
                    }
                    .cbt-opt-letter-tag {
                        width: 28px;
                        height: 28px;
                        min-width: 28px;
                        border-radius: 6px;
                        background: #f1f5f9;
                        color: #475569;
                        font-weight: 900;
                        font-size: 0.85rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .cbt-opt-row.complex-row.selected .cbt-opt-letter-tag {
                        background: #e0e7ff;
                        color: #4338ca;
                    }

                    /* Single PG styling */
                    .cbt-opt-row.single-row {
                        border: 2px solid #e2e8f0;
                        border-radius: 16px;
                        padding: 14px 18px;
                        margin-bottom: 12px;
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        background: #ffffff;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .cbt-opt-row.single-row:hover {
                        border-color: #93c5fd;
                        background: #f8fafc;
                    }
                    .cbt-opt-row.single-row.selected {
                        border-color: #2563eb;
                        background: #eff6ff;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
                    }

                    /* Dark Mode Overrides */
                    body.dark-theme .tf-decision-card,
                    .dark .tf-decision-card {
                        background: #1e293b;
                        border-color: #334155;
                    }
                    body.dark-theme .tf-decision-card.card-true.selected-true,
                    .dark .tf-decision-card.card-true.selected-true {
                        background: rgba(16, 185, 129, 0.2);
                        border-color: #10b981;
                    }
                    body.dark-theme .tf-decision-card.card-false.selected-false,
                    .dark .tf-decision-card.card-false.selected-false {
                        background: rgba(244, 63, 94, 0.2);
                        border-color: #f43f5e;
                    }
                    body.dark-theme .tf-card-subtitle,
                    .dark .tf-card-subtitle {
                        color: #94a3b8;
                    }
                    body.dark-theme .cbt-tf-header-guide,
                    .dark .cbt-tf-header-guide {
                        background: rgba(180, 83, 9, 0.2);
                        border-color: #d97706;
                    }
                    body.dark-theme .tf-guide-text strong,
                    .dark .tf-guide-text strong {
                        color: #fde68a;
                    }
                    body.dark-theme .tf-guide-text p,
                    .dark .tf-guide-text p {
                        color: #fcd34d;
                    }
                    body.dark-theme .tf-status-bar,
                    .dark .tf-status-bar {
                        background: #0f172a;
                        border-color: #334155;
                    }
                    body.dark-theme .cbt-opt-row.complex-row,
                    .dark .cbt-opt-row.complex-row,
                    body.dark-theme .cbt-opt-row.single-row,
                    .dark .cbt-opt-row.single-row {
                        background: #1e293b;
                        border-color: #334155;
                    }
                    body.dark-theme .cbt-opt-row.complex-row.selected,
                    .dark .cbt-opt-row.complex-row.selected {
                        background: rgba(99, 102, 241, 0.2);
                        border-color: #818cf8;
                    }
                    body.dark-theme .cbt-opt-row.single-row.selected,
                    .dark .cbt-opt-row.single-row.selected {
                        background: rgba(37, 99, 235, 0.2);
                        border-color: #3b82f6;
                    }
                    body.dark-theme .cbt-checkbox-box,
                    .dark .cbt-checkbox-box {
                        background: #0f172a;
                        border-color: #475569;
                    }
                    body.dark-theme .cbt-opt-letter-tag,
                    .dark .cbt-opt-letter-tag {
                        background: #0f172a;
                        color: #94a3b8;
                    }

                    /* Practice Banner */
                    .practice-banner-card {
                        background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #0284c7 100%);
                        border-radius: 20px;
                        padding: 24px 32px;
                        margin-bottom: 28px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        color: white;
                        box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.35);
                        gap: 20px;
                        flex-wrap: wrap;
                    }
                    .practice-banner-left { display: flex; align-items: center; gap: 20px; flex: 1; min-width: 280px; }
                    .practice-icon-circle {
                        width: 56px; height: 56px; min-width: 56px; border-radius: 16px;
                        background: rgba(255, 255, 255, 0.2);
                        backdrop-filter: blur(8px);
                        display: flex; align-items: center; justify-content: center;
                        color: #fef08a; border: 1.5px solid rgba(255, 255, 255, 0.3);
                    }
                    .practice-tag { display: inline-flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, 0.18); padding: 4px 12px; border-radius: 50px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 6px; }
                    .practice-title { font-size: 1.4rem; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.5px; }
                    .practice-desc { font-size: 0.9rem; margin: 0; opacity: 0.95; line-height: 1.5; max-width: 680px; }
                    .practice-start-btn {
                        background: white; color: #1d4ed8; border: none; padding: 14px 28px; border-radius: 14px;
                        font-weight: 900; font-size: 1rem; cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
                        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .practice-start-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); background: #f8fafc; }

                    /* Practice Timer & Unlimited Tag */
                    .cbt-timer-unlimited { background: #f0fdf4 !important; border-color: #86efac !important; color: #166534 !important; }
                    .duration-tag.unlimited { background: #ecfdf5 !important; color: #047857 !important; border: 1px solid #a7f3d0 !important; font-weight: 800; }

                    /* Practice Review Modal */
                    .practice-result-modal { max-width: 780px !important; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; padding: 0 !important; border-radius: 24px !important; }
                    .practice-modal-header { background: #f8fafc; padding: 28px 32px; border-bottom: 2px solid #f1f5f9; text-align: center; }
                    .practice-score-circle { width: 84px; height: 84px; border-radius: 50%; background: #eff6ff; border: 3px solid #3b82f6; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 16px auto; }
                    .practice-score-circle .score-num { font-size: 2rem; font-weight: 950; color: #1d4ed8; line-height: 1; }
                    .practice-score-circle .score-max { font-size: 0.8rem; color: #64748b; font-weight: 700; }
                    .practice-modal-header h2 { margin: 0 0 6px 0; font-size: 1.5rem; font-weight: 900; color: #0f172a; }
                    .practice-modal-header p { margin: 0; color: #64748b; font-size: 0.9rem; }
                    
                    .practice-review-list { padding: 24px 32px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; flex: 1; }
                    .review-card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 18px 22px; background: white; }
                    .review-card.is-correct { border-color: #86efac; background: #f0fdf4; }
                    .review-card.is-wrong { border-color: #fed7aa; background: #fff7ed; }
                    .review-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.85rem; font-weight: 800; gap: 8px; flex-wrap: wrap; }
                    .review-q-num { color: #475569; background: white; padding: 3px 10px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .review-q-type { color: #6366f1; background: #eef2ff; padding: 3px 10px; border-radius: 8px; }
                    .review-status.text-green { color: #15803d; }
                    .review-status.text-orange { color: #c2410c; }
                    .review-pertanyaan { font-size: 1rem; color: #1e293b; font-weight: 600; margin-bottom: 12px; }
                    .review-ans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
                    .review-ans-box { padding: 10px 14px; border-radius: 10px; font-size: 0.9rem; }
                    .review-ans-box.user { background: white; border: 1px solid #cbd5e1; }
                    .review-ans-box.key { background: #f8fafc; border: 1.5px dashed #94a3b8; color: #0f172a; font-weight: 700; }
                    .review-ans-box label { display: block; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                    .review-pembahasan { font-size: 0.88rem; color: #475569; background: rgba(255, 255, 255, 0.7); padding: 10px 14px; border-radius: 10px; line-height: 1.5; border-left: 4px solid #3b82f6; }

                    .practice-modal-actions { padding: 18px 32px; background: #f8fafc; border-top: 2px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 12px; }
                    .btn-retry-practice { background: #eff6ff; color: #1d4ed8; border: 2px solid #bfdbfe; padding: 10px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
                    .btn-retry-practice:hover { background: #dbeafe; }
                    .btn-close-practice { background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
                    .btn-close-practice:hover { background: #059669; }

                    /* Dark mode overrides */
                    [data-theme="dark"] .practice-banner-card { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); }
                    [data-theme="dark"] .practice-result-modal { background: #1e293b; color: #f8fafc; }
                    [data-theme="dark"] .practice-modal-header { background: #0f172a; border-color: #334155; }
                    [data-theme="dark"] .practice-modal-header h2 { color: #f8fafc; }
                    [data-theme="dark"] .practice-modal-actions { background: #0f172a; border-color: #334155; }
                    [data-theme="dark"] .review-card { background: #0f172a; border-color: #334155; }
                    [data-theme="dark"] .review-pertanyaan { color: #f8fafc; }
                    [data-theme="dark"] .review-ans-box.user { background: #1e293b; border-color: #475569; color: #f8fafc; }
                    [data-theme="dark"] .review-ans-box.key { background: #1e293b; border-color: #64748b; color: #38bdf8; }

                    /* Type Badges */
                    .cbt-badge-type { font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px; }
                    .cbt-badge-type.badge-pg { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
                    .cbt-badge-type.badge-complex { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
                    .cbt-badge-type.badge-tf { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
                    .cbt-badge-type.badge-essay { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }

                    .sidebar-close-mobile { display: none; }

                    @media (max-width: 900px) {
                        .cbt-sidebar {
                            display: flex !important;
                            position: fixed;
                            top: 0;
                            left: 0;
                            height: 100vh;
                            height: 100dvh;
                            z-index: 2500;
                            transform: translateX(-100%);
                            transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
                            box-shadow: 10px 0 30px rgba(0, 0, 0, 0.2);
                        }
                        .cbt-sidebar.mobile-open {
                            transform: translateX(0);
                        }
                        .sidebar-close-mobile {
                            display: flex !important;
                        }
                        .cbt-sidebar-backdrop {
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100vw;
                            height: 100vh;
                            background: rgba(15, 23, 42, 0.55);
                            backdrop-filter: blur(3px);
                            z-index: 2400;
                        }
                    }

                    /* CBT Objective (PG / Benar Salah / PG Kompleks) */
                    .cbt-pg-answer-container { margin-top: 20px; }
                    .cbt-pg-instruction { font-size: 1rem; font-weight: 700; color: #475569; margin-bottom: 16px; }
                    .cbt-pg-tip-box { display: flex; align-items: center; gap: 10px; background: #eff6ff; border: 1.5px solid #bfdbfe; color: #1e40af; padding: 10px 16px; border-radius: 12px; margin-bottom: 16px; font-size: 0.9rem; }
                    .cbt-opt-list { display: flex; flex-direction: column; gap: 12px; }
                    .cbt-opt-row { display: flex; align-items: center; gap: 16px; padding: 14px 18px; border: 2px solid #e2e8f0; border-radius: 14px; background: white; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); user-select: none; }
                    .cbt-opt-row:hover { border-color: #38bdf8; background: #f0f9ff; transform: translateX(4px); }
                    .cbt-opt-row.selected { border-color: #0284c7; background: #e0f2fe; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.12); }
                    .cbt-opt-radio { width: 38px; height: 38px; min-width: 38px; border-radius: 50%; border: 2px solid #cbd5e1; background: white; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #64748b; font-size: 0.95rem; transition: all 0.2s; }
                    .cbt-opt-row.selected .cbt-opt-radio { background: #0284c7; border-color: #0284c7; color: white; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3); }
                    .cbt-opt-check { width: 38px; height: 38px; min-width: 38px; border-radius: 10px; border: 2px solid #cbd5e1; background: white; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #64748b; font-size: 0.95rem; transition: all 0.2s; }
                    .cbt-opt-check.checked { background: #6366f1; border-color: #6366f1; color: white; box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3); }
                    .cbt-opt-text { flex: 1; font-size: 1.05rem; color: #1e293b; line-height: 1.5; }
                    
                    .cbt-tf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 12px; }
                    .cbt-tf-btn { display: flex; align-items: center; gap: 16px; padding: 22px 24px; border-radius: 18px; border: 2.5px solid #e2e8f0; background: white; cursor: pointer; text-align: left; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                    .cbt-tf-btn:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06); }
                    .cbt-tf-btn .tf-badge { width: 44px; height: 44px; min-width: 44px; border-radius: 12px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; color: #475569; }
                    .cbt-tf-btn .tf-content { flex: 1; display: flex; flex-direction: column; }
                    .cbt-tf-btn .tf-title { font-size: 1.35rem; font-weight: 900; letter-spacing: 0.5px; }
                    .cbt-tf-btn .tf-sub { font-size: 0.85rem; color: #64748b; margin-top: 2px; }
                    .cbt-tf-btn.btn-true.selected { border-color: #10b981; background: #ecfdf5; color: #065f46; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.18); }
                    .cbt-tf-btn.btn-true.selected .tf-badge { background: #10b981; color: white; }
                    .cbt-tf-btn.btn-true.selected .tf-sub { color: #047857; }
                    .cbt-tf-btn.btn-false.selected { border-color: #ef4444; background: #fef2f2; color: #991b1b; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.18); }
                    .cbt-tf-btn.btn-false.selected .tf-badge { background: #ef4444; color: white; }
                    .cbt-tf-btn.btn-false.selected .tf-sub { color: #b91c1c; }
                    .tf-checked-icon { flex-shrink: 0; }
                    .btn-true.selected .tf-checked-icon { color: #10b981; }
                    .btn-false.selected .tf-checked-icon { color: #ef4444; }

                    [data-theme="dark"] .cbt-opt-row { background: #0f172a; border-color: #334155; }
                    [data-theme="dark"] .cbt-opt-row:hover { background: #1e293b; border-color: #38bdf8; }
                    [data-theme="dark"] .cbt-opt-row.selected { background: #1e3a5f; border-color: #38bdf8; }
                    [data-theme="dark"] .cbt-opt-text { color: #f8fafc; }
                    [data-theme="dark"] .cbt-tf-btn { background: #0f172a; border-color: #334155; color: #f8fafc; }
                    [data-theme="dark"] .cbt-tf-btn.btn-true.selected { background: #064e3b; border-color: #10b981; color: #a7f3d0; }
                    [data-theme="dark"] .cbt-tf-btn.btn-false.selected { background: #7f1d1d; border-color: #ef4444; color: #fecaca; }

                    .cbt-layout { display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: #eef2f6; position: fixed; top: 0; left: 0; width: 100%; z-index: 2000; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; overflow: hidden; }
                    .cbt-header { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%); color: white; padding: 14px 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 16px rgba(30, 58, 138, 0.18); flex-shrink: 0; min-height: 64px; z-index: 10; }
                    .cbt-header-left { display: flex; align-items: center; gap: 14px; }
                    .cbt-logo-circle { background: white; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.12); flex-shrink: 0; }
                    .cbt-title { display: flex; flex-direction: column; line-height: 1.2; }
                    .cbt-title strong { font-size: 1.18rem; font-weight: 800; letter-spacing: 0.3px; margin: 0; color: #ffffff; }
                    .cbt-title span { font-size: 0.82rem; font-weight: 500; color: #e0f2fe; opacity: 0.9; margin-top: 2px; }
                    .cbt-header-right { display: flex; align-items: center; gap: 12px; }
                    .cbt-userinfo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 0.92rem; background: rgba(255, 255, 255, 0.14); backdrop-filter: blur(8px); padding: 8px 18px; border-radius: 50px; border: 1px solid rgba(255, 255, 255, 0.22); color: #ffffff; }
                    .cbt-user-icon { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); }
                    
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
                    
                    /* Multimedia (Images, Arabic RTL, Japanese CJK) */
                    .cbt-question-text {
                        color: #0f172a;
                        line-height: 1.85;
                        margin-bottom: 28px;
                        font-weight: 600;
                        font-size: 1.35rem;
                        unicode-bidi: plaintext;
                        word-break: break-word;
                        background: #f8fafc;
                        border-left: 5px solid #2563eb;
                        border-radius: 12px;
                        padding: 22px 26px;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                    }
                    .cbt-question-text.text-lg { font-size: 1.55rem; }
                    .cbt-question-text.text-xl { font-size: 1.75rem; }
                    .cbt-question-text img {
                        max-width: 100%;
                        height: auto;
                        border-radius: 12px;
                        display: block;
                        margin: 16px auto;
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
                        border: 1px solid #e2e8f0;
                    }
                    .cbt-opt-text img {
                        max-width: 100%;
                        max-height: 180px;
                        height: auto;
                        border-radius: 8px;
                        margin-top: 8px;
                        display: block;
                    }

                    .cbt-question-text.text-lg { font-size: 1.3rem; }
                    .cbt-question-text.text-xl { font-size: 1.5rem; }
                    
                    .cbt-answer-area textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; font-family: inherit; resize: vertical; outline: none; transition: border-color 0.2s; font-size: 1.1rem; }
                    .cbt-answer-area textarea.text-lg { font-size: 1.25rem; }
                    .cbt-answer-area textarea.text-xl { font-size: 1.4rem; }
                    .cbt-answer-area textarea:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1); }
                    .cbt-save-indicator { font-size: 0.85rem; color: #94a3b8; margin-top: 10px; display: flex; align-items: center; gap: 6px; font-style: italic; }
                    
                    .cbt-footer { display: flex; justify-content: space-between; padding: 20px 36px; background: white; align-items: center; border-top: 1px solid #e2e8f0; box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.04); gap: 16px; flex-wrap: wrap; }
                    .cbt-footer-btn { display: inline-flex; align-items: center; gap: 10px; padding: 12px 26px; border-radius: 12px; font-weight: 700; font-size: 0.94rem; cursor: pointer; transition: all 0.2s ease-in-out; border: none; color: white; }
                    .cbt-footer-btn:disabled { opacity: 0.45; cursor: not-allowed; filter: grayscale(0.8); }
                    
                    .cbt-btn-prev { background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; }
                    .cbt-btn-prev .icon-circle { background: #e2e8f0; color: #475569; }
                    .cbt-btn-prev:hover:not(:disabled) { background: #e2e8f0; color: #1e293b; border-color: #94a3b8; transform: translateY(-1px); }
                    
                    .cbt-btn-ragu { background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a; }
                    .cbt-btn-ragu:hover { background: #fef3c7; border-color: #f59e0b; transform: translateY(-1px); }
                    .cbt-btn-ragu.active { background: #f59e0b; color: white; border-color: #d97706; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3); }
                    
                    .cbt-btn-next { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25); }
                    .cbt-btn-next:hover:not(:disabled) { background: linear-gradient(135deg, #1d4ed8, #1e40af); box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35); transform: translateY(-1px); }
                    .cbt-btn-next.finish { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25); }
                    .cbt-btn-next.finish:hover:not(:disabled) { background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 6px 18px rgba(16, 185, 129, 0.35); transform: translateY(-1px); }
                    
                    .icon-circle { background: rgba(255, 255, 255, 0.25); color: inherit; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }
                    .cbt-btn-next .icon-circle, .cbt-btn-next.finish .icon-circle { background: rgba(255, 255, 255, 0.25); color: white; }
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
                    [data-theme="dark"] .cbt-question-text { background: #1e293b; color: #f8fafc; border-left-color: #3b82f6; }
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

                    /* Option Image Styling in CBT */
                    .cbt-opt-text img {
                        max-height: 180px;
                        max-width: 100%;
                        border-radius: 10px;
                        margin-top: 8px;
                        display: block;
                        cursor: zoom-in;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .cbt-opt-text img:hover {
                        transform: scale(1.02);
                    }
                    [data-theme="dark"] .cbt-opt-text img {
                        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
                    }
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

            {user.role === 'ADMIN' && (
                <div style={{
                    background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                    color: '#ffffff',
                    padding: '16px 24px',
                    borderRadius: '16px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 24px -6px rgba(49, 46, 129, 0.4)',
                    border: '1px solid #4338ca',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            background: '#4338ca',
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(67, 56, 202, 0.4)'
                        }}>
                            <ShieldCheck size={24} color="#a5b4fc" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>👑 Mode Uji Coba Administrator</span>
                                <span style={{ background: '#3730a3', color: '#c7d2fe', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                    Semua Ujian Terbuka
                                </span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#c7d2fe' }}>
                                Anda sedang menguji sistem ujian sebagai <strong>{user.name || user.namaLengkap || 'Administrator'}</strong>. Seluruh jawaban tersimpan nyata ke database dan dapat dihapus/direset kembali kapan saja.
                            </p>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#93c5fd', background: 'rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '8px', fontWeight: 700 }}>
                        Akses Penuh Uji Coba CBT
                    </div>
                </div>
            )}

            {/* Banner Ujian Latihan Default - Selalu Terlihat */}
            <div className="practice-banner-card">
                <div className="practice-banner-left">
                    <div className="practice-icon-circle">
                        <Sparkles size={28} />
                    </div>
                    <div className="practice-text-content">
                        <div className="practice-tag">
                            <Shield size={13} />
                            <span>SIMULASI CBT RESMI & LATIHAN MANDIRI</span>
                        </div>
                        <h3 className="practice-title">Coba Ujian Latihan (Tanpa Batas Waktu)</h3>
                        <p className="practice-desc">
                            Coba pengerjaan <strong>4 Tipe Soal Lengkap</strong> (Pilihan Ganda Biasa, PG Kompleks, Benar / Salah, dan Essay dengan Whiteboard Corat-coret) tanpa batas waktu dan tanpa perlu token pengawas.
                        </p>
                    </div>
                </div>
                <button type="button" className="practice-start-btn" onClick={handleStartPractice}>
                    <Play size={18} />
                    Mulai Coba Latihan
                </button>
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
                                    <div className={`duration-tag ${ex.durasi === 0 ? "unlimited" : ""}`}>{ex.durasi === 0 ? "♾️ Tanpa Batas" : `${ex.durasi} Menit`}</div>
                                    {ex.tampilkanNilai && ex.nilaiAkhir !== null && (
                                        <div className="score-badge" style={{ background: '#ecfdf5', color: '#059669', padding: '6px 14px', borderRadius: '50px', fontSize: '0.9rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #10b981', boxShadow: '0 2px 4px rgba(16,185,129,0.1)' }}>
                                            <Award size={16} /> {ex.nilaiAkhir}
                                        </div>
                                    )}
                                </div>
                                <h3>{ex.namaMapel}</h3>
                                <p className="teacher"><strong>Nama Guru:</strong> {ex.namaGuru || '-'}</p>

                                {(() => {
                                    const isPractice = (Number(ex.durasi) === 0) || ex.isPractice || (selectedEvent?.namaEvent && (selectedEvent.namaEvent.toLowerCase().includes('latihan') || selectedEvent.namaEvent.toLowerCase().includes('simulasi')));
                                    const isAdminOrStaff = user && (user.role === 'ADMIN' || user.role === 'TU' || user.role === 'GURU');
                                    const startTime = ex.waktuMulai ? new Date(ex.waktuMulai) : null;
                                    const endTime = ex.waktuSelesai ? new Date(ex.waktuSelesai) : null;
                                    const toleranceTime = startTime ? new Date(startTime.getTime() + 30 * 60 * 1000) : null;
                                    const isCurrentlyTaking = ex.sisaWaktuDetik !== undefined && ex.sisaWaktuDetik !== null && ex.sisaWaktuDetik > 0;

                                    let lockInfo = null;
                                    if (!isPractice && !isAdminOrStaff) {
                                        if (startTime && currentTime < startTime) {
                                            lockInfo = {
                                                type: 'NOT_STARTED',
                                                btnText: `Belum Dimulai (Buka ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB)`,
                                                btnStyle: { background: '#fef3c7', color: '#b45309', border: '1.5px solid #fde68a', cursor: 'not-allowed' },
                                                message: `Ujian "${ex.namaMapel}" belum dimulai.\n\nJadwal dibuka pada jam ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB. Silakan menunggu sampai waktu mulai tiba.`
                                            };
                                        } else if (startTime && !isCurrentlyTaking && toleranceTime && currentTime > toleranceTime) {
                                            lockInfo = {
                                                type: 'LATE_LOCKED',
                                                btnText: 'Terkunci (Terlambat > 30 Menit)',
                                                btnStyle: { background: '#fee2e2', color: '#b91c1c', border: '1.5px solid #fca5a5', cursor: 'not-allowed' },
                                                message: `Batas toleransi masuk ujian "${ex.namaMapel}" telah berakhir!\n\nUjian dimulai pukul ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB dan batas maksimal masuk adalah pukul ${toleranceTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB (toleransi 30 menit).\n\nSilakan segera hubungi proktor/pengawas ujian untuk mendapatkan dispensasi.`
                                            };
                                        } else if (endTime && currentTime > endTime) {
                                            lockInfo = {
                                                type: 'EXPIRED',
                                                btnText: 'Ujian Telah Berakhir',
                                                btnStyle: { background: '#f1f5f9', color: '#64748b', border: '1.5px solid #cbd5e1', cursor: 'not-allowed' },
                                                message: `Waktu ujian "${ex.namaMapel}" telah berakhir pada jam ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB.`
                                            };
                                        }
                                    }

                                    return (
                                        <>
                                            <div className="exam-times">
                                                <div className="time-item">
                                                    <Clock size={14} />
                                                    <span>Mulai: {new Date(ex.waktuMulai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB</span>
                                                </div>
                                                <div className="time-item">
                                                    <Clock size={14} />
                                                    <span>Selesai: {Number(ex.durasi) === 0 ? "Bebas / Fleksibel" : new Date(ex.waktuSelesai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' WIB'}</span>
                                                </div>
                                            </div>

                                            {!isPractice && startTime && toleranceTime && (
                                                <div style={{
                                                    fontSize: '0.73rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    marginTop: '-4px',
                                                    marginBottom: '10px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    background: lockInfo?.type === 'LATE_LOCKED' ? '#fef2f2' : '#f0fdf4',
                                                    border: `1px solid ${lockInfo?.type === 'LATE_LOCKED' ? '#fecaca' : '#bbf7d0'}`,
                                                    color: lockInfo?.type === 'LATE_LOCKED' ? '#991b1b' : '#166534'
                                                }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: lockInfo?.type === 'LATE_LOCKED' ? '#ef4444' : '#22c55e' }}></span>
                                                        Toleransi masuk: <strong>s/d {toleranceTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB</strong>
                                                    </span>
                                                    {isAdminOrStaff && (
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb' }}>👑 Pengawas</span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {ex.isFinished ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                        {ex.tampilkanNilai && (
                                            <button className="start-btn" style={{ flex: 1, background: '#ecfdf5', color: '#10b981', borderColor: '#10b981' }} onClick={() => handleViewTranscript(ex)}>
                                                <Award size={18} />
                                                Lihat Nilai
                                            </button>
                                        )}
                                        {((selectedEvent?.namaEvent && (selectedEvent.namaEvent.toLowerCase().includes('latihan') || selectedEvent.namaEvent.toLowerCase().includes('simulasi'))) || Number(ex.durasi) === 0 || ex.isPractice) ? (
                                            <button className="start-btn" style={{ flex: 1, background: '#eff6ff', color: '#2563eb', borderColor: '#3b82f6' }} onClick={() => handleStartClick(ex)}>
                                                <Play size={18} />
                                                Coba Ujian Lagi
                                            </button>
                                        ) : (
                                            !ex.tampilkanNilai && (
                                                <button className="start-btn" style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} disabled>
                                                    <CheckCircle size={18} />
                                                    Selesai Dikerjakan
                                                </button>
                                            )
                                        )}
                                        </div>
                                        {user.role === 'ADMIN' && (
                                            <button
                                                type="button"
                                                className="start-btn"
                                                style={{
                                                    background: '#fef2f2',
                                                    color: '#dc2626',
                                                    border: '1.5px solid #fecaca',
                                                    fontWeight: 800,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.8rem',
                                                    padding: '8px'
                                                }}
                                                onClick={() => handleResetAdminTrial(ex)}
                                                title="Hapus jawaban & skor uji coba Admin agar ujian ini bersih kembali di database"
                                            >
                                                <RotateCcw size={15} />
                                                Hapus / Reset Hasil Uji Coba Saya
                                            </button>
                                        )}
                                    </div>
                                ) : (() => {
                                    const isPractice = (Number(ex.durasi) === 0) || ex.isPractice || (selectedEvent?.namaEvent && (selectedEvent.namaEvent.toLowerCase().includes('latihan') || selectedEvent.namaEvent.toLowerCase().includes('simulasi')));
                                    const isAdminOrStaff = user && (user.role === 'ADMIN' || user.role === 'TU' || user.role === 'GURU');
                                    const startTime = ex.waktuMulai ? new Date(ex.waktuMulai) : null;
                                    const endTime = ex.waktuSelesai ? new Date(ex.waktuSelesai) : null;
                                    const toleranceTime = startTime ? new Date(startTime.getTime() + 30 * 60 * 1000) : null;
                                    const isCurrentlyTaking = ex.sisaWaktuDetik !== undefined && ex.sisaWaktuDetik !== null && ex.sisaWaktuDetik > 0;

                                    if (!isPractice && !isAdminOrStaff) {
                                        if (startTime && currentTime < startTime) {
                                            const lockMsg = `Ujian "${ex.namaMapel}" belum dimulai.\n\nJadwal dibuka pada jam ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB. Silakan menunggu sampai waktu mulai tiba.`;
                                            return (
                                                <button
                                                    type="button"
                                                    className="start-btn"
                                                    style={{ background: '#fef3c7', color: '#b45309', border: '1.5px solid #fde68a', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800 }}
                                                    onClick={() => alert(lockMsg)}
                                                    title={lockMsg}
                                                >
                                                    <Lock size={16} />
                                                    Belum Dimulai ({startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB)
                                                </button>
                                            );
                                        }
                                        if (startTime && !isCurrentlyTaking && toleranceTime && currentTime > toleranceTime) {
                                            const lockMsg = `Batas toleransi masuk ujian "${ex.namaMapel}" telah berakhir!\n\nUjian dimulai pukul ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB dan batas maksimal masuk adalah pukul ${toleranceTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB (toleransi 30 menit).\n\nSilakan segera hubungi proktor/pengawas ujian untuk mendapatkan dispensasi.`;
                                            return (
                                                <button
                                                    type="button"
                                                    className="start-btn"
                                                    style={{ background: '#fee2e2', color: '#b91c1c', border: '1.5px solid #fca5a5', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800 }}
                                                    onClick={() => alert(lockMsg)}
                                                    title={lockMsg}
                                                >
                                                    <Lock size={16} />
                                                    Terkunci (Terlambat > 30 Menit)
                                                </button>
                                            );
                                        }
                                        if (endTime && currentTime > endTime) {
                                            const lockMsg = `Waktu pelaksanaan ujian "${ex.namaMapel}" telah berakhir pada jam ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB.`;
                                            return (
                                                <button
                                                    type="button"
                                                    className="start-btn"
                                                    style={{ background: '#f1f5f9', color: '#64748b', border: '1.5px solid #cbd5e1', cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800 }}
                                                    onClick={() => alert(lockMsg)}
                                                    title={lockMsg}
                                                >
                                                    <Lock size={16} />
                                                    Ujian Telah Berakhir
                                                </button>
                                            );
                                        }
                                    }

                                    return (
                                        <button className="start-btn" onClick={() => handleStartClick(ex)}>
                                            <Play size={18} />
                                            {isCurrentlyTaking ? 'Lanjutkan Ujian' : (isPractice ? 'Mulai Ujian Latihan' : 'Ikuti Ujian')}
                                        </button>
                                    );
                                })()}
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
                <div className="modal-overlay" onClick={() => !isSubmitting && setShowTokenOverlay(null)}>
                    <div className="modal-content token-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="shield-icon">
                            <Shield size={42} />
                        </div>
                        <h2>Token Keamanan Ujian</h2>
                        <p>Masukkan token ujian yang diberikan oleh guru / pengawas untuk memulai <strong>{showTokenOverlay.namaMapel}</strong>.</p>

                        <form onSubmit={handleVerifyToken}>
                            <input
                                type="text"
                                placeholder="MASUKKAN TOKEN..."
                                maxLength={10}
                                autoFocus
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                                className="token-field"
                                disabled={isSubmitting}
                            />

                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '18px', fontStyle: 'italic' }}>
                                *Token ujian diumumkan oleh pengawas di ruang ujian.
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setShowTokenOverlay(null)} disabled={isSubmitting}>
                                    Batal
                                </button>
                                <button type="submit" className="btn-confirm" disabled={isSubmitting || !tokenInput.trim()}>
                                    {isSubmitting ? 'Memverifikasi...' : 'Konfirmasi & Masuk Ujian'}
                                </button>
                            </div>
                        </form>
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

                                        {item.tipeSoal === 'BS_MAJEMUK' ? (
                                            (() => {
                                                const validStatements = ['A', 'B', 'C', 'D', 'E'].filter(opt => item['pilihan' + opt] && item['pilihan' + opt] !== '-');
                                                const totalStmt = validStatements.length || 4;
                                                const maxBobot = item.bobot || 2;
                                                const ptsPerItem = (maxBobot / totalStmt).toFixed(2).replace(/\.00$/, '');
                                                const studentTokens = (item.jawabanSiswa || '').split(',');
                                                const keyTokens = (item.kunciJawaban || '').split(',');
                                                let matchCount = 0;

                                                validStatements.forEach((opt, sIdx) => {
                                                    const sP = (studentTokens[sIdx] || '').trim().toUpperCase();
                                                    const kP = (keyTokens[sIdx] || 'B').trim().toUpperCase();
                                                    if (sP && kP && sP.startsWith(kP.charAt(0))) matchCount++;
                                                });

                                                const studentEarned = ((matchCount / totalStmt) * maxBobot).toFixed(2).replace(/\.00$/, '');

                                                return (
                                                    <div className="transcript-ans-box" style={{ padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Evaluasi Tabel Benar / Salah (Poin per Butir)</p>
                                                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>
                                                                Hasil Anda: {studentEarned} / {maxBobot} Poin ({matchCount}/{totalStmt} Butir Cocok)
                                                            </span>
                                                        </div>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                                    <th style={{ padding: '8px', textAlign: 'left', width: '40px' }}>No</th>
                                                                    <th style={{ padding: '8px', textAlign: 'left' }}>Pernyataan</th>
                                                                    <th style={{ padding: '8px', textAlign: 'center', width: '120px' }}>Pilihan Anda</th>
                                                                    <th style={{ padding: '8px', textAlign: 'center', width: '120px' }}>Kunci</th>
                                                                    <th style={{ padding: '8px', textAlign: 'center', width: '90px' }}>Hasil</th>
                                                                    <th style={{ padding: '8px', textAlign: 'center', width: '110px' }}>Poin Diperoleh</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {validStatements.map((opt, sIdx) => {
                                                                    const sText = item['pilihan' + opt];
                                                                    const studentP = (studentTokens[sIdx] || '').trim().toUpperCase();
                                                                    const keyP = (keyTokens[sIdx] || 'B').trim().toUpperCase();
                                                                    const isMatch = studentP && keyP && studentP.startsWith(keyP.charAt(0));

                                                                    return (
                                                                        <tr key={opt} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                            <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{sIdx + 1}</td>
                                                                            <td style={{ padding: '10px 8px' }} dangerouslySetInnerHTML={{ __html: sText }}></td>
                                                                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                                                <span style={{ fontWeight: 800, color: studentP.startsWith('B') ? '#059669' : studentP.startsWith('S') ? '#e11d48' : '#94a3b8' }}>
                                                                                    {studentP.startsWith('B') ? 'BENAR (B)' : studentP.startsWith('S') ? 'SALAH (S)' : '-'}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#3b82f6' }}>
                                                                                {keyP.startsWith('B') ? 'BENAR (B)' : 'SALAH (S)'}
                                                                            </td>
                                                                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                                                {isMatch ? <span style={{ color: '#10b981', fontWeight: 800 }}>✓ Tepat</span> : <span style={{ color: '#ef4444', fontWeight: 800 }}>✗ Keliru</span>}
                                                                            </td>
                                                                            <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800 }}>
                                                                                {isMatch ? (
                                                                                    <span style={{ color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>+{ptsPerItem} Pts</span>
                                                                                ) : (
                                                                                    <span style={{ color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>0 Pts</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            <div className="transcript-ans-box" style={{ padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
                                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Jawaban Anda</p>
                                                <p className="transcript-ans-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{item.jawabanSiswa}</p>
                                            </div>
                                        )}

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
                /* Practice / Simulation Banner Modern Design */
                .practice-banner-card {
                    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0e7ff 100%);
                    border: 1.5px solid #bfdbfe;
                    border-radius: 20px;
                    padding: 24px 28px;
                    margin-bottom: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 24px;
                    box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.12), 0 4px 6px -2px rgba(59, 130, 246, 0.05);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                }
                .practice-banner-card::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -10%;
                    width: 300px;
                    height: 300px;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
                    border-radius: 50%;
                    pointer-events: none;
                }
                .practice-banner-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 14px 30px -5px rgba(59, 130, 246, 0.2);
                    border-color: #93c5fd;
                }
                .practice-banner-left {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    flex: 1;
                    position: relative;
                    z-index: 1;
                }
                .practice-icon-circle {
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.4);
                }
                .practice-text-content {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .practice-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(37, 99, 235, 0.1);
                    color: #1d4ed8;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 0.04em;
                    width: fit-content;
                }
                .practice-title {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #1e3a8a;
                    letter-spacing: -0.01em;
                }
                .practice-desc {
                    margin: 0;
                    font-size: 0.875rem;
                    color: #475569;
                    line-height: 1.5;
                }
                .practice-desc strong {
                    color: #1e293b;
                }
                .practice-start-btn {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    color: white;
                    border: none;
                    padding: 14px 24px;
                    border-radius: 14px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.4);
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    white-space: nowrap;
                    flex-shrink: 0;
                    position: relative;
                    z-index: 1;
                }
                .practice-start-btn:hover {
                    background: linear-gradient(135deg, #1d4ed8, #1e40af);
                    transform: translateY(-2px);
                    box-shadow: 0 12px 24px -4px rgba(37, 99, 235, 0.5);
                }
                .practice-start-btn:active {
                    transform: translateY(0);
                }

                @media (max-width: 768px) {
                    .practice-banner-card {
                        flex-direction: column;
                        align-items: flex-start;
                        padding: 20px;
                        gap: 18px;
                    }
                    .practice-start-btn {
                        width: 100%;
                        justify-content: center;
                    }
                }

                /* Dark Mode for Practice Banner */
                [data-theme="dark"] .practice-banner-card {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-color: #334155;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
                }
                [data-theme="dark"] .practice-banner-card:hover {
                    border-color: #3b82f6;
                }
                [data-theme="dark"] .practice-title {
                    color: #f8fafc;
                }
                [data-theme="dark"] .practice-desc {
                    color: #94a3b8;
                }
                [data-theme="dark"] .practice-desc strong {
                    color: #f1f5f9;
                }
                [data-theme="dark"] .practice-tag {
                    background: rgba(59, 130, 246, 0.2);
                    color: #93c5fd;
                }
                [data-theme="dark"] .practice-start-btn {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    box-shadow: 0 8px 20px -4px rgba(59, 130, 246, 0.4);
                }

                .teacher strong {
                    color: #475569;
                    font-weight: 700;
                }
                [data-theme="dark"] .teacher strong {
                    color: #cbd5e1;
                }

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
                
                [data-theme="dark"] .student-home .page-header h1 { color: #f8fafc; }
                [data-theme="dark"] .student-home .page-header p { color: #94a3b8; }
                [data-theme="dark"] .event-btn {
                    background: #1e293b;
                    border-color: #334155;
                    color: #cbd5e1;
                }
                [data-theme="dark"] .event-btn:hover {
                    background: #334155;
                    color: #f8fafc;
                }
                [data-theme="dark"] .event-btn.active {
                    background: #1e3a8a;
                    border-color: #3b82f6;
                    color: #bfdbfe;
                }
                [data-theme="dark"] .student-exam-card {
                    background: #1e293b;
                    border-color: #334155;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                }
                [data-theme="dark"] .student-exam-card:hover {
                    border-color: #3b82f6;
                }
                [data-theme="dark"] .student-exam-card h3 {
                    color: #f8fafc;
                }
                [data-theme="dark"] .teacher {
                    color: #94a3b8;
                }
                [data-theme="dark"] .subject-icon {
                    background: #0f172a;
                    color: #60a5fa;
                }
                [data-theme="dark"] .exam-times {
                    background: #0f172a;
                }
                [data-theme="dark"] .time-item {
                    color: #cbd5e1;
                }
                [data-theme="dark"] .token-modal h2, [data-theme="dark"] .token-modal h3 {
                    color: #f8fafc;
                }
                [data-theme="dark"] .token-modal p {
                    color: #94a3b8;
                }
                [data-theme="dark"] .token-field {
                    background: #0f172a;
                    border-color: #334155;
                    color: #f8fafc;
                }
                [data-theme="dark"] .token-field:focus {
                    background: #0f172a;
                    border-color: #3b82f6;
                }
                [data-theme="dark"] .btn-cancel {
                    background: #0f172a;
                    border-color: #334155;
                    color: #cbd5e1;
                }
                [data-theme="dark"] .btn-cancel:hover {
                    background: #334155;
                    color: #f8fafc;
                }

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
