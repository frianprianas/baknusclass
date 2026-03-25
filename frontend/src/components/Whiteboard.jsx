import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Pencil, Trash2, Download, Save } from 'lucide-react';

const Whiteboard = ({ initialData, onSave, onClear }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    const [isEraser, setIsEraser] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Handle initial data
        if (initialData) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = initialData;
        }

        // Set canvas size based on container
        const resizeCanvas = () => {
            const container = canvas.parentElement;
            const tempImage = canvas.toDataURL(); // Save current state
            canvas.width = container.clientWidth;
            canvas.height = 400; // Fixed height for whiteboard

            // Restore state after resize
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = tempImage;
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const startDrawing = (e) => {
        const { offsetX, offsetY } = getOffset(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = getOffset(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.strokeStyle = isEraser ? '#ffffff' : color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        onSave(canvas.toDataURL('image/png'));
    };

    const getOffset = (e) => {
        if (e.touches && e.touches.length > 0) {
            const rect = canvasRef.current.getBoundingClientRect();
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        }
        return {
            offsetX: e.nativeEvent.offsetX,
            offsetY: e.nativeEvent.offsetY
        };
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onClear();
    };

    return (
        <div className="whiteboard-container" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', marginTop: '16px' }}>
            <div className="whiteboard-toolbar" style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setIsEraser(false)}
                        className={`wb-tool ${!isEraser ? 'active' : ''}`}
                        title="Pencil"
                        style={toolButtonStyle(!isEraser)}
                    >
                        <Pencil size={18} />
                    </button>
                    <button
                        onClick={() => setIsEraser(true)}
                        className={`wb-tool ${isEraser ? 'active' : ''}`}
                        title="Eraser"
                        style={toolButtonStyle(isEraser)}
                    >
                        <Eraser size={18} />
                    </button>
                </div>

                <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        style={{ width: '24px', height: '24px', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
                    />
                    <select
                        value={lineWidth}
                        onChange={(e) => setLineWidth(parseInt(e.target.value))}
                        style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    >
                        <option value="2">Tipis</option>
                        <option value="5">Sedang</option>
                        <option value="10">Tebal</option>
                    </select>
                </div>

                <div style={{ flex: 1 }}></div>

                <button
                    onClick={clearCanvas}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                >
                    <Trash2 size={14} /> Hapus Semua
                </button>
            </div>

            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
            />

            <div className="whiteboard-footer" style={{ padding: '4px 12px', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', background: '#f8fafc', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                * Putar HP jika area whiteboard kurang lebar. Jawaban whiteboard tersimpan otomatis bersama teks.
            </div>
        </div>
    );
};

const toolButtonStyle = (isActive) => ({
    background: isActive ? '#3b82f6' : 'white',
    color: isActive ? 'white' : '#64748b',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
});

export default Whiteboard;
