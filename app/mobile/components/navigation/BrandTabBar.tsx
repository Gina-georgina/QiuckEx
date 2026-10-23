import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";
import { HistoryIcon, HomeIcon, ProfileIcon, ScanIcon, type TabIconProps } from "./TabIcons";

/** Minimum touch target (pt) per Apple HIG / Material guidelines. */
export const MIN_TOUCH_TARGET = 44;
export const ACTIVE_TAB_COLOR = colors.primary;
export const INACTIVE_TAB_COLOR = colors.neutral[400];

export interface BrandTab {
  name: string;
  label: string;
  Icon: React.ComponentType<TabIconProps>;
}

export const BRAND_TABS: BrandTab[] = [
  { name: "index", label: "Home", Icon: HomeIcon },
  { name: "scan-to-pay", label: "Scan", Icon: ScanIcon },
  { name: "transactions", label: "History", Icon: HistoryIcon },
  { name: "settings", label: "Profile", Icon: ProfileIcon },
];

export function triggerTabHaptic() {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    Haptics.selectionAsync().catch(() => {});
  }
}

export interface BrandTabBarProps {
  activeTab: string;
  onTabPress: (name: string) => void;
  tabs?: BrandTab[];
  bottomInset?: number;
}

/**
 * QuickEx-branded bottom tab bar. Drop-in for Expo Router's `<Tabs tabBar>`:
 *   <Tabs tabBar={({ state, navigation, insets }) => (
 *     <BrandTabBar
 *       activeTab={state.routes[state.index].name}
 *       onTabPress={(name) => navigation.navigate(name)}
 *       bottomInset={insets.bottom}
 *     />
 *   )} />
 */
export function BrandTabBar({ activeTab, onTabPress, tabs = BRAND_TABS, bottomInset = 0 }: BrandTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 6) }]} accessibilityRole="tablist">
      {tabs.map(({ name, label, Icon }) => {
        const focused = name === activeTab;
        const color = focused ? ACTIVE_TAB_COLOR : INACTIVE_TAB_COLOR;
        return (
          <Pressable
            key={name}
            testID={`tab-${name}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            hitSlop={8}
            onPress={() => {
              triggerTabHaptic();
              if (!focused) onTabPress(name);
            }}
            style={styles.tab}
          >
            <View style={[styles.indicator, focused && styles.indicatorActive]} testID={`tab-indicator-${name}`} />
            <Icon color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[200],
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET + 12,
    paddingTop: 6,
  },
  indicator: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  indicatorActive: { backgroundColor: ACTIVE_TAB_COLOR },
  label: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});

export default BrandTabBar;
