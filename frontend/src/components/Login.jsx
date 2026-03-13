import React, { useState } from 'react';
import axios from 'axios';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

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
      const { token, role, name, profileId, email } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ role, name, profileId, email }));

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa kembali username dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="header-content">
          <div className="logo-placeholder">
            {/* Logo will be assigned later as per request */}
            <div className="avatar-circle">
              <img src="/bclogo.png" alt="BaknusClass Logo" style={{ width: 60, height: 60, objectFit: 'contain' }} />
            </div>
          </div>
          <div className="header-text">
            <h1>BAKNUSCLASS</h1>
            <p>CBT Application</p>
          </div>
        </div>
      </div>

      <div className="login-card-wrapper animate-fade-in">
        <div className="login-card">
          <div className="card-header">
            <h2>Selamat Datang</h2>
            <p>Silahkan login dengan username dan password yang anda miliki</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && <div className="error-message">{error}</div>}

            <div className="input-group">
              <div className="input-wrapper username-wrapper">
                <User className="input-icon" size={20} />
                <input
                  type="text"
                  placeholder="Username"
                  className="username-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                {!username.includes('@') && (
                  <span className="domain-suffix">@smk.baktinusantara666.sch.id</span>
                )}
              </div>
            </div>

            <div className="input-group">
              <div className="input-wrapper">
                <Lock className="input-icon" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? <Loader2 className="spinner" size={20} /> : 'Login'}
            </button>
          </form>
        </div>

        <div className="footer-caption">
          BaknusClass by IT Support
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: #f0f2f5;
        }
        
        .input-wrapper.username-wrapper {
          justify-content: flex-start;
          flex-wrap: nowrap;
        }

        .username-input {
          flex: 0 1 auto !important;
          width: auto !important;
          min-width: 100px;
        }

        .domain-suffix {
          color: #94a3b8;
          font-weight: 500;
          font-size: 1.1rem;
          margin-left: 2px;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
        }

        /* Re-adding original styles below for completeness */
        .login-header {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          height: 300px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 40px;
          color: white;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-text h1 {
          font-size: 2.5rem;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: -5px;
        }

        .header-text p {
          font-size: 1.2rem;
          font-weight: 300;
          opacity: 0.9;
          letter-spacing: 1px;
        }

        .login-card-wrapper {
          margin-top: -120px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .login-card {
          background: white;
          width: 100%;
          max-width: 450px;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .card-header {
          margin-bottom: 30px;
          text-align: left;
        }

        .card-header h2 {
          font-size: 1.8rem;
          color: #374151;
          margin-bottom: 8px;
        }

        .card-header p {
          color: #6b7280;
          font-size: 1rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-wrapper {
          position: relative;
          border-bottom: 2px solid #e5e7eb;
          display: flex;
          align-items: center;
          padding: 10px 0;
          transition: border-color 0.3s ease;
        }

        .input-wrapper:focus-within {
          border-color: #3b82f6;
        }

        .input-icon {
          color: #9ca3af;
          margin-right: 12px;
        }

        .input-wrapper input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 1.1rem;
          color: #1f2937;
          background: transparent;
        }

        .toggle-password {
          background: none;
          color: #9ca3af;
          padding: 5px;
        }

        .login-button {
          margin-top: 10px;
          background-color: #007bff;
          color: white;
          padding: 14px;
          border-radius: 50px;
          font-size: 1.2rem;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgba(0, 123, 255, 0.3);
        }

        .login-button:hover {
          background-color: #0069d9;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 123, 255, 0.4);
        }

        .login-button:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
          transform: none;
        }

        .error-message {
          background-color: #fee2e2;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          font-size: 0.9rem;
          margin-bottom: 10px;
        }

        .footer-caption {
          margin-top: 30px;
          color: #6b7280;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .spinner {
          animation: rotate 2s linear infinite;
        }

        @keyframes rotate {
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .header-text h1 { font-size: 1.8rem; }
          .login-card { padding: 30px; }
        }
      `}</style>
    </div>
  );
};

export default Login;
