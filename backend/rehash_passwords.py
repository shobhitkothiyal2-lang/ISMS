"""
One-time migration: re-hash all plain-text passwords in admins/users tables.
Run ONCE with: python rehash_passwords.py
Safe to run multiple times — skips records already hashed.
"""
from werkzeug.security import generate_password_hash, is_password_hash

from app import create_app
from models import db, Admin, User

app = create_app()

def is_already_hashed(pw: str) -> bool:
    """Detect if a password is already a werkzeug hash (starts with pbkdf2, scrypt, etc.)."""
    if not pw:
        return False
    return pw.startswith(("pbkdf2:", "scrypt:", "argon2:", "$"))

with app.app_context():
    updated = 0

    print("\n🔒 Re-hashing Admin passwords...")
    for admin in Admin.query.all():
        if not is_already_hashed(admin.password):
            plain = admin.password
            admin.password = generate_password_hash(plain)
            print(f"  ✅ Admin '{admin.username}' — hashed (was: '{plain}')")
            updated += 1
        else:
            print(f"  ⏭️  Admin '{admin.username}' — already hashed, skipping")

    print("\n🔒 Re-hashing User passwords...")
    for user in User.query.all():
        if not is_already_hashed(user.password):
            plain = user.password
            user.password = generate_password_hash(plain)
            print(f"  ✅ User '{user.username}' — hashed (was: '{plain}')")
            updated += 1
        else:
            print(f"  ⏭️  User '{user.username}' — already hashed, skipping")

    db.session.commit()
    print(f"\n✅ Done! {updated} password(s) updated.\n")
