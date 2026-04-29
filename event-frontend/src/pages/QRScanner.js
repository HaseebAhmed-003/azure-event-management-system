
// Result card:
//     status = 'PRESENT'   → green card, "Entry Allowed"
//                            shows attendeeName + seatNumber + scanTime
//     status = 'DUPLICATE' → yellow card, "Duplicate — Already Scanned"
//     status = 'INVALID'   → red card, "Invalid QR Code"
//     status = 'ERROR'     → red card, shows error message


import React, { useState, useRef } from 'react';
import { scanQR } from '../api';

export default function QRScanner() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef();

  const handleScan = async (e) => {
    e.preventDefault();
    const code = input.trim();
    if (!code) return;
    setScanning(true);
    setResult(null);
    try {
      const res = await scanQR(code);
      setResult({ ok: res.data.success, data: res.data });
    } catch (err) {
      setResult({ ok: false, data: { status: 'ERROR', message: err.response?.data?.error || 'Scan failed.' } });
    } finally {
      setScanning(false);
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const statusConfig = {
    PRESENT: { icon: '✅', color: 'var(--success)', label: 'Entry Allowed', bg: 'var(--success-dim)', border: 'rgba(74,222,128,0.3)' },
    DUPLICATE: { icon: '🚫', color: 'var(--warning)', label: 'Duplicate — Already Scanned', bg: 'var(--warning-dim)', border: 'rgba(251,191,36,0.3)' },
    INVALID: { icon: '❌', color: 'var(--error)', label: 'Invalid QR Code', bg: 'var(--error-dim)', border: 'rgba(248,113,113,0.3)' },
    ERROR: { icon: '⚠️', color: 'var(--error)', label: 'Error', bg: 'var(--error-dim)', border: 'rgba(248,113,113,0.3)' },
  };

  const cfg = result ? (statusConfig[result.data.status] || statusConfig.ERROR) : null;

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1 className="page-title">QR Scanner</h1>
        <p className="page-sub">Scan attendee tickets at the venue entrance</p>
      </div>

      <div className="scanner-input-area" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
        <p style={{ color: 'var(--text-dim)', marginBottom: 20, fontSize: 14 }}>
          Point your scanner at the attendee's QR code, or paste the QR code string below.
        </p>
        <form onSubmit={handleScan} style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
          <input
            ref={inputRef}
            className="form-input"
            placeholder="Scan QR or paste code here (e.g. TKT-1-EVT-1-USR-…)"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
            style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 13 }}
          />
          <button type="submit" className="btn btn-primary btn-lg" disabled={scanning || !input.trim()} style={{ width: '100%', justifyContent: 'center' }}>
            {scanning ? 'Verifying…' : '⚡ Verify & Mark Entry'}
          </button>
        </form>
      </div>

      {/* Result display */}
      {result && (
        <div
          className="card fade-up"
          style={{ borderColor: cfg.border, background: cfg.bg, borderWidth: 2, textAlign: 'center', padding: '32px 24px' }}
        >
          <div style={{ fontSize: 56, marginBottom: 12 }}>{cfg.icon}</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: cfg.color, marginBottom: 8 }}>
            {cfg.label}
          </div>
          {result.data.attendeeName && (
            <div style={{ fontSize: 18, color: 'var(--white)', fontWeight: 600, marginBottom: 4 }}>
              {result.data.attendeeName}
            </div>
          )}
          {result.data.seatNumber && (
            <div style={{ marginBottom: 4 }}>
              <span className="badge badge-blue">Seat {result.data.seatNumber}</span>
            </div>
          )}
          {result.data.scanTime && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
              Scanned at {new Date(result.data.scanTime).toLocaleTimeString()}
            </div>
          )}
          {result.data.message && (
            <div style={{ marginTop: 12, fontSize: 13, color: cfg.color, opacity: 0.85 }}>
              {result.data.message}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, color: 'var(--white)', marginBottom: 12 }}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--text-dim)' }}>
          <div>🟢 <strong style={{ color: 'var(--success)' }}>PRESENT</strong> — Valid ticket, first scan. Allow entry.</div>
          <div>🟡 <strong style={{ color: 'var(--warning)' }}>DUPLICATE</strong> — This ticket was already scanned. Deny entry.</div>
          <div>🔴 <strong style={{ color: 'var(--error)' }}>INVALID</strong> — QR code not found in system. Deny entry.</div>
        </div>
      </div>
    </div>
  );
}
