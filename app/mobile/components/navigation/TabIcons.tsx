import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export interface TabIconProps {
  color: string;
  size?: number;
}

const stroke = { strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

export function HomeIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-home">
      <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke={color} {...stroke} />
    </Svg>
  );
}

export function ScanIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-scan">
      <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" stroke={color} {...stroke} />
      <Rect x={8} y={8} width={8} height={8} rx={1} stroke={color} {...stroke} />
    </Svg>
  );
}

export function HistoryIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-history">
      <Path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" stroke={color} {...stroke} />
      <Path d="M12 7v5l3 2" stroke={color} {...stroke} />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24 }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-profile">
      <Circle cx={12} cy={8} r={4} stroke={color} {...stroke} />
      <Path d="M4 21a8 8 0 0 1 16 0" stroke={color} {...stroke} />
    </Svg>
  );
}
