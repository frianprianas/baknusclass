import React, { useState } from 'react';
import axios from 'axios';
import { User, Lock, Eye, EyeOff, Loader2, Info } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Auto-append domain if not present
    let loginIdentifier = username;
    if (!loginIdentifier.includes('@')) {
      loginIdentifier = loginIdentifier + '@smk.baktinusantara666.sch.id';
    }

    try {
      const response = await axios.post('/api/auth/login', {
        email: loginIdentifier,
        password
      });
      const { token, role, name, profileId, email, kelasId, userId } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ role, name, profileId, email, kelasId, userId }));

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa kembali username dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="bg-overlay"></div>

      <div className="login-content animate-fade-in">
        <div className="login-card-glass">
          <div className="login-brand">
            <div className="brand-logo-wrapper">
              <img src="/bclogo.png" alt="BaknusClass Logo" />
            </div>
            <div className="brand-text">
              <h1>BAKNUS<span>CLASS</span></h1>
              <p>Advanced CBT Ecosystem</p>
            </div>
          </div>

          <div className="card-welcome">
            <h2>Selamat Datang</h2>
            <p>Silahkan masuk untuk melanjutkan akses ke portal pembelajaran Anda</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && (
              <div className="error-alert">
                <Info size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group-modern">
              <label>Identitas Pengguna</label>
              <div className="input-field">
                <User className="field-icon" size={20} />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                {!username.includes('@') && (
                  <span className="domain-hint">@smk.baktinusantara666.sch.id</span>
                )}
              </div>
            </div>

            <div className="form-group-modern">
              <label>Kata Sandi</label>
              <div className="input-field">
                <Lock className="field-icon" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn-toggle-view"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login-premium" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="card-footer">
            <p>&copy; 2026 BaknusClass by IT Support</p>
            <div className="footer-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-image: url('/assets/login-bg.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          position: relative;
          font-family: 'Inter', sans-serif;
        }

        .bg-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 58, 138, 0.7) 100%);
          z-index: 1;
        }

        .login-content {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 480px;
          padding: 20px;
        }

        .login-card-glass {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 32px;
          padding: 50px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          color: white;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 40px;
        }

        .brand-logo-wrapper {
          width: 54px;
          height: 54px;
          background: white;
          border-radius: 14px;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        }

        .brand-logo-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .brand-text h1 {
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: 1px;
          margin: 0;
          color: white;
        }

        .brand-text h1 span {
          color: #60a5fa;
        }

        .brand-text p {
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin: 0;
          font-weight: 700;
        }

        .card-welcome {
          margin-bottom: 32px;
        }

        .card-welcome h2 {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .card-welcome p {
          color: #cbd5e1;
          font-size: 1rem;
          line-height: 1.5;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-group-modern {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .form-group-modern label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .input-field {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1.5px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 0 16px;
          transition: all 0.3s;
        }

        .input-field:focus-within {
          background: rgba(255, 255, 255, 0.1);
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
        }

        .field-icon {
          color: #64748b;
          margin-right: 14px;
        }

        .input-field input {
          background: transparent;
          border: none;
          outline: none;
          color: white;
          padding: 16px 0;
          font-size: 1rem;
          font-weight: 500;
          width: 100%;
        }

        .input-field input::placeholder {
          color: #475569;
        }

        .domain-hint {
          color: #475569;
          font-weight: 600;
          font-size: 0.9rem;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
          margin-left: 4px;
        }

        .btn-toggle-view {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .btn-toggle-view:hover {
          color: #3b82f6;
        }

        .btn-login-premium {
          margin-top: 10px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 16px;
          padding: 18px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.3s;
          box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4);
        }

        .btn-login-premium:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 20px 30px -10px rgba(59, 130, 246, 0.5);
        }

        .btn-login-premium:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-login-premium:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: #334155;
          box-shadow: none;
        }

        .error-alert {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #fca5a5;
          font-size: 0.9rem;
          font-weight: 600;
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        .card-footer {
          margin-top: 40px;
          text-align: center;
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .footer-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-top: 12px;
        }

        .footer-dots span {
          width: 4px;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
        }

        @media (max-width: 480px) {
          .login-card-glass {
            padding: 30px;
          }
          .card-welcome h2 {
            font-size: 1.6rem;
          }
          .brand-text h1 {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
