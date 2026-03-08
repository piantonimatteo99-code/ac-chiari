/**
 * Logo ufficiale Azione Cattolica Chiari
 * Cerchio blu con raggi solari gialli e croce luminosa
 */
export function AcChiariLogo({ size = 64, className = '' }: { size?: number; className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => i * 22.5);

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
        {/* Clip path per mantenere i raggi dentro il cerchio */}
        <clipPath id="circle-clip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>

      {/* 1. Cerchio blu di sfondo */}
      <circle cx="32" cy="32" r="32" fill="#1e4d9a" />

      {/* 2. Raggi solari gialli — clippati dentro il cerchio */}
      <g clipPath="url(#circle-clip)" fill="#f5c520">
        {rays.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 32 32)`}>
            {/* Triangolo stretto dal centro verso l'alto — larghezza ~13° */}
            <polygon points="32,32 27,0 37,0" />
          </g>
        ))}
      </g>

      {/* 3. Croce chiara/luminosa in primo piano */}
      {/* Verticale */}
      <rect x="26.5" y="3" width="11" height="58" rx="1.5" fill="#fde88a" />
      {/* Orizzontale */}
      <rect x="3" y="26.5" width="58" height="11" rx="1.5" fill="#fde88a" />
    </svg>
  );
}

export default AcChiariLogo;
