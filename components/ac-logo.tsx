import Image from "next/image";

/**
 * Logo ufficiale Azione Cattolica Chiari
 * Sostituito con l'immagine fornita dall'utente.
 */
export function AcChiariLogo({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/ac-logo.jpg"
      alt="Logo AC Chiari"
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`.trim()}
      priority
    />
  );
}

export default AcChiariLogo;

