import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    MessageSquare,
    Send,
    Plus,
    Trash2,
    MessageCircle,
    User,
    Calendar,
    ChevronLeft,
    Search,
    BookOpen,
    Pin as PinIcon,
    PinOff as PinOffIcon,
    Lock,
    LockOpen,
    Sparkles,
    Brain,
    X,
    Trophy,
    Activity,
    Save,
    RefreshCw
} from 'lucide-react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import './ForumDiscussion.css';

const ForumDiscussion = () => {
    const [view, setView] = useState('topics'); // 'topics' or 'chat'
    const [topics, setTopics] = useState([]);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTopic, setNewTopic] = useState({ judul: '', konten: '', guruMapelId: '', isPinned: false });
    const [guruMapels, setGuruMapels] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [typingUsers, setTypingUsers] = useState({}); // {userId: {name, timestamp}}
    const [analysis, setAnalysis] = useState(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [savingAnalysis, setSavingAnalysis] = useState(false);
    const [analyzingTopicId, setAnalyzingTopicId] = useState(null);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const stompClientRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const chatEndRef = useRef(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (view === 'chat' && selectedTopic) {
            scrollToBottom();
            connectWebSocket(selectedTopic.id);
        } else {
            disconnectWebSocket();
        }
        return () => disconnectWebSocket();
    }, [view, selectedTopic?.id]);

    useEffect(() => {
        if (view === 'chat') {
            scrollToBottom();
        }
    }, [comments]);

    const connectWebSocket = (topicId) => {
        const socket = new SockJS('/ws-forum');
        const client = Stomp.over(socket);
        client.debug = (str) => console.log('STOMP:', str); // Enable debug for troubleshooting

        client.connect({ Authorization: `Bearer ${token}` }, (frame) => {
            console.log('STOMP Connected:', frame);
            stompClientRef.current = client;
            client.subscribe(`/topic/forum/${topicId}`, (message) => {
                const wsMsg = JSON.parse(message.body);
                console.log('WS Message Received:', wsMsg);
                handleWSMessage(wsMsg);
            });
        }, (err) => {
            console.error('WebSocket connection error:', err);
        });
    };

    const disconnectWebSocket = () => {
        if (stompClientRef.current) {
            stompClientRef.current.disconnect();
            stompClientRef.current = null;
        }
        setTypingUsers({});
    };

    const handleWSMessage = (msg) => {
        if (msg.type === 'COMMENT') {
            // Only add if not already in list (avoid duplication if we are the sender)
            setComments(prev => {
                if (prev.some(c => c.id === msg.data.id)) return prev;
                return [...prev, msg.data];
            });
            // Also update topic list comment count
            setTopics(prev => prev.map(t =>
                t.id === msg.topikId ? { ...t, jumlahKomentar: (t.jumlahKomentar || 0) + 1 } : t
            ));
        } else if (msg.type === 'TYPING') {
            if (msg.userId === user.userId) return;

            setTypingUsers(prev => {
                const next = { ...prev };
                if (msg.data === true) {
                    next[msg.userId] = { name: msg.namaUser, timestamp: Date.now() };
                } else {
                    delete next[msg.userId];
                }
                return next;
            });
        } else if (msg.type === 'CLOSED_CHANGE') {
            setTopics(prev => prev.map(t => t.id === msg.topikId ? msg.data : t));
            if (selectedTopic?.id === msg.topikId) {
                setSelectedTopic(msg.data);
            }
        }
    };

    // Auto-cleanup typing users who haven't updated in 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => {
                const next = { ...prev };
                let changed = false;
                Object.keys(next).forEach(id => {
                    if (now - next[id].timestamp > 10000) {
                        delete next[id];
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleTyping = () => {
        if (!stompClientRef.current || !selectedTopic) return;

        // Send typing START if not already timed out
        if (!typingTimeoutRef.current) {
            stompClientRef.current.send("/app/forum/typing", {}, JSON.stringify({
                type: 'TYPING',
                topikId: selectedTopic.id,
                userId: user.userId,
                namaUser: user.name,
                data: true
            }));
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // Set timeout to send typing STOP
        typingTimeoutRef.current = setTimeout(() => {
            if (stompClientRef.current) {
                stompClientRef.current.send("/app/forum/typing", {}, JSON.stringify({
                    type: 'TYPING',
                    topikId: selectedTopic.id,
                    userId: user.userId,
                    namaUser: user.name,
                    data: false
                }));
            }
            typingTimeoutRef.current = null;
        }, 3000);
    };

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            if (user.role === 'GURU') {
                // Fetch topics for teacher based on their subjects
                const gmRes = await axios.get('/api/enrollment/guru-mapel/my', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setGuruMapels(gmRes.data);

                // For teacher, fetch all topics from all their subjects
                const allTopics = [];
                for (const gm of gmRes.data) {
                    const tRes = await axios.get(`/api/forum/topik/guru-mapel/${gm.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    allTopics.push(...tRes.data);
                }
                setTopics(allTopics.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } else if (user.role === 'SISWA' && user.kelasId) {
                // Fetch topics for student based on their class
                const tRes = await axios.get(`/api/forum/topik/kelas/${user.kelasId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTopics(tRes.data);
            }
        } catch (err) {
            console.error('Failed to fetch forum data', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async (topicId) => {
        try {
            const res = await axios.get(`/api/forum/topik/${topicId}/komentar`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments(res.data);
        } catch (err) {
            console.error('Failed to fetch comments', err);
        }
    };

    const handleSelectTopic = (topic) => {
        setSelectedTopic(topic);
        setComments([]);
        fetchComments(topic.id);
        setView('chat');
    };

    const handlePostComment = async () => {
        if (!newComment.trim()) return;
        try {
            const res = await axios.post('/api/forum/komentar', {
                topikId: selectedTopic.id,
                userId: user.userId,
                isiKomentar: newComment
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments([...comments, res.data]);
            setNewComment('');
        } catch (err) {
            console.error('Failed to post comment', err);
        }
    };

    const handleCreateTopic = async () => {
        if (!newTopic.judul || !newTopic.konten || !newTopic.guruMapelId) return;
        try {
            const res = await axios.post('/api/forum/topik', newTopic, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTopics([res.data, ...topics]);
            setShowCreateModal(false);
            setNewTopic({ judul: '', konten: '', guruMapelId: '', isPinned: false });
        } catch (err) {
            console.error('Failed to create topic', err);
        }
    };

    const handleTogglePin = async (id, e) => {
        e.stopPropagation();
        try {
            const res = await axios.put(`/api/forum/topik/${id}/pin`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update the topic in the list and re-sort (pinned first, then date)
            const updatedTopics = topics.map(t => t.id === id ? res.data : t);
            setTopics(updatedTopics.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            }));
        } catch (err) {
            console.error('Failed to toggle pin', err);
        }
    };

    const handleToggleClosed = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const res = await axios.put(`/api/forum/topik/${id}/close`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update local state is handled via WebSocket message "CLOSED_CHANGE"
            // But we can also update locally for immediate feedback if needed
            const updated = topics.map(t => t.id === id ? res.data : t);
            setTopics(updated);
            if (selectedTopic?.id === id) setSelectedTopic(res.data);
        } catch (err) {
            console.error('Failed to toggle closed status', err);
        }
    };

    const handleDeleteTopic = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Hapus topik ini beserta semua komentarnya?')) return;
        try {
            await axios.delete(`/api/forum/topik/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTopics(topics.filter(t => t.id !== id));
            if (selectedTopic?.id === id) setView('topics');
        } catch (err) {
            console.error('Failed to delete topic', err);
        }
    };

    const handleGetAnalysis = async (id) => {
        setLoadingAnalysis(true);
        setAnalyzingTopicId(id);
        setShowAnalysisModal(true);
        try {
            const res = await axios.get(`/api/forum/topik/${id}/analysis`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAnalysis(res.data);
        } catch (err) {
            console.error('Failed to get analysis', err);
            alert(err.response?.data?.message || 'Gagal mengambil analisis AI');
            setShowAnalysisModal(false);
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const handleRefreshAnalysis = async (id) => {
        setLoadingAnalysis(true);
        setAnalyzingTopicId(id);
        try {
            const res = await axios.get(`/api/forum/topik/${id}/analysis/force`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAnalysis(res.data);
            alert('Analisis telah diperbarui!');
        } catch (err) {
            console.error('Failed to refresh analysis', err);
            alert('Gagal memperbarui analisis AI');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const handleSaveAnalysis = async (id) => {
        if (!analysis) return;
        setSavingAnalysis(true);
        try {
            const res = await axios.post(`/api/forum/topik/${id}/analysis/save`, analysis, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Analisis berhasil disimpan ke BaknusDrive!');
        } catch (err) {
            console.error('Failed to save analysis', err);
            alert('Gagal menyimpan analisis ke BaknusDrive');
        } finally {
            setSavingAnalysis(false);
        }
    };

    const filteredTopics = topics.filter(t =>
        t.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.namaMapel.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && topics.length === 0) {
        return <div className="forum-loading">Memuat Forum Diskusi...</div>;
    }

    return (
        <div className="forum-container animate-fade-in">
            <div className="forum-header">
                <div className="header-info">
                    <h1>Forum Diskusi</h1>
                    <p>Diskusikan materi pelajaran dengan guru dan teman sekelas</p>
                </div>
                {user.role === 'GURU' && view === 'topics' && (
                    <button className="create-topic-btn" onClick={() => setShowCreateModal(true)}>
                        <Plus size={20} />
                        <span>Buat Topik Baru</span>
                    </button>
                )}
            </div>

            {view === 'topics' ? (
                <div className="topics-layout">
                    <div className="search-bar-forum">
                        <Search size={20} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Cari topik atau mata pelajaran..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="topics-grid">
                        {filteredTopics.length > 0 ? filteredTopics.map(topic => (
                            <div key={topic.id} className={`topic-card ${topic.isPinned ? 'pinned' : ''}`} onClick={() => handleSelectTopic(topic)}>
                                <div className="topic-card-header">
                                    <div className="topic-badge">{topic.namaMapel}</div>
                                    <div className="topic-header-badges">
                                        {topic.isPinned && <div className="pinned-badge"><PinIcon size={12} fill="currentColor" /> TERSEMAT</div>}
                                        {topic.isClosed && <div className="closed-badge"><Lock size={12} /> DITUTUP</div>}
                                    </div>
                                </div>
                                <h3>{topic.judul}</h3>
                                <p className="topic-preview">{topic.konten}</p>
                                <div className="topic-footer">
                                    <div className="topic-meta">
                                        <User size={14} />
                                        <span>{topic.namaGuru}</span>
                                    </div>
                                    <div className="topic-stats">
                                        <MessageCircle size={14} />
                                        <span>{topic.jumlahKomentar || 0}</span>
                                    </div>
                                    {user.role === 'GURU' && (
                                        <div className="topic-actions">
                                            <button
                                                className={`pin-toggle-btn ${topic.isPinned ? 'active' : ''}`}
                                                onClick={(e) => handleTogglePin(topic.id, e)}
                                                title={topic.isPinned ? "Lepas Sematan" : "Sematkan Topik"}
                                            >
                                                {topic.isPinned ? <PinOffIcon size={14} /> : <PinIcon size={14} />}
                                            </button>
                                            <button
                                                className={`close-toggle-btn ${topic.isClosed ? 'active' : ''}`}
                                                onClick={(e) => handleToggleClosed(topic.id, e)}
                                                title={topic.isClosed ? "Buka Diskusi" : "Tutup Diskusi"}
                                            >
                                                {topic.isClosed ? <LockOpen size={14} /> : <Lock size={14} />}
                                            </button>
                                            <button className="delete-topic-btn" onClick={(e) => handleDeleteTopic(topic.id, e)} title="Hapus Topik">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {
                                    user.role === 'GURU' && (
                                        <div className="topic-ai-teaser" onClick={(e) => { e.stopPropagation(); handleGetAnalysis(topic.id); }}>
                                            <div className="ai-teaser-content">
                                                <div className="ai-sparkle-group">
                                                    <Sparkles size={16} className="sparkle-primary" />
                                                    <Brain size={16} className="brain-secondary" />
                                                </div>
                                                <div className="ai-teaser-text">
                                                    <span className="ai-label">BaknusAI Insights</span>
                                                    <span className="ai-cta">Lihat Analisis Diskusi & Kontribusi</span>
                                                </div>
                                            </div>
                                            {topic.jumlahKomentar > 0 && (
                                                <div className="ai-status-badge">
                                                    <Activity size={12} />
                                                    <span>Analisis Tersedia</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                }
                            </div>
                        )) : (
                            <div className="no-topics">
                                <MessageSquare size={48} />
                                <p>Belum ada topik diskusi untuk saat ini.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="chat-container-forum">
                    <div className="chat-header">
                        <button className="back-btn" onClick={() => setView('topics')}>
                            <ChevronLeft size={24} />
                        </button>
                        <div className="chat-topic-info">
                            <span className="chat-badge">{selectedTopic.namaMapel}</span>
                            <h2>{selectedTopic.judul}</h2>
                        </div>
                    </div>

                    <div className="chat-topic-description">
                        <div className="original-post">
                            <div className="message-user">
                                <div className="user-initials guru">G</div>
                                <div className="message-details">
                                    <span className="user-name">{selectedTopic.namaGuru}</span>
                                    <span className="user-role">Moderator</span>
                                </div>
                            </div>
                            <div className="message-content original">
                                {selectedTopic.konten}
                            </div>
                            <div className="message-time">
                                {new Date(selectedTopic.createdAt).toLocaleString('id-ID')}
                            </div>
                        </div>
                    </div>

                    <div className="chat-messages">
                        <div className="messages-divider"><span>Komentar</span></div>

                        {comments.map(comment => (
                            <div key={comment.id} className={`message-bubble ${comment.userId === user.userId ? 'own' : ''}`}>
                                <div className={`message-user ${comment.userId === user.userId ? 'rtl' : ''}`}>
                                    <div className={`user-initials ${comment.roleUser.toLowerCase()}`}>
                                        {comment.namaUser.charAt(0)}
                                    </div>
                                    <div className="message-details">
                                        <span className="user-name">{comment.namaUser}</span>
                                        <span className="user-role">{comment.roleUser}</span>
                                    </div>
                                </div>
                                <div className="message-content">
                                    {comment.isiKomentar}
                                </div>
                                <div className="message-time">
                                    {new Date(comment.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                        {Object.values(typingUsers).length > 0 && !selectedTopic.isClosed && (
                            <div className="typing-indicator-wrapper">
                                <div className="typing-bubbles">
                                    <span></span><span></span><span></span>
                                </div>
                                <span className="typing-text">
                                    <strong>{Object.values(typingUsers).map(u => u.name).join(', ')}</strong> sedang mengetik...
                                </span>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {selectedTopic.isClosed ? (
                        <div className="chat-closed-notice">
                            <Lock size={18} />
                            <span>Diskusi ini telah ditutup oleh Guru.</span>
                        </div>
                    ) : (
                        <div className="chat-input-area">
                            <textarea
                                placeholder="Tulis tanggapan Anda..."
                                value={newComment}
                                onChange={(e) => {
                                    setNewComment(e.target.value);
                                    handleTyping();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handlePostComment();
                                    }
                                }}
                            />
                            <button className="send-btn" onClick={handlePostComment} disabled={!newComment.trim()}>
                                <Send size={20} />
                            </button>
                        </div>
                    )}
                </div>
            )
            }

            {
                showCreateModal && (
                    <div className="modal-overlay">
                        <div className="modal-content-forum">
                            <h2>Buat Topik Diskusi Baru</h2>
                            <div className="form-group-forum">
                                <label>Pilih Mata Pelajaran & Kelas</label>
                                <select
                                    value={newTopic.guruMapelId}
                                    onChange={(e) => setNewTopic({ ...newTopic, guruMapelId: e.target.value })}
                                >
                                    <option value="">-- Pilih --</option>
                                    {guruMapels.map(gm => (
                                        <option key={gm.id} value={gm.id}>
                                            {gm.namaMapel} - {gm.namaKelas || 'Semua'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group-forum">
                                <label>Judul Diskusi</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Diskusi Bab 1 Eksponen"
                                    value={newTopic.judul}
                                    onChange={(e) => setNewTopic({ ...newTopic, judul: e.target.value })}
                                />
                            </div>
                            <div className="form-group-forum">
                                <label>Pesan Pemantik / Konten</label>
                                <textarea
                                    placeholder="Tuliskan pertanyaan atau pengantar diskusi..."
                                    value={newTopic.konten}
                                    onChange={(e) => setNewTopic({ ...newTopic, konten: e.target.value })}
                                />
                            </div>
                            <div className="form-group-forum pin-toggle">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        checked={newTopic.isPinned}
                                        onChange={(e) => setNewTopic({ ...newTopic, isPinned: e.target.checked })}
                                    />
                                    <span className="checkmark"></span>
                                    <span className="label-text">Sematkan Topik (Pin to Top)</span>
                                </label>
                            </div>
                            <div className="modal-actions-forum">
                                <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>Batal</button>
                                <button className="confirm-btn" onClick={handleCreateTopic}>Terbitkan</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                showAnalysisModal && (
                    <div className="analysis-modal-overlay" onClick={() => setShowAnalysisModal(false)}>
                        <div className="analysis-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="analysis-header">
                                <div className="analysis-title">
                                    <Sparkles className="sparkles-icon" size={24} />
                                    <h2>Analisis BaknusAI</h2>
                                </div>
                                <button className="close-modal" onClick={() => setShowAnalysisModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            {loadingAnalysis ? (
                                <div className="analysis-loading">
                                    <div className="loading-dots">
                                        <span></span><span></span><span></span>
                                    </div>
                                    <p>BaknusAI sedang membaca seluruh diskusi...</p>
                                </div>
                            ) : analysis && (
                                <div className="analysis-body">
                                    <div className="analysis-action-bar animate-fade-in">
                                        <button
                                            className="refresh-analysis-btn"
                                            onClick={() => handleRefreshAnalysis(analyzingTopicId || selectedTopic?.id || analysis?.topikId)}
                                            disabled={loadingAnalysis}
                                            title="Perbarui Analisis (Sesuai Komentar Terbaru)"
                                        >
                                            <RefreshCw size={18} className={loadingAnalysis ? 'spin' : ''} />
                                            <span>Perbarui</span>
                                        </button>
                                        <button
                                            className="save-drive-btn"
                                            onClick={() => handleSaveAnalysis(analyzingTopicId || selectedTopic?.id || analysis?.topikId)}
                                            disabled={savingAnalysis}
                                        >
                                            <Save size={18} />
                                            <span>{savingAnalysis ? 'Menyimpan...' : 'Simpan ke BaknusDrive'}</span>
                                        </button>
                                    </div>
                                    <div className="analysis-section summary-section animate-slide-up">
                                        <div className="section-title">
                                            <Brain size={20} />
                                            <h3>Ikhtisar Diskusi</h3>
                                        </div>
                                        <div className="summary-card">
                                            {analysis.ringkasan}
                                        </div>
                                    </div>

                                    <div className="analysis-grid-results">
                                        <div className="analysis-section active-users-section animate-slide-up" style={{ animationDelay: '0.1s' }}>
                                            <div className="section-title">
                                                <Activity size={20} />
                                                <h3>Siswa Paling Aktif</h3>
                                            </div>
                                            <div className="active-users-list">
                                                {analysis.userPalingAktif.map((u, i) => (
                                                    <div key={i} className="active-user-item">
                                                        <span className="user-name">{u.nama}</span>
                                                        <span className="msg-count">{u.jumlahPesan} Pesan</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="analysis-section top-contributors-section animate-slide-up" style={{ animationDelay: '0.2s' }}>
                                            <div className="section-title">
                                                <Trophy size={20} />
                                                <h3>Kontributor Terbaik</h3>
                                            </div>
                                            <div className="contributors-list">
                                                {analysis.kontributorTerbaik.map((u, i) => (
                                                    <div key={i} className="contributor-item">
                                                        <div className="contributor-info-top">
                                                            <span className="user-name">{u.nama}</span>
                                                            <Trophy size={14} className="trophy-icon" />
                                                        </div>
                                                        <p className="contributor-reason">{u.alasan}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ForumDiscussion;
