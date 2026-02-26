from flask import Blueprint, request, jsonify, session
import datetime
from models import db, Admin, Log

admins_bp = Blueprint('admins', __name__)

def generate_admin_id(role):
    """Generates a custom ID for admin roles."""
    prefix = {
        'superadmin': 'SA',
        'admin': 'AD',
        'mentor': 'MT'
    }.get(role.lower(), 'AD')  # Default to Admin prefix

    count = Admin.query.filter(Admin.role.ilike(role)).count()
    year_short = datetime.datetime.now().strftime("%y")
    return f"{prefix}/IN/{year_short}/{str(count + 1).zfill(4)}"

@admins_bp.route("/admins", methods=["GET"])
def get_admins():
    """Get all admins, optionally filtered by role."""
    role_filter = request.args.get("role")
    query = Admin.query
    if role_filter:
        # Allow filtering for specific admin roles like 'admin', 'superadmin', 'mentor'
        query = query.filter(Admin.role.ilike(f"%{role_filter}%"))

    admins = query.all()
    return jsonify([admin.to_dict() for admin in admins])

@admins_bp.route("/admins", methods=["POST"])
def create_admin():
    """Create a new admin or mentor."""
    data = request.json
    try:
        designation = data.get("designation")
        role = data.get("role", "admin")
        
        # Automatically set role to 'mentor' if designation is 'Mentor'
        if designation and designation.lower() == "mentor":
            role = "mentor"

        custom_id = data.get("adminId") or generate_admin_id(role)
        # Prefer an explicit 'username' field; fall back to fullName
        username = data.get("username") or data.get("fullName")

        new_admin = Admin(
            custom_id=custom_id,
            username=username,
            email=data.get("email"),
            role=role,
            domain=data.get("Domain"), 
            designation=designation,
            status=data.get("status", "Active")
        )
        new_admin.set_password(data.get("password", "123"))
        db.session.add(new_admin)
        db.session.commit()
        return jsonify(new_admin.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admins_bp.route("/admins/<int:admin_id>", methods=["PUT"])
def update_admin(admin_id):
    """Update an existing admin."""
    admin = Admin.query.get(admin_id)
    if not admin:        return jsonify({"error": "Admin not found"}), 404
 
    data = request.json
    try:
        if "adminId" in data: admin.custom_id = data["adminId"]
        if "fullName" in data: admin.username = data["fullName"]
        if "email" in data: admin.email = data["email"]
        if "password" in data and data["password"]: admin.set_password(data["password"])
        if "role" in data: admin.role = data["role"]
        if "Domain" in data: admin.domain = data["Domain"]
        if "designation" in data: 
            admin.designation = data["designation"]
            # Automatically set role to 'mentor' if designation is 'Mentor'
            if admin.designation and admin.designation.lower() == "mentor":
                admin.role = "mentor"
        if "status" in data: admin.status = data["status"]

        db.session.commit()
        return jsonify(admin.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admins_bp.route("/admins/<int:admin_id>", methods=["DELETE"])
def delete_admin(admin_id):
    """Delete an admin."""
    admin = Admin.query.get(admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404

    try:
        db.session.delete(admin)
        db.session.commit()
        return jsonify({"success": True, "message": "Admin deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500