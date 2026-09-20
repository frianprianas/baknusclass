import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    padding: '24px'
                }}>
                    <div style={{
                        maxWidth: '520px',
                        width: '100%',
                        background: '#ffffff',
                        borderRadius: '20px',
                        padding: '36px',
                        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.08)',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            background: '#fee2e2',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            margin: '0 auto 20px auto'
                        }}>
                            ⚠️
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                            Terjadi Kendala Tampilan
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5, marginBottom: '24px' }}>
                            Halaman mengalami gangguan sementara saat memuat data. Silakan coba muat ulang atau kembali ke dashboard.
                        </p>

                        {this.state.error && (
                            <div style={{
                                background: '#f1f5f9',
                                borderRadius: '10px',
                                padding: '12px',
                                fontSize: '0.78rem',
                                color: '#475569',
                                textAlign: 'left',
                                overflowX: 'auto',
                                marginBottom: '24px',
                                fontFamily: 'monospace',
                                border: '1px solid #cbd5e1'
                            }}>
                                <strong>Error:</strong> {this.state.error?.message || String(this.state.error)}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                                }}
                            >
                                🔄 Muat Ulang Halaman
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: '#475569',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Ke Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
