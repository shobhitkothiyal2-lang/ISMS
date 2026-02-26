//Super Admin Dashboard 
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "./config";
import logo from "../static/NNlogo.jpeg";

const SuperAdmin = () => {
  const location = useLocation();
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dailyReports, setDailyReports] = useState([]);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);
  const [showReportForm, setShowReportForm] = useState(null); // 'daily' or 'weekly'
  const [currentUser, setCurrentUser] = useState({ name: 'Super Admin', domain: 'xyz' });
  const [editingData, setEditingData] = useState(null);
  const [monthlyReportData, setMonthlyReportData] = useState([]);
  const [showMonthlyReportTable, setShowMonthlyReportTable] = useState(false);
  const [logsData, setLogsData] = useState([]);
  const pollingIntervalRef = useRef(null);
  const [selectedReport, setSelectedReport] = useState(null);


  // Report form state
  const [reportFormData, setReportFormData] = useState({
    id: "",
    name: "",
    reportContent: "",
    date: new Date().toISOString().split('T')[0],
    day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()),
    designation: "",
    projectName: "",
    mobileNumber: "",
    email: "",
    attachment: null,
    weeklySummary: "",
  });

  const handleLogout = async () => {
    try {
      if (currentUser && currentUser.name) {
        // Record logout activity
        await fetch(`${API_BASE_URL}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: currentUser.name,
            action: 'logout',
            app_url: 'Super Admin Dashboard'
          }),
        });

        await fetch(`${API_BASE_URL}/api/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUser.name }),
        });
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const handleSetActiveView = (view) => {
    navigate(`/super-admin/${view === 'dashboard' ? '' : view}`);
  };

  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: "--",
    totalAdmins: "--",
    averageActivity: "--",
    topDomain: "--",
    overallProductivity: "--",
    monthYear: new Date().toLocaleString("default", {
      month: "long",
      year: "numeric",
    }),
  });

  const fetchDashboardData = () => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/admins`).then((res) => res.json()),
      fetch(`${API_BASE_URL}/api/users`).then((res) => res.json()),
      fetch(`${API_BASE_URL}/api/logs`).then((res) => res.json()),
    ])
      .then(([adminsData, usersData, logsDataResponse]) => {
        setMonthlyReportData(usersData);
        setLogsData(logsDataResponse || []);
        const activeEmployees = usersData.filter((e) => e.status === "Active").length;
        const avgActivity = usersData.length > 0
          ? Math.round((activeEmployees / usersData.length) * 100)
          : 0;

        setDashboardStats((prev) => ({
          ...prev,
          totalUsers: usersData.length,
          totalAdmins: adminsData.length,
          averageActivity: avgActivity + "%",
          topDomain: usersData.length > 0
            ? [...usersData].sort((a, b) => (b.department || "").localeCompare(a.department || ""))[0]?.department
            : "--",
          overallProductivity: activeEmployees > 0 ? "Good" : "Pending",
        }));
      })
      .catch((err) => console.warn("Failed to update dashboard stats:", err));
  };

  useEffect(() => {
    const path = location.pathname;
    let view = "dashboard";

    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    if (path.endsWith("/create-admin")) view = "create-admin";
    else if (path.endsWith("/view-admins")) view = "view-admins";
    else if (path.endsWith("/create-user")) view = "create-user";
    else if (path.endsWith("/view-users")) view = "view-users";
    else if (path.endsWith("/daily-reports")) view = "daily-reports";
    else if (path.endsWith("/weekly-reports")) view = "weekly-reports";
    else if (path.endsWith("/system-settings")) view = "system-settings";
    else if (path.endsWith("/logs-audit")) view = "logs-audit";

    setActiveView(view);

    if (view === "dashboard") {
      setDashboardStats((prev) => ({
        ...prev,
        monthYear: new Date().toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
      }));
      fetchDashboardData();
      pollingIntervalRef.current = setInterval(fetchDashboardData, 3000);
    }

    if (view === "daily-reports") {
      fetchReports("daily");
      const mode = searchParams.get("mode");
      setShowReportForm(mode === "list" ? null : "daily");
    } else if (view === "weekly-reports") {
      fetchReports("weekly");
      const mode = searchParams.get("mode");
      setShowReportForm(mode === "list" ? null : "weekly");
    }

    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [location.pathname, searchParams]);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setCurrentUser(prev => ({
        ...prev,
        name: parsedUser.username,
        domain: parsedUser.domain || prev.domain,
        designation: parsedUser.designation || ''
      }));
    }
  }, []);

  // Fetch reports from backend API
  const fetchReports = async (reportType) => {
    try {
      setReportsLoading(true);
      setReportsError(null);
      // Use separate endpoints for daily and weekly reports
      const endpoint = reportType === "daily" ? "daily-reports" : "weekly-reports";
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${reportType} reports`);
      }

      const data = await response.json();

      if (reportType === "daily") {
        setDailyReports(data);
      } else if (reportType === "weekly") {
        setWeeklyReports(data);
      }
    } catch (error) {
      console.error(`Error fetching ${reportType} reports: `, error);
      setReportsError(error.message);
    } finally {
      setReportsLoading(false);
    }
  };



  // Handle report form submission
  const handleReportSubmit = async (e) => {
    e.preventDefault();

    try {
      setReportsLoading(true);
      setReportsError(null);

      const reportData = {
        id: reportFormData.id || `REP-${Date.now()}`,
        title: toTitleCase(reportFormData.projectName) || "New Report",
        projectName: toTitleCase(reportFormData.projectName) || "N/A",
        designation: toTitleCase(reportFormData.designation) || "Staff",
        name: toTitleCase(reportFormData.name) || "Unknown",
        createdBy: toTitleCase(reportFormData.name) || "superadmin",
        status: "Pending",
        date: reportFormData.date || new Date().toISOString().split('T')[0],
        day: reportFormData.day || new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()),
        reportContent: reportFormData.reportContent || "",
        weeklySummary: reportFormData.weeklySummary || "",
        attachmentName: reportFormData.attachment ? reportFormData.attachment.name : null,
        mobileNumber: reportFormData.mobileNumber || "",
        email: reportFormData.email || "",
        type: showReportForm.charAt(0).toUpperCase() + showReportForm.slice(1),
      };

      // Use separate endpoint based on report type
      const endpoint = showReportForm === "daily" ? "daily-reports" : "weekly-reports";
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error("Failed to create report");
      }

      const newReport = await response.json();

      // Update local state
      const updateFn = (prev) => [...prev, newReport];
      if (showReportForm === "daily") {
        setDailyReports(updateFn);
      } else if (showReportForm === "weekly") {
        setWeeklyReports(updateFn);
      }

      // Reset form
      setReportFormData({
        name: "",
        id: "",
        reportContent: "",
        date: new Date().toISOString().split('T')[0],
        day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()),
        designation: "",
        projectName: "",
        mobileNumber: "",
        email: "",
        attachment: null,
        weeklySummary: "",
      });

      setShowReportForm(null);
      if (showReportForm === "daily") {
        navigate("/super-admin/daily-reports?mode=list");
      } else if (showReportForm === "weekly") {
        navigate("/super-admin/weekly-reports?mode=list");
      }
      alert("Report created successfully!");
    } catch (error) {
      console.error("Error creating report:", error);
      setReportsError(error.message);
    } finally {
      setReportsLoading(false);
    }
  };

  // Handle report deletion
  const handleDeleteReport = async (reportType, reportId) => {
    try {
      setReportsLoading(true);
      // Use separate endpoint based on report type
      const endpoint = reportType === "daily" ? "daily-reports" : "weekly-reports";
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}/${reportId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete report");
      }

      // Update local state
      if (reportType === "daily") {
        setDailyReports(dailyReports.filter(r => r.id !== reportId));
      } else if (reportType === "weekly") {
        setWeeklyReports(weeklyReports.filter(r => r.id !== reportId));
      }

      alert("Report deleted successfully!");
    } catch (error) {
      console.error("Error deleting report:", error);
      setReportsError(error.message);
    } finally {
      setReportsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F0F4F8] font-sans text-slate-800">
      {/* Sidebar */}
      <aside
        className={`w-64 bg-white flex flex-col border-r border-slate-200 shrink-0 transition-all duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative z-30 h-full`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center px-6 bg-[#3b82f6] text-white font-bold text-xl tracking-wide shadow-md z-10">
          <span className="mr-2">⚡</span> SuperAdmin
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center text-blue-600 font-bold overflow-hidden">
              {/* <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                alt="User"
                className="w-full h-full"
              /> */}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">
                Hello, {currentUser.name}!
              </p>
              {/* <p className="text-xs text-slate-500">{currentUser.domain}</p> */}
              <p className="text-xs text-slate-500">{currentUser.designation}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <SidebarItem
            icon={<HomeIcon />}
            label="Dashboard"
            active={activeView === "dashboard"}
            onClick={() => handleSetActiveView("dashboard")}
          />

          <div className="pt-2 pb-1 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Management
          </div>
          {/* Create Admin */}
          <SidebarItem
            icon={<UserPlusIcon />}
            label="Create Admins"
            active={activeView === "create-admin"}
            onClick={() => { setEditingData(null); handleSetActiveView("create-admin"); }}
          />
          {/* Create User */}
          <SidebarItem
            icon={<UserPlusIcon />}
            label="Create User"
            active={activeView === "create-user"}
            onClick={() => { setEditingData(null); handleSetActiveView("create-user"); }}
          />

          {/* Manage Users  */}
          <SidebarItem
            icon={<UsersIcon />}
            label="Manage Users"
            active={activeView === "view-users"}
            onClick={() => handleSetActiveView("view-users")}
          />
          {/* Manage Admins */}
          <SidebarItem
            icon={<ShieldIcon />}
            label="Manage Admins"
            active={activeView === "view-admins"}
            onClick={() => handleSetActiveView("view-admins")}
          />
          <div className="pt-2 pb-1 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Analytics
          </div>
          {/* Reports */}
          <SidebarItem
            icon={<FileTextIcon />}
            label="Reports"
            hasSubmenu
            isOpen={reportsMenuOpen}
            onClick={() => setReportsMenuOpen(!reportsMenuOpen)}
            active={activeView === "daily-reports" || activeView === "weekly-reports"}
          >
            <div className="ml-9 mt-1 space-y-1 border-l-2 border-blue-200 pl-2">
              <button
                onClick={() => handleSetActiveView("daily-reports")}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${activeView === "daily-reports" ? "text-blue-600 font-medium" : "text-slate-600 hover:text-blue-600"}`}
              >
                Daily Reports
              </button>
              <button
                onClick={() => handleSetActiveView("weekly-reports")}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${activeView === "weekly-reports" ? "text-blue-600 font-medium" : "text-slate-600 hover:text-blue-600"}`}
              >
                Weekly Reports
              </button>
            </div>
          </SidebarItem>
          {/* Logs And Audit  */}
          <SidebarItem
            icon={<ActivityIcon />}
            label="Logs & Audit"
            active={activeView === "logs-audit"}
            onClick={() => handleSetActiveView("logs-audit")}
          />
          {/* System Settings  */}
          <SidebarItem
            icon={<SettingsIcon />}
            label="System Settings"
            active={activeView === "system-settings"}
            onClick={() => handleSetActiveView("system-settings")}
          />
        </nav>

        {/* Bottom User Info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">
                {currentUser.name} <br></br>{currentUser.domain}
              </p>
            </div>
          </div>
          {/* Logout */}
          <div className="mt-3 space-y-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <LogOutIcon size={16} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm">
          <div className="flex items-center flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden mr-4 p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <MenuIcon />
            </button>
            <div className="relative w-full max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-full leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all sm:text-sm"
                placeholder="Search reports..."
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors relative">
              <BellIcon />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>
            <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
              <HelpCircleIcon />
            </button>
            <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 overflow-hidden">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                alt="Profile"
              />
            </div>
          </div>
        </header>

        {/* Heading  */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeView === "dashboard" && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <span>Hello, <span className="text-blue-600">{currentUser.name}</span>!</span>
                    {currentUser.designation && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-100 uppercase tracking-wider shadow-sm">
                        {currentUser.designation}
                      </span>
                    )}
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Here's what's happening with your projects today.
                  </p>
                </div>
                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <LogOutIcon size={16} className="mr-2 text-slate-500" />{" "}
                  Logout
                </button>
              </div>

              {/* System Overview Widgets */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">
                  System Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatsCard
                    title="Total Users"
                    value={dashboardStats.totalUsers}
                    icon={<UsersIcon size={24} className="text-white" />}
                    color="bg-blue-600"
                    subtext="Total Users"
                  />
                  <StatsCard
                    title="Total Admins"
                    value={dashboardStats.totalAdmins}
                    icon={<ShieldIcon size={24} className="text-white" />}
                    color="bg-blue-500"
                    subtext="Total Admins"
                  />
                  <StatsCard
                    title="Average Activity"
                    value={dashboardStats.averageActivity}
                    icon={<ClockIcon size={24} className="text-white" />}
                    color="bg-blue-400"
                    subtext="Average Activity"
                  />
                </div>
              </div>

              {/* Live Monitoring & Reports Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Live Monitoring Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1 flex flex-col">
                  <div className="p-5 flex justify-between items-center bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800">
                      Live Monitoring
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSetActiveView("create-admin")}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                      >
                        Create Admins
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="shrink-0 w-40 h-28 bg-slate-100 rounded-lg border border-slate-200 relative group overflow-hidden"
                        >
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50">
                            <MonitorIcon
                              className="text-slate-400 opacity-50"
                              size={32}
                            />
                          </div>
                          {/* Simulated screen content */}
                          <div className="absolute top-2 left-2 right-2 h-2 bg-white/60 rounded-sm"></div>
                          <div className="absolute top-5 left-2 w-12 h-16 bg-blue-100/50 rounded-sm"></div>
                          <div className="absolute top-5 right-2 w-20 h-8 bg-slate-300/50 rounded-sm"></div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2">
                        <MonitorIcon size={18} /> Live Monitoring
                      </button>
                    </div>
                  </div>
                </div>

                {/* Monthly Progress Report Section */}
                <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col ${showMonthlyReportTable ? 'lg:col-span-2' : ''}`}>
                  <div className="p-4 bg-blue-600 flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <FileTextIcon size={18} />
                      <h3 className="font-bold text-md">
                        Monthly Progress Report
                      </h3>
                    </div>
                    {showMonthlyReportTable && (
                      <button
                        onClick={() => setShowMonthlyReportTable(false)}
                        className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
                      >
                        Back to Summary
                      </button>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    {!showMonthlyReportTable ? (
                      <>
                        <h4 className="font-bold text-xl text-slate-800 mb-4">
                          {dashboardStats.monthYear}
                        </h4>

                        <ul className="space-y-4 mb-8 flex-1">
                          <li className="flex items-center gap-3 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span className="text-slate-500">
                              Total Users Monitored:
                            </span>
                            <span className="font-bold text-slate-800 ml-auto">
                              {dashboardStats.totalUsers}
                            </span>
                          </li>
                          <li className="flex items-center gap-3 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span className="text-slate-500">
                              Total Admins Monitored:
                            </span>
                            <span className="font-bold text-slate-800 ml-auto">
                              {dashboardStats.totalAdmins}
                            </span>
                          </li>
                          <li className="flex items-center gap-3 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span className="text-slate-500">
                              Average Activity:
                            </span>
                            <span className="font-bold text-slate-800 ml-auto">
                              {dashboardStats.averageActivity}
                            </span>
                          </li>
                          <li className="flex items-center gap-3 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span className="text-slate-500">
                              Top Performing Domain:
                            </span>
                            <span className="font-bold text-slate-800 ml-auto">
                              {dashboardStats.topDomain}
                            </span>
                          </li>
                          <li className="flex items-center gap-3 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span className="text-slate-500">
                              Overall Productivity:
                            </span>
                            <span className="font-bold text-green-600 ml-auto bg-green-50 px-2 py-0.5 rounded">
                              {dashboardStats.overallProductivity}
                            </span>
                          </li>
                        </ul>

                        <button
                          onClick={() => setShowMonthlyReportTable(true)}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all"
                        >
                          Generate Report
                        </button>
                      </>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                              <th className="px-4 py-3">User ID</th>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Designation</th>
                              <th className="px-4 py-3">Domain</th>
                              <th className="px-4 py-3">Activity Score</th>
                              <th className="px-4 py-3">Productivity (%)</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {monthlyReportData.length === 0 ? (
                              <tr><td colSpan="7" className="p-4 text-center text-slate-400">No data available</td></tr>
                            ) : (
                              monthlyReportData.map((user, idx) => (
                                <tr key={user.id || idx} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-mono text-xs">{user.custom_id || user.id || 'N/A'}</td>
                                  <td className="px-4 py-3 font-medium text-slate-800">{user.username}</td>
                                  <td className="px-4 py-3 text-slate-600">{user.employmentType || user.role || 'N/A'}</td>
                                  <td className="px-4 py-3 text-slate-600">{user.domain || 'N/A'}</td>
                                  <td className="px-4 py-3 text-slate-600">{user.status === 'Active' ? Math.floor(Math.random() * (100 - 70 + 1) + 70) : 0}</td>
                                  <td className="px-4 py-3 text-slate-600">{user.status === 'Active' ? Math.floor(Math.random() * (100 - 80 + 1) + 80) : 0}%</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {user.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Log Activity Section - Super Admin Dashboard */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/10">
                  <h3 className="font-bold text-lg text-slate-800">Recent Log Activity</h3>
                  <button onClick={() => handleSetActiveView('logs-audit')} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-blue-600 flex items-center gap-2 hover:bg-slate-50 font-bold uppercase tracking-wider">
                    View All Logs
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 uppercase bg-slate-50/50 tracking-widest font-bold">
                      <tr>
                        <th className="px-6 py-4">Log ID</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Login Time</th>
                        <th className="px-6 py-4">Logout Time</th>
                        <th className="px-6 py-4">Username</th>
                        <th className="px-6 py-4">Designation</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Domain</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                      {logsData.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-6 py-10 text-center text-slate-400 text-sm">
                            No recent log activities recorded.
                          </td>
                        </tr>
                      ) : (
                        logsData.slice(0, 5).map((log) => (
                          <LogAuditRow
                            key={log.id}
                            {...log}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Folders */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FolderCard
                  title="Daily Reports"
                  icon={<FileTextIcon size={24} className="text-yellow-600" />}
                  onClick={() => navigate("/super-admin/daily-reports?mode=list")}
                />
                <FolderCard
                  title="Weekly Reports"
                  icon={<FileTextIcon size={24} className="text-blue-600" />}
                  color="blue"
                  onClick={() => navigate("/super-admin/weekly-reports?mode=list")}
                />

              </div>
            </>
          )}

          {activeView === "create-admin" && (
            <CreateAdminForm
              onViewList={() => handleSetActiveView("view-admins")}
              initialData={editingData}
            />
          )}
          {activeView === "view-admins" && (
            <AdminList
              onCreateNew={() => { setEditingData(null); handleSetActiveView("create-admin"); }}
              onEdit={(admin) => { setEditingData(admin); handleSetActiveView("create-admin"); }}
            />
          )}

          {activeView === "create-user" && (
            <CreateUserForm
              onViewList={() => handleSetActiveView("view-users")}
              initialData={editingData}
            />
          )}
          {activeView === "view-users" && (
            <UserList
              onCreateNew={() => { setEditingData(null); handleSetActiveView("create-user"); }}
              onEdit={(user) => { setEditingData(user); handleSetActiveView("create-user"); }}
            />
          )}

          {/* Daily Reports View */}
          {activeView === "daily-reports" && (
            <ReportView
              reportType="daily"
              reports={dailyReports}
              loading={reportsLoading}
              error={reportsError}
              showForm={showReportForm === "daily"}
              onShowForm={() => navigate("/super-admin/daily-reports?mode=form")}
              onHideForm={() => navigate("/super-admin/daily-reports?mode=list")}
              formData={reportFormData}
              onFormChange={setReportFormData}
              onFormSubmit={handleReportSubmit}
              onDelete={(id) => handleDeleteReport("daily", id)}
              onViewReport={setSelectedReport}
            />
          )}

          {/* Weekly Reports View */}
          {activeView === "weekly-reports" && (
            <ReportView
              reportType="weekly"
              reports={weeklyReports}
              loading={reportsLoading}
              error={reportsError}
              showForm={showReportForm === "weekly"}
              onShowForm={() => navigate("/super-admin/weekly-reports?mode=form")}
              onHideForm={() => navigate("/super-admin/weekly-reports?mode=list")}
              formData={reportFormData}
              onFormChange={setReportFormData}
              onFormSubmit={handleReportSubmit}
              onDelete={(id) => handleDeleteReport("weekly", id)}
              onViewReport={setSelectedReport}
            />
          )}
          {/* Logs And Audit View */}
          {activeView === "logs-audit" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <button onClick={() => handleSetActiveView('dashboard')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                      <ChevronLeftIcon size={20} />
                    </button>
                    System Audit Logs
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">A detailed trail of all administrative and user activities</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Log ID</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Login Time</th>
                      <th className="px-6 py-4">Logout Time</th>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Designation</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Domain</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logsData.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-12 text-center text-slate-400 italic">
                          No audit logs found.
                        </td>
                      </tr>
                    ) : (
                      logsData.map((log) => (
                        <LogAuditRow
                          key={log.id}
                          {...log}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* Sidebar Overlay for Mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-20 md:hidden transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        ></button>

        {/* Report Preview Modal */}
        {selectedReport && (
          <ReportDetailsModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </div>
    </div>
  );
};

// --- Components ---

//Admin Form (For Creating New Admin)
const CreateAdminForm = ({ onViewList, initialData }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    adminId: "",
    role: "admin",
    Domain: "",
    designation: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        fullName: initialData.username || "",
        email: initialData.email || "",
        password: "",
        adminId: initialData.custom_id || "",
        role: initialData.role || "",
        Domain: initialData.domain || initialData.Domain || "",
        designation: initialData.designation || "",
      });
    } else {
      setFormData({
        fullName: "",
        email: "",
        password: "",
        adminId: "",
        role: "admin",
        Domain: "",
        designation: "",
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formattedData = {
        ...formData,
        fullName: toTitleCase(formData.fullName),
        Domain: toTitleCase(formData.Domain),
      };

      const url = initialData
        ? `${API_BASE_URL}/api/admins/${initialData.id}`
        : `${API_BASE_URL}/api/admins`;
      const response = await fetch(url, {
        method: initialData ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });

      if (response.ok) {
        alert(`Admin ${initialData ? 'updated' : 'created'} successfully!`);
        onViewList();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || `Failed to ${initialData ? 'update' : 'create'} admin`}`);
      }
    } catch (error) {
      console.error(`Error ${initialData ? 'updating' : 'creating'} admin:`, error);
      // For demo purposes, we can still redirect if the server is down
      onViewList();
      alert("Failed to connect to the server. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {initialData ? "Edit Admin" : "Create New Admin"}
          </h2>
          <p className="text-slate-500">
            {initialData ? "Update administrator details." : "Add a new administrator to the system."}
          </p>
        </div>
        <button
          onClick={onViewList}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
        >
          <UsersIcon size={18} /> View All Admins
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. john@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ID
              </label>
              <input
                type="text"
                name="adminId"
                value={formData.adminId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. NN/IN/XX/XXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Designation
              </label>
              <select
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              > 
                <option value="Select Designation">Select Designation</option> 
                <option value="Intern Head">Intern Head</option>
                <option value="Mentor">Mentor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Domain
              </label>
              <input
                type="text"
                name="Domain"
                value={formData.Domain}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. IT Security"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password {initialData && "(Leave blank to keep current)"}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!initialData}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="••••••••"
              />
            </div>

          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 ${isSubmitting ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update Admin" : "Create Admin")}
            </button>
            <button
              type="button"
              onClick={onViewList}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

//User Form (For Creating New User)
const CreateUserForm = ({ onViewList, initialData }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    userId: "",
    role: "User",
    Domain: "",
    designation: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        fullName: initialData.username || "",
        email: initialData.email,
        password: "",
        userId: initialData.custom_id || "",
        role: initialData.role || "",
        Domain: initialData.domain || initialData.Domain || "",
        designation: initialData.designation || "",
      });
    } else {
      setFormData({
        fullName: "",
        email: "",
        password: "",
        userId: "",
        role: "User",
        Domain: "",
        designation: "",
 
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "designation") {
        updated.role = value === "Mentor" ? "Mentor" : "admin";
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formattedData = {
        ...formData,
        fullName: toTitleCase(formData.fullName),
        Domain: toTitleCase(formData.Domain),
      };

      const url = initialData
        ? `${API_BASE_URL}/api/users/${initialData.id}`
        : `${API_BASE_URL}/api/users`;
      const response = await fetch(url, {
        method: initialData ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
      });

      if (response.ok) {
        alert(`User ${initialData ? 'updated' : 'created'} successfully!`);
        onViewList();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || `Failed to ${initialData ? 'update' : 'create'} user`}`);
      }
    } catch (error) {
      console.error(`Error ${initialData ? 'updating' : 'creating'} user:`, error);
      onViewList();
      alert("Failed to connect to the server. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{initialData ? "Edit User" : "Create New User"}</h2>
          <p className="text-slate-500">{initialData ? "Update user details." : "Add a new user to the system."}</p>
        </div>
        <button
          onClick={onViewList}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
        >
          <UsersIcon size={18} /> View All Users
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. jane@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ID
              </label>
              <input
                type="text"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. NN/IN/XX/XXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Designation
              </label>
              <select
                name="designation"
                value={formData.designation }
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              >
                <option value="">Select Designation</option>
                <option>Intern</option>
                <option>Trainee</option>
                <option>Employee</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Domain
              </label>
              <input
                type="text"
                name="Domain"
                value={formData.Domain}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="e.g. Marketing"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password {initialData && "(Leave blank to keep current)"}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!initialData}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 ${isSubmitting ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update User" : "Create User")}
            </button>
            <button
              type="button"
              onClick={onViewList}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Admin List Component
const AdminList = ({ onCreateNew, onEdit }) => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmins();
    const interval = setInterval(fetchAdmins, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchAdmins = () => {
    fetch(`${API_BASE_URL}/api/admins`)
      .then((res) => res.json())
      .then((data) => {
        setAdmins(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch admins:", err);
        setAdmins([]);
        setLoading(false);
      });
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete admin "${username}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admins/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("Admin deleted successfully!");
        setAdmins(prevAdmins => prevAdmins.filter(admin => admin.id !== userId));
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || "Failed to delete admin"}`);
      }
    } catch (error) {
      console.error("Error deleting admin:", error);
      alert("Failed to connect to the server. Please try again later.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manage Admins</h2>
          <p className="text-slate-500">
            View and manage system administrators.
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <UserPlusIcon size={18} /> Add New Admin
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Admin Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Domain</th>
              <th className="px-6 py-4">Designation</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan="8" className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-4 text-center">
                  No admins found.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <AdminRow
                  key={admin.id}
                  userId={admin.custom_id}
                  name={admin.username}
                  email={admin.email}
                  domain={admin.domain || "N/A"}
                  role={admin.role}
                  designation={admin.designation}
                  status={admin.status}
                  onEdit={() => onEdit(admin)}
                  onDelete={() => handleDelete(admin.id, admin.username)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// User List Component
const UserList = ({ onCreateNew, onEdit }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = () => {
    fetch(`${API_BASE_URL}/api/users?role=User`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch users:", err);
        setUsers([]);
        setLoading(false);
      });
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}?role=User`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("User deleted successfully!");
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || "Failed to delete user"}`);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to connect to the server. Please try again later.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manage Users</h2>
          <p className="text-slate-500">View and manage system users.</p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <UserPlusIcon size={18} /> Add New User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">User Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Domain</th>
              <th className="px-6 py-4">Designation</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan="5" className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  userId={user.custom_id || user.id}
                  name={user.username}
                  designation={user.designation}
                  domain={user.domain || "N/A"}
                  status={user.status}
                  email={user.email}
                  onEdit={() => onEdit(user)}
                  onDelete={() => handleDelete(user.id, user.username)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// User Row
const UserRow = ({ userId, name, designation, domain, status, email, onEdit, onDelete }) => (
  <tr className="hover:bg-slate-50 transition-colors group">
    <td className="px-6 py-4 font-mono text-xs text-slate-500">
      {userId}
    </td>
    <td className="px-6 py-4 w-full">
      <div className="flex items-center gap-3">
        <div>
          <p className="font-bold text-slate-800">{name}</p>
          <p className="text-slate-500 text-xs text-ellipsis">
            {email}
          </p>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 text-slate-600 font-medium">{designation}</td>
    <td className="px-6 py-4 text-slate-600 min-w-50">{domain}</td>
    <td className="px-6 py-4">
      <span
        className={`px-2 py-1 rounded-full text-xs font-bold ${status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
      >
        {status}
      </span>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all text-xs font-bold border border-blue-100 shadow-sm"
          title="Edit User"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-all text-xs font-bold border border-red-100 shadow-sm"
          title="Delete User"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          Delete
        </button>
      </div>
    </td>
  </tr>
);

// Admin Row
const AdminRow = ({ userId, name, role, designation, domain, status, email, onEdit, onDelete }) => (
  <tr className="hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0">
    <td className="px-6 py-4 font-mono text-xs text-slate-500">
      {userId}
    </td>
    <td className="px-6 py-4 w-full">
      <div className="flex items-center gap-5">
        <p className="font-bold text-slate-800 text-sm min-w-40">{name}</p> 
      </div>
    </td>
    <td className="px-6 py-4 text-slate-500 text-xs">{email}</td>
    <td className="px-6 py-4">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        (role || '').toLowerCase().includes('super') ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 
        (role || '').toLowerCase().includes('admin') ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
        'bg-amber-100 text-amber-700 border border-amber-200'
      }`}>
        {role}
      </span>
    </td>
    <td className="px-6 py-4 text-slate-600 text-sm min-w-50">{domain}</td>
    <td className="px-6 py-4 text-slate-600 text-sm">{designation}</td>
    <td className="px-6 py-4">
      <div className={`flex items-center gap-2 px-2 py-1 rounded-md w-fit ${status === "Active" ? "bg-green-50 text-green-700 border border-green-100" : "bg-slate-50 text-slate-600 border border-slate-100"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${status === "Active" ? "bg-green-500" : "bg-slate-400"}`}></span>
        <span className="text-xs font-bold">{status}</span>
      </div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all text-xs font-bold border border-blue-100 shadow-sm"
          title="Edit Admin"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-all text-xs font-bold border border-red-100 shadow-sm"
          title="Delete Admin"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          Delete
        </button>
      </div>
    </td>
  </tr>
);

// Logs And Audit Row 
const LogAuditRow = ({ id, timestamp, username, designation, email, domain, role, action }) => {
  const dateObj = timestamp ? new Date(timestamp) : null;
  const isLogin = action && action.toLowerCase().includes('log in') || action.toLowerCase().includes('logged in');
  const isLogout = action && action.toLowerCase().includes('log out') || action.toLowerCase().includes('logged out');
  const timeStr = dateObj ? dateObj.toLocaleTimeString() : 'N/A';

  return (
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
      <td className="px-6 py-4 font-mono text-xs text-slate-400 group-hover:text-slate-600 transition-colors">#{id}</td>
      <td className="px-6 py-4 text-sm text-slate-600">{dateObj ? dateObj.toLocaleDateString() : 'N/A'}</td>
      <td className="px-6 py-4">
        {isLogin ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-xs font-bold border border-green-100 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                {timeStr}
            </span>
        ) : (
            <span className="text-slate-300 text-xs">-</span>
        )}
      </td>
      <td className="px-6 py-4">
        {isLogout ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-xs font-bold border border-red-100 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {timeStr}
            </span>
        ) : (
            <span className="text-slate-300 text-xs">-</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase border border-slate-200">
                {(username || '?').charAt(0)}
            </div>
            <span className="font-bold text-slate-800 text-xs">{username || 'N/A'}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-slate-600 text-xs font-medium">{designation || 'N/A'}</td>
      <td className="px-6 py-4 text-slate-500 text-xs">{email}</td>
      <td className="px-6 py-4">
        <span className="text-slate-600 text-xs font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100 whitespace-nowrap">{domain}</span>
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
          (role || '').toLowerCase().includes('super') ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
          (role || '').toLowerCase().includes('admin') ? 'bg-blue-50 text-blue-700 border-blue-100' : 
          'bg-slate-50 text-slate-600 border-slate-100'
        }`}>
          {role}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-slate-700 text-xs font-semibold bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
            {action}
        </span>
      </td>
    </tr>
  );
};

// Helper to capitalize first letter of each word
const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const SidebarItem = ({
  icon,
  label,
  active,
  activeBgColor,
  hasSubmenu,
  isOpen,
  onClick,
  children,
}) => {
  const baseClasses =
    "flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer group";
  const activeClasses = active
    ? (activeBgColor || "bg-blue-600 text-white shadow-lg shadow-blue-200")
    : "text-slate-600 hover:bg-blue-50 hover:text-blue-600";

  return (
    <div>
      <div className={`${baseClasses} ${activeClasses} mb-1`} onClick={onClick}>
        <div className="flex items-center gap-3">
          <span className={`${active ? "text-white" : "text-slate-500 group-hover:text-blue-600"} transition-colors`}>{icon}</span>
          <span className="text-sm">{label}</span>
        </div>
        {hasSubmenu && (
          <ChevronDownIcon
            size={14}
            className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </div>
      {isOpen && children}
    </div>
  );
};

const StatsCard = ({ title, value, icon, color, subtext }) => (
  <div
    className={`p-6 rounded-2xl shadow-lg ${color} text-white flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform`}
  >
    {/* Decorative circles */}
    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>

    <div className="relative z-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
          {icon}
        </div>
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <p className="text-blue-100 text-sm font-medium">{subtext}</p>
    </div>
  </div>
);

const FolderCard = ({ title, icon, color = "yellow", onClick }) => {
  const colors = {
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border-2 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${colors[color] || colors.yellow}`}
    >
      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
        {icon}
      </div>
      <span className="font-bold text-sm">{title}</span>
    </div>
  );
};

// --- Icons (Inline SVGs) ---
const HomeIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);
const UsersIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);
const UserPlusIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="8.5" cy="7" r="4"></circle>
    <line x1="20" y1="8" x2="20" y2="14"></line>
    <line x1="23" y1="11" x2="17" y2="11"></line>
  </svg>
);
const SettingsIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);
const FileTextIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);
const SearchIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const BellIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);
const MenuIcon = ({ size = 24, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);
const ShieldIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);
const ActivityIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);
const LogOutIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);
const ChevronDownIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);
const ChevronLeftIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);
const HelpCircleIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);
const ClockIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

