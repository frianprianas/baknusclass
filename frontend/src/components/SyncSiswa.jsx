import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Terminal, RefreshCw, Zap, AlertTriangle } from 'lucide-react';

const SyncSiswa = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, syncing, complete, error
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ success: 0, failed: 0 });
  
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { text: msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setProgress(0);
      setTotal(0);
      setLogs([]);
      setStats({ success: 0, failed: 0 });
    }
  };

  const handleSync = async () => {
    if (!file) {
      alert("Pilih file CSV terlebih dahulu.");
      return;
    }

    setStatus('uploading');
    addLog("Mengunggah file CSV...", 'info');
    
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem('token');

    try {
      const uploadRes = await axios.post('/api/master/sync-siswa/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const { jobId, totalLines } = uploadRes.data;
      
      setStatus('syncing');
      setTotal(totalLines);
      addLog(`Upload berhasil. ID Sinkron: ${jobId}`, 'success');
      addLog(`Total data yang akan disinkron: ${totalLines} baris. Memulai...`, 'info');
      
      startSSE(jobId, token);
    } catch (err) {
      setStatus('error');
      addLog(`Upload gagal: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  const startSSE = (jobId, token) => {
    const eventSource = new EventSource(`/api/master/sync-siswa/stream?jobId=${jobId}&token=${token}`);
    
    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.progress);
      setTotal(data.total);
      const isErr = data.message.includes('[ERROR]');
      addLog(data.message, isErr ? 'error' : 'success');
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setStatus('complete');
      setStats({ success: data.success, failed: data.failed });
      addLog(data.message, 'success');
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      setStatus('error');
      const msg = e.data || 'Terjadi kesalahan pada stream sinkronisasi.';
      addLog(typeof msg === 'string' ? msg : 'Connection lost or server error', 'error');
      eventSource.close();
    });
  };

  const handleDeepSync = async () => {
    const isConfirmed = window.confirm(
      "SINKRONISASI MENDALAM\n\n" +
      "Apakah Anda yakin? Tindakan ini akan mencari siswa dengan nama sama persis, " +
      "mengambil kelas dari data terbaru, dan memindahkannya ke akun dengan " +
      "email @smk.baktinusantara666.sch.id, lalu menghapus data duplikatnya."
    );

    if (isConfirmed) {
      try {
        setStatus('syncing');
        addLog("Memulai sinkronisasi mendalam. Mohon tunggu...", "info");
        const token = localStorage.getItem('token');

        const res = await axios.post('/api/master/sync-siswa/deep-sync', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        alert("Berhasil!\n" + res.data.message);
        addLog(res.data.message, "success");
      } catch (err) {
        alert("Gagal melakukan sinkronisasi mendalam:\n" + (err.response?.data?.message || err.message));
        addLog("Gagal: " + (err.response?.data?.message || err.message), "error");
      } finally {
        setStatus('complete');
      }
    }
  };

  const progressPercentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="sync-siswa animate-fade-in" style={{ padding: '24px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Sinkronisasi Data Siswa</h1>
          <p style={{ color: '#64748b' }}>Upload file CSV untuk update data siswa secara massal</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="upload-card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} /> Upload CSV
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '16px' }}>
            Format: Nama, Kelas (Pemisah koma atau titik koma). <br/>Contoh: <br/>Budi Santoso, X RPL 1<br/>Andi, X TKJ 1
          </p>
          
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange}
            disabled={status === 'uploading' || status === 'syncing'}
            style={{ width: '100%', padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '8px', marginBottom: '16px' }}
          />

          {status === 'complete' && (
            <div style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>
              <strong>Selesai!</strong> Berhasil: {stats.success}, Gagal: {stats.failed}
            </div>
          )}

          <button 
            className="primary-btn" 
            onClick={handleSync}
            disabled={!file || status === 'uploading' || status === 'syncing'}
            style={{ 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '12px', 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: (!file || status === 'uploading' || status === 'syncing') ? 'not-allowed' : 'pointer' 
            }}
          >
            {status === 'uploading' || status === 'syncing' ? <RefreshCw size={18} className="spin" /> : <Upload size={18} />}
            <span>Mulai Sinkronisasi</span>
          </button>

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0' }}>
            <h4 style={{ marginBottom: '8px', fontSize: '0.95rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="#eab308" /> Fix Data Duplikat
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
              Fitur ini akan menyalin data Kelas dari siswa hasil upload CSV ke akun siswa sebenarnya yang menggunakan email <strong>@smk.baktinusantara666.sch.id</strong>.
            </p>
            <button 
              onClick={handleDeepSync}
              style={{
                width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '10px', 
                background: '#fff', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem'
              }}
            >
              <AlertTriangle size={16} />
              Jalankan Sinkronisasi Mendalam
            </button>
          </div>
        </div>

        <div className="terminal-card" style={{ background: '#0f172a', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', height: '400px' }}>
          <div style={{ background: '#1e293b', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #334155' }}>
            <Terminal size={16} color="#94a3b8" />
            <span style={{ color: '#cbd5e1', fontSize: '0.875rem', fontWeight: '600' }}>Terminal Progres Sinkronisasi</span>
            
            {status === 'syncing' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', width: '200px' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{progressPercentage}%</span>
                <div style={{ flex: 1, background: '#334155', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercentage}%`, background: '#3b82f6', height: '100%', transition: 'width 0.2s' }}></div>
                </div>
              </div>
            )}
          </div>
          
          <div 
            ref={terminalRef}
            style={{ 
              flex: 1, 
              padding: '16px', 
              fontFamily: 'monospace', 
              fontSize: '0.85rem', 
              overflowY: 'auto', 
              color: '#cbd5e1',
              lineHeight: '1.5'
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: '#475569', fontStyle: 'italic' }}>Menunggu proses dimulai...</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '4px', display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#64748b' }}>[{log.time}]</span>
                  <span style={{ 
                    color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#22c55e' : '#cbd5e1'
                  }}>
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SyncSiswa;
