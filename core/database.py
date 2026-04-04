import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'the_system.db')

class Database:
    def __init__(self):
        self.conn = None
        self.cursor = None

    def initialize(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        self._run_migrations()

    def _run_migrations(self):
        from core.models import CREATE_TABLES
        for statement in CREATE_TABLES:
            self.cursor.execute(statement)
        self.conn.commit()

    def execute(self, query, params=()):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor

    def fetchall(self, query, params=()):
        self.cursor.execute(query, params)
        return self.cursor.fetchall()

    def fetchone(self, query, params=()):
        self.cursor.execute(query, params)
        return self.cursor.fetchone()

    def close(self):
        if self.conn:
            self.conn.close()

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