// Novanectar Logo
const NovanectarLogo = ({ size = "normal", className = "" }) => {
  const isLarge = size === "large";
  return (
    <img
      src={logo}
      alt="Novanectar Logo"
      className={`${isLarge ? "h-16" : "h-10"} w-auto object-contain ${className}`}
    />
  );
};

const MonitorIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="8" y1="21" x2="16" y2="21"></line>
    <line x1="12" y1="17" x2="12" y2="21"></line>
  </svg>
);
const PaperclipIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

const PrintIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="6 9 6 2 18 2 18 9"></polyline>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
    <rect x="6" y="14" width="12" height="8"></rect>
  </svg>
);

// Report Details Modal after clicking on view
const ReportDetailsModal = ({ report, onClose }) => {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl rounded-xl relative flex flex-col my-8 origin-top scale-95 animate-in zoom-in-95 duration-300">

        {/* Header - Non Printable Actions */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-20 print:hidden rounded-t-xl">
          
          <div className="flex items-center "><NovanectarLogo className="h-8" /></div>
          <div className="flex items-center gap-2">
            
            <h4 className="font-bold text-slate-800">Report Preview</h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-md shadow-blue-200"
            >
              <PrintIcon size={16} /> Print Report
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all"
            >
              <ChevronLeftIcon size={20} />
            </button>
          </div>
        </div>

        {/* Paper Container - The A4 Sheet */}
        <div className="flex-1 p-[20mm] bg-white print:p-0">

          {/* Company Branding */}
          <div className="flex justify-between items-start border-b-4 border-blue-600 pb-8 mb-8">
            <NovanectarLogo size="large" />
            <div className="text-right">
              <div className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-black text-xl mb-2">
                {report.type ? report.type.toUpperCase() : "DAILY"} PROJECT REPORT
              </div>
              <p className="text-blue-500 text-xs italic font-bold tracking-widest">Ref ID: {report.id}</p>
            </div>
          </div>

          {/* Report Information Grid */}
          <div className="grid grid-cols-2 gap-y-6 gap-x-12 mb-10 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Report ID</label>
                <p className="font-mono text-slate-600 text-sm font-bold">{report.id}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Person Name</label>
                <p className="font-bold text-slate-800 text-lg border-l-4 border-blue-600 pl-3 leading-none">{report.name || report.createdBy}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Designation</label>
                <p className="font-semibold text-slate-700 bg-white inline-block px-3 py-1 rounded-md border border-slate-100 shadow-sm">{report.designation}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Project Name</label>
                <p className="font-bold text-blue-700 uppercase tracking-tight">{report.title || report.projectName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date</label>
                <p className="font-bold text-slate-800">{report.date}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Day</label>
                <p className="text-slate-500 italic font-medium">{report.day}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Number</label>
                <p className="text-slate-600 text-sm font-medium">{report.mobileNumber || "N/A"}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email</label>
                <p className="text-slate-500 text-xs font-medium">{report.email || "N/A"}</p>
              </div>
              {/* <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Submission Status</label>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black uppercase tracking-tighter">● {report.status}</span>
              </div> */}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Detailed Work Progress</h2>
              <div className="flex-1 h-1 bg-slate-100 rounded-full"></div>
            </div>
            <div className="min-h-75 text-slate-700 leading-relaxed text-justify whitespace-pre-wrap p-6 border-2 border-slate-50 rounded-2xl bg-white shadow-inner font-mono text-sm italic">
              {report.reportContent}
            </div>
          </div>

          {report.weeklySummary && (
            <div className="mb-10">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter text-blue-600">Weekly Achievement Summary</h2>
                <div className="flex-1 h-1 bg-blue-50 rounded-full"></div>
              </div>
              <div className="p-6 border-l-4 border-blue-600 bg-blue-50/30 rounded-r-2xl text-slate-700 text-sm font-medium font-mono italic">
                {report.weeklySummary}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-20 mt-24">
            <div className="text-center pt-8 border-t border-slate-300">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Submitted By</p>
              <p className="font-bold text-slate-800 font-serif italic text-lg">{report.name || report.createdBy}</p>
            </div>
            <div className="text-center pt-8 border-t border-slate-300">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Verified By (Admin)</p>
              <div className="h-8"></div>
            </div>
          </div>

          {/* Footer Branding */}
          <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center opacity-30">
            <p className="text-[10px] font-bold text-slate-400">© 2026 Admin Systems • Project Report</p>
            <div className="flex items-center gap-1">
              <span className="w-4 h-1 bg-blue-600 rounded-full"></span>
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Official Copy</span>
            </div>
          </div>

        </div>

        {/* Floating Close - Non Printable */}
        <button
          onClick={onClose}
          className="absolute -right-12 top-0 p-3 bg-white/20 text-white rounded-full hover:bg-white/30 backdrop-blur-md transition-all print:hidden"
        >
          <ChevronLeftIcon size={32} />
        </button>
      </div>

      {/* Global CSS for Print */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          .fixed { position: static !important; }
          .inset-0 { position: static !important; }
          .p-4 { padding: 0 !important; }
          .my-8 { margin: 0 !important; }
          .shadow-2xl { shadow: none !important; }
          .bg-slate-900\\/60 { background: white !important; }
          .modal-container, .modal-container * { visibility: visible; }
          .modal-container { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 0; size: A4; }
        }
      `}} />
    </div>
  );
};

// Report View Component
const ReportView = ({
  reportType,
  reports,
  loading,
  error,
  showForm,
  onShowForm,
  onHideForm,
  formData,
  onFormChange,
  onFormSubmit,
  onDelete,
  onViewReport
}) => {
  return (
    <div className="max-w-6xl mx-auto">
      {!showForm && (
        <div className="mb-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:shadow-md">
          <NovanectarLogo size="large" />
          <div className="flex flex-col items-center md:items-end text-center md:text-right">
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">
              {reportType} <span className="text-blue-600">Reports</span>
            </h2>
            <p className="text-slate-500 font-medium italic mt-1">
              Novanectar ServicesPVT.Ltd.
            </p>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="flex items-center justify-between mb-6 px-2">
          <div>
            <h3 className="text-xl font-bold text-slate-700">Recent Records</h3>
            <p className="text-xs text-slate-400">Manage and view detailed project insights</p>
          </div>
          <button
            onClick={onShowForm}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 font-bold text-sm"
          >
            <span>+</span> Create New Report
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {showForm ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8">
            <div className="mb-6">
              <NovanectarLogo size="large" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Submit New Report</h3>
            <p className="text-slate-500">Fill in all the required fields to submit your report</p>
          </div>
          <form onSubmit={onFormSubmit} className="space-y-6">
            {/* Name and ID Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              {/* ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => onFormChange({ ...formData, id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  placeholder="e.g. NN/IN/YY/XXXX"
                  required
                />
              </div>
            </div>

            {/* Date and Day Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value);
                    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(selectedDate);
                    if (dayName === "Sunday") {
                      alert("Daily reports cannot be submitted for Sundays.");
                      return;
                    }
                    onFormChange({ ...formData, date: e.target.value, day: dayName });
                  }}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Day <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.day}
                  onChange={(e) => onFormChange({ ...formData, day: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  required
                >
                  <option value="">Select Day</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                </select>
              </div>
            </div>

            {/* Designation and Project Name Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => onFormChange({ ...formData, designation: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  placeholder="e.g. Developer"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => onFormChange({ ...formData, projectName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  placeholder="e.g. Project Alpha"
                  required
                />
              </div>
            </div>

            {/* Mobile Number and Email Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.mobileNumber}
                  onChange={(e) => onFormChange({ ...formData, mobileNumber: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  placeholder="e.g. +91 9876543210"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  placeholder="e.g. xyz@gmail.com"
                  required
                />
              </div>
            </div>

            {/* Weekly Only Field: Progress Reflection */}
            {reportType === "weekly" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Weekly Progress Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.weeklySummary || ""}
                  onChange={(e) => onFormChange({ ...formData, weeklySummary: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  placeholder="Summarize your main achievements for this week..."
                  rows="3"
                  required={reportType === "weekly"}
                ></textarea>
              </div>
            )}

            {/* Report Content */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Report Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reportContent}
                onChange={(e) => onFormChange({ ...formData, reportContent: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                placeholder="Enter your report details here..."
                rows="6"
                required
              ></textarea>
            </div>

            {/* File Upload Field - Only for Weekly Reports */}
            {reportType === "weekly" && (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Attachment (PDF, CSV, Image)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    onChange={(e) => onFormChange({ ...formData, attachment: e.target.files[0] })}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
                  />
                  {formData.attachment && (
                    <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                      ✓ {formData.attachment.name}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-slate-200">
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : "Submit Report"}
              </button>
              <button
                type="button"
                onClick={onHideForm}
                className="px-8 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Report List
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4">Submitted By</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Day</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-400">
                    Loading reports...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-400">
                    No reports found. Click "Create New Report" to get started.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold bg-blue-50/50">
                      {String(report.id)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{report.title || report.projectName}</p>
                        {report.attachmentName && (
                          <span className="p-1 bg-green-50 text-green-600 rounded" title={`Attachment: ${report.attachmentName}`}>
                            <PaperclipIcon size={12} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {report.designation}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-800 font-medium">{report.name || report.createdBy}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {report.date}
                    </td>
                    <td className="px-6 py-4 text-slate-500 italic">
                      {report.day}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${report.status === "Completed" ? "bg-green-100 text-green-700" :
                        report.status === "Pending" ? "bg-yellow-100 text-yellow-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onViewReport(report)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors mr-2"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onDelete(report.id)}
                        className="text-red-500 hover:text-red-700 font-medium text-xs px-3 py-1 bg-red-50 rounded hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
