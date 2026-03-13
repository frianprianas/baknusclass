import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Layers,
    BookMarked,
    Plus,
    Trash2,
    Edit2,
    Search,
    Trello,
    UserCheck,
    X,
    CheckCircle2,
    UserPlus,
    Download,
    Users
} from 'lucide-react';

const MasterData = () => {
    const [activeTab, setActiveTab] = useState('jurusan');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form States for basic master data
    const [jurusanForm, setJurusanForm] = useState({ kodeJurusan: '', namaJurusan: '' });
    const [kelasForm, setKelasForm] = useState({ tingkat: '', namaKelas: '', jurusanId: '' });
    const [mapelForm, setMapelForm] = useState({ kodeMapel: '', namaMapel: '' });

    // Master data for dependencies
    const [jurusans, setJurusans] = useState([]);

    // Guru Pengampu tab state
    const [guruList, setGuruList] = useState([]);
    const [kelasList, setKelasList] = useState([]);
    const [mapelList, setMapelList] = useState([]);
    const [pengampuData, setPengampuData] = useState([]);
    const [selectedGuru, setSelectedGuru] = useState(null);
    const [isPengampuModalOpen, setIsPengampuModalOpen] = useState(false);
    const [assignments, setAssignments] = useState([]);
    const [savingPengampu, setSavingPengampu] = useState(false);

    // Peserta Mapel state
    const [selectedMapel, setSelectedMapel] = useState(null); // mapel object being managed
    const [pesertaList, setPesertaList] = useState([]);       // enrolled students
    const [isPesertaOpen, setIsPesertaOpen] = useState(false);
    const [loadingPeserta, setLoadingPeserta] = useState(false);
    const [importKelasId, setImportKelasId] = useState('');
    const [importing, setImporting] = useState(false);
    const [kelasForImport, setKelasForImport] = useState([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            if (activeTab === 'pengampu') {
                const [guruMapelRes, usersRes, kelasRes, mapelRes] = await Promise.all([
                    axios.get('/api/enrollment/guru-mapel', { headers }),
                    axios.get('/api/users', { headers }),
                    axios.get('/api/master/kelas', { headers }),
                    axios.get('/api/master/mapel', { headers }),
                ]);
                setPengampuData(guruMapelRes.data);
                setGuruList(usersRes.data.filter(u => u.role === 'GURU'));
                setKelasList(kelasRes.data);
                setMapelList(mapelRes.data);
            } else {
                let endpoint = `/api/master/${activeTab}`;
                const response = await axios.get(endpoint, { headers });
                setData(response.data);

                if (activeTab === 'kelas') {
                    const jRes = await axios.get('/api/master/jurusan', { headers });
                    setJurusans(jRes.data);
                }
                if (activeTab === 'mapel') {
                    // Preload kelas list for import
                    const kRes = await axios.get('/api/master/kelas', { headers });
                    setKelasForImport(kRes.data);
                }
            }
        } catch (err) {
            console.error('Failed to fetch master data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const endpoint = `/api/master/${activeTab}`;

            let payload = activeTab === 'jurusan' ? jurusanForm :
                activeTab === 'kelas' ? kelasForm : mapelForm;

            if (editMode) {
                await axios.put(`${endpoint}/${selectedId}`, payload, { headers });
            } else {
                await axios.post(endpoint, payload, { headers });
            }

            setIsModalOpen(false);
            fetchData();
            resetForms();
        } catch (err) {
            alert('Gagal menyimpan data: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus data ini?')) return;
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.delete(`/api/master/${activeTab}/${id}`, { headers });
            fetchData();
        } catch (err) {
            alert('Gagal menghapus data.');
        }
    };

    const openEdit = (item) => {
        setEditMode(true);
        setSelectedId(item.id);
        if (activeTab === 'jurusan') {
            setJurusanForm({ kodeJurusan: item.kodeJurusan, namaJurusan: item.namaJurusan });
        } else if (activeTab === 'kelas') {
            setKelasForm({ tingkat: item.tingkat, namaKelas: item.namaKelas, jurusanId: item.jurusanId });
        } else {
            setMapelForm({ kodeMapel: item.kodeMapel, namaMapel: item.namaMapel });
        }
        setIsModalOpen(true);
    };

    const resetForms = () => {
        setJurusanForm({ kodeJurusan: '', namaJurusan: '' });
        setKelasForm({ tingkat: '', namaKelas: '', jurusanId: '' });
        setMapelForm({ kodeMapel: '', namaMapel: '' });
        setEditMode(false);
        setSelectedId(null);
    };

    // ---- Peserta Mapel Handlers ----
    const fetchPeserta = async (mapelId) => {
        setLoadingPeserta(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`/api/enrollment/siswa-mapel/mapel/${mapelId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPesertaList(res.data);
        } catch (err) {
            console.error('Failed to fetch peserta', err);
        } finally {
            setLoadingPeserta(false);
        }
    };

    const openPeserta = (mapel) => {
        setSelectedMapel(mapel);
        setImportKelasId('');
        setIsPesertaOpen(true);
        fetchPeserta(mapel.id);
    };

    const handleImportKelas = async () => {
        if (!importKelasId) { alert('Pilih kelas terlebih dahulu'); return; }
        setImporting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/enrollment/siswa-mapel/import-kelas',
                { mapelId: selectedMapel.id, kelasId: parseInt(importKelasId) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(res.data.message);
            fetchPeserta(selectedMapel.id);
            setImportKelasId('');
        } catch (err) {
            alert('Gagal import: ' + (err.response?.data?.message || err.message));
        } finally {
            setImporting(false);
        }
    };

    const handleRemovePeserta = async (enrollmentId) => {
        if (!window.confirm('Keluarkan siswa ini dari mata pelajaran?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/enrollment/siswa-mapel/${enrollmentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPeserta(selectedMapel.id);
        } catch (err) {
            alert('Gagal menghapus peserta.');
        }
    };

    // ---- Guru Pengampu Handlers ----

    const openPengampuModal = (guru) => {
        setSelectedGuru(guru);
        // Group current assignments by mapelId with multiple kelasIds
        const guruAssignments = pengampuData.filter(p => p.namaGuru === guru.namaLengkap);
        const grouped = {};
        guruAssignments.forEach(p => {
            if (!grouped[p.mapelId]) {
                grouped[p.mapelId] = { mapelId: p.mapelId, kelasIds: [] };
            }
            if (p.kelasId) grouped[p.mapelId].kelasIds.push(p.kelasId);
        });
        setAssignments(Object.values(grouped));
        setIsPengampuModalOpen(true);
    };

    const toggleMapelAssignment = (mapelId) => {
        setAssignments(prev => {
            const exists = prev.some(a => a.mapelId === mapelId);
            if (exists) {
                return prev.filter(a => a.mapelId !== mapelId);
            } else {
                return [...prev, { mapelId, kelasIds: [] }];
            }
        });
    };

    // Toggle a single kelas inside a mapel assignment
    const toggleKelasForMapel = (mapelId, kelasId) => {
        setAssignments(prev => prev.map(a => {
            if (a.mapelId !== mapelId) return a;
            const alreadySelected = a.kelasIds.includes(kelasId);
            return {
                ...a,
                kelasIds: alreadySelected
                    ? a.kelasIds.filter(k => k !== kelasId)
                    : [...a.kelasIds, kelasId]
            };
        }));
    };

    const handleSavePengampu = async (e) => {
        e.preventDefault();
        if (!selectedGuru) return;

        // Validate: every checked mapel must have at least 1 kelas
        const invalid = assignments.some(a => !a.kelasIds || a.kelasIds.length === 0);
        if (invalid) {
            alert('Harap pilih minimal 1 kelas untuk setiap mata pelajaran yang dipilih.');
            return;
        }

        setSavingPengampu(true);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        try {
            // Flatten: [{mapelId, kelasIds:[1,2]}] → [{mapelId, kelasId:1}, {mapelId, kelasId:2}]
            const flatAssignments = assignments.flatMap(a =>
                a.kelasIds.map(kelasId => ({ mapelId: a.mapelId, kelasId }))
            );

            await axios.put(`/api/users/${selectedGuru.id}/profile`, {
                namaLengkap: selectedGuru.namaLengkap,
                assignments: flatAssignments
            }, { headers });

            setIsPengampuModalOpen(false);
            setSelectedGuru(null);
            setAssignments([]);
            fetchData();
            alert('Data pengampu berhasil disimpan!');
        } catch (err) {
            alert('Gagal menyimpan: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingPengampu(false);
        }
    };

    const handleDeletePengampu = async (id) => {
        if (!window.confirm('Hapus assignment ini?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/enrollment/guru-mapel/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (err) {
            alert('Gagal menghapus assignment.');
        }
    };

    const filteredData = activeTab !== 'pengampu'
        ? data.filter(item => {
            const str = (item.namaJurusan || item.namaKelas || item.namaMapel || '').toLowerCase();
            return str.includes(searchTerm.toLowerCase());
        })
        : [];

    const filteredGuruList = guruList.filter(g =>
        (g.namaLengkap || g.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="master-data animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Data Master</h1>
                    <p>Kelola konfigurasi dasar sistem pendidikan</p>
                </div>
                {activeTab !== 'pengampu' && (
                    <button className="primary-btn" onClick={() => { resetForms(); setIsModalOpen(true); }}>
                        <Plus size={18} />
                        <span>Tambah {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
                    </button>
                )}
            </div>

            <div className="tab-navigation">
                <button className={activeTab === 'jurusan' ? 'active' : ''} onClick={() => setActiveTab('jurusan')}>
                    <Layers size={18} /> <span>Jurusan</span>
                </button>
                <button className={activeTab === 'kelas' ? 'active' : ''} onClick={() => setActiveTab('kelas')}>
                    <Trello size={18} /> <span>Kelas</span>
                </button>
                <button className={activeTab === 'mapel' ? 'active' : ''} onClick={() => setActiveTab('mapel')}>
                    <BookMarked size={18} /> <span>Mata Pelajaran</span>
                </button>
                <button className={activeTab === 'pengampu' ? 'active' : ''} onClick={() => setActiveTab('pengampu')}>
                    <UserCheck size={18} /> <span>Guru Pengampu</span>
                </button>
            </div>

            {/* === GURU PENGAMPU TAB === */}
            {activeTab === 'pengampu' ? (
                <div className="pengampu-view">
                    <div className="table-card">
                        <div className="table-actions">
                            <div className="search-box">
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Cari nama guru..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center" style={{ padding: 40 }}>Memuat data...</div>
                        ) : (
                            <div className="guru-grid">
                                {filteredGuruList.map(guru => {
                                    const guruAssignments = pengampuData.filter(p => p.namaGuru === guru.namaLengkap);
                                    return (
                                        <div key={guru.id} className="guru-card">
                                            <div className="guru-card-header">
                                                <div className="guru-avatar">
                                                    {(guru.namaLengkap || guru.username || 'G').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="guru-info">
                                                    <h4>{guru.namaLengkap || guru.username}</h4>
                                                    <p>{guru.email}</p>
                                                </div>
                                                <button
                                                    className="edit-pengampu-btn"
                                                    onClick={() => openPengampuModal(guru)}
                                                    title="Edit Pengampu"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            </div>

                                            <div className="pengampu-list">
                                                {guruAssignments.length === 0 ? (
                                                    <p className="no-assign">Belum ada assignment</p>
                                                ) : (
                                                    guruAssignments.map(p => (
                                                        <div key={p.id} className="pengampu-chip">
                                                            <span className="chip-mapel">{p.namaMapel}</span>
                                                            <span className="chip-kelas">{p.namaKelas || '-'}</span>
                                                            <button
                                                                className="chip-del"
                                                                onClick={() => handleDeletePengampu(p.id)}
                                                                title="Hapus"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredGuruList.length === 0 && (
                                    <div className="text-center" style={{ padding: 40, gridColumn: '1/-1' }}>
                                        Tidak ada guru ditemukan.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* === OTHER TABS === */
                <div className="table-card">
                    <div className="table-actions">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder={`Cari ${activeTab}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="master-table">
                            <thead>
                                {activeTab === 'jurusan' && (
                                    <tr>
                                        <th>Kode</th>
                                        <th>Nama Jurusan</th>
                                        <th>Aksi</th>
                                    </tr>
                                )}
                                {activeTab === 'kelas' && (
                                    <tr>
                                        <th>Tingkat</th>
                                        <th>Nama Kelas</th>
                                        <th>Jurusan</th>
                                        <th>Aksi</th>
                                    </tr>
                                )}
                                {activeTab === 'mapel' && (
                                    <tr>
                                        <th>Kode Mapel</th>
                                        <th>Mata Pelajaran</th>
                                        <th>Aksi</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" className="text-center">Memuat data...</td></tr>
                                ) : filteredData.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center">Data kosong. Silakan tambahkan data baru.</td></tr>
                                ) : (
                                    filteredData.map((item) => (
                                        <tr key={item.id}>
                                            {activeTab === 'jurusan' && (
                                                <>
                                                    <td><span className="code-badge">{item.kodeJurusan}</span></td>
                                                    <td><strong>{item.namaJurusan}</strong></td>
                                                </>
                                            )}
                                            {activeTab === 'kelas' && (
                                                <>
                                                    <td>{item.tingkat}</td>
                                                    <td><strong>{item.namaKelas}</strong></td>
                                                    <td>{item.namaJurusan}</td>
                                                </>
                                            )}
                                            {activeTab === 'mapel' && (
                                                <>
                                                    <td><span className="code-badge">{item.kodeMapel}</span></td>
                                                    <td><strong>{item.namaMapel}</strong></td>
                                                </>
                                            )}
                                            <td>
                                                <div className="action-btns">
                                                    {activeTab === 'mapel' && (
                                                        <button
                                                            className="peserta-btn"
                                                            onClick={() => openPeserta(item)}
                                                            title="Kelola Peserta"
                                                        >
                                                            <Users size={15} />
                                                            <span>Peserta</span>
                                                        </button>
                                                    )}
                                                    <button className="edit-btn" onClick={() => openEdit(item)}><Edit2 size={16} /></button>
                                                    <button className="delete-btn" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Peserta Mapel Modal */}
            {isPesertaOpen && selectedMapel && (
                <div className="modal-overlay">
                    <div className="modal-content animate-slide-up" style={{ maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <div>
                                <h3>Peserta Mapel</h3>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
                                    <span className="code-badge" style={{ marginRight: 8 }}>{selectedMapel.kodeMapel}</span>
                                    {selectedMapel.namaMapel}
                                </p>
                            </div>
                            <button className="icon-close" onClick={() => setIsPesertaOpen(false)}><X size={20} /></button>
                        </div>

                        {/* Import by Kelas */}
                        <div className="import-kelas-bar">
                            <div className="import-kelas-label">
                                <Download size={16} />
                                <span>Import Kelas:</span>
                            </div>
                            <select
                                className="import-kelas-select"
                                value={importKelasId}
                                onChange={e => setImportKelasId(e.target.value)}
                            >
                                <option value="">-- Pilih Kelas --</option>
                                {kelasForImport.map(k => (
                                    <option key={k.id} value={k.id}>{k.tingkat} - {k.namaKelas}</option>
                                ))}
                            </select>
                            <button
                                className="import-btn"
                                onClick={handleImportKelas}
                                disabled={importing || !importKelasId}
                            >
                                <UserPlus size={15} />
                                {importing ? 'Mengimport...' : 'Import'}
                            </button>
                        </div>

                        {/* Student List */}
                        <div className="peserta-list-container">
                            {loadingPeserta ? (
                                <div className="peserta-empty">Memuat data peserta...</div>
                            ) : pesertaList.length === 0 ? (
                                <div className="peserta-empty">
                                    <Users size={40} style={{ opacity: 0.2, marginBottom: 8 }} />
                                    <p>Belum ada peserta. Import kelas untuk menambahkan siswa.</p>
                                </div>
                            ) : (() => {
                                // Group pesertaList by namaKelas
                                const grouped = {};
                                pesertaList.forEach(p => {
                                    const key = p.namaKelas || 'Tanpa Kelas';
                                    if (!grouped[key]) grouped[key] = [];
                                    grouped[key].push(p);
                                });
                                const kelasSorted = Object.keys(grouped).sort();
                                let globalIdx = 0;
                                return (
                                    <>
                                        <div className="peserta-count">
                                            {pesertaList.length} siswa terdaftar — {kelasSorted.length} kelas
                                        </div>
                                        {kelasSorted.map(kelasName => {
                                            const siswaInKelas = grouped[kelasName];
                                            return (
                                                <div key={kelasName} className="kelas-section">
                                                    <div className="kelas-section-header">
                                                        <div className="kelas-section-title">
                                                            <Trello size={14} />
                                                            <span>{kelasName}</span>
                                                        </div>
                                                        <span className="kelas-siswa-count">{siswaInKelas.length} siswa</span>
                                                    </div>
                                                    <table className="peserta-table">
                                                        <thead>
                                                            <tr>
                                                                <th>#</th>
                                                                <th>Nama Siswa</th>
                                                                <th>NISN</th>
                                                                <th>Aksi</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {siswaInKelas.map((p) => {
                                                                globalIdx++;
                                                                const no = globalIdx;
                                                                return (
                                                                    <tr key={p.id}>
                                                                        <td style={{ color: '#94a3b8', width: 36 }}>{no}</td>
                                                                        <td><strong>{p.namaSiswa}</strong></td>
                                                                        <td>
                                                                            <span className="code-badge" style={{ fontSize: '0.73rem' }}>
                                                                                {p.nisn || '-'}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <button
                                                                                className="remove-peserta-btn"
                                                                                onClick={() => handleRemovePeserta(p.id)}
                                                                                title="Keluarkan dari mapel"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })}
                                    </>
                                );
                            })()}

                        </div>

                        <div className="modal-footer" style={{ marginTop: 16 }}>
                            <button className="btn-secondary" onClick={() => setIsPesertaOpen(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Modal for jurusan/kelas/mapel */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content animate-slide-up">
                        <div className="modal-header">
                            <h3>{editMode ? 'Edit' : 'Tambah'} {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
                            <button className="icon-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            {activeTab === 'jurusan' && (
                                <>
                                    <div className="form-group">
                                        <label>Kode Jurusan</label>
                                        <input
                                            type="text"
                                            value={jurusanForm.kodeJurusan}
                                            onChange={(e) => setJurusanForm({ ...jurusanForm, kodeJurusan: e.target.value })}
                                            placeholder="Contoh: RPL" required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Nama Jurusan</label>
                                        <input
                                            type="text"
                                            value={jurusanForm.namaJurusan}
                                            onChange={(e) => setJurusanForm({ ...jurusanForm, namaJurusan: e.target.value })}
                                            placeholder="Contoh: Rekayasa Perangkat Lunak" required
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'kelas' && (
                                <>
                                    <div className="form-group">
                                        <label>Tingkat</label>
                                        <select value={kelasForm.tingkat} onChange={(e) => setKelasForm({ ...kelasForm, tingkat: e.target.value })} required>
                                            <option value="">-- Pilih Tingkat --</option>
                                            <option value="X">X</option>
                                            <option value="XI">XI</option>
                                            <option value="XII">XII</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Nama Kelas</label>
                                        <input
                                            type="text"
                                            value={kelasForm.namaKelas}
                                            onChange={(e) => setKelasForm({ ...kelasForm, namaKelas: e.target.value })}
                                            placeholder="Contoh: X RPL 1" required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Jurusan</label>
                                        <select value={kelasForm.jurusanId} onChange={(e) => setKelasForm({ ...kelasForm, jurusanId: e.target.value })} required>
                                            <option value="">-- Pilih Jurusan --</option>
                                            {jurusans.map(j => (
                                                <option key={j.id} value={j.id}>{j.namaJurusan}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {activeTab === 'mapel' && (
                                <>
                                    <div className="form-group">
                                        <label>Kode Mapel</label>
                                        <input
                                            type="text"
                                            value={mapelForm.kodeMapel}
                                            onChange={(e) => setMapelForm({ ...mapelForm, kodeMapel: e.target.value })}
                                            placeholder="Contoh: BIND" required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Nama Mata Pelajaran</label>
                                        <input
                                            type="text"
                                            value={mapelForm.namaMapel}
                                            onChange={(e) => setMapelForm({ ...mapelForm, namaMapel: e.target.value })}
                                            placeholder="Contoh: Bahasa Indonesia" required
                                        />
                                    </div>
                                </>
                            )}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
                                <button type="submit" className="primary-btn">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Guru Pengampu Modal */}
            {isPengampuModalOpen && selectedGuru && (
                <div className="modal-overlay">
                    <div className="modal-content animate-slide-up" style={{ maxWidth: 620 }}>
                        <div className="modal-header">
                            <div>
                                <h3>Atur Pengampu</h3>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
                                    {selectedGuru.namaLengkap} — {selectedGuru.email}
                                </p>
                            </div>
                            <button className="icon-close" onClick={() => setIsPengampuModalOpen(false)}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSavePengampu}>
                            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: 12 }}>
                                Centang mata pelajaran, lalu centang kelas yang diampu (bisa lebih dari 1):
                            </p>
                            <div className="mapel-assignment-list">
                                {mapelList.map(m => {
                                    const assignedEntry = assignments.find(a => a.mapelId === m.id);
                                    const isChecked = !!assignedEntry;
                                    return (
                                        <div key={m.id} className={`mapel-block ${isChecked ? 'active' : ''}`}>
                                            {/* Mapel header row */}
                                            <div className="mapel-info" onClick={() => toggleMapelAssignment(m.id)}>
                                                <div className={`checkbox-custom ${isChecked ? 'checked' : ''}`}></div>
                                                <span className="mapel-label">{m.namaMapel}</span>
                                                {isChecked && assignedEntry.kelasIds.length > 0 && (
                                                    <span className="kelas-count-badge">{assignedEntry.kelasIds.length} kelas</span>
                                                )}
                                            </div>

                                            {/* Multi-kelas checkboxes shown when mapel is checked */}
                                            {isChecked && (
                                                <div className="kelas-checkbox-grid">
                                                    {kelasList.map(k => {
                                                        const kelasSelected = assignedEntry.kelasIds.includes(k.id);
                                                        return (
                                                            <div
                                                                key={k.id}
                                                                className={`kelas-chip-check ${kelasSelected ? 'selected' : ''}`}
                                                                onClick={() => toggleKelasForMapel(m.id, k.id)}
                                                            >
                                                                <div className={`checkbox-sm ${kelasSelected ? 'checked' : ''}`}></div>
                                                                <span>{k.namaKelas}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsPengampuModalOpen(false)}>Batal</button>
                                <button type="submit" className="primary-btn" disabled={savingPengampu}>
                                    <CheckCircle2 size={16} />
                                    {savingPengampu ? 'Menyimpan...' : 'Simpan Pengampu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .master-data { animation: fadeIn 0.5s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
                .page-header h1 { font-size: 1.8rem; color: #1e293b; margin: 0; font-weight: 700; }
                .page-header p { color: #64748b; margin: 4px 0 0 0; }

                .primary-btn { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 6px -1px rgba(59,130,246,0.3); }
                .primary-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 12px -2px rgba(59,130,246,0.4); }
                .primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }

                .tab-navigation { display: flex; gap: 8px; margin-bottom: 24px; background: #f8fafc; padding: 6px; border-radius: 14px; width: fit-content; border: 1px solid #e2e8f0; flex-wrap: wrap; }
                .tab-navigation button { display: flex; align-items: center; gap: 10px; padding: 10px 24px; border-radius: 10px; border: none; background: transparent; color: #64748b; font-weight: 600; cursor: pointer; transition: all 0.2s cubic-bezier(0.4,0,0.2,1); font-size: 0.95rem; }
                .tab-navigation button.active { background: white; color: #3b82f6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .tab-navigation button:hover:not(.active) { background: #f1f5f9; color: #1e293b; }

                .table-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05); overflow: hidden; }
                .table-actions { padding: 20px; border-bottom: 1px solid #f1f5f9; background: #ffffff; }
                .search-box { position: relative; max-width: 400px; }
                .search-box svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .search-box input { width: 100%; padding: 10px 14px 10px 42px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.9rem; outline: none; transition: all 0.2s; }
                .search-box input:focus { background: white; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

                .table-responsive { width: 100%; overflow-x: auto; }
                .master-table { width: 100%; border-collapse: collapse; text-align: left; }
                .master-table th { padding: 16px 24px; background: #f8fafc; color: #64748b; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .master-table td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 0.95rem; }
                .master-table tr:last-child td { border-bottom: none; }
                .master-table tr:hover td { background: #fbfcfe; }

                .code-badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 0.8rem; }
                .action-btns { display: flex; gap: 10px; }
                .action-btns button { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; transition: all 0.2s; }
                .edit-btn { background: #eff6ff; color: #3b82f6; }
                .delete-btn { background: #fee2e2; color: #ef4444; }
                .edit-btn:hover { background: #3b82f6; color: white; transform: scale(1.05); }
                .delete-btn:hover { background: #ef4444; color: white; transform: scale(1.05); }

                /* Guru Pengampu Grid */
                .guru-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; padding: 20px; }
                .guru-card { border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; transition: all 0.2s; background: white; }
                .guru-card:hover { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.1); }
                .guru-card-header { display: flex; align-items: center; gap: 12px; padding: 16px; background: #f8fafc; }
                .guru-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; flex-shrink: 0; }
                .guru-info { flex: 1; min-width: 0; }
                .guru-info h4 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .guru-info p { margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .edit-pengampu-btn { background: #eff6ff; border: none; color: #3b82f6; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
                .edit-pengampu-btn:hover { background: #3b82f6; color: white; }
                .pengampu-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
                .no-assign { color: #94a3b8; font-size: 0.85rem; font-style: italic; margin: 10px 0; }
                .pengampu-chip { display: flex; align-items: center; gap: 6px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 6px 10px; }
                .chip-mapel { font-weight: 700; color: #0369a1; font-size: 0.85rem; flex: 1; }
                .chip-kelas { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 50px; font-size: 0.75rem; font-weight: 600; }
                .chip-del { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 2px; display: flex; align-items: center; }
                .chip-del:hover { color: #ef4444; }

                /* Modal Styles */
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
                .modal-content { background: white; width: 100%; max-width: 500px; border-radius: 20px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position: relative; }
                .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
                .modal-header h3 { margin: 0; font-size: 1.4rem; color: #1e293b; font-weight: 700; }
                .icon-close { background: #f1f5f9; border: none; color: #64748b; cursor: pointer; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .icon-close:hover { background: #fee2e2; color: #ef4444; }

                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: #475569; }
                .form-group input, .form-group select { width: 100%; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem; transition: all 0.2s; background: #f8fafc; }
                .form-group input:focus, .form-group select:focus { outline: none; border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }

                .mapel-assignment-list { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; max-height: 340px; overflow-y: auto; padding: 8px; margin-bottom: 4px; }

                /* New multi-kelas block style */
                .mapel-block { border-radius: 10px; transition: all 0.2s; margin-bottom: 6px; border: 1px solid transparent; overflow: hidden; }
                .mapel-block.active { background: #eff6ff; border-color: #dbeafe; }
                .mapel-block:not(.active):hover { background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .mapel-info { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 12px; }
                .mapel-label { font-weight: 600; color: #1e293b; font-size: 0.9rem; flex: 1; }
                .kelas-count-badge { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 50px; font-size: 0.72rem; font-weight: 700; }
                .checkbox-custom { width: 18px; height: 18px; border: 2px solid #cbd5e1; border-radius: 4px; position: relative; transition: all 0.2s; flex-shrink: 0; }
                .checkbox-custom.checked { background: #3b82f6; border-color: #3b82f6; }
                .checkbox-custom.checked::after { content: '✓'; position: absolute; color: white; font-size: 12px; top: 50%; left: 50%; transform: translate(-50%, -50%); }

                /* Kelas multi-select grid */
                .kelas-checkbox-grid { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 12px 40px; }
                .kelas-chip-check { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 0.8rem; font-weight: 500; color: #475569; transition: all 0.15s; user-select: none; }
                .kelas-chip-check:hover { border-color: #3b82f6; color: #1d4ed8; background: #eff6ff; }
                .kelas-chip-check.selected { background: #dbeafe; border-color: #3b82f6; color: #1d4ed8; font-weight: 700; }
                .checkbox-sm { width: 14px; height: 14px; border: 1.5px solid #cbd5e1; border-radius: 3px; position: relative; transition: all 0.15s; flex-shrink: 0; }
                .checkbox-sm.checked { background: #3b82f6; border-color: #3b82f6; }
                .checkbox-sm.checked::after { content: '✓'; position: absolute; color: white; font-size: 9px; top: 50%; left: 50%; transform: translate(-50%, -50%); }

                /* Old single-select (kept for backward compatibility) */
                .mapel-assignment-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; transition: all 0.2s; margin-bottom: 4px; }
                .mapel-assignment-row.active { background: #eff6ff; border: 1px solid #dbeafe; }
                .kelas-mini-select { width: 150px; padding: 4px 8px; font-size: 0.8rem; border: 1px solid #3b82f6; border-radius: 6px; background: white; outline: none; }


                .modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
                .btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .btn-secondary:hover { background: #e2e8f0; color: #1e293b; }

                .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .text-center { text-align: center; color: #94a3b8; padding: 40px !important; }

                /* Peserta Mapel */
                .peserta-btn { display: flex; align-items: center; gap: 5px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 5px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .peserta-btn:hover { background: #16a34a; color: white; border-color: #16a34a; }
                .import-kelas-bar { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; flex-wrap: wrap; }
                .import-kelas-label { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #475569; font-size: 0.875rem; white-space: nowrap; }
                .import-kelas-select { flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; background: white; outline: none; cursor: pointer; }
                .import-kelas-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
                .import-btn { display: flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .import-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
                .import-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                .peserta-list-container { flex: 1; overflow-y: auto; min-height: 0; }
                .peserta-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: #94a3b8; text-align: center; }
                .peserta-count { font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 12px; }
                .kelas-section { margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                .kelas-section-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: linear-gradient(135deg, #eff6ff, #f0f9ff); border-bottom: 1px solid #dbeafe; }
                .kelas-section-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1e40af; font-size: 0.875rem; }
                .kelas-siswa-count { background: #3b82f6; color: white; padding: 2px 10px; border-radius: 50px; font-size: 0.75rem; font-weight: 700; }

                .peserta-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
                .peserta-table th { padding: 10px 14px; background: #f8fafc; color: #64748b; font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; }
                .peserta-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
                .peserta-table tr:last-child td { border-bottom: none; }
                .peserta-table tr:hover td { background: #fbfcfe; }
                .remove-peserta-btn { width: 28px; height: 28px; border-radius: 6px; background: #fee2e2; color: #ef4444; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
                .remove-peserta-btn:hover { background: #ef4444; color: white; transform: scale(1.05); }
            `}</style>

        </div>
    );
};

export default MasterData;
