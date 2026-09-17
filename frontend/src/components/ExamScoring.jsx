import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BookOpen, BookMarked, UserCheck, AlertCircle, ChevronLeft, CheckCircle2, Award, Brain, Save, Check, Clock, Timer, FileDown,
    ArrowLeft, CloudUpload, ShieldCheck, BarChart2, X, Activity, Brush, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const ExamScoring = () => {
    const [events, setEvents] = useState([]);
    const [exams, setExams] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [selectedExam, setSelectedExam] = useState(null);
    const [loading, setLoading] = useState(false);
    const [viewingPraktek, setViewingPraktek] = useState(null);
    const [nilaiPraktekList, setNilaiPraktekList] = useState([]);
    const [loadingSync, setLoadingSync] = useState(false);

    // Scoring State
    const [questions, setQuestions] = useState([]);
    const [studentsData, setStudentsData] = useState([]); // Array of { siswaId, namaSiswa, nisn, answers: [] }
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showAiModal, setShowAiModal] = useState(false);
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const resp = await axios.get('/api/exam/event', { headers });
            setEvents(resp.data);
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    };

    const handleEventChange = async (e) => {
        const eventId = e.target.value;
        setSelectedEventId(eventId);
        setSelectedExam(null);
        if (!eventId) return;

        setLoading(true);
        try {
            const resp = await axios.get(`/api/exam/ujian-mapel/event/${eventId}`, { headers });
            // Filter only exams that belong to this teacher, unless ADMIN/TU
            let fetchedExams = resp.data;
            if (user.role === 'GURU') {
                fetchedExams = fetchedExams.filter(exam => exam.guruId == user.profileId);
            }
            setExams(fetchedExams);
        } catch (err) {
            console.error('Error fetching exams:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectExam = async (exam) => {
        setSelectedExam(exam);
        setSelectedStudent(null);
        setLoading(true);
        try {
            // Fetch Questions & Answers for both Essay and PG in parallel
            const [qResp, pgResp, monitorResp, ansResp, pgAnsResp] = await Promise.all([
                axios.get(`/api/exam/soal-essay/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/soal-pg/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/ujian-mapel/${exam.id}/monitoring`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/jawaban/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] })),
                axios.get(`/api/exam/jawaban-pg/ujian/${exam.id}`, { headers }).catch(() => ({ data: [] }))
            ]);

            const pgQuestions = (pgResp.data || []).map(q => {
                let resolvedTipe = q.tipeSoal;
                const isBS = resolvedTipe === 'BENAR_SALAH' || (
                    q.pilihanA && q.pilihanB &&
                    (q.pilihanA.trim().toLowerCase() === 'benar' || q.pilihanA.trim().toLowerCase() === 'true') &&
                    (q.pilihanB.trim().toLowerCase() === 'salah' || q.pilihanB.trim().toLowerCase() === 'false') &&
                    (!q.pilihanC || q.pilihanC === '-' || q.pilihanC.trim() === '')
                );
                const isKompleks = resolvedTipe === 'PG_KOMPLEKS' || (
                    q.kunciJawaban && q.kunciJawaban.includes(',')
                );

                if (isBS) resolvedTipe = 'BENAR_SALAH';
                else if (isKompleks) resolvedTipe = 'PG_KOMPLEKS';
                else if (!resolvedTipe) resolvedTipe = 'PG_BIASA';

                return {
                    ...q,
                    qType: 'pg',
                    tipeSoal: resolvedTipe,
                    bobotNilai: q.bobotNilai || 2
                };
            });

            const essayQuestions = (qResp.data || []).map(q => ({
                ...q,
                qType: 'essay',
                bobotNilai: q.bobotNilai || 10
            }));

            const allQuestions = [...pgQuestions, ...essayQuestions];
            setQuestions(allQuestions);

            const monitorData = monitorResp.data || [];
            const allEssayAnswers = ansResp.data || [];
            const allPgAnswers = pgAnsResp.data || [];

            // Map monitoring data to student objects
            const studentMap = {};
            monitorData.forEach(m => {
                studentMap[m.siswaId] = {
                    siswaId: m.siswaId,
                    namaSiswa: m.namaSiswa,
                    nisn: m.nisn,
                    isOnline: m.isOnline,
                    isFinished: m.isFinished,
                    namaKelas: 'Tanpa Kelas',
                    answers: [],
                    pgAnswers: [],
                    essayAnswers: []
                };
            });

            // Attach PG answers
            allPgAnswers.forEach(ans => {
                const sId = ans.siswaId;
                if (!studentMap[sId]) {
                    studentMap[sId] = {
                        siswaId: sId,
                        namaSiswa: ans.namaSiswa || 'Siswa',
                        nisn: ans.nisn || '-',
                        isOnline: false,
                        isFinished: ans.statusSelesaiUjian || false,
                        namaKelas: ans.namaKelas || 'Tanpa Kelas',
                        answers: [],
                        pgAnswers: [],
                        essayAnswers: []
                    };
                }
                const formattedAns = {
                    ...ans,
                    qType: 'pg',
                    soalId: ans.soalPGId || ans.soalId,
                    jawaban: ans.jawaban || ans.jawabanDipilih || '',
                    skorFinalGuru: ans.skor !== null && ans.skor !== undefined ? ans.skor : 0,
                    isGraded: true
                };
                studentMap[sId].answers.push(formattedAns);
                studentMap[sId].pgAnswers.push(formattedAns);
                if (ans.namaKelas) studentMap[sId].namaKelas = ans.namaKelas;
                if (ans.statusSelesaiUjian) studentMap[sId].isFinished = true;
            });

            // Attach Essay answers
            allEssayAnswers.forEach(ans => {
                const sId = ans.siswaId;
                if (!studentMap[sId]) {
                    studentMap[sId] = {
                        siswaId: sId,
                        namaSiswa: ans.namaSiswa || 'Siswa',
                        nisn: ans.nisn || '-',
                        isOnline: false,
                        isFinished: ans.statusSelesaiUjian || false,
                        namaKelas: ans.namaKelas || 'Tanpa Kelas',
                        answers: [],
                        pgAnswers: [],
                        essayAnswers: []
                    };
                }
                const isGraded = ans.skorFinalGuru !== null && ans.skorFinalGuru !== undefined;
                const formattedAns = {
                    ...ans,
                    qType: 'essay',
                    soalId: ans.soalId,
                    isGraded: isGraded
                };
                studentMap[sId].answers.push(formattedAns);
                studentMap[sId].essayAnswers.push(formattedAns);
                if (ans.namaKelas) studentMap[sId].namaKelas = ans.namaKelas;
                if (ans.statusSelesaiUjian) studentMap[sId].isFinished = true;
            });

            const totalMaxBobot = allQuestions.reduce((acc, q) => acc + (q.bobotNilai || 0), 0);
            const totalPgBobot = pgQuestions.reduce((acc, q) => acc + (q.bobotNilai || 0), 0);
            const totalEssayBobot = essayQuestions.reduce((acc, q) => acc + (q.bobotNilai || 0), 0);

            // Calculate metrics for list
            const grouped = Object.values(studentMap).map(std => {
                let totalAi = 0;
                let totalGuru = 0;
                let totalPg = 0;
                let totalEssay = 0;
                let isFullyGraded = true;
                let start = null;
                let end = null;

                // Hitung nilai PG (otomatis)
                pgQuestions.forEach(q => {
                    const ans = std.pgAnswers.find(a => a.soalId === q.id);
                    if (ans && ans.skorFinalGuru !== null && ans.skorFinalGuru !== undefined) {
                        totalPg += ans.skorFinalGuru;
                        totalGuru += ans.skorFinalGuru;
                    }
                });

                // Hitung nilai Essay
                if (essayQuestions.length > 0) {
                    essayQuestions.forEach(q => {
                        const ans = std.essayAnswers.find(a => a.soalId === q.id);
                        if (ans) {
                            if (ans.skorAi) totalAi += ans.skorAi;
                            if (ans.skorFinalGuru !== null && ans.skorFinalGuru !== undefined) {
                                totalEssay += ans.skorFinalGuru;
                                totalGuru += ans.skorFinalGuru;
                            } else {
                                isFullyGraded = false;
                            }
                        } else {
                            isFullyGraded = false;
                        }
                    });
                } else {
                    // Jika ujian murni PG, dan siswa telah menyelesaikan ujian:
                    if (!std.isFinished) {
                        isFullyGraded = false;
                    }
                }

                [...std.pgAnswers, ...std.essayAnswers].forEach(a => {
                    if (a.waktuMulaiUjian) {
                        const dStart = new Date(a.waktuMulaiUjian);
                        if (!start || dStart < start) start = dStart;
                    }
                    if (a.waktuSelesaiUjian) {
                        const dEnd = new Date(a.waktuSelesaiUjian);
                        if (!end || dEnd > end) end = dEnd;
                    }
                });

                let durasiStr = '-';
                if (std.isFinished) {
                    if (start && end) {
                        const diffMs = end - start;
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffSecs = Math.floor((diffMs % 60000) / 1000);
                        durasiStr = `${diffMins}m ${diffSecs}s`;
                    } else {
                        durasiStr = 'Selesai';
                    }
                } else if (start || std.isOnline) {
                    durasiStr = 'Pengerjaan';
                }

                // Skala nilai akhir 0 - 100
                let nilaiAkhir = '0';
                if (totalMaxBobot > 0) {
                    nilaiAkhir = ((totalGuru / totalMaxBobot) * 100).toFixed(1);
                    if (nilaiAkhir.endsWith('.0')) nilaiAkhir = nilaiAkhir.slice(0, -2);
                }

                let nilaiAkhirAi = '0';
                if (totalMaxBobot > 0) {
                    const estimatedAi = totalPg + totalAi;
                    nilaiAkhirAi = ((estimatedAi / totalMaxBobot) * 100).toFixed(1);
                    if (nilaiAkhirAi.endsWith('.0')) nilaiAkhirAi = nilaiAkhirAi.slice(0, -2);
                }

                return {
                    ...std,
                    totalAi,
                    totalGuru,
                    totalPg,
                    totalEssay,
                    totalMaxBobot,
                    totalPgBobot,
                    totalEssayBobot,
                    nilaiAkhir,
                    nilaiAkhirAi,
                    isFullyGraded,
                    durasiStr
                };
            });

            setStudentsData(grouped);
        } catch (err) {
            console.error('Error fetching scoring data:', err);
            alert('Gagal mengambil data jawaban siswa.');
        } finally {
            setLoading(false);
        }
    };

    // Updating Score logic for the selected student
    const [savingId, setSavingId] = useState(null);
    const [isProcessingAll, setIsProcessingAll] = useState(false);

    const triggerAllAiScoring = async () => {
        if (!selectedStudent || isProcessingAll) return;

        const answersToProcess = selectedStudent.answers.filter(a => a.qType === 'essay' && (a.skorAi === null || a.skorAi === undefined));
        if (answersToProcess.length === 0) {
            alert('Semua jawaban sudah memiliki analisis AI.');
            return;
        }

        if (!window.confirm(`Proses AI untuk ${answersToProcess.length} jawaban sekaligus?`)) return;

        setIsProcessingAll(true);
        try {
            for (const ans of answersToProcess) {
                await triggerAiScoring(ans.id);
            }
            alert('Selesai memproses semua analisis AI.');
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessingAll(false);
        }
    };

    const handleSaveScore = async (answerId, newScore, qType = 'essay') => {
        setSavingId(answerId);
        try {
            const parsedScore = parseFloat(newScore) || 0;
            if (qType === 'pg') {
                await axios.put(`/api/exam/jawaban-pg/${answerId}/nilai?skor=${parsedScore}`, {}, { headers });
            } else {
                const payload = new FormData();
                payload.append('skorGuru', parsedScore);
                await axios.put(`/api/exam/jawaban/${answerId}/nilai`, payload, {
                    headers: { ...headers, 'Content-Type': 'multipart/form-data' }
                });
            }

            const totalMaxBobot = questions.reduce((acc, q) => acc + (q.bobotNilai || 0), 0);

            // Update local state for selectedStudent
            setSelectedStudent(prev => {
                if (!prev) return prev;
                const newAnswers = prev.answers.map(a => a.id === answerId ? { ...a, skorFinalGuru: parsedScore, skor: parsedScore, isGraded: true } : a);
                let tguru = 0;
                let full = true;
                questions.forEach(q => {
                    const ans = newAnswers.find(a => a.soalId === q.id);
                    if (ans && ans.skorFinalGuru !== null && ans.skorFinalGuru !== undefined) {
                        tguru += ans.skorFinalGuru;
                    } else {
                        full = false;
                    }
                });
                let nAkhir = totalMaxBobot > 0 ? ((tguru / totalMaxBobot) * 100).toFixed(1) : '0';
                if (nAkhir.endsWith('.0')) nAkhir = nAkhir.slice(0, -2);
                return { ...prev, answers: newAnswers, totalGuru: tguru, nilaiAkhir: nAkhir, isFullyGraded: full };
            });

            // Update global studentsData
            setStudentsData(prev => prev.map(std => {
                if (std.siswaId === selectedStudent.siswaId) {
                    const newAnswers = std.answers.map(a => a.id === answerId ? { ...a, skorFinalGuru: parsedScore, skor: parsedScore, isGraded: true } : a);
                    let tguru = 0;
                    let full = true;
                    questions.forEach(q => {
                        const ans = newAnswers.find(a => a.soalId === q.id);
                        if (ans && ans.skorFinalGuru !== null && ans.skorFinalGuru !== undefined) {
                            tguru += ans.skorFinalGuru;
                        } else {
                            full = false;
                        }
                    });
                    let nAkhir = totalMaxBobot > 0 ? ((tguru / totalMaxBobot) * 100).toFixed(1) : '0';
                    if (nAkhir.endsWith('.0')) nAkhir = nAkhir.slice(0, -2);
                    return { ...std, answers: newAnswers, totalGuru: tguru, nilaiAkhir: nAkhir, isFullyGraded: full };
                }
                return std;
            }));

        } catch (err) {
            console.error('Save score error:', err);
            alert('Gagal menyimpan nilai');
        } finally {
            setSavingId(null);
        }
    };

    const handleRecalculatePG = async () => {
        if (!selectedExam) return;
        if (!window.confirm('Hitung ulang otomatis seluruh skor jawaban PG untuk ujian ini?')) return;
        setLoading(true);
        try {
            await axios.post(`/api/exam/jawaban-pg/ujian/${selectedExam.id}/recalculate`, {}, { headers });
            alert('Skor PG berhasil dihitung ulang!');
            await handleSelectExam(selectedExam);
        } catch (err) {
            console.error('Recalculate error:', err);
            alert('Gagal menghitung ulang skor PG.');
        } finally {
            setLoading(false);
        }
    };

    const triggerAiScoring = async (answerId) => {
        setSavingId(answerId);
        setShowAiModal(true);
        try {
            const res = await axios.post(`/api/exam/jawaban/${answerId}/ai-score`, {}, { headers });

            if (res.data) {
                // Perbarui state selectedStudent
                setSelectedStudent(prev => {
                    if (!prev) return prev;
                    const newAnswers = prev.answers.map(a => a.id === answerId ? res.data : a);
                    let tAi = 0;
                    newAnswers.forEach(a => {
                        if (a.skorAi !== null && a.skorAi !== undefined) tAi += a.skorAi;
                    });
                    const nAkhirAi = questions.length > 0 ? (tAi / questions.length).toFixed(1) : 0;
                    return { ...prev, answers: newAnswers, totalAi: tAi, nilaiAkhirAi: nAkhirAi };
                });

                // Perbarui state global studentsData
                setStudentsData(prev => prev.map(std => {
                    if (std.siswaId === selectedStudent?.siswaId) {
                        const newAnswers = std.answers.map(a => a.id === answerId ? res.data : a);
                        let tAi = 0;
                        newAnswers.forEach(a => {
                            if (a.skorAi !== null && a.skorAi !== undefined) tAi += a.skorAi;
                        });
                        const nAkhirAi = questions.length > 0 ? (tAi / questions.length).toFixed(1) : 0;
                        return { ...std, answers: newAnswers, totalAi: tAi, nilaiAkhirAi: nAkhirAi };
                    }
                    return std;
                }));
            }
        } catch (err) {
            console.error('Trigger AI Error:', err.response?.data || err);
            const status = err.response?.status;
            let msg = err.response?.data?.message || err.response?.data || err.message;
            if (typeof msg === 'object') {
                try {
                    msg = msg.message || JSON.stringify(msg);
                } catch (e) {
                    msg = 'Kesalahan sistem internal (500)';
                }
            }
            alert(`AI ERROR (${status || 'API'}): ${msg}`);
        } finally {
            setSavingId(null);
            setShowAiModal(false);
        }
    };

    const handleToggleNilai = async () => {
        if (!selectedExam) return;
        const confirmMsg = selectedExam.tampilkanNilai
            ? 'Sembunyikan Nilai Final dari akun siswa?'
            : 'Publikasikan Nilai Final ke akun siswa? (Mereka akan bisa melihat transkrip)';
        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await axios.put(`/api/exam/ujian-mapel/${selectedExam.id}/toggle-nilai`, {}, { headers });
            setSelectedExam(res.data);
            alert(res.data.tampilkanNilai ? 'Nilai berhasil dipublikasikan.' : 'Nilai kembali disembunyikan.');
        } catch (err) {
            console.error(err);
            alert('Gagal mengubah visibilitas nilai.');
        }
    };

    const getAnalyticsData = () => {
        if (!studentsData || studentsData.length === 0) return null;

        let min = 100, max = 0, sum = 0;
        let cSelesai = 0, cPending = 0;
        const dist = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };

        studentsData.forEach(s => {
            if (s.isFullyGraded) cSelesai++;
            else cPending++;

            const score = parseFloat(s.nilaiAkhir) || 0;
            if (score < min) min = score;
            if (score > max) max = score;
            sum += score;

            if (score <= 20) dist['0-20']++;
            else if (score <= 40) dist['21-40']++;
            else if (score <= 60) dist['41-60']++;
            else if (score <= 80) dist['61-80']++;
            else dist['81-100']++;
        });

        const avg = studentsData.length > 0 ? (sum / studentsData.length) : 0;
        const distData = Object.keys(dist).map(key => ({ name: key, count: dist[key] }));

        return { min: min === 100 && max === 0 ? 0 : min, max, avg: avg.toFixed(1), total: studentsData.length, cSelesai, cPending, distData };
    };

    const handleManagePraktek = async (exam) => {
        setViewingPraktek(exam);
        const token = localStorage.getItem('token');
        try {
            setLoading(true);
            const res = await axios.get(`/api/exam/nilai-praktek/${exam.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNilaiPraktekList(res.data);
        } catch (err) {
            console.error(err);
            alert('Gagal mengambil daftar siswa');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePraktek = async () => {
        const token = localStorage.getItem('token');
        try {
            setLoading(true);
            const res = await axios.post('/api/exam/nilai-praktek/save', nilaiPraktekList, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data);
            setViewingPraktek(null);
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan nilai: ' + (err.response?.data || err.message));
        } finally {
            setLoading(false);
        }
    };

    
    const handleResetStudentExam = async () => {
        if (!selectedStudent || !selectedExam) return;
        const confirmMsg = `Yakin ingin mengizinkan ${selectedStudent.namaSiswa} untuk mengulang ujian ini?\n\nStatus pengerjaan dan seluruh jawaban siswa sebelumnya akan direset agar siswa dapat mulai mengerjakan kembali dari nomor 1.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post(`/api/exam/ujian-mapel/${selectedExam.id}/reset-siswa/${selectedStudent.siswaId}`, {}, { headers });
            alert(`Berhasil! Ujian untuk ${selectedStudent.namaSiswa} telah direset. Siswa sekarang dapat membuka menu ujian dan mengulanginya.`);
            setSelectedStudent(null);
            fetchExamData();
        } catch (err) {
            console.error('Failed to reset exam for student', err);
            alert('Gagal mereset ujian siswa: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleSyncToDrive = async () => {
        if (!selectedExam) return;
        setLoadingSync(true);
        try {
            const resp = await axios.post(`/api/exam/jawaban/ujian/${selectedExam.id}/sync-drive`, {}, { headers });
            alert(resp.data);
        } catch (err) {
            console.error(err);
            alert('Gagal sinkronisasi ke Drive');
        } finally {
            setLoadingSync(false);
        }
    };


    const exportToExcel = () => {
        if (!selectedExam || studentsData.length === 0) return;

        // Create a hidden table for summary
        const table = document.createElement('table');

        // Header
        const header = table.createTHead();
        const hRow = header.insertRow(0);
        ['No', 'Nama Siswa', 'NISN', 'Kelas', 'Status Ujian', 'Total Skor (Guru)', 'Nilai Akhir (Rata-rata)'].forEach((text, i) => {
            const cell = hRow.insertCell(i);
            cell.innerHTML = `<b>${text}</b>`;
        });

        // Body
        const body = table.createTBody();
        studentsData.forEach((std, index) => {
            const row = body.insertRow(index);
            row.insertCell(0).innerText = index + 1;
            row.insertCell(1).innerText = std.namaSiswa;
            row.insertCell(2).innerText = std.nisn;
            row.insertCell(3).innerText = std.namaKelas;
            row.insertCell(4).innerText = std.isFinished ? 'Selesai' : (std.durasiStr === 'Pengerjaan' ? 'Sedang Mengerjakan' : 'Belum Memulai');
            row.insertCell(5).innerText = std.totalGuru;
            row.insertCell(6).innerText = std.nilaiAkhir;
        });

        const template = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Ringkasan Nilai</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
                    <style>
                        table { border-collapse: collapse; }
                        th, td { border: 1px solid #000; padding: 5px; }
                        .title { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
                    </style>
                </head>
                <body>
                    <div class="title">HASIL UJIAN: ${selectedExam.namaMapel.toUpperCase()}</div>
                    <div class="title">EVENT: ${events.find(e => e.id == selectedEventId)?.namaEvent || '-'}</div>
                    <div class="title">GURU: ${selectedExam.namaGuru}</div>
                    <div class="title">WAKTU EXPORT: ${new Date().toLocaleString('id-ID')}</div>
                    <br/>
                    ${table.outerHTML}
                </body>
            </html>
        `;

        const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = `Nilai_${selectedExam.namaMapel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (viewingPraktek) {
        return (
            <div className="exam-scoring-page animate-fade-in pb-10">
                <div className="workspace-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button className="btn-back" onClick={() => setViewingPraktek(null)}>
                            <ArrowLeft size={20} />
                        </button>
                        <div className="ws-title">
                            <h3>{viewingPraktek.namaMapel}</h3>
                            <span className="badge-guru"><ShieldCheck size={14} /> {viewingPraktek.namaGuru}</span>
                        </div>
                    </div>
                    <div className="header-stats-praktek">
                        <div className="stat-praktek">
                            <label>Siswa Terdata</label>
                            <strong>{nilaiPraktekList.length}</strong>
                        </div>
                    </div>
                </div>

                <div className="card-box" style={{ padding: '32px' }}>
                    <div className="flex justify-between items-center mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>Pengisian Nilai Praktek</h3>
                            <p style={{ color: '#64748b', fontWeight: 600 }}>Nilai akan otomatis di-upload ke BaknusDrive dalam format Excel.</p>
                        </div>
                        <button
                            onClick={handleSavePraktek}
                            className="btn-save-praktek"
                            disabled={loading}
                        >
                            <CloudUpload size={20} />
                            {loading ? 'Menyimpan...' : 'Simpan & Sinkron ke Drive'}
                        </button>
                    </div>

                    <div className="table-wrapper">
                        <table className="praktek-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>No</th>
                                    <th>NISN</th>
                                    <th>Nama Lengkap</th>
                                    <th style={{ width: '200px', textAlign: 'center' }}>Nilai Praktek (1-100)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nilaiPraktekList.map((item, idx) => (
                                    <tr key={item.siswaId}>
                                        <td style={{ fontWeight: 800, color: '#94a3b8' }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{item.nisn}</td>
                                        <td className="praktek-std-name" style={{ fontWeight: 800 }}>{item.namaSiswa}</td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={item.nilai}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const newList = [...nilaiPraktekList];
                                                    newList[idx].nilai = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
                                                    setNilaiPraktekList(newList);
                                                }}
                                                className="score-input-praktek"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <style>{`
                    .table-wrapper { border: 2px solid #f1f5f9; border-radius: 20px; overflow: hidden; }
                    .praktek-table { width: 100%; border-collapse: collapse; }
                    .praktek-table th { background: #f8fafc; padding: 16px 24px; text-align: left; font-weight: 950; color: #475569; text-transform: uppercase; font-size: 0.8rem; border-bottom: 2px solid #f1f5f9; }
                    .praktek-table td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; }
                    .praktek-table tr:last-child td { border-bottom: none; }
                    
                    .score-input-praktek {
                        width: 100px;
                        margin: 0 auto;
                        display: block;
                        padding: 12px;
                        border: 2.5px solid #e2e8f0;
                        border-radius: 12px;
                        text-align: center;
                        font-weight: 900;
                        font-size: 1.25rem;
                        color: #3b82f6;
                        background: #f8fafc;
                        transition: all 0.2s;
                    }
                    .score-input-praktek:focus {
                        border-color: #3b82f6;
                        background: white;
                        outline: none;
                        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                    }
                    .btn-save-praktek {
                        background: #0f172a;
                        color: white;
                        border: none;
                        padding: 14px 32px;
                        border-radius: 16px;
                        font-weight: 800;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-save-praktek:hover { background: #1e293b; transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
                    .btn-save-praktek:disabled { opacity: 0.6; cursor: not-allowed; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="exam-scoring-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Penilaian Ujian (Koreksi)</h1>
                    <p>Periksa jawaban siswa dan berikan penilaian akhir.</p>
                </div>
            </div>

            {!selectedExam ? (
                // 1. SELECT EVENT & EXAM VIEW
                <div className="card-box">
                    <div className="form-group" style={{ maxWidth: '400px', marginBottom: '24px' }}>
                        <label>Pilih Event Ujian</label>
                        <select value={selectedEventId} onChange={handleEventChange} className="custom-select">
                            <option value="">-- Pilih Event --</option>
                            {events.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.namaEvent}</option>
                            ))}
                        </select>
                    </div>

                    {loading && <p>Memuat jadwal ujian...</p>}

                    {selectedEventId && exams.length > 0 && !loading && (
                        <div className="exams-grid">
                            {exams.map(ex => (
                                <div key={ex.id} className="exam-card cursor-pointer" onClick={() => handleSelectExam(ex)}>
                                    <div className="ex-icon"><BookMarked size={24} /></div>
                                    <h3>{ex.namaMapel}</h3>
                                    <p>{ex.namaGuru}</p>
                                    <div className="tag-kelas">{ex.durasi} Menit</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedEventId && exams.length === 0 && !loading && (
                        <div className="empty-state">
                            <AlertCircle size={40} />
                            <p>Tidak ada jadwal ujian untuk Anda di event ini.</p>
                        </div>
                    )}
                </div>
            ) : (
                // 2. SCORING WORKSPACE VIEW
                <div className="scoring-workspace">
                    <div className="workspace-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button className="btn-back" onClick={() => setSelectedExam(null)}>
                                <ChevronLeft size={20} />
                            </button>
                            <div className="ws-title">
                                <h3>{selectedExam.namaMapel}</h3>
                                <span className="badge-guru">{selectedExam.namaGuru}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                className="btn-analytics"
                                style={{ background: selectedExam.tampilkanNilai ? '#ecfdf5' : '#f8fafc', borderColor: selectedExam.tampilkanNilai ? '#10b981' : '#e2e8f0', color: selectedExam.tampilkanNilai ? '#059669' : '#64748b' }}
                                onClick={handleToggleNilai}
                            >
                                {selectedExam.tampilkanNilai ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                {selectedExam.tampilkanNilai ? 'Nilai Dipublikasi' : 'Sembunyikan Nilai'}
                            </button>
                            <button className="btn-analytics" onClick={() => setShowAnalyticsModal(true)}>
                                <BarChart2 size={18} /> Analitik Ujian
                            </button>
                            <button className="btn-analytics" onClick={() => handleSelectExam(selectedExam)} title="Tarik pembaruan data siswa jika ada perubahan di kelas">
                                <RefreshCw size={18} /> Sync Peserta
                            </button>
                            <button className="btn-praktek" onClick={() => handleManagePraktek(selectedExam)}>
                                <CloudUpload size={18} /> Nilai Praktek
                            </button>
                            <button className="btn-sync-drive" onClick={handleSyncToDrive} disabled={loadingSync}>
                                <CloudUpload size={18} /> {loadingSync ? 'Syncing...' : 'Sync Essay ke Drive'}
                            </button>
                            <button className="btn-export" onClick={exportToExcel}>
                                <FileDown size={18} /> Export Nilai (Excel)
                            </button>
                        </div>
                    </div>

                    <div className="scoring-grid">
                        {/* LEFT: STUDENT LIST */}
                        <div className="student-list-card">
                            <div className="list-title">
                                <UserCheck size={18} /> Daftar Submisi Siswa ({studentsData.length})
                            </div>
                            {loading ? <p className="p-4 text-center">Memuat jawaban...</p> : (
                                <div className="student-scroll">
                                    {Object.entries(
                                        studentsData.reduce((acc, std) => {
                                            const kelas = std.namaKelas || 'Tanpa Kelas';
                                            if (!acc[kelas]) acc[kelas] = [];
                                            acc[kelas].push(std);
                                            return acc;
                                        }, {})
                                    ).sort(([k1], [k2]) => k1.localeCompare(k2)).map(([kelasName, stds]) => (
                                        <div key={kelasName} className="kelas-group">
                                            <div className="kelas-header">{kelasName}</div>
                                            {stds.map(std => (
                                                <div
                                                    key={std.siswaId}
                                                    className={`student-item ${selectedStudent?.siswaId === std.siswaId ? 'active' : ''} ${std.isFullyGraded ? 'graded' : ''}`}
                                                    onClick={() => setSelectedStudent(std)}
                                                >
                                                    <div className="std-info">
                                                        <div className="std-name">{std.namaSiswa}</div>
                                                        <div className="std-nisn">NIS: {std.nisn}</div>
                                                        <div className={`std-status-tag ${std.isFinished ? 'selesai' : 'online'}`}>
                                                            {std.isFinished ? (
                                                                <><CheckCircle2 size={10} style={{ marginRight: '4px' }} /> Selesai</>
                                                            ) : (
                                                                <><Timer size={10} style={{ marginRight: '4px' }} /> Sedang Mengerjakan</>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="std-status">
                                                        {std.isFullyGraded ? (
                                                            <span className="badge-graded"><CheckCircle2 size={14} /> Sudah Dinilai</span>
                                                        ) : (
                                                            <span className="badge-pending">{std.isFinished ? 'Koreksi Essay' : 'Sedang Mengerjakan'}</span>
                                                        )}
                                                        <div className="std-score" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                                            Skor: <strong>{std.totalGuru}</strong> / {std.totalMaxBobot || 100}
                                                        </div>
                                                        <div className="std-final-score" style={{ fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                                                            Nilai Akhir: <span style={{ color: '#16a34a', fontSize: '1.05rem' }}>{std.nilaiAkhir}</span>
                                                        </div>
                                                    </div>
                                                    <div className="std-time" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                                        <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                                        Durasi: <strong>{std.durasiStr}</strong>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    {studentsData.length === 0 && (
                                        <div className="p-8 text-center text-slate-400">Belum ada siswa yang mensubmit ujian ini.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: GRADING PANEL */}
                        <div className="grading-card">
                            {!selectedStudent ? (
                                <div className="empty-grading">
                                    <Award size={48} />
                                    <h3>Pilih Siswa</h3>
                                    <p>Silakan klik nama siswa di panel kiri untuk mulai mengoreksi jawabannya.</p>
                                </div>
                            ) : (
                                <div className="grading-content">
                                    <div className="grading-head">
                                        <div>
                                            <h2>Koreksi: {selectedStudent.namaSiswa}</h2>
                                            <div style={{ color: '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                <Clock size={14} /> Waktu Mengerjakan: <strong>{selectedStudent.durasiStr}</strong>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                                <button
                                                    className="btn-ai-all"
                                                    onClick={triggerAllAiScoring}
                                                    disabled={isProcessingAll}
                                                >
                                                    <Brain size={16} /> {isProcessingAll ? 'Memproses...' : 'Analisis Semua dengan AI'}
                                                </button>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', maxWidth: '300px', textAlign: 'right' }}>
                                                    * BaknusAI bisa membuat kesalahan. Keputusan nilai tetap pada Guru.
                                                </span>
                                            </div>
                                            <div className="total-score-badge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '150px' }}>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Nilai Akhir Siswa:</span>
                                                <strong style={{ fontSize: '1.4rem', color: '#15803d' }}>{selectedStudent.nilaiAkhir}</strong>
                                                <span style={{ fontSize: '0.7rem', marginBottom: '6px' }}>Total Skor: {selectedStudent.totalGuru} / {questions.reduce((a, b) => a + (b.bobotNilai || 0), 0)}</span>
                                                {selectedStudent.isFullyGraded && (
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(`Setujui Nilai Akhir ${selectedStudent.nilaiAkhir} untuk ${selectedStudent.namaSiswa}? Ini akan langsung sinkronisasi keseluruhan rekap nilai ujian ke BaknusDrive.`)) {
                                                                handleSyncToDrive();
                                                            }
                                                        }}
                                                        style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s', marginTop: '4px' }}
                                                        onMouseOver={(e) => e.target.style.background = '#059669'}
                                                        onMouseOut={(e) => e.target.style.background = '#10b981'}
                                                    >
                                                        <CheckCircle2 size={14} /> Setujui & Sync Laporan
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="answers-list">
                                        {questions.map((q, idx) => {
                                            const ans = selectedStudent.answers.find(a => a.soalId === q.id);
                                            const isPG = q.qType === 'pg';

                                            if (isPG) {
                                                const studentChoice = ans?.jawaban || ans?.jawabanDipilih || '';
                                                const keyAnswer = q.kunciJawaban || '';
                                                const earnedScore = ans?.skorFinalGuru !== null && ans?.skorFinalGuru !== undefined ? ans.skorFinalGuru : (ans?.skor || 0);

                                                // Check choices matching
                                                const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, '').trim();
                                                const studentChoicesList = studentChoice.split(/[,;\s]+/).map(s => stripHtml(s).toUpperCase()).filter(Boolean);
                                                const keyChoicesList = keyAnswer.split(/[,;\s]+/).map(s => stripHtml(s).toUpperCase()).filter(Boolean);

                                                const isBS = q.tipeSoal === 'BENAR_SALAH' || (
                                                    q.pilihanA && q.pilihanB &&
                                                    (q.pilihanA.trim().toLowerCase() === 'benar' || q.pilihanA.trim().toLowerCase() === 'true') &&
                                                    (q.pilihanB.trim().toLowerCase() === 'salah' || q.pilihanB.trim().toLowerCase() === 'false') &&
                                                    (!q.pilihanC || q.pilihanC === '-' || q.pilihanC.trim() === '')
                                                );
                                                const isKompleks = !isBS && (
                                                    (q.tipeSoal && q.tipeSoal.toUpperCase().includes('KOMPLEKS')) ||
                                                    (q.kunciJawaban && (q.kunciJawaban.includes(',') || q.kunciJawaban.includes(';'))) ||
                                                    (studentChoice && (studentChoice.includes(',') || studentChoice.includes(';')))
                                                );

                                                const options = isBS ? [
                                                    { key: 'A', text: q.pilihanA || 'Benar' },
                                                    { key: 'B', text: q.pilihanB || 'Salah' }
                                                ] : [
                                                    { key: 'A', text: q.pilihanA },
                                                    { key: 'B', text: q.pilihanB },
                                                    { key: 'C', text: q.pilihanC },
                                                    { key: 'D', text: q.pilihanD },
                                                    { key: 'E', text: q.pilihanE }
                                                ].filter(opt => opt.text && opt.text.trim() !== '' && opt.text !== '-');

                                                return (
                                                    <div key={q.id} className="answer-item" style={{ borderLeft: '4px solid #3b82f6' }}>
                                                        <div className="q-banner" style={{ background: '#eff6ff' }}>
                                                            <span className="q-num" style={{ color: '#1d4ed8' }}>
                                                                Soal #{idx + 1} &bull; {isBS ? 'Benar / Salah' : isKompleks ? 'Pilihan Ganda Lebih dari 1' : 'Pilihan Ganda'}
                                                            </span>
                                                            <span className="q-bobot" style={{ background: '#dbeafe', color: '#1e40af' }}>Bobot: {q.bobotNilai || 2} Poin</span>
                                                        </div>

                                                        <div className="q-question" dangerouslySetInnerHTML={{ __html: q.pertanyaan }}></div>

                                                        {/* Option preview list */}
                                                        <div className="pg-options-preview" style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0' }}>
                                                            {options.map(opt => {
                                                                const cleanOptText = stripHtml(opt.text).toUpperCase();
                                                                const isChosen = studentChoicesList.includes(opt.key) || 
                                                                    (cleanOptText && studentChoicesList.includes(cleanOptText)) ||
                                                                    (isBS && ((opt.key === 'A' && (studentChoice.toUpperCase() === 'BENAR' || studentChoice.toUpperCase() === 'TRUE' || studentChoice === '1')) ||
                                                                              (opt.key === 'B' && (studentChoice.toUpperCase() === 'SALAH' || studentChoice.toUpperCase() === 'FALSE' || studentChoice === '0'))));
                                                                const isKey = keyChoicesList.includes(opt.key) || 
                                                                    (cleanOptText && keyChoicesList.includes(cleanOptText)) ||
                                                                    (isBS && ((opt.key === 'A' && (keyAnswer.toUpperCase() === 'BENAR' || keyAnswer.toUpperCase() === 'TRUE' || keyAnswer === '1')) ||
                                                                              (opt.key === 'B' && (keyAnswer.toUpperCase() === 'SALAH' || keyAnswer.toUpperCase() === 'FALSE' || keyAnswer === '0'))));

                                                                let borderCol = '#e2e8f0';
                                                                let bgCol = '#ffffff';
                                                                if (isChosen && isKey) {
                                                                    borderCol = '#22c55e';
                                                                    bgCol = '#f0fdf4';
                                                                } else if (isChosen && !isKey) {
                                                                    borderCol = '#ef4444';
                                                                    bgCol = '#fef2f2';
                                                                } else if (isKey) {
                                                                    borderCol = '#16a34a';
                                                                    bgCol = '#f0fdf4';
                                                                }

                                                                return (
                                                                    <div
                                                                        key={opt.key}
                                                                        style={{
                                                                            padding: '10px 14px',
                                                                            borderRadius: '10px',
                                                                            border: `2px solid ${borderCol}`,
                                                                            background: bgCol,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            fontSize: '0.9rem'
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                            <strong style={{ minWidth: '24px', color: '#334155' }}>{opt.key}.</strong>
                                                                            <span dangerouslySetInnerHTML={{ __html: opt.text }}></span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                                            {isKey && (
                                                                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px' }}>
                                                                                    Kunci Jawaban
                                                                                </span>
                                                                            )}
                                                                            {isChosen && (
                                                                                <span style={{ background: isKey ? '#bbf7d0' : '#fee2e2', color: isKey ? '#166534' : '#991b1b', padding: '2px 8px', borderRadius: '6px' }}>
                                                                                    Pilihan Siswa
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Summary evaluation box */}
                                                        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                                    Jawaban Siswa: <strong style={{ color: '#0f172a' }}>{studentChoice || '(Kosong / Tidak Dijawab)'}</strong>
                                                                    {' '}&bull;{' '}
                                                                    Kunci Jawaban: <strong style={{ color: '#16a34a' }}>{keyAnswer}</strong>
                                                                </div>
                                                                <div style={{ marginTop: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    {earnedScore >= (q.bobotNilai || 2) ? (
                                                                        <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <CheckCircle2 size={14} /> Nilai Penuh (Otomatis)
                                                                        </span>
                                                                    ) : earnedScore > 0 ? (
                                                                        <span style={{ color: '#d97706', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <AlertCircle size={14} /> Nilai Sebagian (Otomatis)
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <X size={14} /> Jawaban Salah (Otomatis)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>Skor:</label>
                                                                <input
                                                                    type="number"
                                                                    max={q.bobotNilai || 2}
                                                                    min="0"
                                                                    step="0.5"
                                                                    defaultValue={earnedScore}
                                                                    id={`score-${ans ? ans.id : 'pg-' + q.id}`}
                                                                    style={{ width: '70px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'center' }}
                                                                />
                                                                {ans && (
                                                                    <button
                                                                        className="btn-save-score"
                                                                        disabled={savingId === ans.id}
                                                                        onClick={() => {
                                                                            const val = document.getElementById(`score-${ans.id}`).value;
                                                                            if (val !== '') handleSaveScore(ans.id, val, 'pg');
                                                                        }}
                                                                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                                                    >
                                                                        {savingId === ans.id ? '...' : <><Save size={14} /> Ubah</>}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // Render Essay Question
                                            return (
                                                <div key={q.id} className="answer-item">
                                                    <div className="q-banner">
                                                        <span className="q-num">Soal #{idx + 1} &bull; Soal Essay</span>
                                                        <span className="q-bobot">Bobot Maks: {q.bobotNilai || 10}</span>
                                                    </div>

                                                    <div className="q-question" dangerouslySetInnerHTML={{ __html: q.pertanyaan }}></div>

                                                    <div className={`std-answer-box ${ans?.raguRagu ? 'is-ragu' : ''}`}>
                                                        <h4>Jawaban Siswa:</h4>
                                                        {ans?.raguRagu && <div className="ragu-badge" style={{ display: 'inline-block', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px' }}>Ragu - Ragu</div>}
                                                        <p className="ans-text">{ans?.teksJawaban || <span className="text-slate-400 italic">Tidak menjawab</span>}</p>

                                                        {ans?.whiteboardData && (
                                                            <div className="wb-answer-preview" style={{ marginTop: '16px', border: '3px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: 'white', maxWidth: '600px' }}>
                                                                <div style={{ background: '#f8fafc', padding: '6px 16px', fontSize: '0.8rem', fontWeight: '950', color: '#475569', borderBottom: '2px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <Brush size={14} /> Hasil Whiteboard / Corat-coret:
                                                                </div>
                                                                <img
                                                                    src={ans.whiteboardData}
                                                                    alt="Whiteboard"
                                                                    style={{ width: '100%', display: 'block', height: 'auto', background: '#fff' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="key-answer-box">
                                                        <div className="lbl">Rubrik / Kunci Jawaban:</div>
                                                        {q.kunciJawaban && q.kunciJawaban.trim() !== '' && q.kunciJawaban.trim() !== '-' && q.kunciJawaban.trim() !== '<p><br></p>'
                                                            ? <div className="ans-text" dangerouslySetInnerHTML={{ __html: q.kunciJawaban }}></div>
                                                            : <div className="ans-text" style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tidak ada kunci jawaban — AI menilai secara kontekstual.</div>
                                                        }
                                                    </div>

                                                    {ans && (
                                                        <div className="scoring-actions">
                                                            <div className="ai-box">
                                                                <div className="ai-head"><Brain size={16} /> Analisis AI (by BaknusAI)</div>
                                                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '-12px', marginBottom: '16px', fontStyle: 'italic', fontWeight: '500' }}>
                                                                    * BaknusAI bisa saja membuat kesalahan, Kami harap penilaian siswa tetap berpedoman pada Guru.
                                                                </p>
                                                                {ans.skorAi !== null ? (
                                                                    <>
                                                                        <div className="ai-score">Saran Nilai Kandungan: <strong>{ans.skorAi}</strong></div>
                                                                        <div className="ai-reason">{ans.alasanAi}</div>
                                                                    </>
                                                                ) : (
                                                                    <div className="text-sm text-slate-500 mb-2">Belum ada analisis AI.</div>
                                                                )}
                                                                <button className="btn-ai" onClick={() => triggerAiScoring(ans.id)} disabled={savingId === ans.id}>
                                                                    {savingId === ans.id ? (
                                                                        <><span className="spinner"></span> Memproses AI...</>
                                                                    ) : (
                                                                        "Minta Analisis AI (by BaknusAI)"
                                                                    )}
                                                                </button>
                                                            </div>

                                                            <div className="manual-box">
                                                                <label>Nilai Final Guru:</label>
                                                                <div className="score-input-group">
                                                                    <input
                                                                        type="number"
                                                                        max={q.bobotNilai || 10} min="0"
                                                                        defaultValue={ans.skorFinalGuru ?? ''}
                                                                        id={`score-${ans.id}`}
                                                                    />
                                                                    <button
                                                                        className="btn-save-score"
                                                                        disabled={savingId === ans.id}
                                                                        onClick={() => {
                                                                            const val = document.getElementById(`score-${ans.id}`).value;
                                                                            if (val !== '') handleSaveScore(ans.id, val, 'essay');
                                                                        }}
                                                                    >
                                                                        {savingId === ans.id ? 'Menyimpan...' : <><Save size={16} /> Simpan</>}
                                                                    </button>
                                                                    {ans.skorFinalGuru !== null && <CheckCircle2 className="text-green-500" size={24} />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showAnalyticsModal && (
                <div className="analytics-modal-overlay animate-fade-in" onClick={() => setShowAnalyticsModal(false)}>
                    <div className="analytics-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="analytics-header">
                            <div>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontSize: '1.4rem' }}><Activity size={24} color="#3b82f6" /> Analisis Keberhasilan Ujian</h2>
                                <p style={{ margin: '4px 0 0 36px', color: '#64748b', fontSize: '0.9rem' }}>{selectedExam?.namaMapel} - {selectedEventId ? events.find(e => e.id === Number(selectedEventId))?.namaEvent : ''}</p>
                            </div>
                            <button className="btn-close-analytics" onClick={() => setShowAnalyticsModal(false)}><X size={24} /></button>
                        </div>

                        {(() => {
                            const data = getAnalyticsData();
                            if (!data || data.total === 0) return <div className="p-8 text-center text-slate-500" style={{ padding: '40px', fontSize: '1.1rem' }}>Belum ada siswa yang mengikuti ujian ini.</div>;

                            return (
                                <div className="analytics-body">
                                    <div className="analytics-stats-grid">
                                        <div className="analytics-stat-card">
                                            <span className="stat-label">Rata-Rata Kelas</span>
                                            <strong className="stat-value text-blue">{data.avg}</strong>
                                        </div>
                                        <div className="analytics-stat-card">
                                            <span className="stat-label">Nilai Tertinggi</span>
                                            <strong className="stat-value text-green">{data.max}</strong>
                                        </div>
                                        <div className="analytics-stat-card">
                                            <span className="stat-label">Nilai Terendah</span>
                                            <strong className="stat-value text-red">{data.min}</strong>
                                        </div>
                                        <div className="analytics-stat-card">
                                            <span className="stat-label">Total Kehadiran</span>
                                            <strong className="stat-value">{data.total} <small>Siswa</small></strong>
                                        </div>
                                    </div>

                                    <div className="analytics-chart-box">
                                        <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', color: '#1e293b' }}>Distribusi Rentang Nilai</h3>
                                        <div style={{ width: '100%', height: 320 }}>
                                            <ResponsiveContainer>
                                                <BarChart data={data.distData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="name" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                                                    <YAxis allowDecimals={false} tick={{ fill: '#64748b' }} tickLine={false} axisLine={false} />
                                                    <RechartsTooltip cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                    <Bar dataKey="count" name="Jumlah Siswa" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="analytics-footer-status">
                                        <strong>Status Penilaian:</strong> {data.cSelesai} Peserta selesai dinilai penuh. {data.cPending > 0 ? <span style={{ color: '#f59e0b' }}>{data.cPending} Peserta masih menunggu koreksi.</span> : <span style={{ color: '#10b981' }}>Semua peserta telah dinilai.</span>}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* AI LOADING MODAL */}
            {showAiModal && (
                <div className="ai-modal-overlay">
                    <div className="ai-modal-content">
                        <img src="/baknusai.gif" alt="BaknusAI is thinking..." className="ai-gif" />
                        <div className="ai-modal-text">
                            <h3>BaknusAI Sedang Berpikir...</h3>
                            <p>Menganalisis jawaban sesuai kunci jawaban dan rubrik penilaian.</p>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
            .ai-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(10px);
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fade-in 0.3s ease-out;
            }
            .ai-modal-content {
                background: white;
                padding: 40px;
                border-radius: 40px;
                text-align: center;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.6);
                border: 4px solid #3b82f6;
                animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .ai-gif {
                width: 250px;
                height: 250px;
                object-fit: contain;
                margin-bottom: 24px;
                border-radius: 24px;
            }
            .ai-modal-text h3 {
                font-size: 1.7rem;
                font-weight: 950;
                color: #0f172a;
                margin-bottom: 8px;
            }
            .ai-modal-text p {
                color: #64748b;
                font-weight: 700;
                line-height: 1.5;
                font-size: 1.1rem;
            }
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slide-up {
                from { transform: translateY(40px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            .page-header { margin-bottom: 32px; }
                .page-header h1 { font-size: 2rem; color: #0f172a; font-weight: 950; margin-bottom: 8px; letter-spacing: -1px; }
                .page-header p { color: #64748b; font-size: 1.1rem; }

                .card-box { background: white; border-radius: 24px; padding: 32px; border: 2.5px solid #f1f5f9; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.03); }
                .custom-select { width: 100%; padding: 14px 16px; border: 2.5px solid #f1f5f9; background: #f8fafc; border-radius: 16px; font-size: 1.05rem; font-weight: 700; color: #1e293b; outline: none; transition: all 0.2s; }
                .custom-select:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
                .form-group label { display: block; font-size: 0.85rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }

                .exams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .exam-card { background: white; border: 2px solid #e2e8f0; border-radius: 20px; padding: 24px; transition: all 0.3s; position: relative; overflow: hidden; }
                .exam-card:hover { border-color: #3b82f6; box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.15); transform: translateY(-4px); }
                .ex-icon { width: 48px; height: 48px; background: #eff6ff; color: #3b82f6; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
                .exam-card h3 { font-size: 1.2rem; font-weight: 900; color: #1e293b; margin-bottom: 4px; }
                .exam-card p { font-size: 0.9rem; color: #64748b; font-weight: 600; margin-bottom: 16px; }
                .tag-kelas { display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 800; color: #475569; }
                .empty-state { text-align: center; padding: 40px; color: #94a3b8; }

                /* Scoring Workspace */
                .workspace-header { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
                .btn-back { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #64748b; background: white; border: 2px solid #e2e8f0; padding: 10px 20px; border-radius: 14px; width: fit-content; cursor: pointer; transition: all 0.2s; }
                .btn-back:hover { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }
                .ws-title { display: flex; align-items: center; gap: 16px; }
                .ws-title h3 { font-size: 1.75rem; font-weight: 950; color: #0f172a; margin: 0; }
                .badge-guru { background: #eff6ff; color: #2563eb; padding: 6px 16px; border-radius: 50px; font-weight: 800; font-size: 0.9rem; }

                .scoring-grid { display: grid; grid-template-columns: 400px 1fr; gap: 28px; align-items: start; }
                
                .student-list-card { background: white; border-radius: 20px; border: 2px solid #f1f5f9; overflow: hidden; display: flex; flex-direction: column; height: calc(100vh - 200px); position: sticky; top: 20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02); }
                .list-title { padding: 24px; background: #f8fafc; border-bottom: 2px solid #f1f5f9; font-weight: 950; color: #0f172a; display: flex; align-items: center; gap: 12px; font-size: 1.2rem; }
                .student-scroll { overflow-y: auto; flex: 1; }
                
                .kelas-header { background: #e2e8f0; font-size: 0.9rem; font-weight: 950; padding: 12px 24px; color: #334155; text-transform: uppercase; letter-spacing: 1.5px; }
                .student-item { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s; }
                .student-item:hover { background: #f8fafc; }
                .student-item.active { background: #eff6ff; border-left: 4px solid #3b82f6; }
                .student-item.graded { border-left: 4px solid #22c55e; }
                
                .std-name { font-weight: 900; color: #0f172a; font-size: 1.15rem; margin-bottom: 4px; }
                .std-nisn { font-size: 0.8rem; color: #64748b; margin-bottom: 8px; font-weight: 600; }
                .std-status { display: flex; justify-content: space-between; align-items: center; }
                .badge-pending { font-size: 0.8rem; background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 12px; font-weight: 900; }
                .badge-graded { font-size: 0.8rem; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 12px; font-weight: 900; display: flex; align-items: center; gap: 6px; }
                .std-score { font-size: 0.95rem; font-weight: 950; color: #1e293b; background: #f1f5f9; padding: 4px 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; }

                .grading-card { background: white; border-radius: 24px; border: 2px solid #f1f5f9; min-height: calc(100vh - 200px); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02); }
                .empty-grading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #94a3b8; padding: 40px; text-align: center; }
                .empty-grading h3 { margin-top: 16px; font-size: 1.5rem; color: #475569; font-weight: 800; }
                
                .grading-content { padding: 32px; }
                .grading-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px dashed #e2e8f0; }
                .grading-head h2 { margin: 0; font-size: 1.5rem; color: #0f172a; font-weight: 900; }
                .btn-ai-all { display: flex; align-items: center; gap: 8px; background: #6366f1; color: white; border: none; padding: 10px 16px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 0.95rem; }
                .btn-ai-all:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
                .btn-ai-all:disabled { opacity: 0.6; cursor: not-allowed; transform: none!important; }

                .total-score-badge { background: #1e293b; color: white; padding: 12px 24px; border-radius: 16px; font-size: 1.1rem; font-weight: 700; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); }
                .total-score-badge strong { font-size: 1.5rem; color: #38bdf8; font-weight: 950; }

                .answers-list { display: flex; flex-direction: column; gap: 32px; }
                .answer-item { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 20px; padding: 24px; }
                .q-banner { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
                .q-num { background: #3b82f6; color: white; padding: 4px 16px; border-radius: 10px; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; }
                .q-bobot { font-weight: 800; color: #64748b; font-size: 0.9rem; }
                
                .q-question { font-size: 1.15rem; color: #0f172a; font-weight: 600; line-height: 1.6; margin-bottom: 24px; }
                
                .std-answer-box { background: #f8fafc; border: 3px solid #64748b; border-radius: 20px; padding: 24px; margin-bottom: 20px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
                .key-answer-box { background: #fffbeb; border: 2px solid #fde68a; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
                .lbl { font-size: 0.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; color: #475569; }
                .key-answer-box.lbl { color: #b45309; }
                .std-answer-box .ans-text { font-size: 1.2rem; color: #0f172a; line-height: 1.7; font-weight: 700; }
                .ans-text { font-size: 1.05rem; color: #334155; line-height: 1.6; font-weight: 500; white-space: pre-wrap; }

                .scoring-actions { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 24px; }
                .ai-box { background: #f0f7ff; border: 3px solid #3b82f6; border-radius: 24px; padding: 28px; display: flex; flex-direction: column; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.1); }
                .ai-head { display: flex; align-items: center; gap: 10px; font-weight: 900; color: #1d4ed8; margin-bottom: 16px; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .ai-score { font-size: 1.15rem; color: #1e3a8a; margin-bottom: 12px; padding: 12px; background: white; border-radius: 12px; border: 1.5px solid #dbeafe; }
                .ai-score strong { font-size: 2rem; font-weight: 950; color: #2563eb; }
                .ai-reason { font-size: 1.05rem; color: #334155; line-height: 1.7; font-weight: 600; margin-bottom: 20px; flex: 1; background: rgba(255,255,255,0.5); padding: 16px; border-radius: 12px; }
                .btn-ai { background: #3b82f6; color: white; border: none; font-weight: 800; padding: 14px; border-radius: 14px; cursor: pointer; transition: all 0.2s; margin-top: auto; font-size: 1rem; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2); }
                .btn-ai:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 8px 15px rgba(59, 130, 246, 0.3); }

        .std-status-tag {
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    font-weight: 800;
    margin-top: 6px;
    text-transform: uppercase;
    width: fit-content;
}
        .std-status-tag.selesai { background: #dcfce7; color: #166534; }
        .std-status-tag.online { background: #eff6ff; color: #1e40af; animation: pulse-blue 2s infinite; }

@keyframes pulse-blue {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
}

                .manual-box { background: white; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: center; }
                .manual-box label { font-size: 0.95rem; font-weight: 800; color: #1e293b; margin-bottom: 12px; display: block; }
                .score-input-group { display: flex; align-items: center; gap: 12px; }
                .score-input-group input { width: 100px; padding: 12px; font-size: 1.25rem; font-weight: 900; color: #0f172a; border: 2px solid #e2e8f0; border-radius: 12px; text-align: center; outline: none; transition: border-color 0.2s; }
                .score-input-group input:focus { border-color: #3b82f6; }
                .btn-save-score { background: #16a34a; color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
                .btn-save-score:hover { background: #15803d; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(22, 163, 74, 0.2); }
                .btn-save-score:disabled { background: #86efac; cursor: not-allowed; transform: none; box-shadow: none; }

                .btn-export { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2); }
                .btn-export:active { transform: translateY(0); }

                .btn-praktek { background: #f8fafc; color: #3b82f6; border: 2px solid #3b82f6; padding: 10px 20px; border-radius: 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
                .btn-praktek:hover { background: #eff6ff; transform: translateY(-1px); }

                .btn-sync-drive { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2); }
                .btn-sync-drive:hover { background: #2563eb; transform: translateY(-1px); }
                .btn-sync-drive:disabled { background: #94a3b8; cursor: not-allowed; }

                .header-stats-praktek { background: white; border: 2px solid #f1f5f9; padding: 12px 24px; border-radius: 16px; display: flex; align-items: center; }
                .stat-praktek label { font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: block; }
                .stat-praktek strong { font-size: 1.5rem; color: #1e293b; font-weight: 950; }

                /* Dark mode support for AI Box & Grading Panel */
                
                /* Additional Dark Mode Overrides for Scoring */
                [data-theme="dark"] .page-header h1 { color: #f8fafc; }
                [data-theme="dark"] .page-header p { color: #94a3b8; }
                [data-theme="dark"] .card-box { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .custom-select { background: #0f172a; border-color: #334155; color: #f8fafc; }
                [data-theme="dark"] .custom-select:focus { background: #0f172a; }
                [data-theme="dark"] .form-group label { color: #94a3b8; }
                [data-theme="dark"] .exam-card { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .exam-card:hover { border-color: #3b82f6; }
                [data-theme="dark"] .exam-card h3 { color: #f8fafc; }
                [data-theme="dark"] .exam-card p { color: #94a3b8; }
                [data-theme="dark"] .tag-kelas { background: #0f172a; border-color: #334155; color: #cbd5e1; }
                [data-theme="dark"] .btn-back { background: #0f172a; border-color: #334155; color: #cbd5e1; }
                [data-theme="dark"] .btn-back:hover { background: #1e293b; color: #f8fafc; }
                [data-theme="dark"] .ws-title h3 { color: #f8fafc; }
                [data-theme="dark"] .student-list-card { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .list-title { background: #0f172a; border-bottom-color: #334155; color: #f8fafc; }
                [data-theme="dark"] .kelas-header { background: #0f172a; color: #94a3b8; }
                [data-theme="dark"] .student-item { border-bottom-color: #334155; }
                [data-theme="dark"] .student-item:hover { background: #0f172a; }
                [data-theme="dark"] .student-item.active { background: #1e3a8a30; }
                [data-theme="dark"] .std-name { color: #f8fafc; }
                [data-theme="dark"] .std-score { background: #0f172a; border-color: #334155; color: #f8fafc; }
                [data-theme="dark"] .grading-card { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .grading-head { border-bottom-color: #334155; }
                [data-theme="dark"] .grading-head h2 { color: #f8fafc; }
                [data-theme="dark"] .answer-item { background: #0f172a; border-color: #334155; }
                [data-theme="dark"] .q-question { color: #f8fafc; }
                [data-theme="dark"] .std-answer-box { background: #1e293b; border-color: #475569; }
                [data-theme="dark"] .key-answer-box { background: #451a0320; border-color: #78350f; }
                [data-theme="dark"] .table-wrapper { border-color: #334155; }
                [data-theme="dark"] .praktek-table th { background: #0f172a; color: #94a3b8; border-color: #334155; }
                [data-theme="dark"] .praktek-table td { border-color: #334155; color: #cbd5e1; }
                [data-theme="dark"] .praktek-std-name { color: #f8fafc; }
                [data-theme="dark"] .score-input-praktek { background: #0f172a; border-color: #334155; color: #60a5fa; }
                [data-theme="dark"] .header-stats-praktek { background: #1e293b; border-color: #334155; }
                [data-theme="dark"] .stat-praktek strong { color: #f8fafc; }
                [data-theme="dark"] .empty-state, [data-theme="dark"] .empty-grading { color: #94a3b8; }
                [data-theme="dark"] .empty-grading h3 { color: #cbd5e1; }
                [data-theme="dark"] .btn-praktek { background: #0f172a; border-color: #3b82f6; color: #60a5fa; }
                [data-theme="dark"] .btn-praktek:hover { background: #1e3a8a30; }

                [data-theme="dark"] .ai-box { background: #1e293b; border-color: #3b82f6; }
                [data-theme="dark"] .ai-head { color: #60a5fa; }
                [data-theme="dark"] .ai-score { background: #0f172a; border-color: #1e3a8a; color: #bae6fd; }
                [data-theme="dark"] .ai-score strong { color: #38bdf8; }
                [data-theme="dark"] .ai-reason { background: #0f172a; color: #f8fafc; }
                [data-theme="dark"] .lbl, [data-theme="dark"] .key-answer-box .lbl { color: #94a3b8; }
                [data-theme="dark"] .key-answer-box.lbl { color: #f59e0b; }
                [data-theme="dark"] .std-answer-box .ans-text, [data-theme="dark"] .ans-text { color: #e2e8f0; }
                
                [data-theme="dark"] .manual-box { background: #1e293b; border-color: #475569; }
                [data-theme="dark"] .manual-box label { color: #e2e8f0; }
                [data-theme="dark"] .score-input-group input { background: #0f172a; color: #f8fafc; border-color: #334155; }
                [data-theme="dark"] .score-input-group input:focus { border-color: #3b82f6; }

                /* Analytics Modal Styles */
                .btn-analytics { background: #f8fafc; color: #64748b; border: 2px solid #e2e8f0; padding: 10px 20px; border-radius: 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
                .btn-analytics:hover { color: #3b82f6; border-color: #3b82f6; background: white; }

                .analytics-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 5000; padding: 20px; }
                .analytics-modal-content { background: white; border-radius: 24px; width: 100%; max-width: 800px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; }
                .analytics-header { padding: 24px 32px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
                .btn-close-analytics { background: white; border: 1px solid #e2e8f0; color: #64748b; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .btn-close-analytics:hover { background: #ef4444; border-color: #ef4444; color: white; }
                
                .analytics-body { padding: 32px; overflow-y: auto; background: white; }
                .analytics-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 32px; }
                .analytics-stat-card { background: #f8fafc; border: 1px solid #f1f5f9; padding: 24px; border-radius: 20px; text-align: center; display: flex; flex-direction: column; justify-content: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
                .stat-label { font-size: 0.8rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .stat-value { font-size: 2.5rem; font-weight: 950; color: #1e293b; line-height: 1; }
                .stat-value.text-blue { color: #3b82f6; }
                .stat-value.text-green { color: #10b981; }
                .stat-value.text-red { color: #ef4444; }
                .stat-value small { font-size: 1rem; color: #94a3b8; font-weight: 700; margin-left: 4px; }
                
                .analytics-chart-box { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 32px; margin-bottom: 24px; }
                .analytics-footer-status { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 16px 24px; border-radius: 12px; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }

                [data-theme="dark"] .analytics-modal-content { background: #1e293b; color: #f8fafc; border: 1px solid #334155; }
                [data-theme="dark"] .analytics-header { background: #0f172a; border-color: #334155; }
                [data-theme="dark"] .analytics-header h2 { color: #f8fafc !important; }
                [data-theme="dark"] .btn-close-analytics { background: #1e293b; border-color: #334155; color: #94a3b8; }
                [data-theme="dark"] .analytics-body { background: #1e293b; }
                [data-theme="dark"] .analytics-stat-card { background: #0f172a; border-color: #334155; }
                [data-theme="dark"] .stat-value { color: #f8fafc; }
                [data-theme="dark"] .analytics-chart-box { background: #0f172a; border-color: #334155; }
                [data-theme="dark"] .analytics-chart-box h3 { color: #f8fafc !important; }
                [data-theme="dark"] .analytics-footer-status { background: #0f172a; border-color: #334155; color: #94a3b8; }
                [data-theme="dark"] .btn-analytics { background: #1e293b; border-color: #334155; color: #cbd5e1; }
                [data-theme="dark"] .btn-analytics:hover { background: #334155; border-color: #3b82f6; color: #f8fafc; }
`}</style>
        </div>
    );
};

export default ExamScoring;
