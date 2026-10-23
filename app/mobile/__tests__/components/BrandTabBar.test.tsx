import { fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { StyleSheet } from "react-native";

import {
  ACTIVE_TAB_COLOR,
  BrandTabBar,
  INACTIVE_TAB_COLOR,
  MIN_TOUCH_TARGET,
} from "../../components/navigation/BrandTabBar";

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("react-native-svg", () => {
  const { View } = jest.requireActual("react-native");
  const Stub = (props: object) => <View {...props} />;
  return { __esModule: true, default: Stub, Svg: Stub, Path: Stub, Circle: Stub, Rect: Stub };
});

describe("BrandTabBar", () => {
  it("renders Home, Scan, History and Profile tabs with custom icons", () => {
    const { getByLabelText, getByTestId } = render(<BrandTabBar activeTab="index" onTabPress={jest.fn()} />);
    for (const label of ["Home", "Scan", "History", "Profile"]) getByLabelText(label);
    for (const icon of ["home", "scan", "history", "profile"]) getByTestId(`tab-icon-${icon}`);
  });

  it("uses brand primary for the active tab and muted grey for inactive tabs", () => {
    const { getByText, getByTestId } = render(<BrandTabBar activeTab="transactions" onTabPress={jest.fn()} />);
    expect(StyleSheet.flatten(getByText("History").props.style).color).toBe(ACTIVE_TAB_COLOR);
    expect(StyleSheet.flatten(getByText("Home").props.style).color).toBe(INACTIVE_TAB_COLOR);
    expect(StyleSheet.flatten(getByTestId("tab-indicator-transactions").props.style).backgroundColor).toBe(ACTIVE_TAB_COLOR);
  });

  it("enforces 44pt minimum touch targets", () => {
    const { getByTestId } = render(<BrandTabBar activeTab="index" onTabPress={jest.fn()} />);
    const style = StyleSheet.flatten(getByTestId("tab-scan-to-pay").props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it("fires haptic feedback and navigates on press", () => {
    const onTabPress = jest.fn();
    const { getByLabelText } = render(<BrandTabBar activeTab="index" onTabPress={onTabPress} />);
    fireEvent.press(getByLabelText("Scan"));
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(onTabPress).toHaveBeenCalledWith("scan-to-pay");
  });

  it("matches snapshot", () => {
    const tree = render(<BrandTabBar activeTab="index" onTabPress={jest.fn()} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
