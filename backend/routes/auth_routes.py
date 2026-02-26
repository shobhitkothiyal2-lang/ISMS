import datetime
from flask import Blueprint, request, jsonify
from models import db, Admin, User, Log
from sqlalchemy import or_

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Handles login for ALL users — checks Admin table first, then User table.
    Matches by username OR email so full-name usernames still work via email.
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Request body must be JSON"}), 400

    identifier = data.get('username', '').strip()   # could be username or email
    password   = data.get('password', '').strip()

    if not identifier or not password:
        return jsonify({"success": False, "message": "Username and password are required"}), 400

    # Search Admin table by username OR email
    user = Admin.query.filter(
        or_(Admin.username == identifier, Admin.email == identifier)
    ).first()

    # Fall back to User table
    if not user:
        user = User.query.filter(
            or_(User.username == identifier, User.email == identifier)
        ).first()

    if user and user.check_password(password):
        try:
            user.status = "Active"
            new_log = Log(
                login_time=datetime.datetime.now().isoformat(),
                username=user.username,
                email=user.email,
                domain=getattr(user, 'domain', ''),
                role=user.role,
                designation=getattr(user, 'designation', 'N/A'),
                action="User Logged In"
                
            )
            
            db.session.add(new_log)
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({
            "success": True,
            "message": "Login successful",
            "user": user.to_dict()
        }), 200

    return jsonify({"success": False, "message": "Invalid username or password"}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Handles user logout, updates status, and creates a log entry.
    """
    try:
        data = request.get_json()
        username = data.get('username')

        if not username:
            return jsonify({"success": False, "message": "Username is required for logout"}), 400

        user = Admin.query.filter_by(username=username).first() or \
               User.query.filter_by(username=username).first()

        if user:
            user.status = "Offline"

            # Find the last active session for this user (where logout_time is None)
            last_log = Log.query.filter_by(username=user.username)\
                                .filter(Log.logout_time == None)\
                                .order_by(Log.id.desc())\
                                .first()
            
            if last_log:
                last_log.logout_time = datetime.datetime.now().isoformat()
                last_log.action = "User Session Completed"
                db.session.commit()
            # If no active log found (e.g. server restart), we just update status without log update

        return jsonify({"success": True, "message": "Logged out successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": "Server error during logout", "error": str(e)}), 500
