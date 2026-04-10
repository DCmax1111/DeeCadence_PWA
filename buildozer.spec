[app]
title = Dee_Cistem
package.name = deecistem
package.domain = com.dccreations

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,db

version = 0.1.0

requirements = python3,kivy==2.3.0,kivymd==1.2.0,sqlite3,pillow,requests,numpy

orientation = portrait
fullscreen = 0

android.permissions = INTERNET,WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE,RECORD_AUDIO

android.api = 33
android.minapi = 26
android.ndk = 25b
android.archs = arm64-v8a

android.allow_backup = True

[buildozer]
log_level = 2
warn_on_root = 1
