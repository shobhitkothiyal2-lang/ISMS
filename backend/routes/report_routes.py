from flask import Blueprint, request, jsonify, session
from models import db, DailyReport, WeeklyReport, Log, User, Admin
import datetime
import time

DailyReport_bp = Blueprint('DailyReport', __name__)
WeeklyReport_bp = Blueprint('WeeklyReport', __name__)

# ─────────────────────────────────────────────
#  DAILY REPORTS
# ─────────────────────────────────────────────

@DailyReport_bp.route("/daily-reports", methods=["GET"])
def get_daily_reports():
    try:
        reports = DailyReport.query.all()
        return jsonify([r.to_dict() for r in reports])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@DailyReport_bp.route("/daily-reports", methods=["POST"])
def create_daily_report():
    data = request.json
    report_id = data.get("id") or f"DR-{int(time.time()*1000)}"

    new_report = DailyReport(
        id=report_id,
        title=data.get("title", "Daily Report"),
        projectName=data.get("projectName"),
        designation=data.get("designation"),
        name=data.get("name"),
        createdBy=data.get("createdBy"),
        status=data.get("status", "Pending"),
        date=data.get("date"),
        day=data.get("day"),
        reportContent=data.get("reportContent"),
        mobileNumber=data.get("mobileNumber"),
        email=data.get("email"),
    )
    try:
        db.session.add(new_report)

        active_name = session.get("user")
        active_user = Admin.query.filter_by(username=active_name).first() or \
                      User.query.filter_by(username=active_name).first()

        new_log = Log(
            login_time=datetime.datetime.now().isoformat(),
            email=active_user.email if active_user else (data.get("email") or "system"),
            domain=active_user.domain if active_user else "Reports",
            role=active_user.role if active_user else "User",
            action=f"Submitted Daily Report: {new_report.id}"
        )
        db.session.add(new_log)
        db.session.commit()
        return jsonify(new_report.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@DailyReport_bp.route("/daily-reports/<report_id>", methods=["DELETE"])
def delete_daily_report(report_id):
    report = DailyReport.query.get(report_id)
    if not report:
        return jsonify({"success": False, "message": "Daily report not found"}), 404
        
    try:
        rid = report.id
        db.session.delete(report)

        active_name = session.get("user")
        active_user = Admin.query.filter_by(username=active_name).first() or \
                      User.query.filter_by(username=active_name).first()

        new_log = Log(
            login_time=datetime.datetime.now().isoformat(),
            email=active_user.email if active_user else "system",
            domain=active_user.domain if active_user else "Reports",
            role=active_user.role if active_user else "User",
            action=f"Deleted Daily Report: {rid}"
        )
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"success": True, "message": "Daily report deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
#  WEEKLY REPORTS
# ─────────────────────────────────────────────

@WeeklyReport_bp.route("/weekly-reports", methods=["GET"])
def get_weekly_reports():
    try:
        reports = WeeklyReport.query.all()
        return jsonify([r.to_dict() for r in reports])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@WeeklyReport_bp.route("/weekly-reports", methods=["POST"])
def create_weekly_report():
    data = request.json
    report_id = data.get("id") or f"WR-{int(time.time()*1000)}"

    new_report = WeeklyReport(
        id=report_id,
        title=data.get("title", "Weekly Report"),
        projectName=data.get("projectName"),
        designation=data.get("designation"),
        name=data.get("name"),
        createdBy=data.get("createdBy"),
        status=data.get("status", "Pending"),
        date=data.get("date"),
        day=data.get("day"),
        reportContent=data.get("reportContent"),
        weeklySummary=data.get("weeklySummary"),
        attachmentName=data.get("attachmentName"),
        mobileNumber=data.get("mobileNumber"),
        email=data.get("email"),
    )
    try:
        db.session.add(new_report)

        active_name = session.get("user")
        active_user = Admin.query.filter_by(username=active_name).first() or \
                      User.query.filter_by(username=active_name).first()

        new_log = Log(
            login_time=datetime.datetime.now().isoformat(),
            email=active_user.email if active_user else (data.get("email") or "system"),
            domain=active_user.domain if active_user else "Reports",
            role=active_user.role if active_user else "User",
            action=f"Submitted Weekly Report: {new_report.id}"
        )
        db.session.add(new_log)
        db.session.commit()
        return jsonify(new_report.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@WeeklyReport_bp.route("/weekly-reports/<report_id>", methods=["DELETE"])
def delete_weekly_report(report_id):
    report = WeeklyReport.query.get(report_id)
    if not report:
        return jsonify({"success": False, "message": "Weekly report not found"}), 404
        
    try:
        rid = report.id
        db.session.delete(report)

        active_name = session.get("user")
        active_user = Admin.query.filter_by(username=active_name).first() or \
                      User.query.filter_by(username=active_name).first()

        new_log = Log(
            login_time=datetime.datetime.now().isoformat(),
            email=active_user.email if active_user else "system",
            domain=active_user.domain if active_user else "Reports",
            role=active_user.role if active_user else "User",
            action=f"Deleted Weekly Report: {rid}"
        )
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"success": True, "message": "Weekly report deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
