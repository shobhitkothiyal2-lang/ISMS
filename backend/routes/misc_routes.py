from flask import Blueprint, jsonify
from models import Log

misc_bp = Blueprint('misc', __name__)

@misc_bp.route("/logs", methods=["GET"])
def get_logs():
    logs = Log.query.order_by(Log.id.desc()).limit(20).all()
    return jsonify([l.to_dict() for l in logs])

@misc_bp.route("/mentors/performance", methods=["GET"])
def get_mentor_performance():
    # Mock data as requested previously
    mentors = []
    return jsonify(mentors)
