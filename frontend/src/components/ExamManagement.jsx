import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
    Sparkles,
    Calendar,
    BookOpen,
    Plus,
    Edit3,
    LogOut,
    ChevronRight,
    ShieldCheck,
    CheckCircle2,
    CheckSquare,
    XCircle,
    Trash2,
    Book,
    Clock,
    Key,
    Info,
    RefreshCw, RotateCcw,
    ArrowLeft,
    Save,
    Search,
    FileText,
    Edit,
    BookCheck,
    Power,
    PowerOff,
    CloudUpload,
    Image as ImageIcon,
    Eye,
    EyeOff,
    ZoomIn,
    X,
    Copy,
    FileDown
} from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const QuillEditor = ({ value, onChange, placeholder, isSimple }) => {
    const containerRef = useRef(null);
    const quillRef = useRef(null);
    const isInternalChange = useRef(false);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear out container completely to eliminate any duplicate toolbars or stale instances
        containerRef.current.innerHTML = '';
        const editorDiv = document.createElement('div');
        containerRef.current.appendChild(editorDiv);

        const quill = new Quill(editorDiv, {
            theme: 'snow',
            placeholder: placeholder || 'Ketik di sini...',
            modules: {
                toolbar: isSimple ? [
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                ] : {
                    container: [
                        [{ 'header': [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link', 'image', 'video'],
                        ['clean']
                    ]
                }
            }
        });
        quillRef.current = quill;

        if (value) {
            if (quill.clipboard.dangerouslyPasteHTML) {
                quill.clipboard.dangerouslyPasteHTML(value);
            } else {
                quill.root.innerHTML = value;
            }
        }

        // Handle image upload compression inside Quill toolbar
        if (!isSimple && quill.getModule('toolbar')) {
            const toolbar = quill.getModule('toolbar');
            toolbar.addHandler('image', () => {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                input.click();
                input.onchange = async () => {
                    const file = input.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const img = new window.Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const maxDim = 1200;
                                if (width > maxDim || height > maxDim) {
                                    if (width > height) {
                                        height = Math.round((height * maxDim) / width);
                                        width = maxDim;
                                    } else {
                                        width = Math.round((width * maxDim) / height);
                                        height = maxDim;
                                    }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                
                                const range = quill.getSelection(true);
                                quill.insertEmbed(range ? range.index : 0, 'image', compressedDataUrl);
                                quill.setSelection((range ? range.index : 0) + 1);
                            };
                            img.src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                };
            });
        }

        quill.on('text-change', () => {
            isInternalChange.current = true;
            const content = quill.root.innerHTML;
            if (onChangeRef.current) onChangeRef.current(content);
            setTimeout(() => { isInternalChange.current = false; }, 100);
        });

        return () => {
            quillRef.current = null;
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
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

    return <div ref={containerRef} style={{ width: '100%' }} />;
};



// Indonesian WIB Date & Time Helper Functions
const parseWibParts = (val) => {
    if (!val) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return { date: `${y}-${m}-${d}`, hour: '07', minute: '30' };
    }
    if (val.includes('T')) {
        const [d, t] = val.split('T');
        const [h, min] = (t || '00:00').split(':');
        return {
            date: d || '',
            hour: String(h || '00').padStart(2, '0').slice(0, 2),
            minute: String(min || '00').padStart(2, '0').slice(0, 2)
        };
    }
    return {
        date: val.slice(0, 10),
        hour: '07',
        minute: '30'
    };
};

const formatIndonesianDateTime = (dateStr, hourStr, minStr) => {
    if (!dateStr) return '-';
    try {
        const [y, m, d] = dateStr.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const dayName = dayNames[dateObj.getDay()] || '';
        const monthName = monthNames[dateObj.getMonth()] || '';
        return `${dayName}, ${Number(d)} ${monthName} ${y} pukul ${hourStr || '00'}:${minStr || '00'} WIB`;
    } catch {
        return `${dateStr} ${hourStr}:${minStr} WIB`;
    }
};

const addMinutesToWib = (dateStr, hourStr, minStr, durMinutes) => {
    if (!dateStr) return { date: '', hour: '09', minute: '00' };
    const [y, m, d] = dateStr.split('-').map(Number);
    const totalMins = Number(hourStr || 0) * 60 + Number(minStr || 0) + Number(durMinutes || 0);
    const dateObj = new Date(y, m - 1, d, 0, totalMins);
    const endY = dateObj.getFullYear();
    const endM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const endD = String(dateObj.getDate()).padStart(2, '0');
    const endH = String(dateObj.getHours()).padStart(2, '0');
    const endMin = String(dateObj.getMinutes()).padStart(2, '0');
    return { date: `${endY}-${endM}-${endD}`, hour: endH, minute: endMin };
};

const ExamManagement = () => {
    const [activeTab, setActiveTab] = useState('events'); // 'events' or 'exams'
    const [events, setEvents] = useState([]);
    const [allMapels, setAllMapels] = useState([]);
    const [myAssignments, setMyAssignments] = useState([]);
    const [exams, setExams] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [kelasList, setKelasList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [userRole, setUserRole] = useState('');
    const [downloadingExamId, setDownloadingExamId] = useState(null);

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
        token: '',
        kelasIds: []
    });

    // Sub-view for entering questions
    const [viewingQuestions, setViewingQuestions] = useState(null); // Will hold exam object
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [copyTargetExam, setCopyTargetExam] = useState(null);
    const [selectedSourceExamId, setSelectedSourceExamId] = useState('');
    // AI Word Import & Draft States
    const [isWordImportModalOpen, setIsWordImportModalOpen] = useState(false);
    const [wordImportTargetExam, setWordImportTargetExam] = useState(null);
    const [wordImportStep, setWordImportStep] = useState('input'); // 'input' | 'review'
    const [wordImportTab, setWordImportTab] = useState('file'); // 'file' | 'text'
    const [wordImportFile, setWordImportFile] = useState(null);
    const [wordImportRawText, setWordImportRawText] = useState('');
    const [isExtractingAi, setIsExtractingAi] = useState(false);
    const [isSavingBatch, setIsSavingBatch] = useState(false);
    const [draftQuestions, setDraftQuestions] = useState([]);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    const handleOpenWordImportModal = (exam) => {
        setWordImportTargetExam(exam);
        setWordImportStep('input');
        setWordImportTab('file');
        setWordImportFile(null);
        setWordImportRawText('');
        setDraftQuestions([]);
        setIsWordImportModalOpen(true);
    };

    const handleExtractWordAi = async () => {
        if (!wordImportTargetExam) return;
        if (wordImportTab === 'file' && !wordImportFile) {
            alert('Silakan pilih file Word (.docx) terlebih dahulu.');
            return;
        }
        if (wordImportTab === 'text' && (!wordImportRawText || !wordImportRawText.trim())) {
            alert('Silakan masukkan atau tempel teks naskah soal terlebih dahulu.');
            return;
        }

        setIsExtractingAi(true);
        try {
            const formData = new FormData();
            if (wordImportTab === 'file' && wordImportFile) {
                formData.append('file', wordImportFile);
            } else if (wordImportTab === 'text') {
                formData.append('rawText', wordImportRawText);
            }

            const res = await axios.post('/api/exam/ujian-mapel/ai-extract-word', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            });

            const extractedList = Array.isArray(res.data) 
                ? res.data 
                : (res.data && Array.isArray(res.data.drafts) ? res.data.drafts : null);

            if (extractedList) {
                if (extractedList.length === 0) {
                    alert('AI tidak menemukan butir soal dalam dokumen. Pastikan dokumen berisi naskah soal berformat nomor dan opsi.');
                } else {
                    setDraftQuestions(extractedList);
                    setWordImportStep('review');
                }
            } else {
                alert('Gagal mengekstrak soal: ' + (res.data?.message || 'Format respon tidak dikenali'));
            }
        } catch (err) {
            console.error('Error extracting Word AI:', err);
            alert('Gagal mengekstrak soal: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsExtractingAi(false);
        }
    };

    const handleUpdateDraft = (index, field, value) => {
        setDraftQuestions(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    };

    const handleDeleteDraft = (index) => {
        if (window.confirm(`Hapus draf soal nomor ${index + 1}?`)) {
            setDraftQuestions(prev => {
                const next = prev.filter((_, i) => i !== index);
                return next.map((item, i) => ({ ...item, nomor: i + 1 }));
            });
        }
    };

    const handleAddDraft = () => {
        setDraftQuestions(prev => [
            ...prev,
            {
                nomor: prev.length + 1,
                tipeSoal: 'PG_BIASA',
                pertanyaan: '',
                pilihanA: '',
                pilihanB: '',
                pilihanC: '',
                pilihanD: '',
                pilihanE: '',
                kunciJawaban: 'A',
                bobotNilai: 2.0
            }
        ]);
    };

    const handleSaveBatchDraftQuestions = async () => {
        if (!wordImportTargetExam) return;
        if (!draftQuestions || draftQuestions.length === 0) {
            alert('Tidak ada draf soal untuk disimpan.');
            return;
        }

        const emptyItems = draftQuestions.filter(d => !d.pertanyaan || !d.pertanyaan.trim());
        if (emptyItems.length > 0) {
            if (!window.confirm(`Ada ${emptyItems.length} butir soal dengan pertanyaan kosong yang akan dilewati. Lanjutkan simpan?`)) {
                return;
            }
        }

        setIsSavingBatch(true);
        try {
            const res = await axios.post(`/api/exam/ujian-mapel/${wordImportTargetExam.id}/save-batch-questions`, draftQuestions, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (res.data && res.data.success) {
                alert(`Berhasil menyimpan ${res.data.savedCount} soal ke dalam ujian "${wordImportTargetExam.namaMapel}"!`);
                setIsWordImportModalOpen(false);
                setDraftQuestions([]);
                setWordImportFile(null);
                setWordImportRawText('');
                setWordImportStep('input');

                if (viewingQuestions && viewingQuestions.id === wordImportTargetExam.id) {
                    await handleManageQuestions(viewingQuestions);
                }
            } else {
                alert('Gagal menyimpan soal: ' + (res.data?.message || 'Terjadi kesalahan'));
            }
        } catch (err) {
            console.error('Error saving batch draft questions:', err);
            alert('Gagal menyimpan soal: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsSavingBatch(false);
        }
    };
    const [isCopying, setIsCopying] = useState(false);
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
        tipeSoal: 'PG_BIASA',
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
    const [savingQuestion, setSavingQuestion] = useState(false);
    const [enlargedImage, setEnlargedImage] = useState(null);
    const directImageInputRef = useRef(null);
    const optFileInputRefs = useRef({});
    const [uploadingOpt, setUploadingOpt] = useState(null);

    const extractImgSrc = (html) => {
        if (!html || typeof html !== 'string') return null;
        const m = html.match(/<img[^>]+src="([^">]+)"/i);
        return m ? m[1] : null;
    };

    const uploadOptImageFile = async (opt, file) => {
        if (!file) return;
        setUploadingOpt(opt);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/exam/upload-image', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            const imgUrl = res.data.url;
            const currentVal = questionFormPG[`pilihan${opt}`] || '';
            const textOnly = currentVal.replace(/<p><img[^>]*><\/p>|<img[^>]*>/gi, '').trim();
            const newTag = `<p><img src="${imgUrl}" alt="Opsi ${opt}" style="max-height:160px; max-width:100%; border-radius:8px; display:block; margin:6px 0; box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></p>`;
            const combined = textOnly ? `${textOnly} ${newTag}` : newTag;
            setQuestionFormPG(prev => ({
                ...prev,
                [`pilihan${opt}`]: combined
            }));
        } catch (err) {
            console.error('Upload option image via API failed, using compressed local fallback', err);
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 800;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.85);
                    const currentVal = questionFormPG[`pilihan${opt}`] || '';
                    const textOnly = currentVal.replace(/<p><img[^>]*><\/p>|<img[^>]*>/gi, '').trim();
                    const newTag = `<p><img src="${compressed}" alt="Opsi ${opt}" style="max-height:160px; max-width:100%; border-radius:8px; display:block; margin:6px 0; box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></p>`;
                    const combined = textOnly ? `${textOnly} ${newTag}` : newTag;
                    setQuestionFormPG(prev => ({
                        ...prev,
                        [`pilihan${opt}`]: combined
                    }));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        } finally {
            setUploadingOpt(null);
        }
    };

    const handleOptImageUpload = (opt, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        uploadOptImageFile(opt, file);
    };

    const handleOptPaste = (opt, e) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        let imageFile = null;
        if (clipboardData.items) {
            for (let i = 0; i < clipboardData.items.length; i++) {
                const item = clipboardData.items[i];
                if (item.type && item.type.startsWith('image/')) {
                    imageFile = item.getAsFile();
                    break;
                }
            }
        }

        if (!imageFile && clipboardData.files && clipboardData.files.length > 0) {
            for (let i = 0; i < clipboardData.files.length; i++) {
                const file = clipboardData.files[i];
                if (file.type && file.type.startsWith('image/')) {
                    imageFile = file;
                    break;
                }
            }
        }

        if (imageFile) {
            e.preventDefault();
            uploadOptImageFile(opt, imageFile);
        }
    };

    const handleOptDrop = (opt, e) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type && file.type.startsWith('image/')) {
                uploadOptImageFile(opt, file);
            }
        }
    };

    const handleRemoveOptImage = (opt) => {
        const currentVal = questionFormPG[`pilihan${opt}`] || '';
        const textOnly = currentVal.replace(/<p><img[^>]*><\/p>|<img[^>]*>/gi, '').trim();
        setQuestionFormPG(prev => ({
            ...prev,
            [`pilihan${opt}`]: textOnly
        }));
    };

    const handleDirectImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1200;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                
                const imageTag = `<p><img src="${compressedDataUrl}" alt="Gambar Soal" style="max-width:100%; border-radius:12px; margin: 10px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" /></p>`;
                if (qType === 'essay') {
                    setQuestionForm(prev => ({ ...prev, pertanyaan: (prev.pertanyaan || '') + imageTag }));
                } else {
                    setQuestionFormPG(prev => ({ ...prev, pertanyaan: (prev.pertanyaan || '') + imageTag }));
                }
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRemoveImagesFromCurrent = () => {
        if (!window.confirm('Hapus semua gambar dari isi pertanyaan saat ini?')) return;
        const cleanHtml = (html) => html ? html.replace(/<img[^>]*>/gi, '') : '';
        if (qType === 'essay') {
            setQuestionForm(prev => ({ ...prev, pertanyaan: cleanHtml(prev.pertanyaan) }));
        } else {
            setQuestionFormPG(prev => ({ ...prev, pertanyaan: cleanHtml(prev.pertanyaan) }));
        }
    };

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
            tipeSoal: 'PG_BIASA',
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

        const userObj = JSON.parse(userStr || '{}');
        const isCoAdmin = userObj.isCoAdmin;
        if (role === 'GURU' && !isCoAdmin) {
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
            const eventData = res.data;
            setEvents(eventData);

            try {
                const mapelRes = await axios.get('/api/master/mapel', { headers });
                setAllMapels(mapelRes.data || []);
            } catch (e) {
                console.error("Error fetching master mapels", e);
            }

            // Auto-select first active event if nothing selected
            if (eventData.length > 0 && !examForm.eventId) {
                const activeEvent = eventData.find(e => e.statusAktif) || eventData[0];
                setExamForm(prev => ({ ...prev, eventId: activeEvent.id }));
                fetchExams(activeEvent.id);
            }

            if (effectiveRole === 'ADMIN' || effectiveRole === 'TU' || JSON.parse(localStorage.getItem('user') || '{}').isCoAdmin) {
                try {
                    const usersRes = await axios.get('/api/users', { headers });
                    // Filter only teachers to assign as proktor
                    const guruUsers = usersRes.data.filter(u => u.role === 'GURU');
                    setTeachers(guruUsers);

                    const kelasRes = await axios.get('/api/master/kelas', { headers });
                    setKelasList(kelasRes.data);
                } catch (e) {
                    console.error("Error fetching master data", e);
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
            const endpoint = (effectiveRole === 'ADMIN' || effectiveRole === 'TU' || user.isCoAdmin)
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

    
    const handleExportPesertaExcel = async (exam) => {
        if (!exam || !exam.id) return;
        setDownloadingExamId(exam.id);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/exam/ujian-mapel/${exam.id}/export-peserta-excel`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const cleanMapel = (exam.namaMapel || 'Mapel').replace(/[^a-zA-Z0-9_-]/g, '_');
            const nowStr = new Date().toISOString().split('T')[0];
            const fileName = `Rekap_Ujian_${cleanMapel}_${nowStr}.xlsx`;

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export Excel error:', err);
            let msg = 'Gagal mengunduh rekap ujian.';
            if (err.response?.data) {
                try {
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const json = JSON.parse(reader.result);
                            alert(json.message || msg);
                        } catch {
                            alert(msg);
                        }
                    };
                    reader.readAsText(err.response.data);
                    return;
                } catch {}
            }
            alert(msg);
        } finally {
            setDownloadingExamId(null);
        }
    };

    const handleSaveExam = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const ev = events.find(e => e.id == examForm.eventId);
        const isLatihan = ev?.namaEvent && (
            ev.namaEvent.toLowerCase().includes('latihan') || 
            ev.namaEvent.toLowerCase().includes('simulasi') || 
            ev.namaEvent.toLowerCase().includes('ujicoba') || 
            ev.namaEvent.toLowerCase().includes('tryout')
        );

        let startIso = examForm.waktuMulai;
        if (!startIso) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            startIso = `${y}-${m}-${d}T07:30`;
        }

        let finalStart = startIso;
        if (finalStart.length === 16) finalStart += ':00';

        const durasiNum = Number(examForm.durasi) || 0;
        let finalEnd = examForm.waktuSelesai;
        if (!finalEnd && durasiNum > 0) {
            const sParts = parseWibParts(finalStart);
            const calculated = addMinutesToWib(sParts.date, sParts.hour, sParts.minute, durasiNum);
            finalEnd = `${calculated.date}T${calculated.hour}:${calculated.minute}:00`;
        } else if (!finalEnd && ev && ev.tanggalSelesai) {
            finalEnd = `${ev.tanggalSelesai}T23:59:59`;
        } else if (!finalEnd) {
            finalEnd = finalStart;
        }
        if (finalEnd.length === 16) finalEnd += ':00';

        let sanitizedToken = (examForm.token || '').trim().toUpperCase();
        if (sanitizedToken.length > 20) sanitizedToken = sanitizedToken.substring(0, 20);

        const payload = {
            ...examForm,
            token: sanitizedToken,
            waktuMulai: finalStart,
            mapelId: Number(examForm.mapelId),
            guruId: Number(examForm.guruId),
            waktuSelesai: finalEnd,
            durasi: durasiNum
        };

        // Validation against Event Range (allow override for latihan, ujicoba, simulasi)
        if (!isLatihan && ev && ev.tanggalMulai && ev.tanggalSelesai) {
            const startDateOnly = finalStart.substring(0, 10);
            if (startDateOnly < ev.tanggalMulai || startDateOnly > ev.tanggalSelesai) {
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
            console.error(err);
            const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown error';
            alert('Gagal menyimpan ujian: ' + errorMsg);
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

    const handleToggleExamStatus = async (exam) => {
        const isCurrentlyOpen = exam.statusAktif !== false;
        const confirmMsg = isCurrentlyOpen
            ? `Tutup jadwal ujian "${exam.namaMapel || 'Mapel'}"?\n\nUjian akan disembunyikan dari dashboard dan daftar ujian siswa.`
            : `Buka jadwal ujian "${exam.namaMapel || 'Mapel'}"?\n\nUjian akan langsung tampil di dashboard siswa dan siap dikerjakan.`;
        if (!window.confirm(confirmMsg)) return;

        const token = localStorage.getItem('token');
        try {
            const res = await axios.put(`/api/exam/ujian-mapel/${exam.id}/toggle-status`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const updated = res.data;
            setExams(prev => prev.map(e => e.id === exam.id ? { ...e, statusAktif: updated.statusAktif } : e));
        } catch (err) {
            console.error('Error toggling exam status:', err);
            alert(err.response?.data?.message || 'Gagal mengubah status ujian');
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
        setSavingQuestion(true);
        try {
            const isEditing = !!editingQuestion;
            if (qType === 'essay') {
                const body = { ...questionForm, ujianMapelId: viewingQuestions.id, ujianId: viewingQuestions.id };
                if (isEditing) {
                    await axios.put(`/api/exam/soal-essay/${editingQuestion.id}`, body, { headers });
                } else {
                    await axios.post('/api/exam/soal-essay', body, { headers });
                }
            } else {
                const body = { ...questionFormPG, ujianMapelId: viewingQuestions.id, ujianId: viewingQuestions.id };
                // Respect user selected tipeSoal; only set PG_KOMPLEKS if teacher actually selected multiple keys
                const kj = (body.kunciJawaban || '').trim();
                const isMultiKey = kj.includes(',') || kj.includes(';') || kj.length > 1;

                if (body.tipeSoal === 'PG_KOMPLEKS') {
                    // Stays PG_KOMPLEKS
                } else if (body.tipeSoal === 'BS_MAJEMUK') {
                    const activeSlots = ['A', 'B', 'C', 'D', 'E'].filter(o => body['pilihan' + o] && body['pilihan' + o] !== '-');
                    const cCount = Math.max(activeSlots.length, 2);
                    const kArr = (body.kunciJawaban || '').split(',').map(k => k.trim().toUpperCase());
                    body.kunciJawaban = kArr.slice(0, cCount).join(',');
                } else if (body.tipeSoal === 'BENAR_SALAH') {
                    // Stays Benar/Salah
                } else {
                    // If teacher chose PG_BIASA (1 Kunci)
                    if (isMultiKey) {
                        body.tipeSoal = 'PG_KOMPLEKS';
                    } else {
                        body.tipeSoal = 'PG_BIASA';
                    }
                }
                // Pastikan pilihan C, D, E tidak null/kosong agar tidak terkena constraint ORA-01400 pada Oracle
                if (body.tipeSoal === 'BENAR_SALAH' || (body.pilihanA === 'Benar' && body.pilihanB === 'Salah')) {
                    body.tipeSoal = 'BENAR_SALAH';
                    body.pilihanA = body.pilihanA || 'Benar';
                    body.pilihanB = body.pilihanB || 'Salah';
                    body.pilihanC = body.pilihanC || '-';
                    body.pilihanD = body.pilihanD || '-';
                    body.pilihanE = body.pilihanE || '-';
                } else {
                    body.pilihanC = body.pilihanC || '-';
                    body.pilihanD = body.pilihanD || '-';
                    body.pilihanE = body.pilihanE || '-';
                }
                if (isEditing) {
                    await axios.put(`/api/exam/soal-pg/${editingQuestion.id}`, body, { headers });
                } else {
                    await axios.post('/api/exam/soal-pg', body, { headers });
                }
            }
            resetQuestionForm();
            await handleManageQuestions(viewingQuestions);
            alert(`Berhasil! Soal berhasil ${isEditing ? 'diperbarui' : 'disimpan'}.`);
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || 'Gagal simpan soal';
            alert('Error Simpan: ' + msg);
        } finally {
            setSavingQuestion(false);
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
                tipeSoal: q.tipeSoal || 'PG_BIASA',
                pilihanA: q.pilihanA || '',
                pilihanB: q.pilihanB || '',
                pilihanC: q.pilihanC || '',
                pilihanD: q.pilihanD || '',
                pilihanE: q.pilihanE || '',
                kunciJawaban: q.kunciJawaban || 'A',
                bobotNilai: q.bobotNilai || 2
            });
        }
    };

    const handleCopyQuestions = async () => {
        const target = copyTargetExam || viewingQuestions;
        if (!selectedSourceExamId || !target) return;
        if (!window.confirm(`Apakah Anda yakin ingin menyalin seluruh soal dan kunci jawaban ke ujian "${target.namaMapel}"?`)) return;
        setIsCopying(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`/api/exam/ujian-mapel/${target.id}/copy-from/${selectedSourceExamId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message || 'Berhasil menyalin seluruh soal dan kunci jawaban!');
            setIsCopyModalOpen(false);
            setSelectedSourceExamId('');
            setCopyTargetExam(null);
            if (viewingQuestions) {
                await handleManageQuestions(viewingQuestions);
            } else if (typeof fetchExams === 'function') {
                await fetchExams();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Gagal menyalin soal');
        } finally {
            setIsCopying(false);
        }
    };

    const handleDeleteSoal = async (id, type) => {
        if (!window.confirm('Yakin ingin menghapus soal ini?')) return;
        const token = localStorage.getItem('token');
        try {
            const endpoint = type === 'essay' ? `/api/exam/soal-essay/${id}` : `/api/exam/soal-pg/${id}`;
            await axios.delete(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await handleManageQuestions(viewingQuestions);
            alert('Soal berhasil dihapus.');
        } catch (err) {
            alert('Gagal hapus soal');
        }
    };

    const handleDeleteAllQuestions = async () => {
        if (!viewingQuestions) return;
        if (!window.confirm('Yakin ingin MENGHAPUS SEMUA SOAL pada ujian ini? Tindakan ini tidak dapat dibatalkan.')) return;
        
        setIsDeletingAll(true);
        const token = localStorage.getItem('token');
        try {
            // Hapus semua PG
            for (const q of questionsPG) {
                await axios.delete(`/api/exam/soal-pg/${q.id}`, { headers: { Authorization: `Bearer ${token}` } });
            }
            // Hapus semua Essay
            for (const q of questions) {
                await axios.delete(`/api/exam/soal-essay/${q.id}`, { headers: { Authorization: `Bearer ${token}` } });
            }
            
            setQuestions([]);
            setQuestionsPG([]);
            await handleManageQuestions(viewingQuestions);
            alert('Semua soal berhasil dibersihkan.');
        } catch (err) {
            alert('Gagal menghapus beberapa soal.');
        } finally {
            setIsDeletingAll(false);
        }
    };



    const getQuestionMeta = (q) => {
        if (q.tipeSoal === 'BS_MAJEMUK') {
            return {
                typeKey: 'bs_majemuk',
                typeLabel: '📊 Tabel Benar / Salah (Poin per Butir)',
                shortLabel: 'Tabel Benar / Salah',
                badgeClass: 'badge-bs-majemuk',
                cardClass: 'pg-bs-majemuk',
                subLabel: 'Matriks Pernyataan (Nilai Parsial)',
                kunciDesc: q.kunciJawaban || 'B,B,S,B'
            };
        }
        const isBS = q.tipeSoal === 'BENAR_SALAH' || (
            q.pilihanA && q.pilihanB &&
            q.pilihanA.trim().toLowerCase() === 'benar' &&
            q.pilihanB.trim().toLowerCase() === 'salah'
        );
        if (isBS) {
            return {
                typeKey: 'tf',
                typeLabel: '⚖️ Soal Benar / Salah',
                shortLabel: 'Benar / Salah',
                badgeClass: 'badge-tf',
                cardClass: 'pg-tf',
                subLabel: 'Pernyataan Benar atau Salah',
                kunciDesc: q.kunciJawaban === 'A' ? 'A (BENAR)' : (q.kunciJawaban === 'B' ? 'B (SALAH)' : q.kunciJawaban)
            };
        }
        if (q.tipeSoal === 'PG_KOMPLEKS') {
            const keys = (q.kunciJawaban || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            return {
                typeKey: 'complex',
                typeLabel: `☑️ PG Kompleks (${keys.length || 2} Kunci Benar)`,
                shortLabel: 'PG Kompleks',
                badgeClass: 'badge-kompleks',
                cardClass: 'pg-kompleks',
                subLabel: 'Pilihan Jamak (Multi-select)',
                kunciDesc: keys.join(', ') || q.kunciJawaban
            };
        }
        return {
            typeKey: 'single',
            typeLabel: '🔘 Pilihan Ganda (1 Jawaban)',
            shortLabel: 'Pilihan Ganda',
            badgeClass: 'badge-single',
            cardClass: 'pg-single',
            subLabel: 'Pilihan Ganda Tunggal',
            kunciDesc: q.kunciJawaban || 'A'
        };
    };

    
    const renderWordImportModal = () => {
        if (!isWordImportModalOpen) return null;

        return createPortal(
            <div className="modal-overlay" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 999999,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '24px 16px',
                overflowY: 'auto',
                boxSizing: 'border-box'
            }}>
                <div className="modal-content animate-slide-up" style={{
                    borderRadius: '24px',
                    width: '100%',
                    maxWidth: wordImportStep === 'review' ? '1100px' : '650px',
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#ffffff',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                    overflow: 'hidden',
                    transition: 'max-width 0.3s ease'
                }}>
                    {/* Modal Header */}
                    <div style={{
                        padding: '20px 28px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#faf5ff'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                background: '#7c3aed',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                            }}>
                                <Sparkles size={22} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b' }}>
                                    {wordImportStep === 'review' ? 'Review & Sunting Draf Soal' : 'Import Soal dari Word / Teks (AI)'}
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
                                    Ujian: <strong style={{ color: '#4c1d95' }}>{wordImportTargetExam?.namaMapel}</strong>
                                    {wordImportTargetExam?.namaEvent && ` • ${wordImportTargetExam.namaEvent}`}
                                    {wordImportTargetExam?.namaGuru && ` • ${wordImportTargetExam.namaGuru}`}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (wordImportStep === 'review') {
                                    if (window.confirm('Keluar dari draf soal? Perubahan draf yang belum di-ACC akan hilang.')) {
                                        setIsWordImportModalOpen(false);
                                    }
                                } else {
                                    setIsWordImportModalOpen(false);
                                }
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                padding: '4px',
                                borderRadius: '8px',
                                display: 'flex'
                            }}
                        >
                            <XCircle size={24} />
                        </button>
                    </div>

                    {/* Step 1: Input & File Selection */}
                    {wordImportStep === 'input' && (
                        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
                            {/* Tab Switcher */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setWordImportTab('file')}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        background: wordImportTab === 'file' ? '#ffffff' : 'transparent',
                                        color: wordImportTab === 'file' ? '#7c3aed' : '#64748b',
                                        boxShadow: wordImportTab === 'file' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <FileText size={16} />
                                    Unggah File Word (.docx)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWordImportTab('text')}
                                    style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        background: wordImportTab === 'text' ? '#ffffff' : 'transparent',
                                        color: wordImportTab === 'text' ? '#7c3aed' : '#64748b',
                                        boxShadow: wordImportTab === 'text' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Edit3 size={16} />
                                    Tempel / Salin Teks Soal
                                </button>
                            </div>

                            {wordImportTab === 'file' ? (
                                <div>
                                    <div
                                        style={{
                                            border: '2px dashed #c4b5fd',
                                            borderRadius: '16px',
                                            padding: '36px 20px',
                                            textAlign: 'center',
                                            background: wordImportFile ? '#f5f3ff' : '#faf5ff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onClick={() => document.getElementById('docxFileInput')?.click()}
                                    >
                                        <input
                                            id="docxFileInput"
                                            type="file"
                                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setWordImportFile(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <CloudUpload size={48} color="#7c3aed" style={{ margin: '0 auto 12px' }} />
                                        {wordImportFile ? (
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 800, color: '#4c1d95', fontSize: '1rem' }}>
                                                    {wordImportFile.name}
                                                </p>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                                                    {(wordImportFile.size / 1024).toFixed(1)} KB — Klik untuk mengganti file
                                                </p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 700, color: '#4c1d95', fontSize: '0.95rem' }}>
                                                    Klik untuk memilih file naskah Word (.docx)
                                                </p>
                                                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#8b5cf6' }}>
                                                    Mendukung paragraf soal berformat nomor, opsi A-E, kunci tebal/lampiran, dan tabel benar-salah
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                                        Tempel Naskah Soal Disini:
                                    </label>
                                    <textarea
                                        rows={10}
                                        value={wordImportRawText}
                                        onChange={(e) => setWordImportRawText(e.target.value)}
                                        placeholder="Contoh:&#10;1. Ibu kota negara Indonesia adalah...&#10;A. Surabaya&#10;B. Bandung&#10;C. Jakarta&#10;D. Semarang&#10;E. Medan&#10;Kunci: C&#10;&#10;2. Manakah pernyataan berikut yang benar? (Benar/Salah)..."
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            borderRadius: '12px',
                                            border: '2px solid #e2e8f0',
                                            fontSize: '0.9rem',
                                            fontFamily: 'monospace',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            )}

                            {/* Helpful Tips Card */}
                            <div style={{
                                marginTop: '20px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '14px 18px',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start'
                            }}>
                                <Info size={20} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                                    <strong style={{ color: '#1e293b' }}>Alur Kerja Draf Soal (Aman & Terkontrol):</strong>
                                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                                        <li>File Word Anda akan dibaca dan distrukturkan oleh AI menjadi <strong>Draf Soal</strong> terlebih dahulu.</li>
                                        <li>Soal <strong>TIDAK langsung masuk</strong> ke database ujian.</li>
                                        <li>Anda dapat meneliti, menyunting kunci, opsi, butir pernyataan benar-salah, atau menghapus soal yang tidak diinginkan di layar review sebelum menekan tombol ACC.</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsWordImportModalOpen(false)}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '10px',
                                        border: '1.5px solid #cbd5e1',
                                        background: '#ffffff',
                                        color: '#64748b',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExtractWordAi}
                                    disabled={isExtractingAi || (wordImportTab === 'file' && !wordImportFile) || (wordImportTab === 'text' && !wordImportRawText.trim())}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: isExtractingAi || (wordImportTab === 'file' && !wordImportFile) || (wordImportTab === 'text' && !wordImportRawText.trim())
                                            ? '#cbd5e1'
                                            : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        cursor: isExtractingAi ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
                                    }}
                                >
                                    {isExtractingAi ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Sedang Menganalisis Naskah dengan AI...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} />
                                            Mulai Ekstrak ke Draf Soal
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Review Draf Soal */}
                    {wordImportStep === 'review' && (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            {/* Toolbar */}
                            <div style={{
                                padding: '12px 28px',
                                background: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '10px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        background: '#ecfdf5',
                                        color: '#059669',
                                        border: '1px solid #a7f3d0',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontWeight: 800,
                                        fontSize: '0.85rem'
                                    }}>
                                        {draftQuestions.length} Butir Soal Terdeteksi
                                    </span>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        Total Bobot: <strong>{draftQuestions.reduce((acc, q) => acc + (Number(q.bobotNilai) || 0), 0).toFixed(1)}</strong>
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setWordImportStep('input')}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            background: '#ffffff',
                                            color: '#475569',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ← Kembali ke Unggah
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAddDraft}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #7c3aed',
                                            background: '#f5f3ff',
                                            color: '#7c3aed',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <Plus size={14} /> Tambah Soal
                                    </button>
                                </div>
                            </div>

                            {/* Draft List Container */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', background: '#f1f5f9' }} className="custom-scrollbar">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {draftQuestions.map((draft, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                background: '#ffffff',
                                                borderRadius: '16px',
                                                border: '1.5px solid #e2e8f0',
                                                padding: '18px 20px',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                                            }}
                                        >
                                            {/* Card Top Row */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{
                                                        background: '#1e293b',
                                                        color: '#ffffff',
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {idx + 1}
                                                    </span>
                                                    <select
                                                        value={draft.tipeSoal || 'PG_BIASA'}
                                                        onChange={(e) => handleUpdateDraft(idx, 'tipeSoal', e.target.value)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #cbd5e1',
                                                            fontWeight: 700,
                                                            fontSize: '0.8rem',
                                                            background: '#ffffff',
                                                            color: '#1e293b'
                                                        }}
                                                    >
                                                        <option value="PG_BIASA">Pilihan Ganda (1 Kunci)</option>
                                                        <option value="PG_KOMPLEKS">Pilihan Ganda Kompleks (Multi Kunci)</option>
                                                        <option value="BENAR_SALAH">Benar / Salah (Tunggal)</option>
                                                        <option value="BS_MAJEMUK">Tabel Benar / Salah (Majemuk)</option>
                                                        <option value="ESSAY">Essay / Uraian</option>
                                                    </select>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Bobot:</label>
                                                        <input
                                                            type="number"
                                                            step="0.5"
                                                            value={draft.bobotNilai !== undefined ? draft.bobotNilai : 2}
                                                            onChange={(e) => handleUpdateDraft(idx, 'bobotNilai', parseFloat(e.target.value) || 0)}
                                                            style={{
                                                                width: '60px',
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                                border: '1px solid #cbd5e1',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 700,
                                                                textAlign: 'center'
                                                            }}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteDraft(idx)}
                                                        style={{
                                                            background: '#fee2e2',
                                                            color: '#ef4444',
                                                            border: 'none',
                                                            padding: '6px 10px',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700
                                                        }}
                                                        title="Hapus butir soal ini"
                                                    >
                                                        <Trash2 size={13} /> Hapus
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Pertanyaan input */}
                                            <div style={{ marginBottom: '14px' }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                                                    TEKS PERTANYAAN / STIMULUS:
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={draft.pertanyaan || ''}
                                                    onChange={(e) => handleUpdateDraft(idx, 'pertanyaan', e.target.value)}
                                                    placeholder="Masukkan teks soal..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #e2e8f0',
                                                        fontSize: '0.85rem',
                                                        fontFamily: 'inherit',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>

                                            {/* Option inputs based on type */}
                                            {(draft.tipeSoal === 'PG_BIASA' || draft.tipeSoal === 'PG_KOMPLEKS') && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                                                        PILIHAN JAWABAN & KUNCI:
                                                    </label>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                                                        {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                            const fieldName = `pilihan${opt}`;
                                                            const isChecked = draft.tipeSoal === 'PG_KOMPLEKS'
                                                                ? (draft.kunciJawaban || '').split(',').map(s => s.trim().toUpperCase()).includes(opt)
                                                                : (draft.kunciJawaban || '').trim().toUpperCase() === opt;

                                                            return (
                                                                <div
                                                                    key={opt}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '8px',
                                                                        padding: '6px 10px',
                                                                        borderRadius: '8px',
                                                                        border: `1.5px solid ${isChecked ? '#10b981' : '#e2e8f0'}`,
                                                                        background: isChecked ? '#f0fdf4' : '#ffffff'
                                                                    }}
                                                                >
                                                                    <input
                                                                        type={draft.tipeSoal === 'PG_KOMPLEKS' ? 'checkbox' : 'radio'}
                                                                        name={`kunci_${idx}`}
                                                                        checked={isChecked}
                                                                        onChange={() => {
                                                                            if (draft.tipeSoal === 'PG_KOMPLEKS') {
                                                                                let currentKeys = (draft.kunciJawaban || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                                                                if (currentKeys.includes(opt)) {
                                                                                    currentKeys = currentKeys.filter(k => k !== opt);
                                                                                } else {
                                                                                    currentKeys.push(opt);
                                                                                    currentKeys.sort();
                                                                                }
                                                                                handleUpdateDraft(idx, 'kunciJawaban', currentKeys.join(','));
                                                                            } else {
                                                                                handleUpdateDraft(idx, 'kunciJawaban', opt);
                                                                            }
                                                                        }}
                                                                        title="Jadikan Kunci Jawaban"
                                                                        style={{ cursor: 'pointer' }}
                                                                    />
                                                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: isChecked ? '#059669' : '#64748b' }}>{opt}.</span>
                                                                    <input
                                                                        type="text"
                                                                        value={draft[fieldName] === '-' ? '' : (draft[fieldName] || '')}
                                                                        onChange={(e) => handleUpdateDraft(idx, fieldName, e.target.value)}
                                                                        placeholder={`Opsi ${opt}...`}
                                                                        style={{
                                                                            flex: 1,
                                                                            border: 'none',
                                                                            outline: 'none',
                                                                            background: 'transparent',
                                                                            fontSize: '0.82rem'
                                                                        }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                                                        Kunci Terpilih: {draft.kunciJawaban || '-'}
                                                    </div>
                                                </div>
                                            )}

                                            {draft.tipeSoal === 'BENAR_SALAH' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>Kunci Jawaban:</span>
                                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
                                                        <input
                                                            type="radio"
                                                            name={`bs_${idx}`}
                                                            checked={(draft.kunciJawaban || '').trim().toUpperCase() === 'B' || (draft.kunciJawaban || '').trim().toUpperCase() === 'BENAR'}
                                                            onChange={() => handleUpdateDraft(idx, 'kunciJawaban', 'B')}
                                                        />
                                                        Benar (B)
                                                    </label>
                                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>
                                                        <input
                                                            type="radio"
                                                            name={`bs_${idx}`}
                                                            checked={(draft.kunciJawaban || '').trim().toUpperCase() === 'S' || (draft.kunciJawaban || '').trim().toUpperCase() === 'SALAH'}
                                                            onChange={() => handleUpdateDraft(idx, 'kunciJawaban', 'S')}
                                                        />
                                                        Salah (S)
                                                    </label>
                                                </div>
                                            )}

                                            {draft.tipeSoal === 'BS_MAJEMUK' && (() => {
                                                const keys = (draft.kunciJawaban || 'B,S,B,B').split(',').map(s => s.trim().toUpperCase());
                                                const stmts = [
                                                    { label: 'Pernyataan 1', field: 'pilihanA', keyIdx: 0 },
                                                    { label: 'Pernyataan 2', field: 'pilihanB', keyIdx: 1 },
                                                    { label: 'Pernyataan 3', field: 'pilihanC', keyIdx: 2 },
                                                    { label: 'Pernyataan 4', field: 'pilihanD', keyIdx: 3 },
                                                    { label: 'Pernyataan 5 (Opsional)', field: 'pilihanE', keyIdx: 4 },
                                                ];

                                                const updateBsKey = (keyIndex, val) => {
                                                    const updatedKeys = [...keys];
                                                    while (updatedKeys.length <= keyIndex) updatedKeys.push('B');
                                                    updatedKeys[keyIndex] = val;
                                                    handleUpdateDraft(idx, 'kunciJawaban', updatedKeys.join(','));
                                                };

                                                return (
                                                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px' }}>
                                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>
                                                            TABEL BUTIR PERNYATAAN & KUNCI (BENAR / SALAH):
                                                        </label>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {stmts.map((st) => {
                                                                const curKey = keys[st.keyIdx] || 'B';
                                                                const val = draft[st.field] === '-' ? '' : (draft[st.field] || '');
                                                                return (
                                                                    <div key={st.field} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={val}
                                                                            onChange={(e) => handleUpdateDraft(idx, st.field, e.target.value)}
                                                                            placeholder={`Teks butir ${st.label}...`}
                                                                            style={{
                                                                                flex: 1,
                                                                                padding: '6px 10px',
                                                                                borderRadius: '6px',
                                                                                border: '1px solid #cbd5e1',
                                                                                fontSize: '0.8rem'
                                                                            }}
                                                                        />
                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateBsKey(st.keyIdx, 'B')}
                                                                                style={{
                                                                                    padding: '4px 10px',
                                                                                    borderRadius: '6px',
                                                                                    border: `1px solid ${curKey === 'B' ? '#10b981' : '#cbd5e1'}`,
                                                                                    background: curKey === 'B' ? '#10b981' : '#ffffff',
                                                                                    color: curKey === 'B' ? '#ffffff' : '#64748b',
                                                                                    fontWeight: 700,
                                                                                    fontSize: '0.75rem',
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                Benar
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateBsKey(st.keyIdx, 'S')}
                                                                                style={{
                                                                                    padding: '4px 10px',
                                                                                    borderRadius: '6px',
                                                                                    border: `1px solid ${curKey === 'S' ? '#ef4444' : '#cbd5e1'}`,
                                                                                    background: curKey === 'S' ? '#ef4444' : '#ffffff',
                                                                                    color: curKey === 'S' ? '#ffffff' : '#64748b',
                                                                                    fontWeight: 700,
                                                                                    fontSize: '0.75rem',
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                Salah
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {draft.tipeSoal === 'ESSAY' && (
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                                                        PEDOMAN PENSKORAN / KUNCI JAWABAN ESSAY:
                                                    </label>
                                                    <textarea
                                                        rows={2}
                                                        value={draft.kunciJawaban === '-' ? '' : (draft.kunciJawaban || '')}
                                                        onChange={(e) => handleUpdateDraft(idx, 'kunciJawaban', e.target.value)}
                                                        placeholder="Masukkan pedoman jawaban atau kata kunci..."
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #e2e8f0',
                                                            fontSize: '0.82rem',
                                                            fontFamily: 'inherit',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Review Footer */}
                            <div style={{
                                padding: '16px 28px',
                                borderTop: '1px solid #e2e8f0',
                                background: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '12px'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    Pastikan seluruh nomor & kunci jawaban sudah sesuai sebelum menekan ACC.
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm('Keluar dari draf soal? Perubahan draf yang belum di-ACC akan hilang.')) {
                                                setIsWordImportModalOpen(false);
                                            }
                                        }}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '10px',
                                            border: '1.5px solid #cbd5e1',
                                            background: '#ffffff',
                                            color: '#64748b',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveBatchDraftQuestions}
                                        disabled={isSavingBatch || draftQuestions.length === 0}
                                        style={{
                                            padding: '10px 26px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: isSavingBatch || draftQuestions.length === 0
                                                ? '#94a3b8'
                                                : 'linear-gradient(135deg, #059669, #10b981)',
                                            color: '#ffffff',
                                            fontWeight: 800,
                                            cursor: isSavingBatch ? 'wait' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                        }}
                                    >
                                        {isSavingBatch ? (
                                            <>
                                                <RefreshCw size={18} className="animate-spin" />
                                                Menyimpan Soal ke Database...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={18} />
                                                ACC & Simpan Semua ke Soal Ujian
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>,
            document.body
        );
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
                        <div className="header-stats" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSourceExamId('');
                                    setIsCopyModalOpen(true);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 18px',
                                    borderRadius: '12px',
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    border: '1.5px solid #a7f3d0',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)',
                                    transition: 'all 0.2s'
                                }}
                                title="Salin semua soal dari ujian lain ke ujian ini"
                            >
                                <Copy size={16} />
                                <span>Salin Soal dari Ujian Lain</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenWordImportModal(viewingQuestions)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 18px',
                                    borderRadius: '12px',
                                    background: '#f5f3ff',
                                    color: '#7c3aed',
                                    border: '1.5px solid #ddd6fe',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.1)',
                                    transition: 'all 0.2s'
                                }}
                                title="Import Soal dari File Word (.docx) atau Teks dengan AI"
                            >
                                <Sparkles size={16} />
                                <span>Import Word (AI)</span>
                            </button>
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
                                    {/* Indikator & Penjelasan Format Soal Saat Dibuat/Diedit */}
                                    <div className={`format-guide-banner ${qType === 'essay' ? 'banner-essay' : (questionFormPG.tipeSoal === 'BENAR_SALAH' ? 'banner-tf' : questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? 'banner-kompleks' : 'banner-pg')}`}>
                                        <div className="fgb-icon">
                                            {qType === 'essay' ? '📝' : questionFormPG.tipeSoal === 'BENAR_SALAH' ? '⚖️' : questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? '☑️' : '🔘'}
                                        </div>
                                        <div className="fgb-content">
                                            <div className="fgb-title">
                                                {qType === 'essay' && 'Soal Essay / Uraian (Jawaban Terbuka)'}
                                                {qType === 'pg' && (questionFormPG.tipeSoal === 'BENAR_SALAH' ? 'Soal Pernyataan Benar / Salah (1 Pilihan Tepat)' : questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? 'Soal Pilihan Ganda Kompleks (Bisa 2 atau Lebih Jawaban Benar)' : 'Soal Pilihan Ganda Biasa (1 Jawaban Benar)')}
                                            </div>
                                            <div className="fgb-desc">
                                                {qType === 'essay' && 'Siswa akan menjawab dengan mengetikkan penjelasan/uraian secara mandiri. Penilaian dapat diperiksa manual oleh guru atau otomatis dibantu AI.'}
                                                {qType === 'pg' && (
                                                    questionFormPG.tipeSoal === 'BENAR_SALAH'
                                                        ? 'Siswa diminta menentukan apakah pernyataan bernilai BENAR atau SALAH (pilih satu opsi).'
                                                        : questionFormPG.tipeSoal === 'PG_KOMPLEKS'
                                                            ? 'Soal memiliki lebih dari 1 kunci jawaban benar (misal: A & C, atau 2-3 jawaban). Klik tombol opsi (A-E) untuk menandai kunci-kunci yang benar!'
                                                            : 'Soal hanya memiliki 1 kunci jawaban benar (Single Choice). Siswa hanya dapat memilih 1 opsi jawaban tepat.'
                                                )}
                                            </div>
                                        </div>
                                        <div className="fgb-badge-pill">
                                            {qType === 'essay' ? 'Tipe Essay' : questionFormPG.tipeSoal === 'BENAR_SALAH' ? 'Tipe Benar / Salah' : questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? 'Multi Jawaban Benar' : '1 Jawaban Benar'}
                                        </div>
                                    </div>

                                    <div className="form-group-v2">
                                        <div className="form-label-row">
                                            <label style={{ margin: 0 }}>Isi Pertanyaan</label>
                                            <div className="img-upload-actions">
                                                <button
                                                    type="button"
                                                    className="btn-add-img-soal"
                                                    onClick={() => directImageInputRef.current?.click()}
                                                    title="Pilih gambar dari komputer/HP untuk disisipkan ke soal"
                                                >
                                                    <ImageIcon size={16} />
                                                    <span>Sisipkan / Upload Gambar</span>
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={directImageInputRef}
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={handleDirectImageUpload}
                                                />
                                            </div>
                                        </div>

                                        <div className="editor-container-v2">
                                            <QuillEditor
                                                key={qType === 'essay' ? 'essay-q' : 'pg-q'}
                                                value={qType === 'essay' ? questionForm.pertanyaan : questionFormPG.pertanyaan}
                                                onChange={(content) => qType === 'essay'
                                                    ? setQuestionForm(prev => ({ ...prev, pertanyaan: content }))
                                                    : setQuestionFormPG(prev => ({ ...prev, pertanyaan: content }))}
                                                placeholder="Ketik pertanyaan secara detail di sini... Anda juga bisa menyisipkan gambar dengan tombol di atas atau toolbar editor."
                                                isSimple={false}
                                            />
                                        </div>

                                        {/* Preview Langsung Tampilan Soal dan Gambar Saat Soal Diisikan */}
                                        {((qType === 'essay' ? questionForm.pertanyaan : questionFormPG.pertanyaan) || '').trim() && (
                                            <div className="live-question-preview-container">
                                                <div className="lqp-header">
                                                    <div className="lqp-title">
                                                        <Eye size={15} />
                                                        <span>Preview Tampilan Soal (Yang Dilihat Guru & Siswa):</span>
                                                        {((qType === 'essay' ? questionForm.pertanyaan : questionFormPG.pertanyaan) || '').includes('<img') && (
                                                            <span className="lqp-img-badge">
                                                                <ImageIcon size={13} /> Ada Gambar Terlampir
                                                            </span>
                                                        )}
                                                    </div>
                                                    {((qType === 'essay' ? questionForm.pertanyaan : questionFormPG.pertanyaan) || '').includes('<img') && (
                                                        <button
                                                            type="button"
                                                            className="btn-clear-img-preview"
                                                            onClick={handleRemoveImagesFromCurrent}
                                                            title="Hapus gambar dari pertanyaan"
                                                        >
                                                            <X size={13} /> Hapus Gambar
                                                        </button>
                                                    )}
                                                </div>
                                                <div
                                                    className="lqp-body"
                                                    onClick={(e) => {
                                                        if (e.target.tagName === 'IMG') {
                                                            setEnlargedImage(e.target.src);
                                                        }
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: (qType === 'essay' ? questionForm.pertanyaan : questionFormPG.pertanyaan) || '' }}
                                                />
                                                <div className="lqp-tip">
                                                    *Klik pada gambar untuk memperbesar tampilan (Zoom Lightbox).
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {qType === 'pg' && (
                                        <div className="options-section-v2">
                                            <div style={{ marginBottom: '18px' }}>
                                                <label className="section-label" style={{ display: 'block', marginBottom: '8px' }}>Pilih Format Soal Objektif</label>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        className={`btn-type-toggle ${(questionFormPG.tipeSoal || 'PG_BIASA') === 'PG_BIASA' ? 'active' : ''}`}
                                                        onClick={() => {
                                                            const firstKey = (questionFormPG.kunciJawaban || 'A').split(',')[0].trim() || 'A';
                                                            setQuestionFormPG({ ...questionFormPG, tipeSoal: 'PG_BIASA', kunciJawaban: firstKey });
                                                        }}
                                                    >
                                                        🔘 Pilihan Ganda Biasa (1 Kunci)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn-type-toggle ${questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? 'active' : ''}`}
                                                        onClick={() => setQuestionFormPG({ ...questionFormPG, tipeSoal: 'PG_KOMPLEKS' })}
                                                    >
                                                        ☑️ Pilihan Ganda Kompleks (Banyak Kunci)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn-type-toggle ${questionFormPG.tipeSoal === 'BENAR_SALAH' ? 'active' : ''}`}
                                                        onClick={() => setQuestionFormPG({
                                                            ...questionFormPG,
                                                            tipeSoal: 'BENAR_SALAH',
                                                            pilihanA: 'Benar',
                                                            pilihanB: 'Salah',
                                                            pilihanC: '',
                                                            pilihanD: '',
                                                            pilihanE: '',
                                                            kunciJawaban: questionFormPG.kunciJawaban === 'B' ? 'B' : 'A'
                                                        })}
                                                    >
                                                        ⚖️ Pernyataan Benar / Salah
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn-type-toggle ${questionFormPG.tipeSoal === 'BS_MAJEMUK' ? 'active' : ''}`}
                                                        onClick={() => {
                                                            const existingKj = (questionFormPG.kunciJawaban || '').includes(',') ? questionFormPG.kunciJawaban : 'B,B,S,B';
                                                            setQuestionFormPG({
                                                                ...questionFormPG,
                                                                tipeSoal: 'BS_MAJEMUK',
                                                                pilihanA: questionFormPG.pilihanA && questionFormPG.pilihanA !== 'Benar' ? questionFormPG.pilihanA : '',
                                                                pilihanB: questionFormPG.pilihanB && questionFormPG.pilihanB !== 'Salah' ? questionFormPG.pilihanB : '',
                                                                pilihanC: questionFormPG.pilihanC && questionFormPG.pilihanC !== '-' ? questionFormPG.pilihanC : '',
                                                                pilihanD: questionFormPG.pilihanD && questionFormPG.pilihanD !== '-' ? questionFormPG.pilihanD : '',
                                                                pilihanE: questionFormPG.pilihanE && questionFormPG.pilihanE !== '-' ? questionFormPG.pilihanE : '',
                                                                kunciJawaban: existingKj
                                                            });
                                                        }}
                                                    >
                                                        📊 Tabel Benar / Salah (Poin per Butir)
                                                    </button>
                                                </div>
                                            </div>

                                            {questionFormPG.tipeSoal === 'BENAR_SALAH' ? (
                                                <div className="true-false-selection">
                                                    <label className="section-label" style={{ display: 'block', marginBottom: '10px' }}>Kunci Jawaban Pernyataan Ini:</label>
                                                    <div style={{ display: 'flex', gap: '16px' }}>
                                                        <div
                                                            className={`tf-card tf-true ${questionFormPG.kunciJawaban === 'A' ? 'selected' : ''}`}
                                                            onClick={() => setQuestionFormPG({ ...questionFormPG, kunciJawaban: 'A', pilihanA: 'Benar', pilihanB: 'Salah' })}
                                                        >
                                                            <div className="tf-badge">A</div>
                                                            <div className="tf-label">BENAR</div>
                                                            {questionFormPG.kunciJawaban === 'A' && <CheckCircle2 className="tf-check" size={20} />}
                                                        </div>
                                                        <div
                                                            className={`tf-card tf-false ${questionFormPG.kunciJawaban === 'B' ? 'selected' : ''}`}
                                                            onClick={() => setQuestionFormPG({ ...questionFormPG, kunciJawaban: 'B', pilihanA: 'Benar', pilihanB: 'Salah' })}
                                                        >
                                                            <div className="tf-badge">B</div>
                                                            <div className="tf-label">SALAH</div>
                                                            {questionFormPG.kunciJawaban === 'B' && <CheckCircle2 className="tf-check" size={20} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : questionFormPG.tipeSoal === 'BS_MAJEMUK' ? (
                                                <div className="bs-majemuk-form-container">
                                                    {(() => {
                                                        const slots = ['A', 'B', 'C', 'D', 'E'];
                                                        
                                                        // Determine statementCount (between 2 and 5)
                                                        let statementCount = 4;
                                                        if (questionFormPG.pilihanE && questionFormPG.pilihanE !== '-') {
                                                            statementCount = 5;
                                                        } else if (questionFormPG.pilihanD === '-') {
                                                            statementCount = (questionFormPG.pilihanC === '-') ? 2 : 3;
                                                        } else if (questionFormPG.pilihanC === '-') {
                                                            statementCount = 2;
                                                        } else {
                                                            statementCount = 4;
                                                        }

                                                        const totalStatements = statementCount;
                                                        const totalBobot = Number(questionFormPG.bobotNilai) || 2;
                                                        const ptsPerItem = (totalBobot / totalStatements).toFixed(2).replace(/\.00$/, '');
                                                        
                                                        // Parse clean normalized keys
                                                        const rawKeyArr = (questionFormPG.kunciJawaban || '').split(',').map(k => k.trim().toUpperCase());
                                                        const currentKeys = slots.map((_, i) => {
                                                            const k = rawKeyArr[i];
                                                            return (k === 'S' || k === 'B') ? k : (i === 2 ? 'S' : 'B');
                                                        });

                                                        const setRowKey = (rowIdx, val) => {
                                                            const nextKeys = [...currentKeys];
                                                            nextKeys[rowIdx] = val;
                                                            const finalKj = nextKeys.slice(0, totalStatements).join(',');
                                                            setQuestionFormPG(prev => ({ ...prev, kunciJawaban: finalKj }));
                                                        };

                                                        const setAllKeys = (val) => {
                                                            const nextKeys = Array(totalStatements).fill(val).join(',');
                                                            setQuestionFormPG(prev => ({ ...prev, kunciJawaban: nextKeys }));
                                                        };

                                                        const removeStatement = (idxToRemove) => {
                                                            if (statementCount <= 2) {
                                                                alert('Minimal harus ada 2 butir pernyataan untuk Tabel Benar/Salah.');
                                                                return;
                                                            }
                                                            const activeTexts = slots.slice(0, statementCount).map(o => questionFormPG['pilihan' + o]);
                                                            const activeKeys = currentKeys.slice(0, statementCount);

                                                            activeTexts.splice(idxToRemove, 1);
                                                            activeKeys.splice(idxToRemove, 1);

                                                            const newForm = { ...questionFormPG };
                                                            slots.forEach((o, i) => {
                                                                if (i < activeTexts.length) {
                                                                    newForm['pilihan' + o] = activeTexts[i] === '-' ? '' : activeTexts[i];
                                                                } else {
                                                                    newForm['pilihan' + o] = '-';
                                                                }
                                                            });
                                                            newForm.kunciJawaban = activeKeys.join(',');
                                                            setQuestionFormPG(newForm);
                                                        };

                                                        const addStatement = () => {
                                                            if (statementCount >= 5) return;
                                                            const nextSlot = slots[statementCount];
                                                            const nextKeys = [...currentKeys.slice(0, statementCount), 'B'].join(',');
                                                            setQuestionFormPG(prev => ({
                                                                ...prev,
                                                                ['pilihan' + nextSlot]: '',
                                                                kunciJawaban: nextKeys
                                                            }));
                                                        };

                                                        return (
                                                            <>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                                                    <div>
                                                                        <label className="section-label" style={{ margin: 0 }}>Daftar Butir Pernyataan & Kunci [Benar / Salah]</label>
                                                                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                                                            Siswa menentukan status tiap butir. Sistem menilai secara <strong>proporsional per butir</strong>. (Jumlah saat ini: <strong>{totalStatements} Butir</strong>)
                                                                        </p>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setAllKeys('B')}
                                                                            style={{ padding: '6px 12px', background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                                                            title="Jadikan semua butir berkunci BENAR"
                                                                        >
                                                                            ✓ Set Semua BENAR
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setAllKeys('S')}
                                                                            style={{ padding: '6px 12px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                                                            title="Jadikan semua butir berkunci SALAH"
                                                                        >
                                                                            ✗ Set Semua SALAH
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Rincian Penskoran Proporsional Card */}
                                                                <div className="bs-scoring-detail-card" style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ fontSize: '1.2rem' }}>🎯</span>
                                                                            <div>
                                                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0369a1' }}>
                                                                                    Rincian Penilaian Per Butir: <span style={{ color: '#0284c7' }}>{ptsPerItem} Poin</span> / butir pernyataan yang benar
                                                                                </div>
                                                                                <div style={{ fontSize: '0.8rem', color: '#0284c7', marginTop: '2px' }}>
                                                                                    Total Bobot Soal: <strong>{totalBobot} Poin</strong> &bull; Terdiri dari <strong>{totalStatements} Butir Pernyataan</strong>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                            {Array.from({ length: totalStatements }, (_, i) => {
                                                                                const cocokCount = totalStatements - i;
                                                                                const pts = ((cocokCount / totalStatements) * totalBobot).toFixed(1).replace(/\.0$/, '');
                                                                                return (
                                                                                    <span key={i} style={{ background: cocokCount === totalStatements ? '#dcfce7' : '#e0f2fe', color: cocokCount === totalStatements ? '#15803d' : '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                                                        {cocokCount} Cocok: {pts} Pts
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="bs-majemuk-table-editor">
                                                                    {slots.slice(0, totalStatements).map((opt, idx) => {
                                                                        const rowKey = currentKeys[idx];
                                                                        const canDelete = totalStatements > 2;

                                                                        return (
                                                                            <div key={opt} className="bs-statement-card">
                                                                                <div className="bs-stmt-card-header">
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                                        <div className="bs-stmt-num">{idx + 1}</div>
                                                                                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                                                                                            Butir Pernyataan #{idx + 1}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        <div className="bs-stmt-point-badge" title="Nilai didapatkan siswa jika menjawab butir ini dengan tepat">
                                                                                            +{ptsPerItem} Poin
                                                                                        </div>
                                                                                        {canDelete && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => removeStatement(idx)}
                                                                                                style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700 }}
                                                                                                title={`Hapus Pernyataan #${idx + 1}`}
                                                                                            >
                                                                                                <Trash2 size={14} /> Hapus
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="bs-stmt-input-wrap" style={{ marginTop: '12px' }}>
                                                                                    <textarea
                                                                                        className="bs-stmt-textarea"
                                                                                        rows="2"
                                                                                        placeholder={`Ketik teks butir pernyataan ke-${idx + 1} secara lengkap di sini...`}
                                                                                        value={questionFormPG[`pilihan${opt}`] === '-' ? '' : (questionFormPG[`pilihan${opt}`] || '')}
                                                                                        onChange={(e) => setQuestionFormPG({ ...questionFormPG, [`pilihan${opt}`]: e.target.value })}
                                                                                        required={idx < 2}
                                                                                    />
                                                                                </div>

                                                                                <div className="bs-stmt-card-footer">
                                                                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
                                                                                        Kunci Jawaban Guru:
                                                                                    </span>
                                                                                    <div className="bs-stmt-key-toggle">
                                                                                        <button
                                                                                            type="button"
                                                                                            className={`btn-bs-toggle btn-toggle-b ${rowKey === 'B' ? 'active-b' : ''}`}
                                                                                            onClick={() => setRowKey(idx, 'B')}
                                                                                        >
                                                                                            <CheckCircle2 size={15} /> <span>BENAR (B)</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            className={`btn-bs-toggle btn-toggle-s ${rowKey === 'S' ? 'active-s' : ''}`}
                                                                                            onClick={() => setRowKey(idx, 'S')}
                                                                                        >
                                                                                            <X size={15} /> <span>SALAH (S)</span>
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}

                                                                    {totalStatements < 5 && (
                                                                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={addStatement}
                                                                                style={{ background: '#eff6ff', border: '1.5px dashed #3b82f6', color: '#1d4ed8', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                                                            >
                                                                                <Plus size={16} /> + Tambah Pernyataan Ke-{totalStatements + 1} (Maks 5 Butir)
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <label className="section-label" style={{ margin: 0 }}>Opsi Jawaban & Kunci</label>
                                                            <span className="opt-paste-badge">💡 Bisa langsung tekan Ctrl+V (Paste screenshot) pada tiap opsi</span>
                                                        </div>
                                                        {questionFormPG.tipeSoal === 'PG_KOMPLEKS' && (
                                                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>
                                                                *Klik tombol opsi (A-E) untuk memilih satu atau lebih kunci jawaban benar
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Visual Indicator of Selected Keys */}
                                                    <div style={{ padding: '10px 14px', background: '#eef2ff', borderRadius: '8px', border: '1.5px solid #c7d2fe', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '0.85rem', color: '#312e81', fontWeight: 800 }}>Kunci Jawaban Terpilih:</span>
                                                            {((questionFormPG.kunciJawaban || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)).map(k => (
                                                                <span key={k} style={{ background: '#4338ca', color: '#fff', padding: '3px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '0.85rem' }}>
                                                                    ✓ Opsi {k}
                                                                </span>
                                                            ))}
                                                            {!(questionFormPG.kunciJawaban || '').trim() && (
                                                                <span style={{ color: '#ef4444', fontSize: '0.8rem', fontStyle: 'italic' }}>Belum ada kunci dipilih</span>
                                                            )}
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', background: questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? '#e0e7ff' : '#f1f5f9', color: questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? '#4338ca' : '#475569' }}>
                                                            {questionFormPG.tipeSoal === 'PG_KOMPLEKS' ? '☑️ Mode PG Kompleks (Banyak Kunci)' : '🔘 Mode PG Biasa (1 Kunci Jawaban)'}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                            const selectedKeys = (questionFormPG.kunciJawaban || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                                            const isSelected = selectedKeys.includes(opt);
                                                            const optRaw = questionFormPG[`pilihan${opt}`] || '';
                                                            const optImgSrc = extractImgSrc(optRaw);
                                                            const optTextOnly = optRaw.replace(/<p><img[^>]*><\/p>|<img[^>]*>/gi, '').trim();

                                                            return (
                                                                <div
                                                                    key={opt}
                                                                    className={`opt-row-container ${isSelected ? 'is-selected-row' : ''}`}
                                                                    onPaste={(e) => handleOptPaste(opt, e)}
                                                                    onDragOver={(e) => e.preventDefault()}
                                                                    onDrop={(e) => handleOptDrop(opt, e)}
                                                                >
                                                                    <div className={`opt-input-v2 ${isSelected ? 'selected' : ''}`}>
                                                                        <button
                                                                            type="button"
                                                                            className={`opt-check ${isSelected ? 'is-key-selected' : ''}`}
                                                                            onClick={() => {
                                                                                if (questionFormPG.tipeSoal === 'PG_KOMPLEKS') {
                                                                                    let newKeys;
                                                                                    if (selectedKeys.includes(opt)) {
                                                                                        newKeys = selectedKeys.filter(k => k !== opt);
                                                                                    } else {
                                                                                        newKeys = [...selectedKeys, opt].sort();
                                                                                    }
                                                                                    setQuestionFormPG({
                                                                                        ...questionFormPG,
                                                                                        kunciJawaban: newKeys.join(',') || opt
                                                                                    });
                                                                                } else {
                                                                                    // Mode PG Biasa (1 Kunci): langsung jadikan satu-satunya kunci tanpa berubah jadi PG Kompleks
                                                                                    setQuestionFormPG({
                                                                                        ...questionFormPG,
                                                                                        kunciJawaban: opt,
                                                                                        tipeSoal: 'PG_BIASA'
                                                                                    });
                                                                                }
                                                                            }}
                                                                            style={isSelected ? { background: '#4338ca', color: '#fff', borderColor: '#3730a3' } : {}}
                                                                            title={isSelected ? 'Kunci terpilih (klik untuk batalkan)' : 'Klik untuk jadikan sebagai kunci jawaban'}
                                                                        >
                                                                            {isSelected ? `✓ ${opt}` : opt}
                                                                        </button>
                                                                        <input
                                                                            type="text"
                                                                            value={optTextOnly}
                                                                            onChange={(e) => {
                                                                                const newText = e.target.value;
                                                                                const combined = optImgSrc
                                                                                    ? (newText ? `${newText} <p><img src="${optImgSrc}" alt="Opsi ${opt}" style="max-height:160px; max-width:100%; border-radius:8px; display:block; margin:6px 0; box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></p>` : `<p><img src="${optImgSrc}" alt="Opsi ${opt}" style="max-height:160px; max-width:100%; border-radius:8px; display:block; margin:6px 0; box-shadow:0 2px 8px rgba(0,0,0,0.08);" /></p>`)
                                                                                    : newText;
                                                                                setQuestionFormPG({ ...questionFormPG, [`pilihan${opt}`]: combined });
                                                                            }}
                                                                            placeholder={`Pilihan ${opt}... (Ketik teks / Tekan Ctrl+V untuk Paste Screenshot Gambar)`}
                                                                            onPaste={(e) => handleOptPaste(opt, e)}
                                                                            required={opt !== 'E' && !optImgSrc}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            className={`btn-opt-img-attach ${optImgSrc ? 'has-img' : ''}`}
                                                                            onClick={() => optFileInputRefs.current[opt]?.click()}
                                                                            title={`Sisipkan / Upload Gambar ke Opsi ${opt}`}
                                                                        >
                                                                            <ImageIcon size={15} />
                                                                            <span>{uploadingOpt === opt ? 'Mengunggah...' : optImgSrc ? 'Ganti Gbr' : 'Sisipkan Gbr'}</span>
                                                                        </button>
                                                                        <input
                                                                            type="file"
                                                                            ref={el => optFileInputRefs.current[opt] = el}
                                                                            accept="image/*"
                                                                            style={{ display: 'none' }}
                                                                            onChange={(e) => handleOptImageUpload(opt, e)}
                                                                        />
                                                                    </div>
                                                                    {optImgSrc && (
                                                                        <div className="opt-preview-container">
                                                                            <div className="opt-thumb-wrapper" onClick={() => setEnlargedImage(optImgSrc)} title="Klik untuk memperbesar gambar opsi">
                                                                                <img src={optImgSrc} alt={`Preview Opsi ${opt}`} className="opt-preview-thumb" />
                                                                                <span className="opt-zoom-hint"><ZoomIn size={12} /> Perbesar Gambar</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                className="btn-opt-img-remove"
                                                                                onClick={() => handleRemoveOptImage(opt)}
                                                                                title="Hapus gambar dari opsi ini"
                                                                            >
                                                                                <X size={13} /> Hapus Gambar
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}


                                    {qType === 'essay' && (
                                        <div className="form-group-v2">
                                            <label>Pedoman Penskoran / Kunci Jawaban <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.85em' }}>(Opsional — jika dikosongkan, AI akan menilai secara kontekstual)</span></label>
                                            <div className="editor-container-v2">
                                                <QuillEditor
                                                    key="essay-kunci"
                                                    value={questionForm.kunciJawaban}
                                                    onChange={(content) => setQuestionForm(prev => ({ ...prev, kunciJawaban: content }))}
                                                    placeholder="Opsional: Tuliskan poin-poin penilaian atau kunci jawaban. Jika kosong, AI akan menilai berdasarkan relevansi dan kualitas jawaban siswa."
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
                                        <button type="submit" className="btn-save-v2" disabled={savingQuestion}>
                                            {savingQuestion ? <RefreshCw size={20} className="animate-spin" /> : (editingQuestion ? <Save size={20} /> : <Plus size={20} />)}
                                            <span>{savingQuestion ? 'Menyimpan...' : (editingQuestion ? 'Perbarui Soal' : 'Simpan Soal')}</span>
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
                                <div className="filter-badges" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="badge-v2">PG: {questionsPG.length}</div>
                                    <div className="badge-v2">Essay: {questions.length}</div>
                                    {(questionsPG.length > 0 || questions.length > 0) && (
                                        <button 
                                            type="button" 
                                            onClick={handleDeleteAllQuestions}
                                            disabled={isDeletingAll}
                                            className="q-btn-delete"
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', cursor: isDeletingAll ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                                            title="Hapus Semua Soal"
                                        >
                                            <Trash2 size={14} />
                                            {isDeletingAll ? 'Membersihkan...' : 'Bersihkan Soal'}
                                        </button>
                                    )}
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
                                        {questionsPG.map((q, idx) => {
                                            const meta = getQuestionMeta(q);
                                            const correctKeys = (q.kunciJawaban || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

                                            return (
                                                <div key={`pg-${q.id}`} className={`q-card-v2 ${meta.cardClass} ${editingQuestion?.id === q.id ? 'is-editing' : ''}`}>
                                                    {/* Header Soal */}
                                                    <div className="q-card-header">
                                                        <div className="q-meta">
                                                            <span className="q-number-pill">Soal #{idx + 1}</span>
                                                            <span className={`q-badge-type ${meta.badgeClass}`}>
                                                                {meta.typeLabel}
                                                            </span>
                                                            <span className="q-sub-label">{meta.subLabel}</span>
                                                            {(q.pertanyaan || '').includes('<img') && (
                                                                <span className="q-img-present-chip" title="Soal ini menyertakan gambar">
                                                                    <ImageIcon size={12} /> Gambar
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="q-header-right">
                                                            <span className="q-bobot-chip">
                                                                <Clock size={13} /> {q.bobotNilai || 2} Poin
                                                            </span>
                                                            <div className="q-actions-v2">
                                                                <button type="button" className="q-btn-edit" onClick={() => handleEditSoal(q, 'pg')} title="Edit Soal">
                                                                    <Edit3 size={15} />
                                                                    <span>Edit</span>
                                                                </button>
                                                                <button type="button" className="q-btn-delete" onClick={() => handleDeleteSoal(q.id, 'pg')} title="Hapus Soal">
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Isi Pertanyaan */}
                                                    <div className="q-card-body">
                                                        <div
                                                            className="q-text-v2"
                                                            onClick={(e) => {
                                                                if (e.target.tagName === 'IMG') {
                                                                    setEnlargedImage(e.target.src);
                                                                }
                                                            }}
                                                            dangerouslySetInnerHTML={{ __html: q.pertanyaan }}
                                                        ></div>

                                                        {meta.typeKey === 'bs_majemuk' ? (
                                                            <div className="bs-majemuk-preview-table-wrap">
                                                                <table className="bs-majemuk-preview-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                                                                            <th>Butir Pernyataan</th>
                                                                            <th style={{ width: '130px', textAlign: 'center' }}>Kunci Guru</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {['A', 'B', 'C', 'D', 'E'].map((opt, idx) => {
                                                                            const stmtVal = q[`pilihan${opt}`];
                                                                            if (!stmtVal || stmtVal === '-') return null;
                                                                            const keyList = (q.kunciJawaban || '').split(',').map(k => k.trim().toUpperCase());
                                                                            const keyVal = keyList[idx] || 'B';
                                                                            return (
                                                                                <tr key={opt}>
                                                                                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{idx + 1}</td>
                                                                                    <td dangerouslySetInnerHTML={{ __html: stmtVal }}></td>
                                                                                    <td style={{ textAlign: 'center' }}>
                                                                                        <span className={`badge-bs-key ${keyVal.startsWith('B') ? 'is-b' : 'is-s'}`}>
                                                                                            {keyVal.startsWith('B') ? '✓ BENAR (B)' : '✗ SALAH (S)'}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : meta.typeKey === 'tf' ? (
                                                            <div className="tf-preview-row">
                                                                <div className={`tf-preview-box ${q.kunciJawaban === 'A' ? 'is-key' : ''}`}>
                                                                    <div className="tf-p-badge">A</div>
                                                                    <div className="tf-p-label">
                                                                        <strong>BENAR</strong>
                                                                        <span>Pernyataan ini sesuai</span>
                                                                    </div>
                                                                    {q.kunciJawaban === 'A' && (
                                                                        <div className="tf-p-check">
                                                                            <CheckCircle2 size={15} /> Kunci Benar
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={`tf-preview-box ${q.kunciJawaban === 'B' ? 'is-key' : ''}`}>
                                                                    <div className="tf-p-badge">B</div>
                                                                    <div className="tf-p-label">
                                                                        <strong>SALAH</strong>
                                                                        <span>Pernyataan ini salah</span>
                                                                    </div>
                                                                    {q.kunciJawaban === 'B' && (
                                                                        <div className="tf-p-check">
                                                                            <CheckCircle2 size={15} /> Kunci Benar
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Preview Ramah untuk Pilihan Ganda & Kompleks */
                                                            <div className="q-options-v2">
                                                                {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                                    const optVal = q[`pilihan${opt}`];
                                                                    if (!optVal || optVal === '-') return null;
                                                                    const isCorrect = correctKeys.includes(opt);

                                                                    return (
                                                                        <div key={opt} className={`opt-item-v2 ${isCorrect ? 'is-correct' : ''}`}>
                                                                            <div className="opt-marker">{opt}</div>
                                                                            <div
                                                                                className="opt-text"
                                                                                dangerouslySetInnerHTML={{ __html: optVal }}
                                                                                onClick={(e) => {
                                                                                    if (e.target.tagName === 'IMG') {
                                                                                        setEnlargedImage(e.target.src);
                                                                                    }
                                                                                }}
                                                                            />
                                                                            {isCorrect && (
                                                                                <div className="opt-key-pill">
                                                                                    <CheckCircle2 size={13} /> Kunci Benar
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Footer Soal */}
                                                    <div className="q-card-footer">
                                                        <div className="q-footer-info">
                                                            <span className="q-key-info">
                                                                <strong>Kunci Jawaban:</strong> <span className="kunci-highlight">{meta.kunciDesc}</span>
                                                            </span>
                                                            {meta.typeKey === 'complex' && (
                                                                <span className="q-multi-note">*Pilihan Jamak (${correctKeys.length} opsi benar)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Essay Questions */}
                                        {questions.map((q, idx) => (
                                            <div key={`essay-${q.id}`} className={`q-card-v2 essay-type ${editingQuestion?.id === q.id ? 'is-editing' : ''}`}>
                                                <div className="q-card-header">
                                                    <div className="q-meta">
                                                        <span className="q-number-pill">Soal #{questionsPG.length + idx + 1}</span>
                                                        <span className="q-badge-type essay">📝 Soal Essay / Uraian</span>
                                                        <span className="q-sub-label">Jawaban Teks Bebas</span>
                                                    </div>
                                                    <div className="q-header-right">
                                                        <span className="q-bobot-chip essay">
                                                            <Clock size={13} /> {q.bobotNilai || 10} Poin
                                                        </span>
                                                        <div className="q-actions-v2">
                                                            <button
                                                                type="button"
                                                                className="q-btn-kartu"
                                                                onClick={() => openKartuSoalEdit(q, idx)}
                                                                title="Edit via Kartu Soal (Word)"
                                                            >
                                                                <FileText size={15} />
                                                                <span>Word</span>
                                                            </button>
                                                            <button type="button" className="q-btn-edit" onClick={() => handleEditSoal(q, 'essay')} title="Edit Soal">
                                                                <Edit3 size={15} />
                                                                <span>Edit</span>
                                                            </button>
                                                            <button type="button" className="q-btn-delete" onClick={() => handleDeleteSoal(q.id, 'essay')} title="Hapus Soal">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="q-card-body">
                                                    <div
                                                        className="q-text-v2"
                                                        onClick={(e) => {
                                                            if (e.target.tagName === 'IMG') {
                                                                setEnlargedImage(e.target.src);
                                                            }
                                                        }}
                                                        dangerouslySetInnerHTML={{ __html: q.pertanyaan }}
                                                    ></div>
                                                    <div className="essay-rubric-v2">
                                                        <div className="rubric-header">
                                                            <Info size={14} /> Pedoman Penskoran / Kunci Jawaban
                                                        </div>
                                                        <div className="rubric-content" dangerouslySetInnerHTML={{ __html: q.kunciJawaban }}></div>
                                                    </div>
                                                </div>
                                                <div className="q-card-footer">
                                                    <div className="q-footer-info">
                                                        <span className="q-key-info">
                                                            <strong>Format:</strong> Penilaian Manual Guru / Koreksi AI
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    {enlargedImage && (
                <div className="img-lightbox-backdrop" onClick={() => setEnlargedImage(null)}>
                    <div className="img-lightbox-wrapper" onClick={(e) => e.stopPropagation()}>
                        <div className="img-lightbox-header">
                            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Pratinjau Penuh Gambar Soal</span>
                            <button type="button" className="img-lightbox-close" onClick={() => setEnlargedImage(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="img-lightbox-content">
                            <img src={enlargedImage} alt="Perbesar Gambar Soal" />
                        </div>
                    </div>
                </div>
            )}
</div>

                    <style>{`
                    .exam-management { max-width: 1400px; margin: 0 auto; } 
                    /* Format Guide Banner Saat Buat Soal */
                    .format-guide-banner {
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 14px 18px;
                        border-radius: 14px;
                        margin-bottom: 20px;
                        border: 1.5px solid transparent;
                        animation: fadeIn 0.3s ease;
                    }
                    .format-guide-banner.banner-pg {
                        background: #eff6ff;
                        border-color: #bfdbfe;
                        color: #1e40af;
                    }
                    .format-guide-banner.banner-kompleks {
                        background: #f5f3ff;
                        border-color: #ddd6fe;
                        color: #5b21b6;
                    }
                    .format-guide-banner.banner-tf {
                        background: #fffbeb;
                        border-color: #fde68a;
                        color: #92400e;
                    }
                    .format-guide-banner.banner-essay {
                        background: #f0fdf4;
                        border-color: #bbf7d0;
                        color: #166534;
                    }
                    .fgb-icon {
                        font-size: 1.5rem;
                        line-height: 1;
                    }
                    .fgb-content {
                        flex: 1;
                    }
                    .fgb-title {
                        font-weight: 800;
                        font-size: 0.95rem;
                        margin-bottom: 3px;
                    }
                    .fgb-desc {
                        font-size: 0.82rem;
                        line-height: 1.4;
                        opacity: 0.9;
                        margin: 0;
                    }
                    .fgb-badge-pill {
                        padding: 5px 12px;
                        border-radius: 9999px;
                        font-size: 0.75rem;
                        font-weight: 800;
                        background: rgba(255, 255, 255, 0.8);
                        white-space: nowrap;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    }
                    /* Dark Mode overrides for format guide */
                    body.dark-theme .format-guide-banner.banner-pg,
                    .dark .format-guide-banner.banner-pg {
                        background: rgba(30, 58, 138, 0.3);
                        border-color: #1d4ed8;
                        color: #93c5fd;
                    }
                    body.dark-theme .format-guide-banner.banner-kompleks,
                    .dark .format-guide-banner.banner-kompleks {
                        background: rgba(88, 28, 135, 0.3);
                        border-color: #7c3aed;
                        color: #c4b5fd;
                    }
                    body.dark-theme .format-guide-banner.banner-tf,
                    .dark .format-guide-banner.banner-tf {
                        background: rgba(120, 53, 15, 0.3);
                        border-color: #d97706;
                        color: #fde68a;
                    }
                    body.dark-theme .format-guide-banner.banner-essay,
                    .dark .format-guide-banner.banner-essay {
                        background: rgba(20, 83, 45, 0.3);
                        border-color: #16a34a;
                        color: #86efac;
                    }
                    body.dark-theme .fgb-badge-pill,
                    .dark .fgb-badge-pill {
                        background: rgba(15, 23, 42, 0.8);
                        color: inherit;
                    }
                    .q-badge-pg.badge-kompleks {
                        background: #f5f3ff;
                        color: #6d28d9;
                        border: 1px solid #ddd6fe;
                    }
                    .q-badge-pg.badge-tf {
                        background: #fffbeb;
                        color: #b45309;
                        border: 1px solid #fde68a;
                    }
                    .q-badge-pg.badge-single {
                        background: #eff6ff;
                        color: #1d4ed8;
                        border: 1px solid #bfdbfe;
                    }
                    body.dark-theme .q-badge-pg.badge-kompleks,
                    .dark .q-badge-pg.badge-kompleks {
                        background: rgba(109, 40, 217, 0.2);
                        color: #c4b5fd;
                        border-color: #7c3aed;
                    }
                    body.dark-theme .q-badge-pg.badge-tf,
                    .dark .q-badge-pg.badge-tf {
                        background: rgba(180, 83, 9, 0.2);
                        color: #fde68a;
                        border-color: #d97706;
                    }
                    body.dark-theme .q-badge-pg.badge-single,
                    .dark .q-badge-pg.badge-single {
                        background: rgba(29, 78, 216, 0.2);
                        color: #93c5fd;
                        border-color: #2563eb;
                    }
                    
                    /* Tipe Soal Sub-Toggle & True-False UI */
                    .btn-type-toggle { padding: 8px 14px; border-radius: 12px; font-size: 0.85rem; font-weight: 700; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #64748b; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
                    .btn-type-toggle:hover { background: #f1f5f9; color: #1e293b; }
                    .btn-type-toggle.active { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15); }
                    .true-false-selection { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 16px; margin-bottom: 20px; }
                    .tf-card { flex: 1; display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-radius: 14px; border: 2px solid #e2e8f0; background: white; cursor: pointer; transition: all 0.2s; user-select: none; }
                    .tf-card:hover { border-color: #94a3b8; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
                    .tf-card.selected.tf-true { border-color: #10b981; background: #ecfdf5; color: #065f46; }
                    .tf-card.selected.tf-false { border-color: #ef4444; background: #fef2f2; color: #991b1b; }
                    .tf-badge { width: 36px; height: 36px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1rem; color: #475569; }
                    .tf-card.selected.tf-true .tf-badge { background: #10b981; color: white; }
                    .tf-card.selected.tf-false .tf-badge { background: #ef4444; color: white; }
                    .tf-label { font-weight: 800; font-size: 1.1rem; flex: 1; }
                    .tf-check { color: #10b981; }
                    .tf-card.selected.tf-false .tf-check { color: #ef4444; }


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
                    .questions-layout-v2 { display: grid; grid-template-columns: minmax(620px, 680px) 1fr!important; gap: 36px; align-items: start; }
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
                    
                    .editor-container-v2 { border: 2px solid #cbd5e1; border-radius: 14px; overflow: hidden; transition: all 0.25s ease; background: #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
                    .editor-container-v2:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
                    .editor-container-v2 .ql-toolbar { border: none !important; border-bottom: 1.5px solid #e2e8f0 !important; background: #f8fafc; padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
                    .editor-container-v2 .ql-container { border: none !important; font-size: 1.05rem; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; min-height: 220px; }
                    .editor-container-v2 .ql-editor { min-height: 220px; padding: 18px 20px; line-height: 1.65; color: #0f172a; font-weight: 500; font-size: 1.05rem; }
                    .editor-container-v2 .ql-editor.ql-blank::before { color: #94a3b8; font-style: normal; font-weight: 500; left: 20px; right: 20px; }

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

                    
                    .q-text-v2 img {
                        max-width: 100%;
                        height: auto;
                        border-radius: 10px;
                        display: block;
                        margin: 12px 0;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                    }
                    .q-text-v2 { font-size: 1.15rem; color: #0f172a; line-height: 1.6; font-weight: 700; margin-bottom: 24px; unicode-bidi: plaintext; }

                    
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

                    
                    /* Ramah Visual: Kartu Daftar Soal Tersimpan */
                    .q-card-v2 {
                        background: #ffffff;
                        border-radius: 20px;
                        border: 1.5px solid #e2e8f0;
                        padding: 22px;
                        transition: all 0.25s ease;
                        position: relative;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
                    }
                    .q-card-v2:hover {
                        box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.08);
                        transform: translateY(-2px);
                    }
                    .q-card-v2.pg-single {
                        border-left: 6px solid #3b82f6;
                    }
                    .q-card-v2.pg-kompleks {
                        border-left: 6px solid #8b5cf6;
                    }
                    .q-card-v2.pg-tf {
                        border-left: 6px solid #f59e0b;
                    }
                    .q-card-v2.essay-type {
                        border-left: 6px solid #10b981;
                    }
                    .q-card-v2.is-editing {
                        border-color: #3b82f6;
                        background: #eff6ff;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                    }

                    .q-card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .q-meta {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    .q-number-pill {
                        font-size: 0.8rem;
                        font-weight: 900;
                        background: #f1f5f9;
                        color: #475569;
                        padding: 5px 12px;
                        border-radius: 10px;
                        letter-spacing: 0.3px;
                    }
                    .q-badge-type {
                        font-size: 0.82rem;
                        font-weight: 800;
                        padding: 5px 12px;
                        border-radius: 10px;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .q-badge-type.badge-tf {
                        background: #fffbeb;
                        color: #b45309;
                        border: 1px solid #fde68a;
                    }
                    .q-badge-type.badge-kompleks {
                        background: #f5f3ff;
                        color: #6d28d9;
                        border: 1px solid #ddd6fe;
                    }
                    .q-badge-type.badge-single {
                        background: #eff6ff;
                        color: #1d4ed8;
                        border: 1px solid #bfdbfe;
                    }
                    .q-badge-type.essay {
                        background: #f0fdf4;
                        color: #15803d;
                        border: 1px solid #bbf7d0;
                    }
                    .q-sub-label {
                        font-size: 0.76rem;
                        color: #94a3b8;
                        font-weight: 600;
                    }
                    .q-header-right {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .q-bobot-chip {
                        font-size: 0.82rem;
                        font-weight: 800;
                        color: #1e293b;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 5px 12px;
                        border-radius: 10px;
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .q-bobot-chip.essay {
                        background: #f0fdf4;
                        color: #15803d;
                        border-color: #bbf7d0;
                    }
                    .q-actions-v2 {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .q-btn-edit {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        padding: 6px 12px;
                        border-radius: 10px;
                        font-size: 0.82rem;
                        font-weight: 700;
                        background: #eff6ff;
                        color: #2563eb;
                        border: 1px solid #bfdbfe;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .q-btn-edit:hover {
                        background: #2563eb;
                        color: #ffffff;
                        border-color: #2563eb;
                    }
                    .q-btn-delete {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 32px;
                        height: 32px;
                        border-radius: 10px;
                        background: #fff1f2;
                        color: #e11d48;
                        border: 1px solid #fecdd3;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .q-btn-delete:hover {
                        background: #e11d48;
                        color: #ffffff;
                        border-color: #e11d48;
                    }
                    .q-btn-kartu {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        padding: 6px 12px;
                        border-radius: 10px;
                        font-size: 0.82rem;
                        font-weight: 700;
                        background: #fef3c7;
                        color: #b45309;
                        border: 1px solid #fde68a;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .q-btn-kartu:hover {
                        background: #f59e0b;
                        color: #ffffff;
                        border-color: #f59e0b;
                    }

                    /* Benar / Salah Preview */
                    .tf-preview-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        margin-top: 10px;
                        margin-bottom: 12px;
                    }
                    .tf-preview-box {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px 16px;
                        border-radius: 14px;
                        background: #f8fafc;
                        border: 1.5px solid #e2e8f0;
                        transition: all 0.2s;
                    }
                    .tf-preview-box.is-key {
                        background: #f0fdf4;
                        border-color: #22c55e;
                        box-shadow: 0 2px 8px rgba(34, 197, 94, 0.12);
                    }
                    .tf-p-badge {
                        width: 32px;
                        height: 32px;
                        min-width: 32px;
                        border-radius: 8px;
                        background: #ffffff;
                        border: 2px solid #cbd5e1;
                        font-weight: 900;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.9rem;
                        color: #475569;
                    }
                    .tf-preview-box.is-key .tf-p-badge {
                        background: #22c55e;
                        border-color: #22c55e;
                        color: #ffffff;
                    }
                    .tf-p-label strong {
                        display: block;
                        font-size: 0.92rem;
                        color: #1e293b;
                    }
                    .tf-p-label span {
                        font-size: 0.76rem;
                        color: #64748b;
                    }
                    .tf-p-check {
                        margin-left: auto;
                        font-size: 0.78rem;
                        font-weight: 800;
                        color: #15803d;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        background: #dcfce7;
                        padding: 4px 10px;
                        border-radius: 8px;
                        flex-shrink: 0;
                    }

                    /* Option Cards */
                    .opt-key-pill {
                        margin-left: auto;
                        font-size: 0.74rem;
                        font-weight: 800;
                        color: #15803d;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        background: #dcfce7;
                        padding: 3px 8px;
                        border-radius: 6px;
                        flex-shrink: 0;
                    }
                    .q-card-footer {
                        border-top: 1px dashed #e2e8f0;
                        margin-top: 16px;
                        padding-top: 12px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 0.85rem;
                    }
                    .q-footer-info {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex-wrap: wrap;
                    }
                    .q-key-info {
                        color: #475569;
                    }
                    .kunci-highlight {
                        background: #dbeafe;
                        color: #1d4ed8;
                        padding: 2px 10px;
                        border-radius: 6px;
                        font-weight: 900;
                        margin-left: 4px;
                    }
                    .q-multi-note {
                        font-size: 0.78rem;
                        color: #6d28d9;
                        font-weight: 700;
                    }

                    /* Dark Mode Overrides for Friendly Cards */
                    body.dark-theme .q-card-v2,
                    .dark .q-card-v2 {
                        background: #1e293b;
                        border-color: #334155;
                    }
                    body.dark-theme .q-card-v2.is-editing,
                    .dark .q-card-v2.is-editing {
                        background: rgba(30, 58, 138, 0.25);
                        border-color: #3b82f6;
                    }
                    body.dark-theme .q-number-pill,
                    .dark .q-number-pill {
                        background: #0f172a;
                        color: #cbd5e1;
                    }
                    body.dark-theme .q-badge-type.badge-tf,
                    .dark .q-badge-type.badge-tf {
                        background: rgba(180, 83, 9, 0.2);
                        color: #fde68a;
                        border-color: #d97706;
                    }
                    body.dark-theme .q-badge-type.badge-kompleks,
                    .dark .q-badge-type.badge-kompleks {
                        background: rgba(109, 40, 217, 0.2);
                        color: #c4b5fd;
                        border-color: #7c3aed;
                    }
                    body.dark-theme .q-badge-type.badge-single,
                    .dark .q-badge-type.badge-single {
                        background: rgba(29, 78, 216, 0.2);
                        color: #93c5fd;
                        border-color: #2563eb;
                    }
                    body.dark-theme .q-badge-type.essay,
                    .dark .q-badge-type.essay {
                        background: rgba(21, 128, 61, 0.2);
                        color: #86efac;
                        border-color: #16a34a;
                    }
                    body.dark-theme .q-bobot-chip,
                    .dark .q-bobot-chip {
                        background: #0f172a;
                        color: #cbd5e1;
                        border-color: #334155;
                    }
                    body.dark-theme .tf-preview-box,
                    .dark .tf-preview-box {
                        background: #0f172a;
                        border-color: #334155;
                    }
                    body.dark-theme .tf-preview-box.is-key,
                    .dark .tf-preview-box.is-key {
                        background: rgba(34, 197, 94, 0.15);
                        border-color: #22c55e;
                    }
                    body.dark-theme .tf-p-badge,
                    .dark .tf-p-badge {
                        background: #1e293b;
                        color: #cbd5e1;
                        border-color: #475569;
                    }
                    body.dark-theme .tf-p-label strong,
                    .dark .tf-p-label strong {
                        color: #f1f5f9;
                    }
                    body.dark-theme .tf-p-label span,
                    .dark .tf-p-label span {
                        color: #94a3b8;
                    }
                    body.dark-theme .tf-p-check,
                    .dark .tf-p-check {
                        background: rgba(34, 197, 94, 0.2);
                        color: #86efac;
                    }
                    body.dark-theme .opt-key-pill,
                    .dark .opt-key-pill {
                        background: rgba(34, 197, 94, 0.2);
                        color: #86efac;
                    }
                    body.dark-theme .q-card-footer,
                    .dark .q-card-footer {
                        border-color: #334155;
                    }
                    body.dark-theme .kunci-highlight,
                    .dark .kunci-highlight {
                        background: rgba(30, 58, 138, 0.4);
                        color: #93c5fd;
                    }

                    
                    /* Image Upload & Live Preview Styles */
                    .form-label-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    .btn-add-img-soal {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 14px;
                        border-radius: 10px;
                        background: #ecfdf5;
                        color: #059669;
                        border: 1.5px solid #a7f3d0;
                        font-size: 0.8rem;
                        font-weight: 800;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-add-img-soal:hover {
                        background: #059669;
                        color: #ffffff;
                        border-color: #059669;
                    }
                    .live-question-preview-container {
                        margin-top: 14px;
                        border: 1.5px solid #cbd5e1;
                        border-radius: 14px;
                        background: #f8fafc;
                        overflow: hidden;
                        animation: fadeIn 0.25s ease;
                    }
                    .lqp-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 14px;
                        background: #f1f5f9;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 0.8rem;
                        font-weight: 800;
                        color: #334155;
                    }
                    .lqp-title {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex-wrap: wrap;
                    }
                    .lqp-img-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 2px 8px;
                        background: #dbeafe;
                        color: #1e40af;
                        border-radius: 6px;
                        font-size: 0.72rem;
                        font-weight: 800;
                    }
                    .btn-clear-img-preview {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        background: #fee2e2;
                        color: #b91c1c;
                        border: 1px solid #fca5a5;
                        border-radius: 6px;
                        padding: 3px 8px;
                        font-size: 0.74rem;
                        font-weight: 700;
                        cursor: pointer;
                    }
                    .btn-clear-img-preview:hover {
                        background: #b91c1c;
                        color: #ffffff;
                    }
                    .lqp-body {
                        padding: 14px 16px;
                        font-size: 1rem;
                        line-height: 1.6;
                        color: #0f172a;
                    }
                    .lqp-body img {
                        max-width: 100%;
                        max-height: 350px;
                        object-fit: contain;
                        border-radius: 12px;
                        border: 1.5px solid #cbd5e1;
                        background: #ffffff;
                        padding: 6px;
                        display: block;
                        margin: 10px 0;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
                        cursor: zoom-in;
                        transition: transform 0.2s;
                    }
                    .lqp-body img:hover {
                        transform: scale(1.01);
                    }
                    .lqp-tip {
                        padding: 6px 14px 10px 14px;
                        font-size: 0.74rem;
                        color: #64748b;
                        font-style: italic;
                    }

                    /* Saved Question Card Images */
                    .q-text-v2 img {
                        max-width: 100%;
                        max-height: 360px;
                        object-fit: contain;
                        border-radius: 12px;
                        margin: 12px 0;
                        display: block;
                        border: 1.5px solid #e2e8f0;
                        background: #ffffff;
                        padding: 6px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                        cursor: zoom-in;
                        transition: transform 0.2s;
                    }
                    .q-text-v2 img:hover {
                        transform: scale(1.01);
                    }
                    .q-img-present-chip {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        background: #ecfdf5;
                        color: #047857;
                        border: 1px solid #a7f3d0;
                        padding: 3px 8px;
                        border-radius: 8px;
                        font-size: 0.72rem;
                        font-weight: 800;
                    }

                    /* Lightbox Modal */
                    .img-lightbox-backdrop {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(15, 23, 42, 0.85);
                        z-index: 99999;
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

                    /* Dark Mode Overrides for Image Previews */
                    body.dark-theme .live-question-preview-container,
                    .dark .live-question-preview-container {
                        background: #0f172a;
                        border-color: #334155;
                    }
                    body.dark-theme .lqp-header,
                    .dark .lqp-header {
                        background: #1e293b;
                        border-color: #334155;
                        color: #cbd5e1;
                    }
                    body.dark-theme .lqp-body,
                    .dark .lqp-body {
                        color: #f1f5f9;
                    }
                    body.dark-theme .lqp-body img,
                    .dark .lqp-body img,
                    body.dark-theme .q-text-v2 img,
                    .dark .q-text-v2 img {
                        border-color: #334155;
                        background: #1e293b;
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

                    .opt-item-v2.is-correct { background: #f0fdf4; border-color: #22c55e; color: #166534; font-weight: 800; }
                    .opt-marker { width: 30px; height: 30px; min-width: 30px; border-radius: 8px; background: white; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; color: #64748b; }
                    .opt-item-v2.is-correct .opt-marker { background: #22c55e; color: white; border-color: #22c55e; }
                    .essay-rubric-v2 { background: #fffbeb; border-radius: 16px; padding: 20px; border-left: 6px solid #f59e0b; margin-top: 20px; }
                    .rubric-header { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 950; color: #b45309; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; }
                    .rubric-content { font-size: 1rem; color: #78350f; line-height: 1.6; font-weight: 600; white-space: pre-wrap; }
                    .q-card-footer { border-top: 2px dashed #f1f5f9; margin-top: 24px; padding-top: 16px; display: flex; justify-content: flex-end; }
                    .bobot-tag { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #64748b; font-weight: 700; padding: 8px 16px; background: #f8fafc; border-radius: 50px; border: 2px solid #f1f5f9; }
                    .bobot-tag strong { color: #0f172a; font-size: 1rem; font-weight: 900; }
                    .empty-questions-v2 { text-align: center; padding: 60px 20px; background: white; border-radius: 24px; border: 2px dashed #e2e8f0; color: #94a3b8; }
                    .empty-illustration { color: #e2e8f0; margin-bottom: 16px; }
                    .empty-questions-v2 h3 { font-size: 1.3rem; color: #475569; margin-bottom: 8px; font-weight: 800; }
                    .empty-questions-v2 p { font-size: 1rem; }
                    .questions-scroll-v2::-webkit-scrollbar { width: 8px; }
                    .questions-scroll-v2::-webkit-scrollbar-track { background: transparent; }
                    .questions-scroll-v2::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    .questions-scroll-v2::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

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
                    /* Dark Mode Overrides for Questions View */
                    [data-theme="dark"] .card-v2 { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .title-v2, [data-theme="dark"] .form-header-v2 h3 { color: #f8fafc; }
                    [data-theme="dark"] .back-btn-v2 { background: #0f172a; border-color: #334155; color: #cbd5e1; }
                    [data-theme="dark"] .back-btn-v2:hover { background: #1e293b; color: #3b82f6; border-color: #3b82f6; }
                    [data-theme="dark"] .q-type-switcher-v2 { background: #0f172a; border: 1px solid #334155; }
                    [data-theme="dark"] .q-type-btn-v2 { color: #94a3b8; }
                    [data-theme="dark"] .q-type-btn-v2.active { background: #1e293b; color: #60a5fa; }
                    [data-theme="dark"] .q-type-btn-v2.active .icon-circle { background: #3b82f6; color: white; }
                    [data-theme="dark"] .q-type-btn-v2 .icon-circle { background: #0f172a; color: #94a3b8; }
                    [data-theme="dark"] .form-group-v2 label { color: #94a3b8; }
                    [data-theme="dark"] .editor-container-v2 { background: #0f172a; border-color: #334155; color: #f8fafc; }
                    [data-theme="dark"] .editor-container-v2 .ql-toolbar { background: #1e293b; border-bottom: 1.5px solid #334155 !important; }
                    [data-theme="dark"] .editor-container-v2 .ql-editor { color: #f8fafc; }
                    [data-theme="dark"] .editor-container-v2 .ql-editor.ql-blank::before { color: #64748b; }
                    [data-theme="dark"] .btn-type-toggle { background: #0f172a; border-color: #334155; color: #94a3b8; }
                    [data-theme="dark"] .btn-type-toggle:hover { background: #1e293b; color: #f8fafc; }
                    [data-theme="dark"] .btn-type-toggle.active { background: #1e3a8a; border-color: #3b82f6; color: #93c5fd; }
                    [data-theme="dark"] .true-false-selection { background: #0f172a; border-color: #334155; }
                    [data-theme="dark"] .tf-card { background: #1e293b; border-color: #334155; color: #f8fafc; }
                    [data-theme="dark"] .tf-badge { background: #0f172a; color: #cbd5e1; }
                    [data-theme="dark"] .stat-item { background: #1e293b; border-color: #334155; border-bottom-color: #334155; }
                    [data-theme="dark"] .stat-item .value { color: #f8fafc; }
                    [data-theme="dark"] .guru-tag { background: #0f172a; color: #cbd5e1; }
                    [data-theme="dark"] .q-card-v2 { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .opt-item-v2 { background: #0f172a; border-color: #334155; color: #cbd5e1; }
                    [data-theme="dark"] .opt-marker { background: #0f172a; border-color: #334155; color: #cbd5e1; }
                    [data-theme="dark"] .bobot-tag { background: #0f172a; border-color: #334155; color: #94a3b8; }
                    [data-theme="dark"] .bobot-tag strong { color: #f8fafc; }
                    [data-theme="dark"] .empty-questions-v2 { background: #1e293b; border-color: #334155; color: #94a3b8; }
                    [data-theme="dark"] .empty-questions-v2 h3 { color: #f8fafc; }
                    [data-theme="dark"] .modal-content { background: #1e293b; color: #f8fafc; border: 1px solid #334155; }
                    [data-theme="dark"] .modal-header h3 { color: #f8fafc; }
                    [data-theme="dark"] .form-group input, [data-theme="dark"] .form-group select, [data-theme="dark"] .form-group textarea { background: #0f172a; border-color: #334155; color: #f8fafc; }
                    [data-theme="dark"] .btn-secondary { background: #0f172a; color: #cbd5e1; border: 1px solid #334155; }
                    [data-theme="dark"] .btn-secondary:hover { background: #334155; color: #f8fafc; }
/* Option Image Upload and Preview Styles */
                    
                    .opt-paste-badge {
                        background: #ecfdf5;
                        color: #047857;
                        border: 1px solid #a7f3d0;
                        padding: 3px 10px;
                        border-radius: 20px;
                        font-size: 0.76rem;
                        font-weight: 700;
                    }

                    .opt-row-container { margin-bottom: 12px; }
                    .opt-input-v2 { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 16px; padding: 8px 12px 8px 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
                    .opt-input-v2 input { flex: 1; border: none; background: transparent; outline: none; font-size: 0.92rem; font-weight: 600; color: #1e293b; padding: 6px 4px; }
                    .btn-opt-img-attach {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 8px 12px;
                        background: #eef2ff;
                        color: #4f46e5;
                        border: 1px solid #c7d2fe;
                        border-radius: 10px;
                        font-size: 0.78rem;
                        font-weight: 700;
                        cursor: pointer;
                        white-space: nowrap;
                        transition: all 0.2s;
                    }
                    .btn-opt-img-attach:hover { background: #e0e7ff; border-color: #a5b4fc; }
                    .btn-opt-img-attach.has-img { background: #f0fdf4; color: #15803d; border-color: #86efac; }
                    .opt-preview-container {
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        margin: 6px 0 6px 54px;
                        padding: 8px 14px;
                        background: #f8fafc;
                        border: 1.5px dashed #cbd5e1;
                        border-radius: 12px;
                    }
                    .opt-thumb-wrapper { display: flex; align-items: center; gap: 10px; cursor: pointer; }
                    .opt-preview-thumb {
                        max-height: 85px;
                        max-width: 150px;
                        border-radius: 8px;
                        border: 1px solid #e2e8f0;
                        object-fit: contain;
                        background: white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
                        transition: transform 0.2s;
                    }
                    .opt-preview-thumb:hover { transform: scale(1.04); }
                    .opt-zoom-hint { font-size: 0.78rem; color: #3b82f6; font-weight: 700; display: flex; align-items: center; gap: 4px; }
                    .btn-opt-img-remove {
                        margin-left: auto;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        padding: 6px 12px;
                        background: #fee2e2;
                        color: #b91c1c;
                        border: none;
                        border-radius: 8px;
                        font-size: 0.78rem;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-opt-img-remove:hover { background: #fecaca; }
                    .opt-text img {
                        max-height: 160px;
                        max-width: 100%;
                        border-radius: 8px;
                        margin-top: 6px;
                        display: block;
                        cursor: zoom-in;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                        transition: transform 0.2s;
                    }
                    .opt-text img:hover { transform: scale(1.02); }

                    /* ==================== BS_MAJEMUK TABLE EDITOR STYLES ==================== */
                    .bs-majemuk-form-container {
                        background: #f8fafc;
                        border: 2px solid #e2e8f0;
                        border-radius: 16px;
                        padding: 20px;
                        margin-bottom: 24px;
                    }
                    .bs-majemuk-table-editor {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    .bs-statement-card {
                        background: #ffffff;
                        border: 2px solid #e2e8f0;
                        border-radius: 16px;
                        padding: 16px 18px;
                        transition: all 0.2s ease;
                        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
                    }
                    .bs-statement-card:focus-within {
                        border-color: #3b82f6;
                        box-shadow: 0 4px 16px -2px rgba(59, 130, 246, 0.15);
                    }
                    .bs-stmt-card-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                    }
                    .bs-stmt-card-footer {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-top: 14px;
                        padding-top: 12px;
                        border-top: 1px dashed #e2e8f0;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .bs-stmt-num {
                        width: 32px;
                        height: 32px;
                        min-width: 32px;
                        border-radius: 10px;
                        background: #e0e7ff;
                        color: #4338ca;
                        font-weight: 800;
                        font-size: 0.9rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .bs-stmt-input-wrap {
                        width: 100%;
                    }
                    .bs-stmt-textarea {
                        width: 100% !important;
                        min-width: 100% !important;
                        max-width: 100% !important;
                        box-sizing: border-box;
                        border: 1.5px solid #cbd5e1;
                        border-radius: 12px;
                        padding: 12px 16px;
                        font-size: 0.95rem;
                        font-family: inherit;
                        line-height: 1.55;
                        color: #0f172a;
                        background: #f8fafc;
                        resize: vertical;
                        min-height: 64px;
                        transition: all 0.2s;
                        outline: none;
                        display: block;
                    }
                    .bs-stmt-textarea:focus {
                        border-color: #3b82f6;
                        background: #ffffff;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
                    }
                    .bs-stmt-point-badge {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 0.78rem;
                        font-weight: 800;
                        color: #0369a1;
                        background: #e0f2fe;
                        padding: 6px 10px;
                        border-radius: 8px;
                        white-space: nowrap;
                        border: 1px solid #bae6fd;
                    }
                    .bs-stmt-key-toggle {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        white-space: nowrap;
                    }
                    .btn-bs-toggle {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 9px 15px;
                        border-radius: 10px;
                        font-size: 0.82rem;
                        font-weight: 800;
                        cursor: pointer;
                        border: 2px solid #e2e8f0;
                        background: #f8fafc;
                        color: #64748b;
                        transition: all 0.2s ease;
                    }
                    .btn-bs-toggle:hover {
                        border-color: #cbd5e1;
                        transform: translateY(-1px);
                    }
                    .btn-bs-toggle.btn-toggle-b.active-b {
                        background: #16a34a !important;
                        border-color: #15803d !important;
                        color: #ffffff !important;
                        box-shadow: 0 3px 8px rgba(22, 163, 74, 0.3) !important;
                    }
                    .btn-bs-toggle.btn-toggle-s.active-s {
                        background: #dc2626 !important;
                        border-color: #b91c1c !important;
                        color: #ffffff !important;
                        box-shadow: 0 3px 8px rgba(220, 38, 38, 0.3) !important;
                    }

                    /* Preview table styles */
                    .bs-majemuk-preview-table-wrap {
                        margin: 14px 0;
                        overflow-x: auto;
                        border-radius: 12px;
                        border: 1px solid #e2e8f0;
                    }
                    .bs-majemuk-preview-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.9rem;
                        background: white;
                    }
                    .bs-majemuk-preview-table th {
                        background: #f1f5f9;
                        color: #475569;
                        font-size: 0.8rem;
                        font-weight: 800;
                        padding: 10px 14px;
                        border-bottom: 2px solid #e2e8f0;
                        text-transform: uppercase;
                    }
                    .bs-majemuk-preview-table td {
                        padding: 12px 14px;
                        border-bottom: 1px solid #e2e8f0;
                        color: #1e293b;
                    }
                    .badge-bs-key {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 4px 10px;
                        border-radius: 6px;
                        font-size: 0.78rem;
                        font-weight: 800;
                    }
                    .badge-bs-key.is-b {
                        background: #dcfce7;
                        color: #15803d;
                        border: 1px solid #86efac;
                    }
                    .badge-bs-key.is-s {
                        background: #fee2e2;
                        color: #b91c1c;
                        border: 1px solid #fca5a5;
                    }

                    /* Dark Mode styles */
                    [data-theme="dark"] .bs-majemuk-form-container { background: #0f172a; border-color: #334155; }
                    [data-theme="dark"] .bs-statement-card { background: #1e293b; border-color: #334155; }
                    [data-theme="dark"] .bs-stmt-card-footer { border-top-color: #334155; }
                    [data-theme="dark"] .bs-stmt-num { background: #1e3a8a; color: #93c5fd; }
                    [data-theme="dark"] .bs-stmt-textarea { background: #0f172a; border-color: #334155; color: #f8fafc; }
                    [data-theme="dark"] .bs-stmt-textarea:focus { border-color: #3b82f6; background: #1e293b; }
                    [data-theme="dark"] .bs-stmt-point-badge { background: #0c4a6e; color: #7dd3fc; border-color: #0369a1; }
                    [data-theme="dark"] .btn-bs-toggle { background: #0f172a; border-color: #334155; color: #94a3b8; }
                    [data-theme="dark"] .bs-scoring-detail-card { background: #082f49 !important; border-color: #0369a1 !important; color: #e0f2fe !important; }
                    [data-theme="dark"] .bs-majemuk-preview-table-wrap { border-color: #334155; }
                    [data-theme="dark"] .bs-majemuk-preview-table { background: #1e293b; }
                    [data-theme="dark"] .bs-majemuk-preview-table th { background: #0f172a; border-bottom-color: #334155; color: #94a3b8; }
                    [data-theme="dark"] .bs-majemuk-preview-table td { border-bottom-color: #334155; color: #f8fafc; }
                `}</style>

                </div>

                {/* Modal Salin Soal dari Ujian Lain */}
                {isCopyModalOpen && (
                    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.75)', zIndex: 100000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backdropFilter: 'blur(6px)' }}>
                        <div className="modal-content animate-slide-up" style={{
                            maxWidth: '560px',
                            width: '100%',
                            borderRadius: '20px',
                            background: '#ffffff',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ background: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '12px' }}>
                                        <Copy size={22} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Salin Soal dari Ujian Lain</h3>
                                        {(() => {
                                            const target = copyTargetExam || viewingQuestions;
                                            if (!target) return null;
                                            return (
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                                    Target: <strong>{target.namaMapel}</strong> ({target.waktuMulai ? new Date(target.waktuMulai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'})
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <button type="button" onClick={() => setIsCopyModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                    <XCircle size={22} />
                                </button>
                            </div>

                            <div style={{ padding: '24px' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#334155', marginBottom: '8px' }}>
                                        Pilih Ujian Sumber (Yang Akan Disalin)
                                    </label>
                                    <select
                                        value={selectedSourceExamId}
                                        onChange={(e) => setSelectedSourceExamId(e.target.value)}
                                        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.9rem', color: '#1e293b', background: '#fff' }}
                                    >
                                        <option value="">-- Pilih Ujian Sumber --</option>
                                        {exams
                                            .filter(e => e.id !== (copyTargetExam?.id || viewingQuestions?.id))
                                            .map(e => (
                                                <option key={e.id} value={e.id}>
                                                    {e.namaMapel} • {e.namaEvent || 'Event'} ({new Date(e.waktuMulai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px', marginBottom: '24px' }}>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#166534', lineHeight: 1.5 }}>
                                        💡 <strong>Informasi:</strong> Seluruh soal Pilihan Ganda (termasuk opsi pilihan A-E & kunci jawaban) dan soal Essay beserta bobot nilai akan disalin langsung ke ujian ini.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsCopyModalOpen(false)}
                                        style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700, background: '#f1f5f9', border: 'none', color: '#475569', cursor: 'pointer' }}
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!selectedSourceExamId || isCopying}
                                        onClick={handleCopyQuestions}
                                        style={{
                                            padding: '10px 22px',
                                            borderRadius: '10px',
                                            fontWeight: 800,
                                            background: !selectedSourceExamId || isCopying ? '#94a3b8' : '#059669',
                                            color: '#ffffff',
                                            border: 'none',
                                            cursor: !selectedSourceExamId || isCopying ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {isCopying ? <RefreshCw size={16} className="animate-spin" /> : <Copy size={16} />}
                                        {isCopying ? 'Menyalin...' : 'Salin Soal Sekarang'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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
                            background: 'var(--bg-modal, #1e293b)'
                        }}>
                            <div className="modal-header" style={{ flexShrink: 0, background: 'var(--bg-modal, #1e293b)', borderBottom: '1px solid #334155', padding: '20px 40px', zIndex: 20 }}>
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
                {renderWordImportModal()}
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
                            className={`nav-tab ${activeTab === 'events' ? 'active' : ''}`}
                            onClick={() => setActiveTab('events')}
                        >
                            <Calendar size={18} />
                            <span>Daftar Event</span>
                        </button>
                    )}
                    <button
                        className={`nav-tab ${activeTab === 'exams' ? 'active' : ''}`}
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
                                                        className={`icon-btn ${event.statusAktif ? 'deactivate' : 'activate'}`}
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
                            {examForm.eventId && (userRole === 'ADMIN' || userRole === 'TU' || userRole === 'GURU') && (
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        setEditMode(false);
                                        const ev = events.find(e => e.id == examForm.eventId);
                                        const isLatihan = ev?.namaEvent && (ev.namaEvent.toLowerCase().includes('latihan') || ev.namaEvent.toLowerCase().includes('simulasi'));
                                        const user = JSON.parse(localStorage.getItem('user') || '{}');
                                        const myFirstAssignment = myAssignments.find(a => a.guruId == user.profileId) || myAssignments[0];

                                        setExamForm({
                                            eventId: examForm.eventId,
                                            mapelId: myFirstAssignment ? myFirstAssignment.mapelId : (allMapels[0]?.id || ''),
                                            guruId: userRole === 'GURU' ? (user.profileId || '') : (myFirstAssignment?.guruId || ''),
                                            waktuMulai: isLatihan ? `${new Date().toISOString().substring(0, 10)}T${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}` : `${(ev?.tanggalMulai && ev.tanggalMulai.length >= 10) ? ev.tanggalMulai : new Date().toISOString().substring(0, 10)}T07:30`,
                                            waktuSelesai: isLatihan ? `${new Date().toISOString().substring(0, 10)}T23:59` : `${(ev?.tanggalMulai && ev.tanggalMulai.length >= 10) ? ev.tanggalMulai : new Date().toISOString().substring(0, 10)}T09:00`,
                                            durasi: isLatihan ? 0 : 90,
                                            token: isLatihan ? 'LATIH' : '',
                                            kelasIds: []
                                        });
                                        setIsModalOpen(true);
                                    }}
                                >
                                    <Plus size={18} /> Tambah Jadwal Ujian
                                </button>
                            )}
                        </div>

                        {userRole === 'GURU' && !JSON.parse(localStorage.getItem('user') || '{}').isCoAdmin && myAssignments.length > 0 && (
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
                                                    if (user.isCoAdmin) return true;
                                                    return exam.guruId == user.profileId;
                                                })
                                                .map(exam => (
                                                    <tr key={exam.id}>
                                                        <td>
                                                            <div className="mapel-cell">
                                                                <span className="nama-mapel">{exam.namaMapel}</span>
                                                                <div style={{ marginTop: '4px' }}>
                                                                    {exam.statusAktif !== false ? (
                                                                        <span style={{
                                                                            fontSize: '0.72rem',
                                                                            background: '#ecfdf5',
                                                                            color: '#059669',
                                                                            border: '1px solid #a7f3d0',
                                                                            padding: '2px 8px',
                                                                            borderRadius: '6px',
                                                                            fontWeight: 800,
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px'
                                                                        }}>
                                                                            <Eye size={12} /> Buka (Aktif)
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{
                                                                            fontSize: '0.72rem',
                                                                            background: '#fef2f2',
                                                                            color: '#dc2626',
                                                                            border: '1px solid #fecaca',
                                                                            padding: '2px 8px',
                                                                            borderRadius: '6px',
                                                                            fontWeight: 800,
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px'
                                                                        }}>
                                                                            <EyeOff size={12} /> Tutup (Nonaktif)
                                                                        </span>
                                                                    )}
                                                                </div>
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
                                                            <span className="duration-badge">{Number(exam.durasi) === 0 ? "♾️ Tanpa Batas" : `${exam.durasi} Menit`}</span>
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
                                                                    style={{ background: '#f5f3ff', color: '#7c3aed', border: '1.5px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                                                    onClick={() => handleOpenWordImportModal(exam)}
                                                                    title="Import Soal dari Word (.docx) atau Teks dengan AI"
                                                                >
                                                                    <Sparkles size={13} />
                                                                    Import Word (AI)
                                                                </button>
                                                                <button
                                                                    className="btn-lengkapi"
                                                                    style={{ background: '#ecfdf5', color: '#059669', border: '1.5px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                                                    onClick={() => {
                                                                        setCopyTargetExam(exam);
                                                                        setSelectedSourceExamId('');
                                                                        setIsCopyModalOpen(true);
                                                                    }}
                                                                    title="Salin / Transfer seluruh soal dari ujian lain ke ujian ini"
                                                                >
                                                                    <Copy size={13} />
                                                                    Salin Soal
                                                                </button>
                                                                <button
                                                                    className="btn-lengkapi"
                                                                    style={{ background: '#ecfdf5', color: '#059669', border: '1.5px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                                    onClick={() => window.location.href = `/student-exams?examId=${exam.id}&eventId=${exam.eventId || selectedEventId || ''}`}
                                                                    title="Coba kerjakan ujian ini di antarmuka CBT Siswa (Simulasi Admin)"
                                                                >
                                                                    <CheckCircle2 size={13} />
                                                                    Coba Ujian
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
                                                                <button
                                                                    className="btn-lengkapi"
                                                                    style={{ background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa', display: 'inline-flex', alignItems: 'center' }}
                                                                    onClick={() => window.location.href = '/exam-scoring'}
                                                                    title="Buka menu Koreksi Nilai & Reset / Ulangi Ujian Siswa"
                                                                >
                                                                    <RotateCcw size={13} style={{ marginRight: '4px' }} />
                                                                    Koreksi & Reset
                                                                </button>
                                                                {(userRole === 'ADMIN' || userRole === 'TU' || (userRole === 'GURU' && (JSON.parse(localStorage.getItem('user') || '{}').isCoAdmin || exam.guruId == JSON.parse(localStorage.getItem('user') || '{}').profileId))) && (
                                                                    <button
                                                                        className="btn-lengkapi"
                                                                        style={{
                                                                            background: '#ecfdf5',
                                                                            color: '#059669',
                                                                            border: '1.5px solid #a7f3d0',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            fontWeight: 700
                                                                        }}
                                                                        onClick={() => handleExportPesertaExcel(exam)}
                                                                        disabled={downloadingExamId === exam.id}
                                                                        title="Unduh rekap file Excel data seluruh siswa (yang sudah dan belum menyelesaikan ujian ini)"
                                                                    >
                                                                        <FileDown size={13} />
                                                                        {downloadingExamId === exam.id ? 'Mengunduh...' : 'Unduh Rekap Siswa'}
                                                                    </button>
                                                                )}
                                                                {(userRole === 'ADMIN' || userRole === 'TU' || (userRole === 'GURU' && exam.guruId == JSON.parse(localStorage.getItem('user') || '{}').profileId)) && (
                                                                    <>
                                                                        <button
                                                                            className="btn-icon-outline"
                                                                            onClick={() => handleToggleExamStatus(exam)}
                                                                            title={exam.statusAktif !== false ? 'Ujian sedang Terbuka (Tampil untuk Siswa) — Klik untuk Tutup Ujian' : 'Ujian sedang Ditutup (Disembunyikan dari Siswa) — Klik untuk Buka Ujian'}
                                                                            style={{
                                                                                color: exam.statusAktif !== false ? '#059669' : '#dc2626',
                                                                                borderColor: exam.statusAktif !== false ? '#a7f3d0' : '#fecaca',
                                                                                background: exam.statusAktif !== false ? '#ecfdf5' : '#fef2f2',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                        >
                                                                            {exam.statusAktif !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                                                                        </button>
                                                                        <button
                                                                            className="btn-icon-outline"
                                                                            onClick={() => {
                                                                                setSelectedItem(exam);
                                                                                setEditMode(true);
                                                                                let startStr = '';
                                                                                if (exam.waktuMulai) {
                                                                                    startStr = exam.waktuMulai.substring(0, 16);
                                                                                }
                                                                                let endStr = '';
                                                                                if (exam.waktuSelesai) {
                                                                                    endStr = exam.waktuSelesai.substring(0, 16);
                                                                                } else if (startStr && Number(exam.durasi) > 0) {
                                                                                    const sParts = parseWibParts(startStr);
                                                                                    const calculated = addMinutesToWib(sParts.date, sParts.hour, sParts.minute, Number(exam.durasi));
                                                                                    endStr = `${calculated.date}T${calculated.hour}:${calculated.minute}`;
                                                                                }
                                                                                setExamForm({
                                                                                    ...examForm,
                                                                                    eventId: exam.eventId || examForm.eventId,
                                                                                    mapelId: exam.mapelId,
                                                                                    guruId: exam.guruId,
                                                                                    waktuMulai: startStr,
                                                                                    waktuSelesai: endStr,
                                                                                    durasi: exam.durasi !== undefined ? exam.durasi : 90,
                                                                                    token: exam.token || '',
                                                                                    kelasIds: exam.kelasIds || []
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
            {isModalOpen && createPortal(
                <div className="modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 999999,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '24px 16px',
                    overflowY: 'auto',
                    boxSizing: 'border-box'
                }}>
                    <div className="modal-content animate-slide-up" style={{
                        borderRadius: '24px',
                        width: '100%',
                        maxWidth: '680px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        background: '#ffffff',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
                        position: 'relative',
                        margin: 'auto',
                        boxSizing: 'border-box'
                    }}>
                        <div className="modal-header" style={{
                            padding: '20px 28px',
                            borderBottom: '1.5px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexShrink: 0,
                            background: '#ffffff'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                                {editMode ? 'Edit' : 'Tambah'} {activeTab === 'events' ? 'Event Ujian' : 'Jadwal Ujian'}
                            </h3>
                            <button type="button" className="close-btn" onClick={() => setIsModalOpen(false)}>
                                <XCircle size={22} />
                            </button>
                        </div>
                        <form onSubmit={activeTab === 'events' ? handleSaveEvent : handleSaveExam} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            minHeight: 0,
                            overflow: 'hidden',
                            margin: 0
                        }}>
                            <div className="modal-body-scroll custom-scrollbar" style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '24px 28px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px'
                            }}>
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
                                        <label>{(userRole === 'GURU' && !JSON.parse(localStorage.getItem('user') || '{}').isCoAdmin) ? 'Mata Pelajaran' : 'Pilih Mata Pelajaran & Guru'}</label>
                                        {(() => {
                                            const user = JSON.parse(localStorage.getItem('user') || '{}');
                                            const optionMap = new Map();

                                            if (Array.isArray(myAssignments) && myAssignments.length > 0) {
                                                myAssignments.forEach(a => {
                                                    const mId = a.mapelId || a.id;
                                                    const gId = a.guruId || (userRole === 'GURU' ? (user.profileId || '') : '');
                                                    const key = `${mId}___${gId}`;
                                                    if (!optionMap.has(key)) {
                                                        optionMap.set(key, {
                                                            mapelId: mId,
                                                            guruId: gId,
                                                            label: a.namaGuru ? `${a.namaMapel} (${a.namaGuru})` : a.namaMapel
                                                        });
                                                    }
                                                });
                                            }

                                            if (Array.isArray(allMapels) && allMapels.length > 0) {
                                                allMapels.forEach(m => {
                                                    const gId = userRole === 'GURU' ? (user.profileId || '') : (teachers[0]?.profileId || '');
                                                    const key = `${m.id}___${gId}`;
                                                    if (!optionMap.has(key)) {
                                                        optionMap.set(key, {
                                                            mapelId: m.id,
                                                            guruId: gId,
                                                            label: m.namaMapel
                                                        });
                                                    }
                                                });
                                            }

                                            if (editMode && selectedItem && selectedItem.mapelId) {
                                                const curMId = selectedItem.mapelId;
                                                const curGId = selectedItem.guruId || (userRole === 'GURU' ? (user.profileId || '') : '');
                                                const key = `${curMId}___${curGId}`;
                                                if (!optionMap.has(key)) {
                                                    optionMap.set(key, {
                                                        mapelId: curMId,
                                                        guruId: curGId,
                                                        label: selectedItem.namaMapel ? `${selectedItem.namaMapel} ${selectedItem.namaGuru ? '(' + selectedItem.namaGuru + ')' : ''}` : `Mapel #${curMId}`
                                                    });
                                                }
                                            }

                                            const options = Array.from(optionMap.values());
                                            const currentSelected = options.find(o => String(o.mapelId) === String(examForm.mapelId) && (!examForm.guruId || String(o.guruId) === String(examForm.guruId)))
                                                || options.find(o => String(o.mapelId) === String(examForm.mapelId));

                                            const selectValue = currentSelected ? `${currentSelected.mapelId}___${currentSelected.guruId}` : '';

                                            return (
                                                <select
                                                    value={selectValue}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val && val.includes('___')) {
                                                            const [mId, gId] = val.split('___');
                                                            setExamForm(prev => ({ ...prev, mapelId: Number(mId) || mId, guruId: Number(gId) || gId }));
                                                        } else {
                                                            setExamForm(prev => ({ ...prev, mapelId: '', guruId: '' }));
                                                        }
                                                    }}
                                                    required
                                                >
                                                    <option value="">-- Pilih Mata Pelajaran --</option>
                                                    {options.map(o => (
                                                        <option key={`${o.mapelId}___${o.guruId}`} value={`${o.mapelId}___${o.guruId}`}>
                                                            {o.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            );
                                        })()}
                                    </div>

                                    {(userRole === 'ADMIN' || userRole === 'TU' || JSON.parse(localStorage.getItem('user') || '{}').isCoAdmin) && (
                                        <div className="form-group">
                                            <label>Peserta Kelas (Opsional - Jika kosong, akan otomatis mengambil semua kelas guru bersangkutan)</label>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' }}>
                                                {kelasList.map(k => (
                                                    <label key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={examForm.kelasIds?.includes(k.id)}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setExamForm(prev => {
                                                                    const ids = prev.kelasIds || [];
                                                                    return {
                                                                        ...prev,
                                                                        kelasIds: checked
                                                                            ? (ids.includes(k.id) ? ids : [...ids, k.id])
                                                                            : ids.filter(id => id !== k.id)
                                                                    };
                                                                });
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.9rem' }}>{k.namaKelas}</span>
                                                    </label>
                                                ))}
                                                {kelasList.length === 0 && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Belum ada data kelas</span>}
                                            </div>
                                        </div>
                                    )}

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

                                    {(() => {
                                        const startParts = parseWibParts(examForm.waktuMulai);
                                        const endParts = parseWibParts(examForm.waktuSelesai);

                                        const updateStart = (newDate, newHour, newMin) => {
                                            const d = newDate !== undefined ? newDate : startParts.date;
                                            const h = newHour !== undefined ? newHour : startParts.hour;
                                            const m = newMin !== undefined ? newMin : startParts.minute;
                                            const newStartIso = `${d}T${h}:${m}`;

                                            const dur = Number(examForm.durasi) || 0;
                                            let newEndIso = examForm.waktuSelesai;
                                            if (dur > 0 && d) {
                                                const calculatedEnd = addMinutesToWib(d, h, m, dur);
                                                newEndIso = `${calculatedEnd.date}T${calculatedEnd.hour}:${calculatedEnd.minute}`;
                                            }
                                            setExamForm({ ...examForm, waktuMulai: newStartIso, waktuSelesai: newEndIso });
                                        };

                                        const updateEnd = (newDate, newHour, newMin) => {
                                            const d = newDate !== undefined ? newDate : endParts.date;
                                            const h = newHour !== undefined ? newHour : endParts.hour;
                                            const m = newMin !== undefined ? newMin : endParts.minute;
                                            setExamForm({ ...examForm, waktuSelesai: `${d}T${h}:${m}` });
                                        };

                                        const handleSetNow = () => {
                                            const now = new Date();
                                            const y = now.getFullYear();
                                            const m = String(now.getMonth() + 1).padStart(2, '0');
                                            const d = String(now.getDate()).padStart(2, '0');
                                            const h = String(now.getHours()).padStart(2, '0');
                                            const min = String(now.getMinutes()).padStart(2, '0');
                                            updateStart(`${y}-${m}-${d}`, h, min);
                                        };

                                        const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
                                        const minuteOptions = Array.from(new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', startParts.minute])).sort();
                                        const endMinuteOptions = Array.from(new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', endParts.minute])).sort();

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', marginTop: '6px', marginBottom: '8px' }}>
                                                {/* Waktu Mulai & Durasi */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                            <label style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '0.88rem' }}>
                                                                📅 Waktu Mulai (WIB)
                                                            </label>
                                                            <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                                                24 Jam WIB
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                                            <input
                                                                type="date"
                                                                value={startParts.date}
                                                                onChange={(e) => updateStart(e.target.value, undefined, undefined)}
                                                                style={{ flex: 1.3, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem' }}
                                                                required
                                                            />
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                                                                <select
                                                                    value={startParts.hour}
                                                                    onChange={(e) => updateStart(undefined, e.target.value, undefined)}
                                                                    style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                                                                >
                                                                    {hourOptions.map(h => (
                                                                        <option key={h} value={h}>{h}</option>
                                                                    ))}
                                                                </select>
                                                                <span style={{ fontWeight: 800, color: '#64748b' }}>:</span>
                                                                <select
                                                                    value={startParts.minute}
                                                                    onChange={(e) => updateStart(undefined, undefined, e.target.value)}
                                                                    style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                                                                >
                                                                    {minuteOptions.map(m => (
                                                                        <option key={m} value={m}>{m}</option>
                                                                    ))}
                                                                </select>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb' }}>WIB</span>
                                                            </div>
                                                        </div>

                                                        {/* Presets Jam Mulai */}
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                                                            {['07:30', '08:00', '09:30', '10:00', '13:00'].map(tp => {
                                                                const [th, tm] = tp.split(':');
                                                                const isSelected = startParts.hour === th && startParts.minute === tm;
                                                                return (
                                                                    <button
                                                                        key={tp}
                                                                        type="button"
                                                                        onClick={() => updateStart(undefined, th, tm)}
                                                                        style={{
                                                                            fontSize: '0.72rem',
                                                                            padding: '2px 7px',
                                                                            borderRadius: '6px',
                                                                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                                                            background: isSelected ? '#eff6ff' : '#ffffff',
                                                                            color: isSelected ? '#1d4ed8' : '#475569',
                                                                            fontWeight: isSelected ? 800 : 500,
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {tp}
                                                                    </button>
                                                                );
                                                            })}
                                                            <button
                                                                type="button"
                                                                onClick={handleSetNow}
                                                                style={{
                                                                    fontSize: '0.72rem',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #bfdbfe',
                                                                    background: '#eff6ff',
                                                                    color: '#1d4ed8',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Set ke jam sekarang"
                                                            >
                                                                ⚡ Sekarang
                                                            </button>
                                                        </div>

                                                        <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #dbeafe', fontSize: '0.74rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Calendar size={13} className="text-blue-600 shrink-0" />
                                                            <span><strong>Mulai:</strong> {formatIndonesianDateTime(startParts.date, startParts.hour, startParts.minute)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Durasi */}
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                            <label style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '0.88rem' }}>
                                                                ⏱️ Durasi (Menit)
                                                            </label>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                                0 = Bebas / Latihan
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="5"
                                                                value={examForm.durasi !== undefined ? examForm.durasi : ''}
                                                                onChange={(e) => {
                                                                    const newDur = Number(e.target.value);
                                                                    let newEndIso = examForm.waktuSelesai;
                                                                    if (startParts.date && newDur > 0) {
                                                                        const calculatedEnd = addMinutesToWib(startParts.date, startParts.hour, startParts.minute, newDur);
                                                                        newEndIso = `${calculatedEnd.date}T${calculatedEnd.hour}:${calculatedEnd.minute}`;
                                                                    }
                                                                    setExamForm({ ...examForm, durasi: e.target.value, waktuSelesai: newEndIso });
                                                                }}
                                                                style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem', fontWeight: 700 }}
                                                                placeholder="Contoh: 90"
                                                                required
                                                            />
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Menit</span>
                                                        </div>

                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                                                            {[60, 90, 120, 0].map(dp => {
                                                                const isSelected = Number(examForm.durasi) === dp;
                                                                return (
                                                                    <button
                                                                        key={dp}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            let newEndIso = examForm.waktuSelesai;
                                                                            if (startParts.date && dp > 0) {
                                                                                const calculatedEnd = addMinutesToWib(startParts.date, startParts.hour, startParts.minute, dp);
                                                                                newEndIso = `${calculatedEnd.date}T${calculatedEnd.hour}:${calculatedEnd.minute}`;
                                                                            }
                                                                            setExamForm({ ...examForm, durasi: dp, waktuSelesai: newEndIso });
                                                                        }}
                                                                        style={{
                                                                            fontSize: '0.72rem',
                                                                            padding: '2px 7px',
                                                                            borderRadius: '6px',
                                                                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                                                            background: isSelected ? '#eff6ff' : '#ffffff',
                                                                            color: isSelected ? '#1d4ed8' : '#475569',
                                                                            fontWeight: isSelected ? 800 : 500,
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {dp === 0 ? '♾️ Bebas (0)' : `${dp} Mnt`}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.74rem', color: '#64748b' }}>
                                                            {Number(examForm.durasi) === 0
                                                                ? '♾️ Durasi bebas. Siswa dapat mengerjakan tanpa countdown batas durasi.'
                                                                : `Durasi pengerjaan: ${examForm.durasi} menit sejak tombol mulai ditekan.`}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Waktu Selesai (Batas Akhir) */}
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <label style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '0.88rem' }}>
                                                            🏁 Waktu Selesai (Batas Akhir Akses Ujian - WIB)
                                                        </label>
                                                        <span style={{ fontSize: '0.72rem', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                                            Otomatis Dihitung
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                                        <input
                                                            type="date"
                                                            value={endParts.date}
                                                            onChange={(e) => updateEnd(e.target.value, undefined, undefined)}
                                                            style={{ flex: 1.3, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem' }}
                                                            required
                                                        />
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                                                            <select
                                                                value={endParts.hour}
                                                                onChange={(e) => updateEnd(undefined, e.target.value, undefined)}
                                                                style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                                                            >
                                                                {hourOptions.map(h => (
                                                                    <option key={h} value={h}>{h}</option>
                                                                ))}
                                                            </select>
                                                            <span style={{ fontWeight: 800, color: '#64748b' }}>:</span>
                                                            <select
                                                                value={endParts.minute}
                                                                onChange={(e) => updateEnd(undefined, undefined, e.target.value)}
                                                                style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                                                            >
                                                                {endMinuteOptions.map(m => (
                                                                    <option key={m} value={m}>{m}</option>
                                                                ))}
                                                            </select>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669' }}>WIB</span>
                                                        </div>
                                                    </div>

                                                    <div style={{ padding: '6px 10px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', fontSize: '0.74rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Clock size={13} className="text-emerald-600 shrink-0" />
                                                        <span><strong>Batas Selesai:</strong> {formatIndonesianDateTime(endParts.date, endParts.hour, endParts.minute)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
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
                                                    placeholder="Maks 20 karakter / kosongkan"
                                                    maxLength={20}
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
                            </div>
                            <div className="modal-footer" style={{
                                padding: '16px 28px',
                                borderTop: '1.5px solid #f1f5f9',
                                background: '#f8fafc',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                flexShrink: 0,
                                margin: 0
                            }}>
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
                                <button type="submit" className="btn-primary">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {renderWordImportModal()}

            {/* End of main list return block */}
            <style>{`
                .modal-overlay {
                    position: fixed !important;
                    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    background: rgba(15, 23, 42, 0.75) !important;
                    backdrop-filter: blur(8px) !important;
                    z-index: 999999 !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    padding: 24px 16px !important;
                    overflow-y: auto !important;
                    box-sizing: border-box !important;
                }
                .modal-content.animate-slide-up {
                    border-radius: 24px;
                    width: 100%;
                    max-width: 680px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4);
                    background: white;
                    margin: auto !important;
                    position: relative;
                    box-sizing: border-box;
                }
                .modal-body-scroll {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px 28px;
                    box-sizing: border-box;
                }
                .modal-body-scroll::-webkit-scrollbar { width: 6px; }
                .modal-body-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
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

                /* Conflicting modal-overlay and modal-content removed */
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

            
            [data-theme="dark"] .empty-state {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #94a3b8 !important;
            }

            [data-theme="dark"] .empty-state p {
                color: #94a3b8 !important;
            }

            [data-theme="dark"] .selection-bar {
                background: #1e293b !important;
                border-color: #334155 !important;
            }

            [data-theme="dark"] .event-selector {
                background: #0f172a !important;
                border-color: #334155 !important;
                color: #f8fafc !important;
            }

            [data-theme="dark"] .event-selector:focus {
                background: #0f172a !important;
            }

            [data-theme="dark"] .table-card {
                background: #1e293b !important;
                border-color: #334155 !important;
            }

            [data-theme="dark"] .exam-table th {
                background: #0f172a !important;
                color: #94a3b8 !important;
                border-color: #334155 !important;
            }

            [data-theme="dark"] .exam-table td {
                border-color: #334155 !important;
                color: #cbd5e1 !important;
            }

            [data-theme="dark"] .mapel-cell {
                color: #f8fafc !important;
            }

            [data-theme="dark"] .time-cell {
                background: #0f172a !important;
                color: #94a3b8 !important;
            }

            [data-theme="dark"] .auto-generate-box {
                background: #0f172a !important;
                border-color: #334155 !important;
                color: #94a3b8 !important;
            }

            [data-theme="dark"] .btn-refresh-token {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #94a3b8 !important;
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
            [data-theme="dark"] .modal-content,
            [data-theme="dark"] .modal-header,
            [data-theme="dark"] .modal-body-scroll {
                background: #1e293b !important;
                border-color: #334155 !important;
                color: #f8fafc !important;
            }
            [data-theme="dark"] .modal-header h3 {
                color: #f8fafc !important;
            }
            [data-theme="dark"] .modal-footer {
                background: #0f172a !important;
                border-top-color: #334155 !important;
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
