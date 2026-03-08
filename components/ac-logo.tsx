/**
 * Logo ufficiale Azione Cattolica Chiari
 * Cerchio blu con raggi solari giori e croce luminosa
 */
export function AcChiariLogo({ size = 64, className = '' }: { size?: number; className?: string }) {
  // Ogni raggio è un triangolo dal centro ai bordi del cerchio, ruotato di 22.5°
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
      {/* Cerchio di sfondo - blu AC */}
      <circle cx="32" cy="32" r="32" fill="#2256a8" />

      {/* Raggi solari - triangoli giori che si irradiano dal centro */}
      <g fill="#f5c520">
        {rays.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 32 32)`}>
            {/* Triangolo dal centro (32,32) verso la cima del cerchio, largo ~14° */}
            <polygon points="32,32 27.5,0 36.5,0" />
          </g>
        ))}
      </g>

      {/* Croce - bande luminose orizzontali e verticali */}
      {/* Verticale */}
      <rect x="26" y="2" width="12" height="60" rx="1" fill="#fde680" />
      {/* Orizzontale */}
      <rect x="2" y="26" width="60" height="12" rx="1" fill="#fde680" />
    </svg>
  );
}

export default AcChiariLogo;
