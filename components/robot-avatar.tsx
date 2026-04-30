'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * RobotAvatar
 * Renders the Wall-E style robot with:
 *  - No circular clip (transparent background, robot shown as-is)
 *  - Idle float animation (animate-robot-idle via Tailwind)
 *  - CSS eyelid blink animation every ~6 s
 *
 * Eye positions are calibrated on the 1024×1024 source PNG.
 * The robot head occupies roughly x: 18–82%, y: 8–52% of the frame.
 * Each binocular eye centre:
 *   left eye  → x ≈ 31%, y ≈ 30%
 *   right eye → x ≈ 59%, y ≈ 30%
 * Each eye radius ≈ 13% of image width.
 */
export function RobotAvatar({
  size = 72,
  animated = true,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <>
      {/* Keyframes injected once — safe for multiple instances */}
      <style>{`
        @keyframes robot-blink {
          /* Eyes open 90 % of the time */
          0%,  82%, 100% { transform: scaleY(0); opacity: 0; }
          /* Quick blink */
          85%            { transform: scaleY(1); opacity: 1; }
          88%            { transform: scaleY(0); opacity: 0; }
          /* Second blink shortly after */
          91%            { transform: scaleY(1); opacity: 1; }
          94%            { transform: scaleY(0); opacity: 0; }
        }
      `}</style>

      <div
        className={cn(
          'relative inline-block select-none',
          animated && 'animate-robot-idle',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src="/assistant-walle.png"
          alt="Assistente"
          width={size}
          height={size}
          className="w-full h-full object-contain"
          draggable={false}
          priority
        />

        {/* ── Eyelid overlays ──────────────────────────────────────────────
            Each span sits on top of the corresponding eye and slides down
            from the top (transformOrigin: top) to cover it → simulates
            an eyelid closing.  Colour matches the grey of the robot head. */}

        {/* Left eye lid */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left:   '28.8%',
            top:    '29.5%',
            width:  '14.6%',
            height: '14.6%',
            background: '#cfd8dc',
            border: '1px solid #263238',
            borderRadius: '50%',
            transformOrigin: 'top center',
            transform: 'scaleY(0)',
            animation: 'robot-blink 6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Right eye lid */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left:   '46.5%',
            top:    '29.5%',
            width:  '14.6%',
            height: '14.6%',
            background: '#cfd8dc',
            border: '1px solid #263238',
            borderRadius: '50%',
            transformOrigin: 'top center',
            transform: 'scaleY(0)',
            animation: 'robot-blink 6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      </div>
    </>
  );
}
