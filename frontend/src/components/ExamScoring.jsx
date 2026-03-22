import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BookOpen, BookMarked, UserCheck, AlertCircle, ChevronLeft, CheckCircle2, Award, Brain, Save, Check, Clock, Timer, FileDown,
    ArrowLeft, CloudUpload, ShieldCheck
} from 'lucide-react';

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
                fetchedExams = fetchedExams.filter(exam => exam.namaGuru === user.name || exam.namaGuru === user.namaLengkap);
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
            // Fetch Questions
            const qResp = await axios.get(`/api/exam/soal-essay/ujian/${exam.id}`, { headers });
            setQuestions(qResp.data);

            // Fetch Monitoring Data (Ground Truth for who is Finished)
            const monitorResp = await axios.get(`/api/exam/ujian-mapel/${exam.id}/monitoring`, { headers });
            const monitorData = monitorResp.data;

            // Fetch Answers
            const ansResp = await axios.get(`/api/exam/jawaban/ujian/${exam.id}`, { headers });
            const allAnswers = ansResp.data;

            // Map monitoring data to student objects
            const studentMap = {};
            monitorData.forEach(m => {
                studentMap[m.siswaId] = {
                    siswaId: m.siswaId,
                    namaSiswa: m.namaSiswa,
                    nisn: m.nisn,
                    isOnline: m.isOnline,
                    isFinished: m.isFinished,
                    namaKelas: 'Tanpa Kelas', // Will be updated if answers exist
                    answers: []
                };
            });

            // Attach answers and metadata from answers
            allAnswers.forEach(ans => {
                if (!studentMap[ans.siswaId]) {
                    // This case shouldn't happen if monitorData is complete for the class
                    studentMap[ans.siswaId] = {
                        siswaId: ans.siswaId,
                        namaSiswa: ans.namaSiswa,
                        nisn: ans.nisn,
                        isOnline: false,
                        isFinished: ans.statusSelesaiUjian || false,
                        namaKelas: ans.namaKelas || 'Tanpa Kelas',
                        answers: []
                    };
                }
                studentMap[ans.siswaId].answers.push(ans);
                if (ans.namaKelas) studentMap[ans.siswaId].namaKelas = ans.namaKelas;
                // If answer says it's finished, trust it too as backup
                if (ans.statusSelesaiUjian) studentMap[ans.siswaId].isFinished = true;
            });

            // Calculate metrics for list
            const grouped = Object.values(studentMap).map(std => {
                let totalAi = 0;
                let totalGuru = 0;
                let isFullyGraded = true;
                let start = null;
                let end = null;

                if (std.answers.length === 0) isFullyGraded = false;

                std.answers.forEach(a => {
                    if (a.skorAi) totalAi += a.skorAi;
                    if (a.skorFinalGuru !== null && a.skorFinalGuru !== undefined) {
                        totalGuru += a.skorFinalGuru;
                    } else {
                        isFullyGraded = false;
                    }

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
                } else if (start) {
                    durasiStr = 'Pengerjaan';
                }

                const nilaiAkhir = questions.length > 0 ? (totalGuru / questions.length).toFixed(1) : 0;
                const nilaiAkhirAi = questions.length > 0 ? (totalAi / questions.length).toFixed(1) : 0;

                return { ...std, totalAi, totalGuru, nilaiAkhir, nilaiAkhirAi, isFullyGraded, durasiStr };
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

        const answersToProcess = selectedStudent.answers.filter(a => a.skorAi === null || a.skorAi === undefined);
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

    const handleSaveScore = async (answerId, newScore) => {
        setSavingId(answerId);
        try {
            const payload = new FormData();
            payload.append('skorGuru', newScore);

            const resp = await axios.put(`/api/exam/jawaban/${answerId}/nilai`, payload, {
                headers: { ...headers, 'Content-Type': 'multipart/form-data' }
            });

            // Update local state
            setSelectedStudent(prev => {
                if (!prev) return prev;
                const newAnswers = prev.answers.map(a => a.id === answerId ? { ...a, skorFinalGuru: parseFloat(newScore) } : a);
                let tguru = 0;
                let full = true;
                newAnswers.forEach(a => {
                    if (a.skorFinalGuru !== null && a.skorFinalGuru !== undefined) tguru += a.skorFinalGuru;
                    else full = false;
                });
                const nAkhir = questions.length > 0 ? (tguru / questions.length).toFixed(1) : 0;
                return { ...prev, answers: newAnswers, totalGuru: tguru, nilaiAkhir: nAkhir, isFullyGraded: full };
            });

            // Also update the main studentsData array
            setStudentsData(prev => prev.map(std => {
                if (std.siswaId === selectedStudent.siswaId) {
                    const newAnswers = std.answers.map(a => a.id === answerId ? { ...a, skorFinalGuru: parseFloat(newScore) } : a);
                    let tguru = 0;
                    let full = true;
                    newAnswers.forEach(a => {
                        if (a.skorFinalGuru !== null && a.skorFinalGuru !== undefined) tguru += a.skorFinalGuru;
                        else full = false;
                    });
                    const nAkhir = questions.length > 0 ? (tguru / questions.length).toFixed(1) : 0;
                    return { ...std, answers: newAnswers, totalGuru: tguru, nilaiAkhir: nAkhir, isFullyGraded: full };
                }
                return std;
            }));

        } catch (err) {
            alert('Gagal menyimpan nilai');
        } finally {
            setSavingId(null);
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
                                        <td style={{ fontWeight: 800, color: '#1e293b' }}>{item.namaSiswa}</td>
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
                                                            <span className="badge-pending">Belum Dinilai</span>
                                                        )}
                                                        <div className="std-score">M: {std.totalGuru} | AI: {std.totalAi}</div>
                                                        <div className="std-final-score" style={{ fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                                                            Saran Nilai Akhir: <span style={{ color: '#3b82f6' }}>{std.nilaiAkhir}</span>
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
                                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Saran Nilai Akhir:</span>
                                                <strong style={{ fontSize: '1.25rem' }}>{selectedStudent.nilaiAkhir}</strong>
                                                <span style={{ fontSize: '0.65rem', marginBottom: '6px' }}>Total Skor: {selectedStudent.totalGuru} / {questions.reduce((a, b) => a + b.bobotNilai, 0)}</span>
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
                                            return (
                                                <div key={q.id} className="answer-item">
                                                    <div className="q-banner">
                                                        <span className="q-num">Soal #{idx + 1}</span>
                                                        <span className="q-bobot">Bobot Maks: {q.bobotNilai}</span>
                                                    </div>

                                                    <div className="q-question" dangerouslySetInnerHTML={{ __html: q.pertanyaan }}></div>

                                                    <div className={`std-answer-box ${ans?.raguRagu ? 'is-ragu' : ''}`}>
                                                        <h4>Jawaban Siswa:</h4>
                                                        {ans?.raguRagu && <div className="ragu-badge" style={{ display: 'inline-block', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px' }}>Ragu - Ragu</div>}
                                                        <p className="ans-text">{ans?.teksJawaban || <span className="text-slate-400 italic">Tidak menjawab</span>}</p>
                                                    </div>

                                                    <div className="key-answer-box">
                                                        <div className="lbl">Rubrik / Kunci Jawaban:</div>
                                                        <div className="ans-text" dangerouslySetInnerHTML={{ __html: q.kunciJawaban }}></div>
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
                                                                        max={q.bobotNilai} min="0"
                                                                        defaultValue={ans.skorFinalGuru ?? ''}
                                                                        id={`score-${ans.id}`}
                                                                    />
                                                                    <button
                                                                        className="btn-save-score"
                                                                        disabled={savingId === ans.id}
                                                                        onClick={() => {
                                                                            const val = document.getElementById(`score-${ans.id}`).value;
                                                                            if (val !== '') handleSaveScore(ans.id, val);
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
`}</style>
        </div>
    );
};

export default ExamScoring;
