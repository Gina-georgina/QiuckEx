# QuickEx Mobile — Contributor Guide

This guide walks you through setting up the QuickEx mobile app (`app/mobile`) for local development, running it on emulators and physical devices, and running the test suites. It complements the quick-start in [`README.md`](./README.md).

If you only want to run the app quickly, see the README. This guide is for contributors who need a full local toolchain.

## 1. Prerequisites

- **Node.js 18+** and **pnpm** (the repo is a pnpm/turbo monorepo).
- **Git**.
- A terminal you are comfortable with.

Install dependencies from the repository root (not from `app/mobile`):

```bash
pnpm install
```

### Expo CLI

The project uses the Expo CLI bundled with the `expo` package, so you do **not** need a global install. Run it through pnpm from the repo root:

```bash
pnpm turbo run dev --filter=mobile
```

This starts the Expo dev server and prints a QR code plus a menu of shortcuts (`i` for iOS, `a` for Android, `w` for web).

> Optional: install the standalone CLI with `npm install -g expo-cli` if you prefer, but the bundled version is what CI and the release pipeline use.

## 2. Android setup

1. Install **Android Studio** from <https://developer.android.com/studio>.
2. In Android Studio, open **SDK Manager** and install:
   - Android SDK Platform (a recent API level, e.g. API 34).
   - Android SDK Build-Tools.
   - Android Emulator and Android SDK Platform-Tools.
3. Create a virtual device: **Device Manager → Create Device**, pick a phone profile (e.g. Pixel 7) and a system image, then finish.
4. Make sure the SDK is on your `PATH`. Add to your shell profile:

   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"        # macOS/Linux default
   export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
   ```

   On Windows the default is `%LOCALAPPDATA%\Android\Sdk`.
5. Start the emulator (from Android Studio or `emulator -avd <name>`), then run the dev server and press `a`.

Verify the device is visible with `adb devices`.

## 3. iOS setup (macOS only)

1. Install **Xcode** from the Mac App Store (or <https://developer.apple.com/xcode/>).
2. Open Xcode once to accept the license, then install command-line tools:

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app
   sudo xcodebuild -license accept
   ```
3. Install the **iOS Simulator** runtime via **Xcode → Settings → Platforms**.
4. Open **Simulator** (or `open -a Simulator`), then run the dev server and press `i`.

CocoaPods is only needed if you run `expo prebuild` and build native projects locally. Install it with `sudo gem install cocoapods` (or via Homebrew) and run `pod install` inside `ios/` after prebuild.

> The home-screen widgets are native targets and are **not** available in Expo Go or the plain simulator without a development build. See section 6.

## 4. Running on a physical device (Expo Go)

1. Install **Expo Go** from the App Store (iOS) or Google Play (Android).
2. Ensure your phone and computer are on the **same Wi-Fi network**.
3. Start the dev server (`pnpm turbo run dev --filter=mobile`) and scan the QR code:
   - **iOS**: use the Camera app.
   - **Android**: use the QR scanner inside Expo Go.
4. If the QR code does not connect (common on corporate/guest networks), start with a tunnel:

   ```bash
   pnpm turbo run dev --filter=mobile -- --tunnel
   ```

> Expo Go cannot load the native widget extensions. Use a development build (section 6) to test widgets.

## 5. Running tests

### Jest unit tests

```bash
pnpm --filter=mobile test
```

### Maestro UI tests

Maestro drives the app on an emulator/simulator or a connected device. Install it once:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

Then, with the app installed on a running emulator/device, run the flows from `app/mobile`:

```bash
maestro test .maestro
```

(Adjust the flow directory to wherever the `.yaml` flows live in this repo.)

## 6. EAS builds (optional)

EAS produces installable development and internal release builds, including the native widget targets that Expo Go cannot run.

Prerequisites:

1. Create a free account at <https://expo.dev> (optional for local dev, required for EAS).
2. Install the EAS CLI and log in:

   ```bash
   npm install -g eas-cli
   eas login
   ```

3. Link the project (first time only): `eas init`.

Build commands (run from `app/mobile`):

```bash
# Development build for a connected device/emulator
eas build --profile development --platform android
eas build --profile development --platform ios

# Internal release builds (dev / staging / production profiles)
eas build --profile staging --platform android
eas build --profile production --platform ios
```

CI uses `EAS_TOKEN` from repository secrets and the `dev`, `staging`, and `production` profiles configured in `./.github/workflows/mobile-release.yml`. See `RELEASE_CHECKLIST.md` for release readiness and privacy review.

## 7. Environment variables

The app reads `EXPO_PUBLIC_*` variables at runtime. See the table in [`README.md`](./README.md#environment-configuration) for the full list and defaults. These values are compiled into the bundle, so never put secrets in them.

## 8. Troubleshooting

- **Metro bundler port in use**: stop the other process or start with `--port 8082`.
- **Android emulator not detected**: confirm `adb devices` lists it and `ANDROID_HOME` is set.
- **iOS build fails on pods**: run `cd ios && pod install --repo-update`.
- **QR code won't connect**: use `--tunnel` (section 4).

## Screenshots

Expected emulator output screenshots live in `docs/assets/mobile/` (add them when contributing UI changes). If the folder is empty, capture a screenshot of the running app on your emulator and open a PR adding it here.
