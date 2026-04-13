[app]
title = Dee_Cistem
package.name = deecistem
package.domain = com.dccreations

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,db
source.exclude_dirs = tests,bin,.buildozer,.github,assets/fonts,draft
source.exclude_patterns = testing.py,watcher.py,*.md,*.yml,*.spec,*.log,*.txt,requirements.txt

version = 0.1.0

requirements = python3==3.10.14,kivy==2.3.0,kivymd==1.2.0,pillow

orientation = portrait
fullscreen = 0

android.permissions = INTERNET,WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE

android.api = 33
android.minapi = 21
android.ndk = 25b
android.ndk_api = 21
android.build_tools_version = 34.0.0
android.archs = arm64-v8a
android.allow_backup = True
android.accept_sdk_license = True

[buildozer]
log_level = 2
warn_on_root = 1
