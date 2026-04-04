CREATE_TABLES = [
    # Financial
    """
    CREATE TABLE IF NOT EXISTS transactions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        type        TEXT NOT NULL CHECK(type IN ('income','expense')),
        amount      REAL NOT NULL,
        category    TEXT NOT NULL,
        note        TEXT,
        date        TEXT NOT NULL,
        created_at  TEXT DEFAULT (datetime('now'))
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS financial_goals (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        target      REAL NOT NULL,
        current     REAL DEFAULT 0,
        deadline    TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
    )
    """,
    # Stats — one row per stat, upserted on change
    """
    CREATE TABLE IF NOT EXISTS stats (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        name    TEXT UNIQUE NOT NULL,
        value   REAL DEFAULT 50,
        rank    TEXT DEFAULT 'E'
    )
    """,
    # Seed default stats if not present
    """
    INSERT OR IGNORE INTO stats (name, value) VALUES
        ('Body',      1),
        ('Mind',      1),
        ('Spirit',    1),
        ('Knowledge', 1),
        ('Financial', 1),
        ('Dexterity', 1)
    """,
]