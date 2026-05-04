import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Calendar,
    BookOpen,
    Plus,
    Edit3,
    LogOut,
    ChevronRight,
    ShieldCheck,
    CheckCircle2,
    XCircle,
    Trash2,
    Book,
    Clock,
    Key,
    Info,
    RefreshCw,
    ArrowLeft,
    Save,
    Search,
    FileText,
    Edit,
    BookCheck,
    Power,
    PowerOff,
    CloudUpload
} from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const QuillEditor = ({ value, onChange, placeholder, isSimple }) => {
    const editorRef = useRef(null);
    const quillRef = useRef(null);
    const isInternalChange = useRef(false);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!quillRef.current && editorRef.current) {
            quillRef.current = new Quill(editorRef.current, {
                theme: 'snow',
                placeholder: placeholder || 'Ketik di sini...',
                modules: {
                    toolbar: isSimple ? [
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link'],
                        ['clean']
                    ] : [
                        [{ 'header': [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link', 'image', 'video'],
                        ['clean']
                    ]
                }
            });

            quillRef.current.on('text-change', () => {
                isInternalChange.current = true;
                const content = quillRef.current.root.innerHTML;
                if (onChangeRef.current) onChangeRef.current(content);
                setTimeout(() => { isInternalChange.current = false; }, 100);
            });
        }
    }, [placeholder, isSimple]);

    useEffect(() => {
        if (quillRef.current && !isInternalChange.current && value !== undefined) {
            const currentHTML = quillRef.current.root.innerHTML;
            if (value !== currentHTML) {
                const selection = quillRef.current.getSelection();
                if (quillRef.current.clipboard.dangerouslyPasteHTML) {
                    quillRef.current.clipboard.dangerouslyPasteHTML(value || '');
                } else {
                    quillRef.current.root.innerHTML = value || '';
                }
                if (selection) {
                    quillRef.current.setSelection(selection.index, selection.length);
                }
            }
        }
    }, [value]);

    return <div ref={editorRef} />;
};


