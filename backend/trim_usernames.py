from app import create_app
from models import db, Admin, User

app = create_app()

with app.app_context():
    print("Trimming Admin usernames...")
    admins = Admin.query.all()
    for a in admins:
        if a.username != a.username.strip():
            print(f"  Trimming '{a.username}' -> '{a.username.strip()}'")
            a.username = a.username.strip()
    
    print("\nTrimming User usernames...")
    users = User.query.all()
    for u in users:
        if u.username != u.username.strip():
            print(f"  Trimming '{u.username}' -> '{u.username.strip()}'")
            u.username = u.username.strip()
            
    db.session.commit()
    print("\n✅ Done!")
