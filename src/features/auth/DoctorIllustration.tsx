/** Login-page artwork: a doctor with folded arms on soft medical shapes. Pure SVG, no assets. */
export function DoctorIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 240" className={className} role="img" aria-label="Doctor illustration">
      <defs>
        <linearGradient id="blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#dbeafe" />
        </linearGradient>
        <linearGradient id="blob2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {/* backdrop */}
      <circle cx="140" cy="130" r="98" fill="url(#blob)" />
      <path d="M52 170c-10-38 12-72 44-80 24-6 34 18 60 12 28-6 52 8 58 36 8 36-20 62-58 66-44 4-94-2-104-34z" fill="url(#blob2)" opacity=".55" />
      <ellipse cx="72" cy="66" rx="16" ry="11" fill="#93c5fd" />
      {/* crosses & heart */}
      <g fill="#ffffff">
        <path d="M44 104h9v-9h7v9h9v7h-9v9h-7v-9h-9z" />
        <path d="M204 150h8v-8h6v8h8v6h-8v8h-6v-8h-8z" />
        <path d="M30 138h5v-5h4v5h5v4h-5v5h-4v-5h-5z" opacity=".8" />
      </g>
      <rect x="186" y="80" rx="12" width="40" height="26" fill="#ffffff" opacity=".9" />
      <path d="M198 91c0-4 5-6 8-2 3-4 8-2 8 2 0 5-8 9-8 9s-8-4-8-9z" fill="#60a5fa" />
      {/* body: coat, shirt, arms */}
      <path d="M92 236c0-44 20-66 48-70 28 4 48 26 48 70z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M122 168l18 32 18-32c-6-3-12-4-18-4s-12 1-18 4z" fill="#1e3a8a" />
      <path d="M128 168l12 22 12-22" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
      <path d="M100 214c10-10 26-14 40-12 14-2 30 2 40 12-8 10-24 16-40 14-16 2-32-4-40-14z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M108 210c16 6 48 6 64 0" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
      {/* stethoscope */}
      <path d="M122 170c-6 18-2 32 8 36" stroke="#334155" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M158 170c6 16 4 26-2 32" stroke="#334155" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="155" cy="205" r="5" fill="#94a3b8" stroke="#334155" strokeWidth="2" />
      {/* neck & head */}
      <rect x="131" y="150" width="18" height="18" rx="6" fill="#f2c4a0" />
      <ellipse cx="140" cy="126" rx="26" ry="30" fill="#f6cfae" />
      <ellipse cx="114" cy="128" rx="5" ry="7" fill="#f2c4a0" />
      <ellipse cx="166" cy="128" rx="5" ry="7" fill="#f2c4a0" />
      {/* hair */}
      <path d="M112 118c-4-26 14-40 32-38 20-2 36 12 30 38-4-10-10-16-18-18-10 6-26 8-44 18z" fill="#1e3a8a" />
      {/* glasses & face */}
      <g stroke="#1e293b" strokeWidth="2" fill="none">
        <circle cx="129" cy="128" r="8" />
        <circle cx="151" cy="128" r="8" />
        <path d="M137 128h6" />
      </g>
      <circle cx="129" cy="128" r="2" fill="#1e293b" />
      <circle cx="151" cy="128" r="2" fill="#1e293b" />
      <path d="M132 144c5 4 11 4 16 0" stroke="#b45309" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M140 132v6" stroke="#e0a47c" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
