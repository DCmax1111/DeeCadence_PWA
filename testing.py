
python -c "
from core.database import Database
db = Database()
db.initialize()
db.execute(\"INSERT OR REPLACE INTO app_settings (key, value) VALUES ('subscription_tier', 'pioneer')\")
db.execute(\"INSERT OR REPLACE INTO app_settings (key, value) VALUES ('subscriptions_active', '1')\")
db.close()
print('Pioneer activated locally')
"

python -c "
from core.database import Database
db = Database()
db.initialize()
db.execute(\"INSERT OR REPLACE INTO app_settings (key, value) VALUES ('subscription_tier', 'free')\")
db.execute(\"INSERT OR REPLACE INTO app_settings (key, value) VALUES ('subscriptions_active', '1')\")
db.close()
print('Free tier active — gates engaged')
"

python -c "
from core.database import Database
db = Database()
db.initialize()
db.execute(\"INSERT OR REPLACE INTO app_settings (key, value) VALUES ('subscriptions_active', '0')\")
db.close()
print('Testing mode — all features unlocked')
"
