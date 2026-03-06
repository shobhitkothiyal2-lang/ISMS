from datetime import datetime
from flask import Blueprint, jsonify, request
from models import db, Log, Activity
from config import Config
import json
import os
import base64

activity_bp = Blueprint('activity', __name__)


@activity_bp.route("/activity", methods=["POST"])
def save_activity():
    data = request.json

    try:
        screenshot_data = data.get("screenshot")
        file_path = None

        #  HANDLE SCREENSHOT HERE
        if screenshot_data:
            header, encoded = screenshot_data.split(",", 1)
            image_bytes = base64.b64decode(encoded)

            os.makedirs(Config.SCREENSHOT_FOLDER, exist_ok=True)

            filename = f"{data.get('username')}_{int(datetime.utcnow().timestamp())}.png"
            file_path = os.path.join(Config.SCREENSHOT_FOLDER, filename)

            with open(file_path, "wb") as f:
                f.write(image_bytes)

        action_type = data.get("action", "").lower()
        is_logout = "logout" in action_type or "log out" in action_type or "logged out" in action_type
        
        #  Create Log entry
        new_log = Log(
            login_time=datetime.now().isoformat() if not is_logout else None,
            logout_time=datetime.now().isoformat() if is_logout else None,
            username=data.get("username"),
            email=data.get("email", "system@gmail.com"),
            domain=data.get("app_url","Application"),
            role="User",
            action=data.get("action")
        )

        #  Create Activity entry
        new_activity = Activity(
            username=data.get("username"),
            action=data.get("action"),
            login_time=datetime.now() if data.get("action") == "login" else None,
            logout_time=datetime.now() if data.get("action") == "logout" else None,
            idle_time=data.get("idle_time"),
            screenshot_path=file_path,  # ✅ save file path, not base64
            app_url=data.get("app_url"),
            activity_metadata=json.dumps({
                "timestamp": data.get("timestamp")
            }) if data.get("timestamp") else None,
            created_at=datetime.utcnow()
        )

        db.session.add(new_log)
        db.session.add(new_activity)
        db.session.commit()

        return jsonify({"success": True}), 201

    except Exception as e:
        db.session.rollback()
        print("ERROR:", e)
        return jsonify({"success": False, "error": str(e)}), 500