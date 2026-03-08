/**
 * Logo ufficiale Azione Cattolica Chiari
 * Cerchio blu con raggi solari gialli che si irradiano dal centro e croce luminosa
 */
export function AcChiariLogo({ size = 64, className = '' }: { size?: number; className?: string }) {

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <clipPath id={`ac-clip-${size}`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>

      {/* 1. Sfondo giallo dorato (base dei raggi) */}
      <circle cx="32" cy="32" r="32" fill="#f5c520" />

      {/* 2. Settori blu che coprono lo sfondo, lasciando gap gialli (i raggi) 
          16 raggi = 22.5° ognuno, gap giallo = ~8°, settore blu = ~14.5° */}
      <g clipPath={`url(#ac-clip-${size})`} fill="#1e4d9a">
        {Array.from({ length: 16 }, (_, i) => {
          /* Ogni settore blu copre 14.5° centrato a (i*22.5 + 11.25)° */
          const startDeg = i * 22.5 + 4;
          const endDeg = i * 22.5 + 18.5;
          const r = 40; // raggio leggermente più grande del cerchio
          const cx = 32, cy = 32;
          const toRad = (d: number) => (d - 90) * Math.PI / 180;
          const x1 = cx + r * Math.cos(toRad(startDeg));
          const y1 = cy + r * Math.sin(toRad(startDeg));
          const x2 = cx + r * Math.cos(toRad(endDeg));
          const y2 = cy + r * Math.sin(toRad(endDeg));
          return (
            <polygon
              key={i}
              points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`}
            />
          );
        })}
      </g>

      {/* 3. Croce chiara luminosa in primo piano */}
      <rect x="26.5" y="3" width="11" height="58" rx="1.5" fill="#fde88a" clipPath={`url(#ac-clip-${size})`} />
      <rect x="3" y="26.5" width="58" height="11" rx="1.5" fill="#fde88a" clipPath={`url(#ac-clip-${size})`} />
    </svg>
  );
}

export default AcChiariLogo;