const ExamManagement = () => {
    const [activeTab, setActiveTab] = useState('events'); // 'events' or 'exams'
    const [events, setEvents] = useState([]);
    const [myAssignments, setMyAssignments] = useState([]);
    const [exams, setExams] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [userRole, setUserRole] = useState('');

    // Form States
    const [eventForm, setEventForm] = useState({
        namaEvent: '',
        semester: 'GANJIL',
        tahunAjaran: '2025/2026',
        tanggalMulai: '',
        tanggalSelesai: '',
        statusAktif: true,
        proktorIds: []
    });

    const [examForm, setExamForm] = useState({
        eventId: '',
        mapelId: '',
        guruId: '',
        waktuMulai: '',
        waktuSelesai: '',
        durasi: 90,
        token: ''
    });

    // Sub-view for entering questions
    const [viewingQuestions, setViewingQuestions] = useState(null); // Will hold exam object
    const [qType, setQType] = useState('essay'); // 'essay' or 'pg'
    const [questions, setQuestions] = useState([]);
    const [questionsPG, setQuestionsPG] = useState([]);
    const [questionForm, setQuestionForm] = useState({
        pertanyaan: '',
        kunciJawaban: '',
        bobotNilai: 10
    });
    const [questionFormPG, setQuestionFormPG] = useState({
        pertanyaan: '',
        pilihanA: '',
        pilihanB: '',
        pilihanC: '',
        pilihanD: '',
        pilihanE: '',
        kunciJawaban: 'A',
        bobotNilai: 2
    });
    const [editingQuestion, setEditingQuestion] = useState(null);
    const fileInputRef = useRef(null);
    const [uploadingExam, setUploadingExam] = useState(null);

    // Kartu Soal States
    const [isKartuModalOpen, setIsKartuModalOpen] = useState(false);
    const [editingKartuSoal, setEditingKartuSoal] = useState(null); // holds existing SoalEssay object being edited via kartu
    const [kartuForm, setKartuForm] = useState({
        judul: '',
        tujuanPembelajaran: '',
        kriteriaKetercapaian: '',
        petunjukAssesment: '',
        kunciJawaban: '',
        bobotNilai: 10,
        nomorSoal: 1
    });

    const handleUploadDrive = async (e, exam) => {
        const file = e.target.files[0];
        if (!file) return;

        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('eventName', exam.namaEvent);
        formData.append('subjectName', exam.namaMapel);
        formData.append('file', file);

        try {
            setLoading(true);
            const res = await axios.post('/api/exam/drive/upload-soal', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('Sukses upload ke Drive: ' + res.data);
        } catch (err) {
            console.error(err);
            alert('Gagal upload ke Drive: ' + (err.response?.data || err.message));
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleSaveKartuSoal = async (e, keepOpen = false) => {
        if (e) e.preventDefault();
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            setLoading(true);
            const payload = {
                ...kartuForm,
                ujianMapelId: viewingQuestions.id,
                soalEssayId: editingKartuSoal ? editingKartuSoal.id : null // if editing existing soal
            };
            const res = await axios.post('/api/exam/create-kartu-soal', payload, { headers });

            if (keepOpen && !editingKartuSoal) {
                alert(`Soal ke-${kartuForm.nomorSoal} Berhasil Dibuat & Diupload!`);
                // Clear only question fields, increment nomorSoal
                setKartuForm(prev => ({
                    ...prev,
                    petunjukAssesment: '',
                    kunciJawaban: '',
                    nomorSoal: prev.nomorSoal + 1
                }));
            } else {
                alert(editingKartuSoal
                    ? 'Kartu Soal berhasil diperbarui: ' + res.data
                    : 'Kartu Soal Berhasil Dibuat: ' + res.data
                );
                setIsKartuModalOpen(false);
                setEditingKartuSoal(null);
                setKartuForm({
                    judul: '', tujuanPembelajaran: '', kriteriaKetercapaian: '',
                    petunjukAssesment: '', kunciJawaban: '', bobotNilai: 10, nomorSoal: 1
                });
            }
            // Refresh questions list
            handleManageQuestions(viewingQuestions);
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan Kartu Soal: ' + (err.response?.data || err.message));
        } finally {
            setLoading(false);
        }
    };

    const openKartuSoalEdit = (q, idx) => {
        // Open kartu soal modal in edit mode, pre-filling from existing essay question
        setEditingKartuSoal(q);
        setKartuForm({
            judul: viewingQuestions.namaMapel + ' - Soal ' + (idx + 1),
            tujuanPembelajaran: '',
            kriteriaKetercapaian: '',
            petunjukAssesment: q.pertanyaan || '',
            kunciJawaban: q.kunciJawaban || '',
            bobotNilai: q.bobotNilai || 10,
            nomorSoal: questionsPG.length + idx + 1
        });
        setIsKartuModalOpen(true);
    };

    const resetQuestionForm = () => {
        setQuestionForm({ pertanyaan: '', kunciJawaban: '', bobotNilai: 10 });
        setQuestionFormPG({
            pertanyaan: '',
            pilihanA: '', pilihanB: '', pilihanC: '', pilihanD: '', pilihanE: '',
            kunciJawaban: 'A', bobotNilai: 2
        });
        setEditingQuestion(null);
    };

    useEffect(() => {
        if (isModalOpen || isKartuModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isModalOpen, isKartuModalOpen]);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        let role = 'GURU';
        if (userStr) {
            const userObj = JSON.parse(userStr);
            role = userObj.role || 'GURU';
            setUserRole(role);
        } else {
            setUserRole('GURU');
        }

        if (role === 'GURU') {
            setActiveTab('exams');
        }

        fetchData(role);
        fetchMyAssignments(role); // ✅ pass role directly, tidak pakai state yg belum ready
    }, []);

    const fetchData = async (role) => {
        const effectiveRole = role || userRole;
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            const res = await axios.get('/api/exam/event', { headers });
            setEvents(res.data);

            if (effectiveRole === 'ADMIN' || effectiveRole === 'TU') {
                try {
                    const usersRes = await axios.get('/api/users', { headers });
                    // Filter only teachers to assign as proktor
                    const guruUsers = usersRes.data.filter(u => u.role === 'GURU');
                    // We need guruId. In UserResponseDTO, maybe nip or id is there?
                    // Wait, we need Guru.id to store in EventUjianDTO proktorIds.
                    // The backend user fetching mapping...let's check. 
                    setTeachers(guruUsers);
                } catch (e) {
                    console.error("Error fetching users for proktor", e);
                }
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyAssignments = async (role) => {
        // role bisa dari parameter (pertama kali) atau dari state (refresh)
        const effectiveRole = role || userRole;
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            // ADMIN/TU: ambil semua. GURU: ambil punya sendiri via /my
            const endpoint = (effectiveRole === 'ADMIN' || effectiveRole === 'TU')
                ? '/api/enrollment/guru-mapel'
                : '/api/enrollment/guru-mapel/my';
            const res = await axios.get(endpoint, { headers });
            setMyAssignments(res.data);
        } catch (err) {
            console.error('Fetch assignments error:', err);
        }
    };


    const fetchExams = async (eventId) => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`/api/exam/ujian-mapel/event/${eventId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExams(res.data);
        } catch (err) {
            console.error('Fetch exams error:', err);
        }
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            if (new Date(eventForm.tanggalSelesai) < new Date(eventForm.tanggalMulai)) {
                alert('Tanggal Selesai tidak boleh sebelum Tanggal Mulai');
                return;
            }
            if (editMode) {
                await axios.put(`/api/exam/event/${selectedItem.id}`, eventForm, { headers });
            } else {
                await axios.post('/api/exam/event', eventForm, { headers });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            alert('Gagal menyimpan event');
        }
    };

    const handleSaveExam = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Calculate waktuSelesai from waktuMulai + durasi
        const startDate = new Date(examForm.waktuMulai);
        const endDate = new Date(startDate.getTime() + (examForm.durasi || 0) * 60 * 1000);

        const payload = {
            ...examForm,
            mapelId: Number(examForm.mapelId),
            guruId: Number(examForm.guruId),
            waktuSelesai: endDate.toISOString(),
            durasi: Number(examForm.durasi)
        };

        // Validation against Event Range
        const ev = events.find(e => e.id == examForm.eventId);
        if (ev && ev.tanggalMulai && ev.tanggalSelesai) {
            const evStart = new Date(ev.tanggalMulai + "T00:00");
            const evEnd = new Date(ev.tanggalSelesai + "T23:59");
            if (startDate < evStart || startDate > evEnd) {
                alert(`Waktu mulai harus berada dalam rentang event: ${ev.tanggalMulai} s/d ${ev.tanggalSelesai}`);
                return;
            }
        }

        try {
            if (editMode) {
                await axios.put(`/api/exam/ujian-mapel/${selectedItem.id}`, payload, { headers });
            } else {
                await axios.post('/api/exam/ujian-mapel', payload, { headers });
            }
            setIsModalOpen(false);
            fetchExams(examForm.eventId);
        } catch (err) {
            alert('Gagal menyimpan ujian');
        }
    };

    const handleRefreshToken = async (id) => {
        if (!window.confirm('Generate ulang token ujian ini?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`/api/exam/ujian-mapel/${id}/refresh-token`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchExams(examForm.eventId);
            alert('Token berhasil diperbarui!');
        } catch (err) {
            alert('Gagal refresh token');
        }
    };

    const handleDeleteExam = async (id) => {
        alert('DEBUG: Clicked Hapus Jadwal Ujian ID ' + id);
        if (!window.confirm('Hapus jadwal ujian ini? Data soal akan tetap ada tetapi tidak lagi terjadwal.')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/exam/ujian-mapel/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchExams(examForm.eventId);
            alert('Jadwal ujian berhasil dihapus');
        } catch (err) {
            alert('Gagal hapus jadwal ujian');
        }
    };

    const handleDeleteEvent = async (id, force = false) => {
        alert('DEBUG: Clicked Hapus Event ID ' + id + ', Force: ' + force);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        if (!force) {
            if (!window.confirm('Hapus event ini?')) return;
        }

        try {
            console.log(`Menghapus event ID: ${id}, force: ${force}`);
            const res = await axios.delete(`/api/exam/event/${id}${force ? '?force=true' : ''}`, { headers });
            console.log('Hapus response:', res.data);
            alert('Event berhasil dihapus');
            fetchData();
        } catch (err) {
            console.error('Hapus Error:', err);
            if (err.response?.status === 409) {
                const msg = err.response.data;
                const messageString = typeof msg === 'string' ? msg : (msg.message || JSON.stringify(msg));

                if (messageString.includes('CONTAINS_DATA|')) {
                    const count = messageString.split('|')[1];
                    if (window.confirm(`PERINGATAN: Event ini memiliki ${count} jadwal ujian aktif. Jika Anda menghapus event ini, semua jadwal ujian di dalamnya juga akan terhapus. Lanjutkan (Konfirmasi ke-2)?`)) {
                        handleDeleteEvent(id, true);
                    }
                } else {
                    alert('Gagal menghapus (Conflict): ' + messageString);
                }
            } else {
                const errorMsg = err.response?.data?.message || err.response?.data || err.message;
                alert('Gagal menghapus: ' + errorMsg);
            }
        }
    };

    const handleToggleEventStatus = async (id) => {
        const token = localStorage.getItem('token');
        try {
            await axios.put(`/api/exam/event/${id}/toggle-status`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (err) {
            alert('Gagal mengubah status event');
        }
    };

    const handleDeleteAllEvents = async () => {
        alert('DEBUG: Clicked Hapus Semua Event');
        if (!window.confirm('YAKIN INGIN MENGHAPUS SEMUA RINCIAN EVENT BESERTA JADWAL UJIAN? Keputusan ini tidak bisa dibatalkan!')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.get(`/api/exam/event/delete-all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Sukses. Semua Events Ujian telah dihapus.');
            fetchData();
        } catch (err) {
            alert('Gagal menghapus semua event');
        }
    };

    const openEditModal = (item) => {
        setSelectedItem(item);
        setEditMode(true);
        if (activeTab === 'events') {
            setEventForm({
                namaEvent: item.namaEvent,
                semester: item.semester,
                tahunAjaran: item.tahunAjaran,
                tanggalMulai: item.tanggalMulai || '',
                tanggalSelesai: item.tanggalSelesai || '',
                statusAktif: item.statusAktif,
                proktorIds: item.proktorIds || []
            });
        }
        setIsModalOpen(true);
    };



    const handleManageQuestions = async (exam) => {
        setViewingQuestions(exam);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            const [essayRes, pgRes] = await Promise.all([
                axios.get(`/api/exam/soal-essay/ujian/${exam.id}`, { headers }),
                axios.get(`/api/exam/soal-pg/ujian/${exam.id}`, { headers })
            ]);
            setQuestions(essayRes.data);
            setQuestionsPG(pgRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveQuestion = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            if (qType === 'essay') {
                const body = { ...questionForm, ujianMapelId: viewingQuestions.id };
                if (editingQuestion) {
                    await axios.put(`/api/exam/soal-essay/${editingQuestion.id}`, body, { headers });
                } else {
                    await axios.post('/api/exam/soal-essay', body, { headers });
                }
            } else {
                const body = { ...questionFormPG, ujianMapelId: viewingQuestions.id };
                if (editingQuestion) {
                    await axios.put(`/api/exam/soal-pg/${editingQuestion.id}`, body, { headers });
                } else {
                    await axios.post('/api/exam/soal-pg', body, { headers });
                }
            }
            resetQuestionForm();
            handleManageQuestions(viewingQuestions);
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || 'Gagal simpan soal';
            alert('Error Simpan: ' + msg);
        }
    };

    const handleEditSoal = (q, type) => {
        setQType(type);
        setEditingQuestion(q);
        if (type === 'essay') {
            setQuestionForm({
                pertanyaan: q.pertanyaan,
                kunciJawaban: q.kunciJawaban,
                bobotNilai: q.bobotNilai
            });
        } else {
            setQuestionFormPG({
                pertanyaan: q.pertanyaan,
                pilihanA: q.pilihanA,
                pilihanB: q.pilihanB,
                pilihanC: q.pilihanC,
                pilihanD: q.pilihanD,
                pilihanE: q.pilihanE,
                kunciJawaban: q.kunciJawaban,
                bobotNilai: q.bobotNilai
            });
        }
    };

    const handleDeleteSoal = async (id, type) => {
        alert('DEBUG: Clicked Hapus Soal ID ' + id + ', Type: ' + type);
        if (!window.confirm('Hapus soal ini?')) return;
        const token = localStorage.getItem('token');
        try {
            const endpoint = type === 'essay' ? `/api/exam/soal-essay/${id}` : `/api/exam/soal-pg/${id}`;
            await axios.delete(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });
            handleManageQuestions(viewingQuestions);
        } catch (err) {
            alert('Gagal hapus soal');
        }
    };


    if (viewingQuestions) {
        return (
            <>
                <div className="exam-management animate-fade-in pb-10">
                    <div className="page-header-v2">
                        <div className="flex items-center gap-5">
                            <button onClick={() => setViewingQuestions(null)} className="back-btn-v2" title="Kembali ke Daftar Ujian">
                                <ArrowLeft size={22} />
                            </button>
                            <div>
                                <div className="breadcrumb">Manajemen Ujian / Input Soal</div>
                                <h1 className="title-v2">{viewingQuestions.namaMapel}</h1>
                                <div className="subtitle-v2">
                                    <span className="event-tag">{viewingQuestions.namaEvent}</span>
                                    <span className="separator">•</span>
                                    <span className="guru-tag"><ShieldCheck size={14} /> {viewingQuestions.namaGuru}</span>
                                </div>
                            </div>
                        </div>
                        <div className="header-stats">
                            <div className="stat-item">
                                <label>Total Soal</label>
                                <div className="value">{questions.length + questionsPG.length}</div>
                            </div>
                            <div className={`stat - item ${questions.reduce((acc, q) => acc + q.bobotNilai, 0) + questionsPG.reduce((acc, q) => acc + q.bobotNilai, 0) === 100 ? 'valid' : 'warning'} `}>
                                <label>Total Bobot</label>
                                <div className="value">
                                    {questions.reduce((acc, q) => acc + q.bobotNilai, 0) + questionsPG.reduce((acc, q) => acc + q.bobotNilai, 0)}
                                    <span className="total">/ 100</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="questions-layout-v2">
                        <div className="sticky-form-container">
                            <div className="card-v2 question-form-card">
                                <div className="q-type-switcher-v2">
                                    <button
                                        className={`q - type - btn - v2 ${qType === 'pg' ? 'active' : ''} `}
                                        onClick={() => { setQType('pg'); setEditingQuestion(null); }}
                                    >
                                        <div className="icon-circle"><CheckCircle2 size={16} /></div>
                                        <span>Pilihan Ganda</span>
                                    </button>
                                    <button
                                        className={`q - type - btn - v2 ${qType === 'essay' ? 'active' : ''} `}
                                        onClick={() => { setQType('essay'); setEditingQuestion(null); }}
                                    >
                                        <div className="icon-circle"><FileText size={16} /></div>
                                        <span>Essay</span>
                                    </button>
                                </div>

                                <div className="form-header-v2">
                                    <div className="form-indicator"></div>
                                    <h3>{editingQuestion ? 'Mode Edit Soal' : 'Buat Soal Baru'}</h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p>{qType === 'pg' ? 'Tipe Pilihan Ganda (A-E)' : 'Tipe Jawaban Terbuka (Essay)'}</p>
                                        {!editingQuestion && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const isPG = qType === 'pg';
                                                    const currentPertanyaan = isPG ? questionFormPG.pertanyaan : questionForm.pertanyaan;
                                                    let currentKunci = '';
                                                    if (isPG) {
                                                        const optKey = questionFormPG.kunciJawaban || 'A';
                                                        currentKunci = `${optKey}. ${questionFormPG['pilihan' + optKey] || ''} `;
                                                    } else {
                                                        currentKunci = questionForm.kunciJawaban;
                                                    }
                                                    const currentBobot = isPG ? questionFormPG.bobotNilai : questionForm.bobotNilai;

                                                    setKartuForm(prev => ({
                                                        ...prev,
                                                        petunjukAssesment: currentPertanyaan,
                                                        kunciJawaban: currentKunci,
                                                        bobotNilai: currentBobot,
                                                        nomorSoal: (questions.length + questionsPG.length + 1)
                                                    }));
                                                    // Reload existing essay questions before opening modal
                                                    if (viewingQuestions) {
                                                        handleManageQuestions(viewingQuestions);
                                                    }
                                                    setIsKartuModalOpen(true);
                                                }}
                                                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                                            >
                                                <FileText size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                Buat via Kartu Soal (Word)
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <form onSubmit={handleSaveQuestion} className="space-y-6">
                                    <div className="form-group-v2">
                                        <label>Isi Pertanyaan</label>
                                        <div className="editor-container-v2">
                                            <QuillEditor
                                                key={qType === 'essay' ? 'essay-q' : 'pg-q'}
                                                value={qType === 'essay' ? questionForm.pertanyaan : questionFormPG.pertanyaan}
                                                onChange={(content) => qType === 'essay'
                                                    ? setQuestionForm(prev => ({ ...prev, pertanyaan: content }))
                                                    : setQuestionFormPG(prev => ({ ...prev, pertanyaan: content }))}
                                                placeholder="Ketik pertanyaan secara detail di sini..."
                                                isSimple={false}
                                            />
                                        </div>
                                    </div>

                                    {qType === 'pg' && (
                                        <div className="options-section-v2">
                                            <label className="section-label">Opsi Jawaban & Kunci</label>
                                            <div className="space-y-3">
                                                {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                                    <div key={opt} className={`opt - input - v2 ${questionFormPG.kunciJawaban === opt ? 'selected' : ''} `}>
                                                        <button
                                                            type="button"
                                                            className="opt-check"
                                                            onClick={() => setQuestionFormPG({ ...questionFormPG, kunciJawaban: opt })}
                                                            title="Jadikan sebagai kunci jawaban"
                                                        >
                                                            {opt}
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={questionFormPG[`pilihan${opt} `]}
                                                            onChange={(e) => setQuestionFormPG({ ...questionFormPG, [`pilihan${opt} `]: e.target.value })}
                                                            placeholder={`Pilihan ${opt}...`}
                                                            required={opt !== 'E'}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {qType === 'essay' && (
                                        <div className="form-group-v2">
                                            <label>Pedoman Penskoran (Kunci Jawaban)</label>
                                            <div className="editor-container-v2">
                                                <QuillEditor
                                                    key="essay-kunci"
                                                    value={questionForm.kunciJawaban}
                                                    onChange={(content) => setQuestionForm(prev => ({ ...prev, kunciJawaban: content }))}
                                                    placeholder="Tuliskan poin-poin penilaian atau kunci jawaban..."
                                                    isSimple={true}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-grid-v2">
                                        <div className="form-group-v2">
                                            <label>Bobot Nilai</label>
                                            <div className="input-with-icon">
                                                <div className="input-icon"><Plus size={16} /></div>
                                                <input
                                                    type="number"
                                                    value={qType === 'essay' ? questionForm.bobotNilai : questionFormPG.bobotNilai}
                                                    onChange={(e) => qType === 'essay'
                                                        ? setQuestionForm({ ...questionForm, bobotNilai: parseInt(e.target.value) })
                                                        : setQuestionFormPG({ ...questionFormPG, bobotNilai: parseInt(e.target.value) })}
                                                    required
                                                    min="1"
                                                    max="100"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-actions-v2">
                                        <button type="submit" className="btn-save-v2">
                                            {editingQuestion ? <Save size={20} /> : <Plus size={20} />}
                                            <span>{editingQuestion ? 'Perbarui Soal' : 'Simpan Soal'}</span>
                                        </button>

                                        {editingQuestion && (
                                            <button
                                                type="button"
                                                className="btn-cancel-v2"
                                                onClick={resetQuestionForm}
                                            >
                                                Batal Edit
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div className="question-list-section-v2">
                            <div className="list-header-v2">
                                <div className="flex items-center gap-3">
                                    <div className="header-icon"><Book size={20} /></div>
                                    <h3>Daftar Soal Tersimpan</h3>
                                </div>
                                <div className="filter-badges">
                                    <div className="badge-v2">PG: {questionsPG.length}</div>
                                    <div className="badge-v2">Essay: {questions.length}</div>
                                </div>
                            </div>

                            <div className="questions-scroll-v2">
                                {questionsPG.length === 0 && questions.length === 0 ? (
                                    <div className="empty-questions-v2">
                                        <div className="empty-illustration">
                                            <BookOpen size={64} />
                                        </div>
                                        <h3>Belum ada soal dibuat</h3>
                                        <p>Gunakan formulir di sebelah kiri untuk mulai menambahkan soal ujian.</p>
                                    </div>
                                ) : (
                                    <div className="questions-grid-v2">
                                        {/* PG Questions */}
                                        {questionsPG.map((q, idx) => (
                                            <div key={`pg - ${q.id} `} className={`q - card - v2 pg - type ${editingQuestion?.id === q.id ? 'is-editing' : ''} `}>
                                                <div className="q-card-header">
                                                    <div className="q-meta">
                                                        <span className="q-number-v2">Soal {idx + 1}</span>
                                                        <span className="q-badge-pg">Pilihan Ganda</span>
                                                    </div>
                                                    <div className="q-actions-v2">
                                                        <button className="q-btn-edit" onClick={() => handleEditSoal(q, 'pg')} title="Edit Soal">
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button className="q-btn-delete" onClick={() => handleDeleteSoal(q.id, 'pg')} title="Hapus Soal">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="q-card-body">
                                                    <div className="q-text-v2" dangerouslySetInnerHTML={{ __html: q.pertanyaan }}></div>
                                                    <div className="q-options-v2">
                                                        {['A', 'B', 'C', 'D', 'E'].map(opt => q[`pilihan${opt} `] && (
                                                            <div key={opt} className={`opt - item - v2 ${q.kunciJawaban === opt ? 'is-correct' : ''} `}>
                                                                <div className="opt-marker">{opt}</div>
                                                                <div className="opt-text">{q[`pilihan${opt} `]}</div>
                                                                {q.kunciJawaban === opt && <div className="correct-check"><CheckCircle2 size={14} /></div>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="q-card-footer">
                                                    <div className="bobot-tag">
                                                        <Clock size={14} />
                                                        <span>Bobot: <strong>{q.bobotNilai}</strong></span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Essay Questions */}
                                        {questions.map((q, idx) => (
                                            <div key={`essay - ${q.id} `} className={`q - card - v2 essay - type ${editingQuestion?.id === q.id ? 'is-editing' : ''} `}>
                                                <div className="q-card-header">
                                                    <div className="q-meta">
                                                        <span className="q-number-v2">Soal {questionsPG.length + idx + 1}</span>
                                                        <span className="q-badge-essay">Essay</span>
                                                    </div>
                                                    <div className="q-actions-v2">
                                                        <button
                                                            className="q-btn-edit"
                                                            onClick={() => openKartuSoalEdit(q, idx)}
                                                            title="Edit via Kartu Soal (Word)"
                                                            style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}
                                                        >
                                                            <FileText size={16} />
                                                        </button>
                                                        <button className="q-btn-edit" onClick={() => handleEditSoal(q, 'essay')} title="Edit Soal">
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button className="q-btn-delete" onClick={() => handleDeleteSoal(q.id, 'essay')} title="Hapus Soal">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="q-card-body">
                                                    <div className="q-text-v2" dangerouslySetInnerHTML={{ __html: q.pertanyaan }}></div>
                                                    <div className="essay-rubric-v2">
                                                        <div className="rubric-header">
                                                            <Info size={14} /> Pedoman Penskoran
                                                        </div>
                                                        <div className="rubric-content" dangerouslySetInnerHTML={{ __html: q.kunciJawaban }}></div>
                                                    </div>
                                                </div>
                                                <div className="q-card-footer">
                                                    <div className="bobot-tag">
                                                        <Clock size={14} />
                                                        <span>Bobot: <strong>{q.bobotNilai}</strong></span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <style>{`
                    .exam-management { max-width: 1400px; margin: 0 auto; }

                    /* Page Header V2 */
                    .page-header-v2 { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding: 0 4px; }
                    .back-btn-v2 { background: white; border: 1.5px solid #e2e8f0; color: #64748b; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                    .back-btn-v2:hover { background: #f8fafc; color: #3b82f6; border-color: #3b82f6; transform: translateX(-4px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1); }
                    
                    .breadcrumb { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
                    .title-v2 { font-size: 2.25rem; font-weight: 900; color: #0f172a; letter-spacing: -1px; margin: 0; }
                    .subtitle-v2 { display: flex; align-items: center; gap: 12px; margin-top: 8px; font-size: 0.95rem; color: #64748b; }
                    .event-tag { color: #3b82f6; font-weight: 700; }
                    .guru-tag { display: flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 2px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; }
                    
                    .header-stats { display: flex; gap: 24px; }
                    .stat-item { background: white; padding: 12px 24px; border-radius: 18px; border: 1.5px solid #e2e8f0; border-bottom: 4px solid #e2e8f0; min-width: 140px; }
                    .stat-item label { display: block; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
                    .stat-item.value { font-size: 1.5rem; font-weight: 900; color: #1e293b; display: flex; align-items: baseline; gap: 2px; }
                    .stat-item.total { font-size: 0.9rem; color: #94a3b8; font-weight: 600; }
                    .stat-item.valid { border-color: #22c55e; border-bottom-color: #16a34a; background: #f0fdf4; }
                    .stat-item.valid.value { color: #166534; }
                    .stat-item.warning { border-color: #f59e0b; border-bottom-color: #d97706; background: #fffbeb; }
                    .stat-item.warning.value { color: #92400e; }

                    /* Questions Layout V2 */
                    .questions-layout-v2 { display: grid; grid-template-columns: 600px 1fr!important; gap: 40px; align-items: start; }
                    .sticky-form-container { position: sticky; top: 20px; }
                    
                    .card-v2 { background: white; border-radius: 24px; border: 2.5px solid #f1f5f9; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.03); overflow: hidden; }
                    .question-form-card { padding: 24px!important; }

                    /* Type Switcher V2 */
                    .q-type-switcher-v2 { display: grid; grid-template-columns: 1fr 1fr; background: #f1f5f9; padding: 8px; border-radius: 20px; margin-bottom: 32px; gap: 10px; }
                    .q-type-btn-v2 { border: none; padding: 16px; border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 800; font-size: 0.95rem; color: #64748b; background: transparent; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                    .q-type-btn-v2.icon-circle { background: white; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); color: #94a3b8; }
                    .q-type-btn-v2.active { background: white; color: #3b82f6; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }
                    .q-type-btn-v2.active.icon-circle { background: #3b82f6; color: white; }

                    .form-header-v2 { margin-bottom: 24px; }
                    .form-indicator { width: 32px; height: 6px; background: #3b82f6; border-radius: 10px; margin-bottom: 12px; }
                    .form-header-v2 h3 { font-size: 1.4rem; font-weight: 950; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
                    .form-header-v2 p { color: #64748b; font-size: 0.85rem; margin-top: 4px; font-weight: 600; }

                    .form-group-v2 { margin-bottom: 28px; }
                    .form-group-v2 label { display: block; font-size: 0.85rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
                    
                    .editor-container-v2 { border: 2.5px solid #f1f5f9; border-radius: 16px; overflow: hidden; transition: all 0.3s; background: white; }
                    .editor-container-v2:focus-within { border-color: #3b82f6; box-shadow: 0 4px 15px -5px rgba(59, 130, 246, 0.1); }
                    .editor-container-v2.quill { border: none; }
                    .editor-container-v2.ql-toolbar { border: none!important; border-bottom: 2.5px solid #f1f5f9!important; background: #f8fafc; padding: 8px; }
                    .editor-container-v2.ql-container { border: none!important; font-size: 1.05rem; font-family: 'Inter', sans-serif; min-height: 280px; }
                    .editor-container-v2.ql-editor { padding: 16px; line-height: 1.5; color: #1e293b; font-weight: 500; }
                    .editor-container-v2.ql-editor.ql-blank::before { color: #94a3b8; font-style: normal; font-weight: 600; left: 16px; }

                    .section-label { display: block; font-size: 0.85rem; font-weight: 900; color: #334155; text-transform: uppercase; margin-bottom: 24px; border-top: 2.5px solid #f8fafc; padding-top: 32px; letter-spacing: 2px; }

                    /* Large Question Inputs */
                    .opt-input-v2 { display: flex; align-items: center; gap: 12px; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 16px; padding: 8px 16px 8px 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); margin-bottom: 10px; }
                    .opt-input-v2:focus-within { border-color: #3b82f6; background: white; transform: scale(1.01); box-shadow: 0 4px 10px -5px rgba(59, 130, 246, 0.15); }
                    .opt-input-v2.selected { border-color: #22c55e; background: #f0fdf4; }
                    
                    .opt-check { width: 44px; height: 44px; min-width: 44px; border-radius: 12px; background: white; border: 2px solid #e2e8f0; color: #64748b; font-weight: 950; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 1rem; }
                    .opt-input-v2.selected.opt-check { background: #22c55e; color: white; border-color: #22c55e; }
                    .opt-input-v2 input { flex: 1; border: none; background: transparent; padding: 10px; font-size: 1.05rem; font-weight: 600; color: #1e293b; outline: none; }

                    .kunci-textarea { border: 2px solid #fef3c7!important; background: #fffbeb!important; font-size: 1rem!important; font-weight: 600!important; }
                    .kunci-textarea:focus { border-color: #f59e0b!important; box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1)!important; }

                    .input-with-icon input { width: 100%; padding: 14px 16px 14px 44px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 16px; font-size: 1.1rem; font-weight: 800; transition: all 0.2s; color: #1e293b; }
                    .input-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                    .input-with-icon input:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08); }

                    .form-actions-v2 { display: grid; gap: 12px; margin-top: 20px; }
                    .btn-save-v2 { background: #3b82f6; color: white; border: none; padding: 16px; border-radius: 18px; font-weight: 900; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: all 0.2s; }
                    .btn-save-v2:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 8px 15px -3px rgba(59, 130, 246, 0.3); }
                    .btn-cancel-v2 { background: white; color: #64748b; border: 2px solid #e2e8f0; padding: 14px; border-radius: 16px; font-weight: 700; cursor: pointer; font-size: 0.95rem; }
                    .btn-cancel-v2:hover { background: #f8fafc; color: #1e293b; border-color: #94a3b8; }

                    /* Question List V2 */
                    .question-list-section-v2 { flex: 1; }
                    .list-header-v2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                    .header-icon { background: #3b82f6; color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2); }
                    .list-header-v2 h3 { font-size: 1.4rem; font-weight: 900; color: #0f172a; margin: 0; }
                    .filter-badges { display: flex; gap: 8px; }
                    .badge-v2 { background: white; border: 2px solid #f1f5f9; padding: 4px 12px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; color: #64748b; }

                    .questions-scroll-v2 { max-height: calc(100vh - 220px); overflow-y: auto; padding-right: 12px; scroll-behavior: smooth; }
                    .questions-grid-v2 { display: grid; gap: 24px; padding-bottom: 30px; }
                    
                    .q-card-v2 { background: white; border-radius: 24px; border: 2px solid #f1f5f9; padding: 24px; transition: all 0.3s ease; position: relative; overflow: hidden; }
                    .q-card-v2:hover { border-color: #3b82f6; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.06); transform: translateY(-4px); }
                    .q-card-v2.is-editing { border-color: #3b82f6; background: #eff6ff; border-style: dashed; }
                    
                    .q-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .q-number-v2 { font-size: 0.85rem; font-weight: 900; color: #3b82f6; text-transform: uppercase; background: #eff6ff; padding: 6px 16px; border-radius: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04); }
                    
                    .q-actions-v2 { display: flex; gap: 8px; }
                    .q-actions-v2 button { background: white; border: 2px solid #f1f5f9; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: #64748b; }
                    .q-btn-edit:hover { color: #3b82f6; border-color: #3b82f6; background: #eff6ff; }
                    .btn-delete:hover { color: #ef4444; border-color: #fca5a5; background: #fef2f2; }

                    .q-text-v2 { font-size: 1.15rem; color: #0f172a; line-height: 1.6; font-weight: 700; margin-bottom: 24px; }
                    
                    .q-options-v2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
                    .opt-item-v2 { padding: 14px 18px; background: #f8fafc; border-radius: 16px; border: 2px solid #f1f5f9; display: flex; gap: 12px; align-items: center; }
                    .opt-item-v2.is-correct { background: #f0fdf4; border-color: #22c55e; color: #166534; font-weight: 800; }
                    .opt-marker { width: 30px; height: 30px; min-width: 30px; border-radius: 8px; background: white; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; color: #64748b; }
                    .opt-item-v2.is-correct.opt-marker { background: #22c55e; color: white; border-color: #22c55e; }

                    .essay-rubric-v2 { background: #fffbeb; border-radius: 16px; padding: 20px; border-left: 6px solid #f59e0b; margin-top: 20px; }
                    .rubric-header { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 950; color: #b45309; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; }
                    .rubric-content { font-size: 1rem; color: #78350f; line-height: 1.6; font-weight: 600; white-space: pre-wrap; }

                    .q-card-footer { border-top: 2px dashed #f1f5f9; margin-top: 24px; padding-top: 16px; display: flex; justify-content: flex-end; }
                    .bobot-tag { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #64748b; font-weight: 700; padding: 8px 16px; background: #f8fafc; border-radius: 50px; border: 2px solid #f1f5f9; }
                    .bobot-tag strong { color: #0f172a; font-size: 1rem; font-weight: 900; }

                    /* Custom Scrollbar */
                    .questions-scroll-v2::-webkit-scrollbar { width: 8px; }
                    .questions-scroll-v2::-webkit-scrollbar-track { background: transparent; }
                    .questions-scroll-v2::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; border: 2px solid white; }
                    .questions-scroll-v2::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

                    .empty-questions-v2 { text-align: center; padding: 60px 20px; background: white; border-radius: 24px; border: 2px dashed #e2e8f0; color: #94a3b8; }
                    .empty-illustration { color: #e2e8f0; margin-bottom: 16px; }
                    .empty-questions-v2 h3 { font-size: 1.3rem; color: #475569; margin-bottom: 8px; font-weight: 800; }
                    .empty-questions-v2 p { font-size: 1rem; }

                    /* Transitions */
                    .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                    .opt - item - v2.is - correct { background: #f0fdf4; border - color: #22c55e; color: #166534; font - weight: 800; }
                    .opt - marker { width: 30px; height: 30px; min - width: 30px; border - radius: 8px; background: white; border: 2px solid #e2e8f0; display: flex; align - items: center; justify - content: center; font - size: 0.8rem; font - weight: 900; color: #64748b; }
                    .opt - item - v2.is - correct.opt - marker { background: #22c55e; color: white; border - color: #22c55e; }
                    .essay - rubric - v2 { background: #fffbeb; border - radius: 16px; padding: 20px; border - left: 6px solid #f59e0b; margin - top: 20px; }
                    .rubric - header { display: flex; align - items: center; gap: 8px; font - size: 0.8rem; font - weight: 950; color: #b45309; text - transform: uppercase; margin - bottom: 12px; letter - spacing: 0.5px; }
                    .rubric - content { font - size: 1rem; color: #78350f; line - height: 1.6; font - weight: 600; white - space: pre - wrap; }
                    .q - card - footer { border - top: 2px dashed #f1f5f9; margin - top: 24px; padding - top: 16px; display: flex; justify - content: flex - end; }
                    .bobot - tag { display: flex; align - items: center; gap: 8px; font - size: 0.9rem; color: #64748b; font - weight: 700; padding: 8px 16px; background: #f8fafc; border - radius: 50px; border: 2px solid #f1f5f9; }
                    .bobot - tag strong { color: #0f172a; font - size: 1rem; font - weight: 900; }
                    .empty - questions - v2 { text - align: center; padding: 60px 20px; background: white; border - radius: 24px; border: 2px dashed #e2e8f0; color: #94a3b8; }
                    .empty - illustration { color: #e2e8f0; margin - bottom: 16px; }
                    .empty - questions - v2 h3 { font - size: 1.3rem; color: #475569; margin - bottom: 8px; font - weight: 800; }
                    .empty - questions - v2 p { font - size: 1rem; }
                    .animate - fade -in { animation: fadeIn 0.4s cubic- bezier(0.4, 0, 0.2, 1) forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    .questions - scroll - v2:: -webkit - scrollbar { width: 8px; }
                    .questions - scroll - v2:: -webkit - scrollbar - track { background: transparent; }
                    .questions - scroll - v2:: -webkit - scrollbar - thumb { background: #e2e8f0; border - radius: 10px; }
                    .questions - scroll - v2:: -webkit - scrollbar - thumb:hover { background: #cbd5e1; }

                    /* Modal Styles */
                    .modal-overlay { position: fixed; top: 70px; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: flex-start; z-index: 10000; padding: 20px; overflow-y: auto; }
                    .modal-content { background: white; border-radius: 16px; width: 100%; max-width: 500px; padding: 30px; box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.35); position: relative; margin: 0 auto; flex-shrink: 0; }
                    .modal-content::-webkit-scrollbar { width: 8px; }
                    .modal-content::-webkit-scrollbar-track { background: transparent; }
                    .modal-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                    .modal-content::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .modal-header h3 { font-size: 1.35rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
                    .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; transition: all 0.2s; padding: 6px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
                    .close-btn:hover { background: #f1f5f9; color: #ef4444; }
                    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
                    
                    .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-size: 0.85rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
                    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1rem; font-weight: 600; color: #0f172a; background: #ffffff; transition: all 0.2s; }
                    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #3b82f6; background: white; outline: none; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08); }
                    
                    .btn-secondary { background: #f1f5f9; color: #475569; padding: 14px 28px; border-radius: 14px; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; }
                    .btn-secondary:hover { background: #e2e8f0; color: #1e293b; }
                    
                    .btn-primary {
                        background: #3b82f6; color: white; padding: 12px 24px; border-radius: 14px; font-weight: 700;
                        display: flex; align-items: center; gap: 10px; transition: all 0.3s; border: none; cursor: pointer;
                        box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.2);
                    }
                    .btn-primary:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.3); }
`}</style>

                </div>

                {/* Modal Kartu Soal consistently defined here for the Questions View */}
                {isKartuModalOpen && (
                    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.8)', zIndex: 100000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backdropFilter: 'blur(8px)' }}>
                        <div className="modal-content animate-slide-up" style={{
                            maxWidth: '1200px',
                            width: '98%',
                            maxHeight: '90vh',
                            height: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '0',
                            overflow: 'hidden',
                            borderRadius: '24px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            background: 'white'
                        }}>
                            <div className="modal-header" style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #f1f5f9', padding: '20px 40px', zIndex: 20 }}>
                                <div className="flex items-center gap-3">
                                    <div style={{ background: '#fef3c7', color: '#b45309', padding: '10px', borderRadius: '12px' }}>
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>{editingKartuSoal ? 'Edit Kartu Soal' : 'Buat Kartu Soal Baru'}</h3>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                            {editingKartuSoal
                                                ? `Mengedit Soal ID ${editingKartuSoal.id} — perubahan akan diupload ulang ke Drive`
                                                : 'Sistem akan menyimpan soal & membuat file Word ke Drive'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <button type="button" className="close-btn" onClick={() => { setIsKartuModalOpen(false); setEditingKartuSoal(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><XCircle size={24} /></button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '30px 40px', background: '#ffffff' }} className="custom-scrollbar">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2.5rem' }}>
                                    <div className="lg:col-span-8" style={{ gridColumn: 'span 8' }}>
                                        <form id="kartuSoalFormFinal" onSubmit={handleSaveKartuSoal}>
                                            <div className="grid grid-cols-4 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 1fr) 3fr', gap: '1rem' }}>
                                                <div className="form-group">
                                                    <label style={{ fontWeight: 800, fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>No. Soal</label>
                                                    <input
                                                        type="number"
                                                        value={kartuForm.nomorSoal}
                                                        onChange={(e) => setKartuForm({ ...kartuForm, nomorSoal: parseInt(e.target.value) })}
                                                        required
                                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: 700 }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontWeight: 800, fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>Judul / Nama Kartu Soal</label>
                                                    <input
                                                        type="text"
                                                        value={kartuForm.judul}
                                                        onChange={(e) => setKartuForm({ ...kartuForm, judul: e.target.value })}
                                                        placeholder="Contoh: Kartu Soal UTS - Algoritma Dasar"
                                                        required
                                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: 700 }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div className="form-group">
                                                    <label style={{ fontWeight: 800, fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>A. Tujuan Pembelajaran</label>
                                                    <textarea
                                                        value={kartuForm.tujuanPembelajaran}
                                                        onChange={(e) => setKartuForm({ ...kartuForm, tujuanPembelajaran: e.target.value })}
                                                        placeholder="Uraikan tujuan pembelajaran..."
                                                        style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', resize: 'none', fontWeight: 600 }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontWeight: 800, fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>B. Kriteria Ketercapaian (KKTP)</label>
                                                    <textarea
                                                        value={kartuForm.kriteriaKetercapaian}
                                                        onChange={(e) => setKartuForm({ ...kartuForm, kriteriaKetercapaian: e.target.value })}
                                                        placeholder="Uraikan KKTP..."
                                                        style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', resize: 'none', fontWeight: 600 }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group mb-6">
                                                <label style={{ fontWeight: 800, color: '#3b82f6', fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>C. Petunjuk Assesment / Soal (Otomatis masuk ke Soal Ujian)</label>
                                                <div className="editor-container-v2" style={{ minHeight: '150px', border: '2px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                                    <QuillEditor
                                                        value={kartuForm.petunjukAssesment}
                                                        onChange={(content) => setKartuForm({ ...kartuForm, petunjukAssesment: content })}
                                                        placeholder="Ketik soal/instruksi di sini..."
                                                        isSimple={true}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group mb-6">
                                                <label style={{ fontWeight: 800, color: '#16a34a', fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>D. Kunci Jawaban (Otomatis masuk ke Jawaban)</label>
                                                <div className="editor-container-v2" style={{ minHeight: '120px', border: '2px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                                    <QuillEditor
                                                        value={kartuForm.kunciJawaban}
                                                        onChange={(content) => setKartuForm({ ...kartuForm, kunciJawaban: content })}
                                                        placeholder="Ketik kunci jawaban di sini..."
                                                        isSimple={true}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div className="form-group">
                                                    <label style={{ fontWeight: 800, fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>E. Rubrik Penilaian</label>
                                                    <input
                                                        type="text"
                                                        disabled
                                                        value="Template Standar Penilaian Otomatis"
                                                        style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', fontStyle: 'italic' }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontWeight: 800, fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>Bobot Nilai</label>
                                                    <input
                                                        type="number"
                                                        value={kartuForm.bobotNilai}
                                                        onChange={(e) => setKartuForm({ ...kartuForm, bobotNilai: parseFloat(e.target.value) })}
                                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: 700 }}
                                                    />
                                                </div>
                                            </div>
                                        </form>
                                    </div>

                                    <div className="lg:col-span-4" style={{ gridColumn: 'span 4' }}>
                                        <div style={{ background: '#f8fafc', borderRadius: '16px', border: '1.5px solid #e2e8f0', padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                                <div style={{ background: '#3b82f6', color: 'white', padding: '6px', borderRadius: '8px' }}>
                                                    <Book size={16} />
                                                </div>
                                                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem' }}>Soal Tersimpan (Essay)</h4>
                                            </div>
                                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '10px' }} className="custom-scrollbar">
                                                {questions.length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                        <BookOpen size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                                                        <p>Belum ada soal essay tersimpan.</p>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        {questions.map((q, i) => {
                                                            const isCurrentlyEditing = editingKartuSoal && editingKartuSoal.id === q.id;
                                                            return (
                                                                <div
                                                                    key={q.id}
                                                                    style={{
                                                                        background: isCurrentlyEditing ? '#fffbeb' : 'white',
                                                                        padding: '16px',
                                                                        borderRadius: '12px',
                                                                        border: isCurrentlyEditing ? '2px solid #f59e0b' : '1.5px solid #e2e8f0',
                                                                        boxShadow: isCurrentlyEditing ? '0 0 0 3px rgba(245,158,11,0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onClick={() => openKartuSoalEdit(q, i)}
                                                                    title="Klik untuk edit soal ini via Kartu Soal"
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                        <div style={{ fontWeight: 900, color: isCurrentlyEditing ? '#b45309' : '#3b82f6', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                                            Soal {i + 1}
                                                                        </div>
                                                                        {isCurrentlyEditing && (
                                                                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>
                                                                                ✏️ Sedang Diedit
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: q.pertanyaan }}></div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                                                Total: <strong>{questions.length} Soal Essay</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer" style={{ flexShrink: 0, borderTop: '2px solid #f1f5f9', padding: '24px 40px', background: 'white', display: 'flex', justifyContent: 'flex-end', gap: '12px', zIndex: 30 }}>
                                <button type="button" className="btn-secondary" onClick={() => { setIsKartuModalOpen(false); setEditingKartuSoal(null); }} style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: 700, background: '#f1f5f9', border: 'none', cursor: 'pointer' }}>Batal</button>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="button" className="btn-primary" style={{ background: editingKartuSoal ? '#f59e0b' : '#3b82f6', color: 'white', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' }} onClick={(e) => handleSaveKartuSoal(e, false)}>
                                        <Save size={18} /> {editingKartuSoal ? 'Perbarui & Selesai' : 'Simpan & Selesai'}
                                    </button>
                                    {!editingKartuSoal && (
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            style={{ background: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                                            onClick={(e) => handleSaveKartuSoal(e, true)}
                                        >
                                            <Plus size={18} /> Simpan & Lanjut Soal {kartuForm.nomorSoal + 1}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }


    return (
        <>
            <div className="exam-management animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1>Manajemen Ujian</h1>
                        <p>Atur event ujian, jadwal, dan input soal</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {(userRole === 'ADMIN' || userRole === 'TU') && activeTab === 'events' && (
                            <button
                                style={{ background: '#fee2e2', color: '#ef4444', padding: '8px 16px', borderRadius: '8px', border: '1px solid #fca5a5', fontWeight: '600' }}
                                onClick={handleDeleteAllEvents}
                            >
                                <Trash2 size={16} style={{ display: 'inline', marginRight: '6px' }} />
                                Hapus Semua Data
                            </button>
                        )}
                        {(userRole === 'ADMIN' || userRole === 'TU') && activeTab === 'events' && (
                            <button className="btn-primary" onClick={() => {
                                setEditMode(false);
                                setEventForm({
                                    namaEvent: '',
                                    semester: 'GANJIL',
                                    tahunAjaran: '2025/2026',
                                    tanggalMulai: '',
                                    tanggalSelesai: '',
                                    statusAktif: true,
                                    proktorIds: []
                                });
                                setIsModalOpen(true);
                            }}>
                                <Plus size={18} />
                                <span>Event Baru</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="tabs-container">
                    {(userRole === 'ADMIN' || userRole === 'TU') && (
                        <button
                            className={`nav - tab ${activeTab === 'events' ? 'active' : ''} `}
                            onClick={() => setActiveTab('events')}
                        >
                            <Calendar size={18} />
                            <span>Daftar Event</span>
                        </button>
                    )}
                    <button
                        className={`nav - tab ${activeTab === 'exams' ? 'active' : ''} `}
                        onClick={() => setActiveTab('exams')}
                    >
                        <BookOpen size={18} />
                        <span>Input Soal & Jadwal</span>
                    </button>
                </div>

                {loading ? (
                    <div className="loading-container">Memuat data...</div>
                ) : activeTab === 'events' ? (
                    <div className="event-grid">
                        {events.map(event => (
                            <div key={event.id} className="event-card">
                                <div className="event-header">
                                    <div className="event-status">
                                        {event.statusAktif ? (
                                            <span className="badge-active"><CheckCircle2 size={14} /> Aktif</span>
                                        ) : (
                                            <span className="badge-inactive"><XCircle size={14} /> Selesai</span>
                                        )}
                                    </div>
                                    <div className="event-options">
                                        {(userRole === 'ADMIN' || userRole === 'TU') && (
                                            <>
                                                {userRole === 'ADMIN' && (
                                                    <button
                                                        onClick={() => handleToggleEventStatus(event.id)}
                                                        className={`icon - btn ${event.statusAktif ? 'deactivate' : 'activate'} `}
                                                        title={event.statusAktif ? 'Nonaktifkan' : 'Aktifkan'}
                                                    >
                                                        {event.statusAktif ? <PowerOff size={16} /> : <Power size={16} />}
                                                    </button>
                                                )}
                                                <button onClick={() => openEditModal(event)} className="icon-btn edit"><Edit3 size={16} /></button>
                                                <button onClick={() => handleDeleteEvent(event.id)} className="icon-btn delete"><Trash2 size={16} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="event-body">
                                    <h3>{event.namaEvent}</h3>
                                    <div className="event-info">
                                        <p><span>Semester:</span> {event.semester}</p>
                                        <p><span>Tahun:</span> {event.tahunAjaran}</p>
                                        {event.tanggalMulai && (
                                            <p><span>Periode:</span> {new Date(event.tanggalMulai).toLocaleDateString('id-ID', { dateStyle: 'medium' })} - {new Date(event.tanggalSelesai).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="event-footer">
                                    <button
                                        className="btn-outline w-full"
                                        onClick={() => {
                                            setActiveTab('exams');
                                            fetchExams(event.id);
                                            setExamForm({ ...examForm, eventId: event.id });
                                        }}
                                    >
                                        Lihat Detail Ujian <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="exams-view">
                        <div className="selection-bar">
                            <select
                                value={examForm.eventId}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    setExamForm({ ...examForm, eventId: id });
                                    if (id) fetchExams(id);
                                    else setExams([]);
                                }}
                                className="event-selector"
                            >
                                <option value="">-- Pilih Event Ujian --</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.namaEvent}</option>)}
                            </select>
                            {examForm.eventId && (userRole === 'ADMIN' || userRole === 'TU') && (
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        setEditMode(false);
                                        setExamForm({ eventId: examForm.eventId, mapelId: '', guruId: '', waktuMulai: '', waktuSelesai: '', durasi: 90, token: '' });
                                        setIsModalOpen(true);
                                    }}
                                >
                                    <Plus size={18} /> Tambah Jadwal Ujian
                                </button>
                            )}
                        </div>

                        {userRole === 'GURU' && myAssignments.length > 0 && (
                            <div className="my-assignments-summary">
                                <h3><BookOpen size={18} /> Mata Pelajaran & Kelas Anda</h3>
                                <div className="assignments-grid">
                                    {myAssignments.map(a => (
                                        <div key={a.id} className="assignment-badge">
                                            <span className="badge-mapel">{a.namaMapel}</span>
                                            <span className="badge-kelas">{a.namaKelas}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="exams-container">
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={(e) => handleUploadDrive(e, uploadingExam)}
                            />
                            {exams.length === 0 ? (
                                <div className="empty-state">
                                    <Book size={48} />
                                    <p>
                                        {!examForm.eventId
                                            ? "Silakan pilih event untuk melihat daftar ujian"
                                            : "Belum ada jadwal ujian untuk event ini"}
                                    </p>
                                </div>
                            ) : (
                                <div className="table-card">
                                    <table className="exam-table">
                                        <thead>
                                            <tr>
                                                <th>Mata Pelajaran</th>
                                                <th>Guru</th>
                                                <th>Jadwal</th>
                                                <th>Durasi</th>
                                                <th>Token</th>
                                                <th>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exams
                                                .filter(exam => {
                                                    if (userRole !== 'GURU') return true;
                                                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                                                    return exam.guruId == user.profileId;
                                                })
                                                .map(exam => (
                                                    <tr key={exam.id}>
                                                        <td>
                                                            <div className="mapel-cell">
                                                                <span className="nama-mapel">{exam.namaMapel}</span>
                                                            </div>
                                                        </td>
                                                        <td>{exam.namaGuru}</td>
                                                        <td>
                                                            <div className="time-cell">
                                                                <Clock size={14} />
                                                                <span>{new Date(exam.waktuMulai).toLocaleString('id-ID', {
                                                                    dateStyle: 'medium',
                                                                    timeStyle: 'short'
                                                                })} WIB</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="duration-badge">{exam.durasi || 0} Menit</span>
                                                        </td>
                                                        <td>
                                                            <div className="token-cell">
                                                                <div className="token-badge">{exam.token || '---'}</div>
                                                                {(userRole === 'ADMIN' || userRole === 'TU' || userRole === 'GURU') && (
                                                                    <button
                                                                        className="btn-refresh-token"
                                                                        onClick={() => handleRefreshToken(exam.id)}
                                                                        title="Generate Token Baru"
                                                                    >
                                                                        <RefreshCw size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    className="btn-lengkapi"
                                                                    onClick={() => handleManageQuestions(exam)}
                                                                >
                                                                    Input Soal
                                                                </button>
                                                                <button
                                                                    className="btn-lengkapi"
                                                                    style={{ background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0' }}
                                                                    onClick={() => {
                                                                        setUploadingExam(exam);
                                                                        fileInputRef.current.click();
                                                                    }}
                                                                >
                                                                    <CloudUpload size={14} style={{ marginRight: '4px' }} />
                                                                    Upload Drive
                                                                </button>
                                                                {(userRole === 'ADMIN' || userRole === 'TU') && (
                                                                    <>
                                                                        <button
                                                                            className="btn-icon-outline"
                                                                            onClick={() => {
                                                                                setSelectedItem(exam);
                                                                                setEditMode(true);
                                                                                setExamForm({
                                                                                    ...examForm,
                                                                                    mapelId: exam.mapelId,
                                                                                    guruId: exam.guruId,
                                                                                    waktuMulai: exam.waktuMulai.substring(0, 16),
                                                                                    waktuSelesai: exam.waktuSelesai.substring(0, 16),
                                                                                    durasi: exam.durasi || 90,
                                                                                    token: exam.token
                                                                                });
                                                                                setIsModalOpen(true);
                                                                            }}
                                                                            title="Edit Jadwal"
                                                                        >
                                                                            <Edit3 size={14} />
                                                                        </button>
                                                                        <button
                                                                            className="btn-icon-outline delete"
                                                                            onClick={() => handleDeleteExam(exam.id)}
                                                                            title="Hapus Jadwal"
                                                                            style={{ color: '#ef4444', borderColor: '#fee2e2' }}
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for Event or Exam */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content animate-slide-up">
                        <div className="modal-header">
                            <h3>{editMode ? 'Edit' : 'Tambah'} {activeTab === 'events' ? 'Event Ujian' : 'Jadwal Ujian'}</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}><XCircle size={20} /></button>
                        </div>
                        <form onSubmit={activeTab === 'events' ? handleSaveEvent : handleSaveExam}>
                            {activeTab === 'events' ? (
                                <>
                                    <div className="form-group">
                                        <label>Nama Event</label>
                                        <input
                                            type="text"
                                            value={eventForm.namaEvent}
                                            onChange={(e) => setEventForm({ ...eventForm, namaEvent: e.target.value })}
                                            placeholder="Misal: UAS Semester Ganjil 2026"
                                            required
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="form-group">
                                            <label>Semester</label>
                                            <select value={eventForm.semester} onChange={(e) => setEventForm({ ...eventForm, semester: e.target.value })}>
                                                <option value="GANJIL">GANJIL</option>
                                                <option value="GENAP">GENAP</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Tahun Ajaran</label>
                                            <input type="text" value={eventForm.tahunAjaran} onChange={(e) => setEventForm({ ...eventForm, tahunAjaran: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="form-group">
                                            <label>Tanggal Mulai</label>
                                            <input type="date" value={eventForm.tanggalMulai} onChange={(e) => setEventForm({ ...eventForm, tanggalMulai: e.target.value })} required />
                                        </div>
                                        <div className="form-group">
                                            <label>Tanggal Selesai</label>
                                            <input type="date" value={eventForm.tanggalSelesai} onChange={(e) => setEventForm({ ...eventForm, tanggalSelesai: e.target.value })} required />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={eventForm.statusAktif} onChange={(e) => setEventForm({ ...eventForm, statusAktif: e.target.checked })} />
                                            <span>Event Aktif</span>
                                        </label>
                                    </div>

                                    {(userRole === 'ADMIN' || userRole === 'TU') && (
                                        <div className="form-group">
                                            <label>Tugaskan Proktor (Opsional)</label>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' }}>
                                                {teachers.map(t => (
                                                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={eventForm.proktorIds?.includes(t.profileId)}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setEventForm(prev => {
                                                                    const ids = prev.proktorIds || [];
                                                                    return {
                                                                        ...prev,
                                                                        proktorIds: checked
                                                                            ? (ids.includes(t.profileId) ? ids : [...ids, t.profileId])
                                                                            : ids.filter(id => id !== t.profileId)
                                                                    };
                                                                });
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.9rem' }}>{t.namaLengkap}</span>
                                                    </label>
                                                ))}
                                                {teachers.length === 0 && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Belum ada data guru</span>}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label>{userRole === 'GURU' ? 'Mata Pelajaran Anda' : 'Pilih Mata Pelajaran & Guru'}</label>
                                        <select
                                            value={examForm.mapelId && examForm.guruId ? `${examForm.mapelId}-${examForm.guruId}` : ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if(val) {
                                                    const [mId, gId] = val.split('-');
                                                    setExamForm({ ...examForm, mapelId: mId, guruId: gId });
                                                } else {
                                                    setExamForm({ ...examForm, mapelId: '', guruId: '' });
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">-- Pilih Mapel & Guru --</option>
                                            {Array.from(new Map(myAssignments.map(a => [`${a.mapelId}-${a.guruId}`, a])).values()).map(a => (
                                                <option key={`${a.mapelId}-${a.guruId}`} value={`${a.mapelId}-${a.guruId}`}>
                                                    {a.namaMapel} ({a.namaGuru})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {(() => {
                                        const ev = events.find(e => e.id == examForm.eventId);
                                        if (!ev || !ev.tanggalMulai) return null;
                                        const isInvalid = new Date(ev.tanggalSelesai) < new Date(ev.tanggalMulai);
                                        return (
                                            <div className={`event-range-info ${isInvalid ? 'invalid' : ''}`}>
                                                <Info size={16} />
                                                <div className="flex-1">
                                                    <p className="font-semibold">{isInvalid ? '⚠️ Rentang Waktu Event Tidak Valid' : '📅 Rentang Waktu Event'}</p>
                                                    <p>{new Date(ev.tanggalMulai).toLocaleDateString('id-ID', { dateStyle: 'long' })} s/d {new Date(ev.tanggalSelesai).toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                                                    {isInvalid && <p className="text-xs mt-1 text-red-600">Mohon lapor Admin untuk memperbaiki tanggal event ini.</p>}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label>Waktu Mulai</label>
                                            <input
                                                type="datetime-local"
                                                value={examForm.waktuMulai}
                                                onChange={(e) => setExamForm({ ...examForm, waktuMulai: e.target.value })}
                                                min={(() => {
                                                    const ev = events.find(e => e.id == examForm.eventId);
                                                    if (!ev || !ev.tanggalMulai) return '';
                                                    const isInvalid = new Date(ev.tanggalSelesai) < new Date(ev.tanggalMulai);
                                                    // Jika invalid, jangan batasi min agar user tetap bisa pilih (admin bisa fix nanti)
                                                    return isInvalid ? '' : `${ev.tanggalMulai} T00:00`;
                                                })()}
                                                max={(() => {
                                                    const ev = events.find(e => e.id == examForm.eventId);
                                                    if (!ev || !ev.tanggalSelesai) return '';
                                                    const isInvalid = new Date(ev.tanggalSelesai) < new Date(ev.tanggalMulai);
                                                    return isInvalid ? '' : `${ev.tanggalSelesai}T23:59`;
                                                })()}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Durasi (Menit)</label>
                                            <input type="number" value={examForm.durasi} onChange={(e) => setExamForm({ ...examForm, durasi: e.target.value })} required />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Token Ujian</label>
                                        <div className="auto-generate-box">
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Key size={16} />
                                                <input 
                                                    type="text" 
                                                    value={examForm.token || ''} 
                                                    onChange={(e) => setExamForm({ ...examForm, token: e.target.value.toUpperCase() })} 
                                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '1.2rem', fontWeight: 800, color: '#2563eb', letterSpacing: '2px', width: '100%' }}
                                                    placeholder="Input manual / kosongkan utk auto"
                                                />
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                                                    let randToken = '';
                                                    for (let i = 0; i < 6; i++) {
                                                        randToken += chars.charAt(Math.floor(Math.random() * chars.length));
                                                    }
                                                    setExamForm({ ...examForm, token: randToken });
                                                }}
                                                className="btn-icon-outline"
                                                style={{ width: 'auto', padding: '0 12px', height: '36px', fontSize: '0.85rem', fontWeight: 'bold' }}
                                            >
                                                Acak
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
                                <button type="submit" className="btn-primary">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* End of main list return block */}
            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: rgba(15, 23, 42, 0.82);
                    backdrop-filter: blur(6px);
                    z-index: 99999;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    overflow-y: auto;
                }
                .modal-content.animate-slide-up {
                    border-radius: 16px;
                    width: 100%;
                    max-width: 750px;
                    padding: 30px;
                    box-shadow: 0 25px 60px -10px rgba(0,0,0,0.5);
                    background: white;
                    margin: 85px auto 40px auto;
                    max-height: calc(100vh - 105px);
                    overflow-y: auto;
                }
                .modal-content.animate-slide-up::-webkit-scrollbar { width: 6px; }
                .modal-content.animate-slide-up::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

                .exam-management { padding: 0; }
                .page-header h1 { font-size: 1.3rem; font-weight: 900; color: #0f172a; letter-spacing: -1px; margin: 0; }
                .page-header p { color: #64748b; font-size: 0.8rem; margin-top: 4px; }

                .btn-primary {
                    background: #3b82f6;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 14px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.2);
                }
                .btn-primary:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.3); }

                .tabs-container {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 40px;
                    background: #f1f5f9;
                    padding: 6px;
                    border-radius: 20px;
                    width: fit-content;
                }

                .nav-tab {
                    background: none;
                    border: none;
                    padding: 12px 28px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 700;
                    color: #64748b;
                    cursor: pointer;
                    border-radius: 16px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .nav-tab.active { background: white; color: #3b82f6; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }

                .my-assignments-summary {
                    background: white;
                    padding: 24px;
                    border-radius: 20px;
                    margin-bottom: 32px;
                    border: 1.5px solid #f1f5f9;
                }

                .my-assignments-summary h3 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 20px;
                }

                .assignments-grid { display: flex; flex-wrap: wrap; gap: 12px; }

                .assignment-badge {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 20px;
                    background: #f8fafc;
                    border-radius: 14px;
                    border: 1.5px solid #e2e8f0;
                }

                .badge-mapel { font-weight: 800; color: #3b82f6; }
                .badge-kelas { font-size: 0.8rem; color: #64748b; background: white; padding: 4px 10px; border-radius: 8px; font-weight: 700; }

                .event-range-info {
                    background: #f0f9ff;
                    padding: 20px;
                    border-radius: 18px;
                    margin-bottom: 32px;
                    border: 1.5px solid #bae6fd;
                    color: #0369a1;
                    font-size: 0.95rem;
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }
                .event-range-info.invalid { background: #fef2f2; border-color: #fecaca; color: #991b1b; }


                .event-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 32px; }
                .event-card {
                    background: white;
                    border-radius: 30px;
                    border: 1.5px solid #f1f5f9;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .event-card:hover { transform: translateY(-12px); box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.08); border-color: #3b82f6; }

                .event-header { padding: 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f8fafc; }
                .badge-active { background: #f0fdf4; color: #16a34a; padding: 8px 16px; border-radius: 50px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; border: 1.5px solid #bbf7d0; }
                .badge-inactive { background: #fef2f2; color: #ef4444; padding: 8px 16px; border-radius: 50px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; border: 1.5px solid #fecaca; }

                .icon-btn { background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 10px; border-radius: 12px; cursor: pointer; color: #64748b; transition: all 0.2s; }
                .icon-btn:hover { transform: scale(1.1); }
                .icon-btn.edit:hover { background: #eff6ff; color: #3b82f6; border-color: #3b82f6; }
                .icon-btn.delete:hover { background: #fef2f2; color: #ef4444; border-color: #fecaca; }
                .icon-btn.activate:hover { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
                .icon-btn.deactivate:hover { background: #fffbeb; color: #d97706; border-color: #fde68a; }

                .event-options { display: flex; gap: 8px; align-items: center; }

                .event-body { padding: 28px; flex: 1; }
                .event-body h3 { color: #0f172a; margin-bottom: 20px; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.5px; }
                .event-info { display: grid; gap: 12px; }
                .event-info p { font-size: 0.95rem; color: #64748b; display: flex; align-items: center; gap: 10px; font-weight: 500; }
                .event-info span { font-weight: 800; color: #94a3b8; width: 100px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }

                .event-footer { padding: 24px; background: #f8fafc; border-top: 1.5px solid #f1f5f9; }
                .btn-outline { background: white; border: 2px solid #e2e8f0; color: #475569; padding: 14px; border-radius: 16px; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.3s; width: 100%; }
                .btn-outline:hover { background: #3b82f6; color: white; border-color: #3b82f6; box-shadow: 0 15px 20px -5px rgba(59, 130, 246, 0.25); }

                .selection-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 20px; background: white; padding: 12px; border-radius: 20px; border: 1.5px solid #f1f5f9; }
                .event-selector { flex: 1; padding: 12px 20px; border-radius: 14px; border: 2px solid #f1f5f9; font-weight: 700; color: #1e293b; outline: none; transition: all 0.2s; background: #f8fafc; cursor: pointer; }
                .event-selector:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.05); }
                .empty-state { padding: 100px 0; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 20px; background: white; border-radius: 32px; border: 3px dashed #e2e8f0; }
                .empty-state p { font-size: 1.1rem; font-weight: 600; color: #64748b; }

                .table-card { background: white; border-radius: 32px; border: 1.5px solid #f1f5f9; box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.03); overflow: hidden; }
                .exam-table { width: 100%; border-collapse: collapse; }
                .exam-table th { background: #f8fafc; padding: 24px; text-align: left; font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; font-weight: 800; letter-spacing: 1.5px; border-bottom: 2px solid #f1f5f9; }
                .exam-table td { padding: 24px; border-bottom: 1.5px solid #f8fafc; font-size: 1rem; color: #334155; }
                .mapel-cell { font-weight: 950; color: #0f172a; font-size: 1.15rem; letter-spacing: -0.5px; }
                .time-cell { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 0.95rem; font-weight: 700; background: #f1f5f9; padding: 8px 16px; border-radius: 12px; width: fit-content; }
                .token-badge { background: #eff6ff; border: 2.5px dashed #3b82f6; padding: 8px 18px; border-radius: 12px; font-family: 'JetBrains Mono', monospace; font-weight: 950; color: #2563eb; display: inline-block; font-size: 1.25rem; letter-spacing: 2px; }
                .duration-badge { background: #fffbeb; color: #92400e; padding: 8px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 800; border: 1.5px solid #fef3c7; }
                .btn-lengkapi { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: all 0.3s; box-shadow: 0 6px 12px rgba(59, 130, 246, 0.15); }
                .btn-lengkapi:hover { background: #2563eb; transform: scale(1.05); box-shadow: 0 12px 20px rgba(59, 130, 246, 0.25); }
                .btn-icon-outline { background: white; border: 2px solid #f1f5f9; color: #64748b; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .btn-icon-outline:hover { background: #3b82f6; color: white; border-color: #3b82f6; }

                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
                .modal-content { background: white; border-radius: 32px; width: 100%; max-width: 550px; padding: 40px; box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.35); }
                .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .modal-header h3 { font-size: 1.75rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
                .form-group label { display: block; margin-bottom: 10px; font-size: 0.85rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1px; }
                .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 16px; border: 2.5px solid #f1f5f9; border-radius: 16px; font-size: 1rem; font-weight: 600; color: #1e293b; background: #f8fafc; transition: all 0.2s; }
                .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #3b82f6; background: white; outline: none; box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.08); }
                .auto-generate-box { background: #f8fafc; padding: 16px; border-radius: 16px; border: 2.5px dashed #cbd5e1; display: flex; align-items: center; gap: 12px; color: #64748b; font-size: 0.9rem; }
                .btn-refresh-token { background: #f1f5f9; border: 1.5px solid #e2e8f0; color: #64748b; padding: 6px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
                .btn-refresh-token:hover { background: #e2e8f0; color: #3b82f6; transform: rotate(180deg); }
                .modal-footer { display: flex; justify-content: flex-end; gap: 16px; margin-top: 32px; }
                .btn-secondary { background: #f1f5f9; color: #475569; padding: 14px 28px; border-radius: 14px; font-weight: 700; border: none; cursor: pointer; }

                .back-btn { background: #f8fafc; border: 1.5px solid #e2e8f0; color: #64748b; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .back-btn:hover { background: #fff; color: #3b82f6; border-color: #3b82f6; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.1); }

            /* Questions View Styles (Legacy fallback fallback) */
            .questions-layout { display: grid; grid-template-columns: 460px 1fr!important; gap: 40px; align-items: start; }
            .q-type-switcher { display: grid; grid-template-columns: 1fr 1fr; background: #e2e8f0; padding: 6px; border-radius: 16px; margin-bottom: 28px; gap: 6px; }
            .q-type-btn { border: none; padding: 12px; border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 0.85rem; color: #475569; background: transparent; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            .q-type-btn.active { background: white; color: #3b82f6; box-shadow: 0 10px 15px-3px rgba(0, 0, 0, 0.1); transform: scale(1.02); }

            .form-title { font-size: 1.25rem; color: #0f172a; margin-bottom: 28px; font-weight: 900; border-left: 6px solid #3b82f6; padding-left: 16px; letter-spacing: -0.5px; }

            .question-form-card.form-group { margin-bottom: 24px; display: flex!important; flex-direction: column!important; width: 100%; }
            .question-form-card label { display: block!important; font-weight: 800; color: #334155; margin-bottom: 10px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
            .question-form-card textarea, .question-form-card input, .question-form-card select { width: 100%; font-family: inherit; border: 2.5px solid #e2e8f0; border-radius: 16px; padding: 16px; font-size: 1rem; color: #1e293b; background: #f8fafc; transition: all 0.2s; }
            .question-form-card textarea:focus, .question-form-card input:focus { border-color: #3b82f6; background: white; outline: none; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }

            .opt-input-wrapper { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
            .opt-input-letter { background: #f1f5f9; color: #64748b; font-weight: 900; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 2px solid #e2e8f0; }
            .opt-input-wrapper input { flex: 1; }

            .questions-container { display: flex; flex-direction: column; gap: 24px; max-height: calc(100vh - 250px); overflow-y: auto; padding-right: 12px; padding-bottom: 20px; }
            .question-item { background: #fff; border: 2.5px solid #f1f5f9; border-radius: 24px; padding: 28px; transition: all 0.3s; }
            .question-item:hover { border-color: #3b82f6; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05); transform: translateY(-2px); }
            .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
            .q-number { font-size: 0.8rem; font-weight: 900; color: #3b82f6; text-transform: uppercase; background: #eff6ff; padding: 8px 16px; border-radius: 12px; letter-spacing: 1px; border: 1.5px solid #dbeafe; }
            .q-type-badge { font-size: 0.75rem; font-weight: 800; color: #64748b; background: #f1f5f9; padding: 4px 12px; border-radius: 50px; margin-left: 10px; }

            .q-actions { display: flex; gap: 10px; }
            .q-actions button { background: white; border: 1.5px solid #e2e8f0; cursor: pointer; padding: 10px; border-radius: 12px; transition: all 0.2s; color: #64748b; }
            .q-actions.edit-btn:hover { color: #3b82f6; border-color: #3b82f6; background: #eff6ff; }
            .q-actions.delete-btn:hover { color: #ef4444; border-color: #fee2e2; background: #fef2f2; }

            .q-body { margin-bottom: 24px; }
            .q-text { font-size: 1.15rem; color: #0f172a; line-height: 1.6; font-weight: 700; }
            .q-options { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
            .opt-item { font-size: 0.95rem; padding: 16px; background: #fff; border-radius: 14px; border: 2.5px solid #f1f5f9; display: flex; gap: 12px; align-items: start; transition: all 0.2s; }
            .opt-item:hover { border-color: #e2e8f0; background: #f8fafc; }
            .opt-item.kunci { background: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: 800; }
            .opt-letter { color: #94a3b8; font-weight: 900; background: #f1f5f9; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; border: 1.5px solid #e2e8f0; }
            .opt-item.kunci.opt-letter { background: #22c55e; color: white; border-color: #22c55e; }

            .q-kunci { margin-top: 24px; background: #fffbeb; padding: 20px; border-radius: 20px; border-left: 6px solid #f59e0b; }
            .q-kunci label { display: block; font-size: 0.8rem; font-weight: 900; color: #b45309; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
            .q-kunci p { font-size: 1rem; color: #78350f; margin: 0; line-height: 1.6; font-weight: 600; }

            .q-footer { border-top: 2.5px solid #f1f5f9; padding-top: 24px; display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; color: #64748b; font-weight: 800; }
            .total-weight { background: #0f172a; color: white; padding: 10px 20px; border-radius: 50px; font-size: 0.9rem; font-weight: 900; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
            .total-weight.valid { background: #22c55e; }
            .btn-submit-q { width: 100%; justify-content: center; padding: 20px!important; margin-top: 16px; font-weight: 900!important; font-size: 1.1rem!important; border-radius: 18px!important; }
            .btn-cancel-edit { background: white; border: 2.5px solid #e2e8f0; color: #64748b; padding: 16px; border-radius: 18px; font-weight: 800; width: 100%; margin-top: 16px; cursor: pointer; transition: all 0.2s; }
            .btn-cancel-edit:hover { background: #f8fafc; border-color: #94a3b8; color: #1e293b; }

            /* Dark Mode Overrides for Exam Management */
            [data-theme="dark"] .page-header h1,
            [data-theme="dark"] .my-assignments-summary h3,
            [data-theme="dark"] .event-body h3,
            [data-theme="dark"] .mapel-cell,
            [data-theme="dark"] .modal-header h3,
            [data-theme="dark"] .form-title,
            [data-theme="dark"] .q-text,
            [data-theme="dark"] .total-weight {
                color: #f8fafc;
            }

            [data-theme="dark"] .tabs-container {
                background: #1e293b;
            }

            [data-theme="dark"] .nav-tab {
                color: #94a3b8;
            }

            [data-theme="dark"] .nav-tab.active {
                background: #334155;
                color: #60a5fa;
            }

            [data-theme="dark"] .my-assignments-summary,
            [data-theme="dark"] .selection-bar,
            [data-theme="dark"] .table-card,
            [data-theme="dark"] .question-item,
            [data-theme="dark"] .modal-content {
                background: #1e293b;
                border-color: #334155;
            }

            [data-theme="dark"] .assignment-badge {
                background: #0f172a;
                border-color: #334155;
            }

            [data-theme="dark"] .badge-kelas,
            [data-theme="dark"] .event-footer {
                background: #0f172a;
                border-color: #334155;
            }

            [data-theme="dark"] .event-card {
                background: #1e293b;
                border-color: #334155;
            }

            [data-theme="dark"] .event-card:hover {
                border-color: #3b82f640;
            }

            [data-theme="dark"] .event-header,
            [data-theme="dark"] .exam-table th,
            [data-theme="dark"] .q-footer {
                border-color: #334155;
                background: #0f172a60;
            }

            [data-theme="dark"] .icon-btn,
            [data-theme="dark"] .btn-icon-outline,
            [data-theme="dark"] .back-btn,
            [data-theme="dark"] .q-actions button {
                background: #0f172a;
                border-color: #334155;
                color: #94a3b8;
            }

            [data-theme="dark"] .btn-outline {
                background: #0f172a;
                border-color: #334155;
                color: #cbd5e1;
            }

            [data-theme="dark"] .event-selector,
            [data-theme="dark"] .form-group input,
            [data-theme="dark"] .form-group select,
            [data-theme="dark"] .form-group textarea,
            [data-theme="dark"] .question-form-card textarea,
            [data-theme="dark"] .question-form-card input,
            [data-theme="dark"] .question-form-card select {
                background: #0f172a;
                border-color: #334155;
                color: #f1f5f9;
            }

            [data-theme="dark"] .time-cell {
                background: #334155;
                color: #cbd5e1;
            }

            [data-theme="dark"] .duration-badge {
                background: #451a0330;
                border-color: #78350f40;
                color: #fbbf24;
            }

            [data-theme="dark"] .token-badge {
                background: #1e40af20;
                border-color: #3b82f660;
                color: #60a5fa;
            }

            [data-theme="dark"] .opt-item {
                background: #0f172a;
                border-color: #334155;
                color: #cbd5e1;
            }

            [data-theme="dark"] .opt-letter {
                background: #334155;
                border-color: #475569;
                color: #94a3b8;
            }

            [data-theme="dark"] .q-kunci {
                background: #451a0320;
                border-left-color: #f59e0b;
            }

            [data-theme="dark"] .form-group label,
            [data-theme="dark"] .question-form-card label {
                color: #94a3b8;
            }
`}</style >
        </>
    );
};

export default ExamManagement;
