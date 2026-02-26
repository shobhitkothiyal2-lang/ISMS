from flask import Blueprint, request, jsonify, session
import datetime
from models import db, User, Log

users_bp = Blueprint('users', __name__)

def generate_user_id():
    """Generates a custom ID for a standard User."""
    prefix = 'US'
    count = User.query.count()
    year_short = datetime.datetime.now().strftime("%y")
    return f"{prefix}/IN/{year_short}/{str(count + 1).zfill(4)}"



# Get All Users Route
@users_bp.route("/users", methods=["GET"])
def get_users():
    # This route now exclusively handles standard Users.
    role_filter = request.args.get("role")

    query = User.query
    if role_filter:
        query = query.filter(User.role.ilike(f'%{role_filter}%'))

    users = query.all()
    return jsonify([u.to_dict() for u in users])

# User Management Routes
@users_bp.route("/users", methods=["POST"])
def create_user():
    data = request.json
    try:
        custom_id = data.get("userId") or generate_user_id()

        new_user = User(
            custom_id=custom_id,
            username=data.get("fullName"),
            email=data.get("email"),
            role="User",
            domain=data.get("Domain", data.get("department", "")),
            designation=data.get("designation", ""),
            status=data.get("status", "Active")
        )
        new_user.set_password(data.get("password", "123"))
        db.session.add(new_user)
        db.session.commit()
        return jsonify(new_user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@users_bp.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = request.json
    try:
        if "userId" in data: user.custom_id = data["userId"]
        if "fullName" in data: user.username = data["fullName"]
        if "email" in data: user.email = data["email"]
        if "password" in data and data["password"]: user.set_password(data["password"])
        if "Domain" in data: user.domain = data["Domain"]
        if "designation" in data: user.designation = data["designation"]
        if "status" in data: user.status = data["status"]
        db.session.commit()
        return jsonify(user.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Delete Route (Universal)
@users_bp.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        username_to_delete = user.username
        db.session.delete(user)

        # Log deletion
        try:
            current_user_email = session.get("user", "System")
            new_log = Log(
                login_time=datetime.datetime.now().isoformat(),
                email=current_user_email,
                role=session.get("role", "System"),
                action=f"Deleted User: {username_to_delete}"
            )
            db.session.add(new_log)
        except Exception as log_error:
            print(f"Error logging deletion: {log_error}")

        db.session.commit()
        return jsonify({"success": True, "message": "User deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
