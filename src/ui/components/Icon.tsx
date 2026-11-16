import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Hand-drawn 24×24 stroke icons. Bundled as code — nothing is fetched at runtime. */
const ICONS = {
  back: <Path d="m15 6-6 6 6 6" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  chevron: <Path d="m9 6 6 6-6 6" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="m5 12 5 5 9-10" />,
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-3.5-3.5" />
    </>
  ),
  settings: (
    <>
      <Path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
      <Circle cx={16} cy={7} r={2.5} />
      <Circle cx={10} cy={17} r={2.5} />
    </>
  ),
  lock: (
    <>
      <Rect x={4} y={11} width={16} height={10} rx={3} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  lockKeyhole: (
    <>
      <Rect x={4} y={11} width={16} height={10} rx={3} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2" />
    </>
  ),
  eye: (
    <>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
      <Path d="M3 3l18 18" />
    </>
  ),
  copy: (
    <>
      <Rect x={8} y={8} width={13} height={13} rx={3} />
      <Path d="M16 8V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2" />
    </>
  ),
  edit: <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />,
  trash: <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  globe: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  key: (
    <>
      <Circle cx={8} cy={15} r={4} />
      <Path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
    </>
  ),
  shield: <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
  shieldCheck: (
    <>
      <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  wifiOff: (
    <Path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5M12 20h.01" />
  ),
  phone: (
    <>
      <Rect x={6} y={2} width={12} height={20} rx={3} />
      <Path d="M11 18h2" />
    </>
  ),
  fingerprint: (
    <Path d="M6.5 8.5A6.5 6.5 0 0 1 18.5 12v1M5.5 12v1.5c0 2-.4 3.8-1 5M12 12v2c0 3-.8 5.4-2 7M9 9.6A3.5 3.5 0 0 1 15.5 12v2.5c0 2.4-.4 4.5-1.2 6.5M8.5 13v1c0 2-.5 3.8-1.3 5.3M18.5 16c-.1 1.5-.4 3-.9 4.3" />
  ),
  backspace: (
    <>
      <Path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
      <Path d="m12 9 6 6M18 9l-6 6" />
    </>
  ),
  refresh: <Path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />,
  download: <Path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  upload: <Path d="M12 15V3M7 8l5-5 5 5M5 21h14" />,
  file: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3v5h5" />
    </>
  ),
  folder: <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  bluetooth: <Path d="m7 7 10 10-5 5V2l5 5L7 17" />,
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  alert: (
    <>
      <Path d="M12 9v4M12 17h.01" />
      <Path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 8v5M12 16h.01" />
    </>
  ),
  pin: (
    <>
      <Rect x={2} y={6} width={20} height={12} rx={4} />
      <Circle cx={7} cy={12} r={1.2} />
      <Circle cx={12} cy={12} r={1.2} />
      <Circle cx={17} cy={12} r={1.2} />
    </>
  ),
  book: (
    <>
      <Path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <Path d="M5 17a3 3 0 0 1 3-3h11" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {ICONS[name]}
    </Svg>
  );
}

/** Filled four-point sparkle used as a small accent (generator header, empty state). */
export function Sparkle({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M12 2l2.2 6.4L21 10l-6.8 1.8L12 18l-2.2-6.2L3 10l6.8-1.6z" fill={color} />
    </Svg>
  );
}
