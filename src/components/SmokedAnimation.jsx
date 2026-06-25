import { useEffect, useState } from 'react'

const CAPTIONS = [
  'Nice one. Real nice.',
  'Your lungs just rolled their eyes.',
  'Tooth #14 just packed its bags.',
  "That's going straight to the streak counter.",
  'Bold choice.',
  'Future you is taking notes.',
]

export default function SmokedAnimation({ onDone }) {
  const [caption] = useState(CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)])

  useEffect(() => {
    const t = setTimeout(onDone, 1700)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="smoke-overlay" onClick={onDone}>
      <svg viewBox="0 0 120 120" className="smoke-face" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="48" fill="#C9D9A0" />
        <line x1="30" y1="48" x2="50" y2="42" stroke="#6B7A4A" strokeWidth="5" strokeLinecap="round" />
        <line x1="70" y1="42" x2="90" y2="48" stroke="#6B7A4A" strokeWidth="5" strokeLinecap="round" />
        <line x1="37" y1="55" x2="47" y2="65" stroke="#28201A" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="47" y1="55" x2="37" y2="65" stroke="#28201A" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="73" y1="55" x2="83" y2="65" stroke="#28201A" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="83" y1="55" x2="73" y2="65" stroke="#28201A" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M94 28 q5 8 0 14 q-5 -2 -5 -7 q0 -7 5 -7 z" fill="#BFE3F0" />
        <rect x="34" y="82" width="52" height="26" rx="13" fill="#6B231F" />
        <rect x="38" y="85" width="8" height="14" rx="2" fill="#F2ECDD" />
        <rect x="56" y="85" width="8" height="14" rx="2" fill="#0D0805" />
        <rect x="65" y="85" width="8" height="14" rx="2" fill="#0D0805" />
      </svg>
      <p className="smoke-caption">{caption}</p>
    </div>
  )
}
