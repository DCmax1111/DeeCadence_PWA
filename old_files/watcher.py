"""
Run this instead of main.py during development.
Watches all .py files and auto-restarts the app on changes.
Usage: python watcher.py
"""
import subprocess
import sys
import time
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

APP_PROCESS = None


def start_app():
    global APP_PROCESS
    if APP_PROCESS:
        APP_PROCESS.terminate()
        APP_PROCESS.wait()
    print("\n🔄 Starting Dee_Cistem...\n")
    APP_PROCESS = subprocess.Popen(
        [sys.executable, "main.py"],
        cwd=os.path.dirname(os.path.abspath(__file__))
    )


class ReloadHandler(FileSystemEventHandler):
    def __init__(self):
        self._last_reload = 0

    def on_modified(self, event):
        if event.is_directory:
            return
        if not event.src_path.endswith('.py'):
            return
        # Debounce — ignore rapid successive changes
        now = time.time()
        if now - self._last_reload < 1.5:
            return
        self._last_reload = now
        print(f"📝 Changed: {event.src_path}")
        start_app()


if __name__ == "__main__":
    try:
        from watchdog.observers import Observer
    except ImportError:
        print("Installing watchdog...")
        subprocess.run([sys.executable, "-m", "pip",
                       "install", "watchdog"])
        from watchdog.observers import Observer

    start_app()
    handler = ReloadHandler()
    observer = Observer()
    observer.schedule(handler, path=".", recursive=True)
    observer.start()
    print("👁  Watching for changes... (Ctrl+C to stop)")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        if APP_PROCESS:
            APP_PROCESS.terminate()
    observer.join()

