[app]
title = DeeCadence
package.name = deecadence
package.domain = com.dccreations

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,json
source.exclude_dirs = .git,__pycache__,bin,.buildozer

version = 0.2.0
requirements = python3==3.10.14,kivy==2.3.0,kivymd==1.2.0,pillow
orientation = portrait
fullscreen = 0

android.permissions = INTERNET
android.api = 35
android.minapi = 23
android.ndk = 25b
android.ndk_api = 23
android.archs = arm64-v8a
android.allow_backup = True
android.enable_androidx = True

[buildozer]
log_level = 2
warn_on_root = 1

