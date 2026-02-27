/**
 * LBS FieldGuard — Responsive Screen Size Hook
 *
 * Provides device-class aware sizing helpers that work across:
 *   - Compact phones  (w < 360)
 *   - Normal phones   (360 ≤ w < 600)
 *   - Large phones    (600 ≤ w < 840)  [landscape phone / small tablet]
 *   - Tablets         (840 ≤ w < 1280)
 *   - Desktop/large   (w ≥ 1280)       [Windows app]
 *
 * Usage:
 *   const { scale, fontSize, isTablet, isDesktop, numColumns } = useScreenSize();
 *   style={{ fontSize: fontSize(14), padding: scale(12) }}
 */

import { useWindowDimensions } from 'react-native';

// ── Device class ──────────────────────────────────────────────────────────────

export type DeviceClass = 'compact' | 'phone' | 'large-phone' | 'tablet' | 'desktop';

function classify(width: number): DeviceClass {
  if (width < 360)  return 'compact';
  if (width < 600)  return 'phone';
  if (width < 840)  return 'large-phone';
  if (width < 1280) return 'tablet';
  return 'desktop';
}

// ── Scale factors ─────────────────────────────────────────────────────────────

const SCALE_FACTOR: Record<DeviceClass, number> = {
  'compact':    0.85,
  'phone':      1.00,
  'large-phone':1.10,
  'tablet':     1.20,
  'desktop':    1.35,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface ScreenSize {
  width: number;
  height: number;
  deviceClass: DeviceClass;
  isCompact:   boolean;
  isPhone:     boolean;
  isTablet:    boolean;
  isDesktop:   boolean;
  isLandscape: boolean;

  /**
   * Scale a spacing/dimension value relative to the device class.
   * e.g. `scale(16)` → 16 on phone, 19 on tablet, 22 on desktop
   */
  scale: (base: number) => number;

  /**
   * Scale a font size relative to the device class.
   * Minimum value is always preserved (base * 0.75).
   */
  fontSize: (base: number) => number;

  /**
   * Suggested number of columns for a grid layout.
   * compact/phone → 1, large-phone → 2, tablet → 3, desktop → 4
   */
  numColumns: number;

  /**
   * Maximum content width — useful to centre content on large screens.
   * Returns undefined for phones (no max needed).
   */
  maxContentWidth: number | undefined;
}

export function useScreenSize(): ScreenSize {
  const { width, height } = useWindowDimensions();
  const deviceClass = classify(width);
  const factor = SCALE_FACTOR[deviceClass];

  const scale = (base: number) => Math.round(base * factor);
  const fontSize = (base: number) => Math.max(Math.round(base * factor), Math.round(base * 0.75));

  const numColumnsMap: Record<DeviceClass, number> = {
    'compact':    1,
    'phone':      1,
    'large-phone':2,
    'tablet':     3,
    'desktop':    4,
  };

  const maxContentWidthMap: Record<DeviceClass, number | undefined> = {
    'compact':    undefined,
    'phone':      undefined,
    'large-phone':undefined,
    'tablet':     800,
    'desktop':    1100,
  };

  return {
    width,
    height,
    deviceClass,
    isCompact:   deviceClass === 'compact',
    isPhone:     deviceClass === 'phone' || deviceClass === 'compact',
    isTablet:    deviceClass === 'tablet',
    isDesktop:   deviceClass === 'desktop',
    isLandscape: width > height,
    scale,
    fontSize,
    numColumns:  numColumnsMap[deviceClass],
    maxContentWidth: maxContentWidthMap[deviceClass],
  };
}
