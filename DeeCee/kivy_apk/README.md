# DeeCadence Kivy APK

Fresh Android-targeted Kivy app surface.

## Shape

- `main.py` is the Android entrypoint.
- `app/core/subscription.py` keeps subscription state and access rules isolated.
- `app/screens/home.py` builds the first mobile screen.
- `buildozer.spec` is scoped to this folder for APK builds.

The archived Kivy app in `../old_files` should be mined module by module, not copied wholesale. First migration targets should be settings/subscription, DeeCadence focus, then financial logs.

## Build Direction

Use Linux, WSL, or CI for Buildozer. Windows-native Android builds are usually where time goes to sulk.

