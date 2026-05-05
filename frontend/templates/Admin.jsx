//Intern Head Dashboard
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from './config';
import { formatIndianDate, formatIndianDateTime, formatIndianTime, getIndianDateTimeMs, getLatestLoginTime, getLatestLogoutTime } from './dateTime';
import logo from '../static/NNlogo.jpeg';

const isEndUserRole = (role) => String(role || '').trim().toLowerCase() === 'user';
const formatIdleTime = (idleTimeInSeconds) => {
    const totalSeconds = Number(idleTimeInSeconds);

    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return '—';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

const getLogPrimaryDateValue = (log) => (log ? (log.login_time || log.logout_time || log.timestamp || null) : null);
const getLogDateKey = (log) => {
    const value = getLogPrimaryDateValue(log);
    return value ? formatIndianDate(value) : '';
};
const getActivityDateKey = (activity) => {
    const value = activity?.created_at || activity?.login_time || activity?.logout_time || null;
    return value ? formatIndianDate(value) : '';
};
const mergeLogsWithActivityIdle = (logs, activities) => {
    const idleRecords = (activities || [])
        .filter((activity) => {
            const idleSeconds = Number(activity?.idle_time) || 0;
            if (idleSeconds <= 0) return false;

            const action = String(activity?.action || '').trim().toLowerCase();
            return action === 'idle' || action === 'session' || action === 'login' || action === 'logout';
        })
        .map((activity) => ({
            username: String(activity?.username || '').trim().toLowerCase(),
            dateKey: getActivityDateKey(activity),
            idleSeconds: Number(activity.idle_time) || 0,
            createdAtMs: getIndianDateTimeMs(activity.created_at || activity.login_time || activity.logout_time),
        }));

    return (logs || []).map((log) => {
        const existingIdle = Number(log?.idle_time) || 0;
        if (existingIdle > 0) return log;

        const usernameKey = String(log?.username || '').trim().toLowerCase();
        const logDateKey = getLogDateKey(log);
        if (!usernameKey || !logDateKey) return log;

        const loginMs = log.login_time ? getIndianDateTimeMs(log.login_time) : null;
        const logoutMs = log.logout_time ? getIndianDateTimeMs(log.logout_time) : null;

        let sessionIdle = 0;

        for (const record of idleRecords) {
            if (record.username !== usernameKey) continue;
            if (record.dateKey !== logDateKey) continue;

            if (loginMs && logoutMs) {
                if (record.createdAtMs >= loginMs && record.createdAtMs <= logoutMs) {
                    sessionIdle += record.idleSeconds;
                }
            } else if (loginMs) {
                if (record.createdAtMs >= loginMs) {
                    sessionIdle += record.idleSeconds;
                }
            } else {
                sessionIdle += record.idleSeconds;
            }
        }

        return {
            ...log,
            idle_time: sessionIdle,
        };
    });
};

const Admin = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportsData, setReportsData] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [mentorsList, setMentorsList] = useState([]);
    const [logsData, setLogsData] = useState([]);
    const [mentorPerformance, setMentorPerformance] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [selectedAuditProfile, setSelectedAuditProfile] = useState(null);
    const [selectedUserProfile, setSelectedUserProfile] = useState(null);
    const [editingData, setEditingData] = useState(null);
    const [currentView, setCurrentView] = useState('dashboard');
    const pollingIntervalRef = useRef(null);
    const sessionExpiredRef = useRef(false);
    const reportsRequestInFlightRef = useRef(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState(() => {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const parsed = JSON.parse(stored);
            return { 
                name: parsed.username, 
                username: parsed.username, 
                domain: parsed.domain || '', 
                role: parsed.role || '',
                designation: parsed.designation || ''
            };
        }
        return { name: 'Admin', username: 'Admin', domain: '', role: '', designation: '' };
    });
    const [dashboardStats, setDashboardStats] = useState({ dailyProductivity: '--', weeklyActivity: '--' });
    const USERS_POLL_MS = 15000;
    const LOGS_POLL_MS = 15000;
    const MENTORS_POLL_MS = 30000;
    const DASHBOARD_POLL_MS = 30000;

    const clearPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    const handleUnauthorized = () => {
        clearPolling();
        if (sessionExpiredRef.current) return;

        sessionExpiredRef.current = true;
        localStorage.removeItem("currentUser");
        localStorage.removeItem("token");
        setError("Session expired. Please log in again.");
        navigate("/");
    };

    const handleLogout = async () => {
        try {
            if (!currentUser?.username) return;

            // Call logout API to record logout time
            const response = await fetch(`${API_BASE_URL}/api/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    username: currentUser.username
                }),
            });

            if (response.ok) {
                console.log("Logout recorded successfully");
            }
        } catch (error) {
            console.error("Error recording logout:", error);
        } finally {
            // Clear localStorage and redirect
            localStorage.removeItem("currentUser");
            localStorage.removeItem("token");
            navigate("/");
        }
    };

    // Sidebar navigation handlers
    const handleSidebarNav = (label) => {
        // Stop polling when switching views
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        switch (label) {
            case 'Dashboard':
                navigate('/admin');
                break;
            case 'Daily Reports':
                navigate('/admin/daily-reports');
                break;
            case 'Weekly Reports':
                navigate('/admin/weekly-reports');
                break;
            case 'Users':
                navigate('/admin/users');
                break;
            case 'Create User':
                navigate('/admin/create-user');
                break;
            case 'Domain Management':
                navigate('/admin/domains');
                break;
            case 'Live Monitoring':
                navigate('/admin/monitoring');
                break;
            case 'Mentors Overview':
                navigate('/admin/mentors');
                break;
            case 'Logs':
                navigate('/admin/logs');
                break;
        }
    };

    // Report folder handlers with SuperAdmin data fetching and real-time updates
    const fetchReports = async (reportType, { showLoader = false } = {}) => {
        if (reportsRequestInFlightRef.current) return;

        try {
            reportsRequestInFlightRef.current = true;
            if (showLoader) setIsLoading(true);
            setError(null);

            const endpoint = reportType.toLowerCase().includes('daily') ? 'daily-reports' : 'weekly-reports';
            const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch ${reportType} reports`);
            }

            const data = await response.json();
            setReportsData(data);
        } catch (err) {
            console.error(`Error fetching reports:`, err);
            setError(`Failed to load reports: ${err.message}`);
        } finally {
            reportsRequestInFlightRef.current = false;
            if (showLoader) setIsLoading(false);
        }
    };

    const handleReportFolderClick = async (reportType) => {
        setCurrentView(reportType.toLowerCase().includes('daily') ? 'daily-reports' : 'weekly-reports');
        await fetchReports(reportType, { showLoader: true });
    };

    const fetchMentors = async () => {
        try {
            const [mRes, uRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admins?role=mentor`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/users`, { credentials: "include" })
            ]);
            if (mRes.ok) {
                const mentors = await mRes.json();
                const allUsers = uRes.ok ? await uRes.json() : [];
                // Attach assignedStudents count: users whose domain matches the mentor's domain
                const mentorsWithCount = mentors.map(m => ({
                    ...m,
                    assignedStudents: allUsers.filter(u =>
                        (u.domain || '').toLowerCase() === (m.domain || '').toLowerCase()
                    ).length
                }));
                setMentorsList(mentorsWithCount);
            }
        } catch (err) {
            console.warn('Failed to fetch mentors:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const [uRes, lRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/users`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/logs`, { credentials: "include" })
            ]);

            if (uRes.ok && lRes.ok) {
                const data = await uRes.json();
                const allLogs = (await lRes.json() || []).filter(log => isEndUserRole(log.role));

                const usersWithActivity = data.map(user => {
                    const userLogs = allLogs.filter(log => log.username?.trim().toLowerCase() === user.username?.trim().toLowerCase());

                    return {
                        ...user,
                        login_time: getLatestLoginTime(userLogs),
                        logout_time: getLatestLogoutTime(userLogs)
                    };
                });

                setUsersList(usersWithActivity);

                const activeUsers = data.filter(u => u.status === 'Online').length;
                const productivity = data.length > 0 ? Math.round((activeUsers / data.length) * 100) : 0;
                setDashboardStats({
                    dailyProductivity: `${productivity}%`,
                    weeklyActivity: `${productivity}%`
                });
            }
        } catch (err) {
            console.warn("Real-time polling error for users:", err);
        }
    };

    const fetchLogs = async () => {
        try {
            const [logsResponse, activityResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/logs`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/activity`, { credentials: "include" })
            ]);

            if (logsResponse.ok) {
                const data = await logsResponse.json();
                const activities = activityResponse.ok ? await activityResponse.json() : [];
                const userLogs = data.filter(log => isEndUserRole(log.role));
                const mergedLogs = mergeLogsWithActivityIdle(userLogs, activities);
                setLogsData(mergedLogs);
                return mergedLogs;
            }

            return [];
        } catch (err) {
            console.warn("Real-time polling error for logs:", err);
            return [];
        }
    };

    const fetchDashboardData = async () => {
        try {
            const [uRes, rRes, lRes, aRes, mRes, mentorsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/users`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/daily-reports`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/logs`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/activity`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/mentors/performance`, { credentials: "include" }),
                fetch(`${API_BASE_URL}/api/admins?role=mentor`, { credentials: "include" })
            ]);

            const users = uRes.ok ? await uRes.json() : [];
            const reports = rRes.ok ? await rRes.json() : [];
            const logs = lRes.ok ? (await lRes.json()).filter(log => isEndUserRole(log.role)) : [];
            const activities = aRes.ok ? await aRes.json() : [];
            const performance = mRes.ok ? await mRes.json() : [];
            const mentorsData = mentorsRes?.ok ? await mentorsRes.json() : [];

            if (uRes.ok && lRes.ok) {
                const usersWithActivity = users.map(user => {
                    const userLogs = logs.filter(log => log.username?.trim().toLowerCase() === user.username?.trim().toLowerCase());

                    return {
                        ...user,
                        login_time: getLatestLoginTime(userLogs),
                        logout_time: getLatestLogoutTime(userLogs)
                    };
                });

                setUsersList(usersWithActivity);
                const activeUsers = users.filter(u => u.status === 'Online').length;
                const productivity = users.length > 0 ? Math.round((activeUsers / users.length) * 100) : 0;
                setDashboardStats({
                    dailyProductivity: `${productivity}%`,
                    weeklyActivity: `${productivity}%`
                });
            }
            if (rRes.ok) {
                setReportsData(reports); // All reports, no domain filter
            }
            if (lRes.ok) {
                setLogsData(mergeLogsWithActivityIdle(logs, activities));
            }
            if (mRes.ok) {
                setMentorPerformance(performance); // All mentor performance, no domain filter
            }
            if (mentorsRes && mentorsRes.ok) {
                setMentorsList(mentorsData);
            }
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
        }
    };

    const handleUsersNav = async () => {
        try {
            setIsLoading(true);
            setError(null);
            await fetchUsers();
            setCurrentView('users');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDashboardNav = async () => {
        try {
            setIsLoading(true);
            setError(null);
            await fetchDashboardData();
            setCurrentView('dashboard');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenUserProfile = async (user) => {
        if (!user?.username) return;

        let availableLogs = logsData;
        if (availableLogs.length === 0) {
            availableLogs = await fetchLogs();
        }

        const userLogs = availableLogs.filter(log =>
            log.username?.trim().toLowerCase() === user.username?.trim().toLowerCase()
        );
        const recentLog = userLogs
            .slice()
            .sort((a, b) => getIndianDateTimeMs(getLogPrimaryDateValue(b)) - getIndianDateTimeMs(getLogPrimaryDateValue(a)))[0];
        const dateKey = recentLog ? getLogDateKey(recentLog) : formatIndianDate(new Date());

        setSelectedUserProfile({
            username: user.username,
            dateKey,
            dateLabel: dateKey || 'N/A',
            email: user.email || '—',
            domain: user.domain || user.Domain || '—',
            designation: user.designation || 'N/A',
            role: user.role || 'User',
            custom_id: user.custom_id,
            id: user.id
        });

        setSelectedAuditProfile(null);
        navigate('/admin/user-activity');
    };

    const handleCloseUserProfile = () => {
        setSelectedUserProfile(null);
        navigate('/admin/users');
    };

    const handleOpenAuditProfile = (log) => {
        if (!log?.username) return;

        setSelectedAuditProfile({
            username: log.username,
            dateKey: getLogDateKey(log),
            dateLabel: getLogDateKey(log) || 'N/A',
            email: log.email || '—',
            domain: log.domain || '—',
            designation: log.designation || 'N/A',
            role: log.role || 'User'
        });
    };

    const handleCloseAuditProfile = () => {
        setSelectedAuditProfile(null);
    };

    // URL-based view management
    useEffect(() => {
        const path = location.pathname;
        clearPolling();

        if (path.endsWith('/users')) {
            handleUsersNav();
            pollingIntervalRef.current = setInterval(fetchUsers, USERS_POLL_MS);
        } else if (path.endsWith('/create-user')) {
            setCurrentView('create-user');
        } else if (path.endsWith('/daily-reports')) {
            handleReportFolderClick('Daily Reports');
        } else if (path.endsWith('/weekly-reports')) {
            handleReportFolderClick('Weekly Reports');
        } else if (path.endsWith('/domains')) {
            setCurrentView('domains');
            if (usersList.length === 0) {
                fetch(`${API_BASE_URL}/api/users`, { credentials: "include" })
                    .then(res => res.ok ? res.json() : [])
                    .then(data => setUsersList(data))
                    .catch(err => console.error("Failed to fetch users for domains", err));
            }
        } else if (path.endsWith('/monitoring')) {
            setCurrentView('monitoring');
        } else if (path.endsWith('/mentors')) {
            setCurrentView('mentors');
            fetchMentors();
            pollingIntervalRef.current = setInterval(fetchMentors, MENTORS_POLL_MS);
        } else if (path.endsWith('/user-activity')) {
            setCurrentView('user-activity');
            fetchLogs();
            pollingIntervalRef.current = setInterval(fetchLogs, LOGS_POLL_MS);
        } else if (path.endsWith('/logs')) {
            setCurrentView('logs');
            setSelectedAuditProfile(null);
            fetchLogs();
            pollingIntervalRef.current = setInterval(fetchLogs, LOGS_POLL_MS);
        } else {
            setSelectedAuditProfile(null);
            handleDashboardNav();
            pollingIntervalRef.current = setInterval(fetchDashboardData, DASHBOARD_POLL_MS);
        }

        return () => {
            clearPolling();
        };
    }, [location.pathname]);

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(prev => ({
                ...prev,
                name: parsedUser.username,
                domain: parsedUser.domain || prev.domain,
                role: parsedUser.role || prev.role,
                designation: parsedUser.designation || ''
            }));
        }
    }, []);

    useEffect(() => {
        if (selectedUserProfile?.username && logsData.length > 0) {
            const userLogs = logsData
                .filter((log) => log.username?.trim().toLowerCase() === selectedUserProfile.username?.trim().toLowerCase())
                .sort((a, b) => getIndianDateTimeMs(getLogPrimaryDateValue(b)) - getIndianDateTimeMs(getLogPrimaryDateValue(a)));

            if (userLogs.length > 0) {
                const latestDateKey = getLogDateKey(userLogs[0]);
                if (latestDateKey && latestDateKey !== selectedUserProfile.dateKey) {
                    setSelectedUserProfile((prev) => prev ? ({
                        ...prev,
                        dateKey: latestDateKey,
                        dateLabel: latestDateKey,
                    }) : prev);
                }
            }
        }

        if (selectedAuditProfile?.username && logsData.length > 0) {
            const auditLogs = logsData
                .filter((log) => log.username?.trim().toLowerCase() === selectedAuditProfile.username?.trim().toLowerCase())
                .sort((a, b) => getIndianDateTimeMs(getLogPrimaryDateValue(b)) - getIndianDateTimeMs(getLogPrimaryDateValue(a)));

            if (auditLogs.length > 0) {
                const latestDateKey = getLogDateKey(auditLogs[0]);
                if (latestDateKey && latestDateKey !== selectedAuditProfile.dateKey) {
                    setSelectedAuditProfile((prev) => prev ? ({
                        ...prev,
                        dateKey: latestDateKey,
                        dateLabel: latestDateKey,
                    }) : prev);
                }
            }
        }
    }, [logsData, selectedUserProfile, selectedAuditProfile]);

    return (
        <div className="flex h-screen bg-[#F8F9FA] font-sans text-slate-800">
            {/* Logout Modal */}
            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                        <p className="text-slate-700 font-medium">Loading...</p>
                    </div>
                </div>
            )}

            {/* Error Toast */}
            {error && (
                <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {error}
                </div>
            )}

            {/* Sidebar */}
            <aside className={`w-64 bg-white flex flex-col border-r border-slate-200 shrink-0 transition-transition duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-30 h-full`}>
                {/* Brand */}
                <div className="h-16 flex items-center px-6 bg-orange-500 text-white font-bold text-xl tracking-wide shadow-md z-10">
                    <span className="mr-2">⚡</span> Intern Head
                </div>

                {/* User Card */}
                <div className="p-4 border-b border-slate-100 bg-orange-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="Admin" className="w-full h-full bg-orange-100" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">Hello, {currentUser.name}!</p>
                            <p className="text-xs text-slate-500">{currentUser.designation}</p>
                            
                        </div>
                    </div>
                </div>

                {/* Navigation in sidebar */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    <SidebarItem icon={<HomeIcon />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => handleSidebarNav('Dashboard')} />
                    <SidebarItem icon={<GlobeIcon />} label="Domain Management" active={currentView === 'domains'} onClick={() => handleSidebarNav('Domain Management')} />
                    <SidebarItem icon={<UserPlusIcon />} label="Create User" active={currentView === 'create-user'} onClick={() => { setEditingData(null); handleSidebarNav('Create User'); }} />
                    <SidebarItem icon={<UsersIcon />} label="Users" active={currentView === 'users'} onClick={() => handleSidebarNav('Users')} />
                    <SidebarItem icon={<FileTextIcon />} label="Daily Reports" active={currentView === 'daily-reports'} onClick={() => handleSidebarNav('Daily Reports')} />
                    <SidebarItem icon={<FileTextIcon />} label="Weekly Reports" active={currentView === 'weekly-reports'} onClick={() => handleSidebarNav('Weekly Reports')} />
                    <SidebarItem icon={<MonitorIcon />} label="Live Monitoring" active={currentView === 'monitoring'} onClick={() => handleSidebarNav('Live Monitoring')} />
                    <SidebarItem icon={<UserCheckIcon />} label="Mentors Overview" active={currentView === 'mentors'} onClick={() => handleSidebarNav('Mentors Overview')} />
                    <SidebarItem icon={<ActivityIcon />} label="System Logs" active={currentView === 'logs'} onClick={() => handleSidebarNav('Logs')} />
                </nav>

                {/* Bottom User Info */}
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs overflow-hidden">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="User" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{currentUser.name}</p>
                            <p className="text-xs text-slate-500 truncate">{currentUser.domain}</p>
                        </div>
                    </div>

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
                <header className="h-16 bg-orange-500 text-white flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm">
                    <div className="flex items-center flex-1">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden mr-4 p-2 text-white/80 hover:bg-white/10 rounded-lg">
                            <MenuIcon />
                        </button>
                        <div className="relative w-full max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-orange-300" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-lg leading-5 bg-white/20 text-white placeholder-orange-100 focus:outline-none focus:bg-white/30 focus:ring-0 transition-all sm:text-sm"
                                placeholder="Search Admin..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-white/80 hover:text-white transition-colors relative">
                            <HomeIcon size={20} />
                        </button>
                        <button className="p-2 text-white/80 hover:text-white transition-colors">
                            <ClockIcon size={20} />
                        </button>
                        <div className="h-8 w-8 rounded-full border border-white/50 overflow-hidden bg-white">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="Profile" />
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">

                    {currentView === 'dashboard' ? (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    <span>Hello, <span className="text-orange-600">{currentUser.name}</span>!</span>
                                    {currentUser.designation && (
                                        <span className="px-3 py-1 bg-orange-50 text-orange-600 text-xs rounded-full border border-orange-100 uppercase tracking-wider shadow-sm">
                                            {currentUser.designation}
                                        </span>
                                    )}
                                </h1>
                                <button
                                    onClick={handleLogout}
                                    className="inline-flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <LogOutIcon size={16} className="mr-2 text-slate-500" /> Logout
                                </button>
                            </div>

                            {/* Domain Overview Cards */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-slate-800">Domain Overview</h2>
                                    <button className="text-slate-400 hover:text-slate-600"><HelpCircleIcon size={20} /></button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Total Users */}
                                    <div
                                        onClick={() => handleSidebarNav('Users')}
                                        className="bg-linear-to-r from-orange-500 to-orange-400 rounded-xl p-4 text-white shadow-lg shadow-orange-200 cursor-pointer hover:scale-[1.02] transition-transform"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className="p-2 bg-white/20 rounded-lg h-fit"><UsersIcon size={24} /></div>
                                                <div>
                                                    <p className="font-semibold text-white/90">Total Users</p>
                                                    <p className="text-xs text-white/70">Total Starters</p>
                                                </div>
                                            </div>
                                            <div className="bg-white text-orange-600 font-bold px-3 py-1 rounded-lg">{usersList.length}</div>
                                        </div>
                                    </div>

                                    {/* Total Mentors */}
                                    <div
                                        onClick={() => handleSidebarNav('Mentors Overview')}
                                        className="bg-linear-to-r from-orange-400 to-amber-400 rounded-xl p-4 text-white shadow-lg shadow-orange-200 cursor-pointer hover:scale-[1.02] transition-transform"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className="p-2 bg-white/20 rounded-lg h-fit"><UserCheckIcon size={24} /></div>
                                                <div>
                                                    <p className="font-semibold text-white/90">Total Mentors</p>
                                                    <p className="text-xs text-white/70">Team Leads</p>
                                                </div>
                                            </div>
                                            <div className="bg-white text-orange-600 font-bold px-3 py-1 rounded-lg">
                                                {mentorsList.length}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Daily Productivity */}
                                    <div className="bg-[#E4C79F] rounded-xl p-4 text-yellow-900 shadow-md">
                                        <div className="flex justify-between items-center">
                                            <div className="flex gap-3">
                                                <div className="p-2 bg-white/40 rounded-lg"><ClockIcon size={24} /></div>
                                                <div>
                                                    <p className="font-bold">Daily Productivity</p>
                                                    <p className="text-xs opacity-70">Std productivity</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-2xl bg-white/50 px-2 rounded">{dashboardStats.dailyProductivity}</span>
                                        </div>
                                    </div>

                                    {/* Weekly Activity */}
                                    <div className="bg-linear-to-r from-amber-400 to-orange-300 rounded-xl p-4 text-white shadow-md">
                                        <div className="flex justify-between items-center">
                                            <div className="flex gap-3">
                                                <div className="p-2 bg-white/20 rounded-lg"><FileTextIcon size={24} /></div>
                                                <div>
                                                    <p className="font-semibold">Weekly</p>
                                                    <p className="text-xs opacity-80">Activity</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-2xl bg-white text-orange-500 px-2 py-1 rounded-lg">{dashboardStats.weeklyActivity}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Section: Live Monitoring & Mentor Performance */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                                {/* Live Monitoring */}
                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 dashed-border">
                                    <h3 className="font-bold text-lg text-slate-800 mb-4">Live Monitoring</h3>
                                    <div className="relative rounded-xl overflow-hidden bg-slate-200 border border-slate-300 flex items-center justify-center h-48 group">
                                        <div className="flex gap-2 opacity-60">
                                            <div className="w-1/2 h-24 bg-blue-100 rounded border border-blue-200" />
                                            <div className="w-1/2 h-24 bg-blue-100 rounded border border-blue-200" />
                                        </div>
                                        <div className="absolute inset-0 flex items-end justify-center pb-4 bg-linear-to-t from-slate-900/10 to-transparent">
                                            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-colors">
                                                <MonitorIcon size={16} /> Live Monitoring
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Mentor Performance */}
                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                    <h3 className="font-bold text-lg text-slate-800 mb-4">Mentor Performance</h3>
                                    <div className="space-y-4">
                                        {mentorPerformance.length === 0 ? (
                                            <p className="text-center text-slate-400 py-4 text-sm italic">No mentor data available</p>
                                        ) : (
                                            mentorPerformance.slice(0, 3).map((mentor) => (
                                                <MentorItem
                                                    key={mentor.id}
                                                    name={mentor.name}
                                                    activity={mentor.activity}
                                                    avatarSeed={mentor.avatarSeed}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Reports Folders */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div onClick={() => navigate('/admin/daily-reports')} className="cursor-pointer hover:shadow-md transition-shadow">
                                    <ReportFolder title="Daily Reports" count="View All" color="text-orange-500" />
                                </div>
                                <div onClick={() => navigate('/admin/weekly-reports')} className="cursor-pointer hover:shadow-md transition-shadow">
                                    <ReportFolder title="Weekly Reports" count="View All" color="text-amber-500" />
                                </div>
                            </div>

                            {/* Recent Log Activity */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-slate-800">Recent Log Activity</h3>
                                    <button onClick={() => setCurrentView('logs')} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-center gap-2 hover:bg-slate-50">
                                        View All <ChevronDownIcon size={14} />
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                                            <tr>
                                                <th className="px-6 py-3 font-medium text-xs">ID</th>
                                                <th className="px-6 py-3 font-medium text-xs">Date</th>
                                                <th className="px-6 py-3 font-medium text-xs">Login Time</th>
                                                <th className="px-6 py-3 font-medium text-xs">Logout Time</th>
                                                <th className="px-6 py-3 font-medium text-xs">Username</th>
                                                <th className="px-6 py-3 font-medium text-xs">Designation</th>
                                                <th className="px-6 py-3 font-medium text-xs">Email</th>
                                                <th className="px-6 py-3 font-medium text-xs">Domain</th>
                                                    <th className="px-6 py-3 font-medium text-xs">Role Type</th>
                                                <th className="px-6 py-3 font-medium text-xs">Status</th>
                                                <th className="px-6 py-3 font-medium text-xs">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {logsData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="10" className="px-6 py-8 text-center text-slate-400 italic">
                                                        No recent logs available
                                                    </td>
                                                </tr>
                                            ) : (
                                                logsData.slice(0, 5).map((log) => (
                                                    <LogStartRow
                                                        key={log.id}
                                                        {...log}
                                                        onSelectUser={() => handleOpenAuditProfile(log)}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                        // Users Management View
                    ) : currentView === 'users' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={() => setCurrentView('dashboard')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        System Users
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Viewing all registered users in the system</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setEditingData(null); setCurrentView('create-user'); navigate('/admin/create-user'); }}
                                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 shadow-sm text-sm font-bold"
                                    >
                                        <UserPlusIcon size={18} /> Add New User
                                    </button>
                                    <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold flex items-center">
                                        {usersList.length} Total Users
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4 text-xs">ID</th>
                                            <th className="px-6 py-4">Username</th>
                                            <th className="px-6 py-4">Email</th>
                                            <th className="px-6 py-4">Domain</th>
                                            <th className="px-6 py-4">Designation</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {usersList.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="p-12 text-center text-slate-400">
                                                    No users found in the system.
                                                </td>
                                            </tr>
                                        ) : (
                                            usersList.map((user) => (
                                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                                     <td className="px-6 py-4 text-slate-500 font-mono text-xs">{user.custom_id || user.id}</td>
                                                     <td className="px-6 py-4">
                                                         <div className="flex items-center gap-3">
                                                             <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
                                                                 {(user.username || 'U').charAt(0).toUpperCase()}
                                                             </div>
                                                             <div>
                                                                 <p className="font-bold text-slate-800 whitespace-nowrap">{user.username}</p>
                                                             </div>
                                                         </div>
                                                     </td>
                                                     <td className="px-6 py-4 text-slate-600 text-sm">{user.email || 'No email'}</td>
                                                     <td className="px-6 py-4">
                                                         <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{user.domain || 'N/A'}</span>
                                                     </td>
                                                     <td className="px-6 py-4">
                                                         <span className="font-bold text-slate-700 text-sm">{user.designation || 'N/A'}</span>
                                                     </td>
                                                     <td className="px-6 py-4">
                                                         <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                             {user.status === 'Online' ? 'Online' : 'Offline'}
                                                         </span>
                                                     </td>
                                                     <td className="px-6 py-4 text-right">
                                                         <div className="flex items-center justify-end gap-2">
                                                             <button className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                                                                 Edit
                                                             </button>
                                                             <button
                                                                 onClick={() => handleOpenUserProfile(user)}
                                                                 className="text-amber-600 hover:text-amber-800 font-medium text-xs px-3 py-1 bg-amber-50 rounded hover:bg-amber-100 transition-colors"
                                                             >
                                                                 Activity
                                                             </button>
                                                             <button className="text-red-500 hover:text-red-700 font-medium text-xs px-3 py-1 bg-red-50 rounded hover:bg-red-100 transition-colors">
                                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                             </button>
                                                         </div>
                                                     </td>
                                                 </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        // User Activity View
                    ) : currentView === 'user-activity' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={handleCloseUserProfile} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        User Activity Profile
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {selectedUserProfile
                                            ? `Daily activity summary for ${selectedUserProfile.username} on ${selectedUserProfile.dateLabel}`
                                            : 'Select a user from System Users to view activity details.'}
                                    </p>
                                </div>
                            </div>
                            {selectedUserProfile ? (
                                <UserAuditProfile
                                    profile={selectedUserProfile}
                                    logs={logsData}
                                    onBack={handleCloseUserProfile}
                                />
                            ) : (
                                <div className="p-12 text-center text-slate-400 italic">
                                    No user selected.
                                </div>
                            )}
                        </div>
                        // Mentors Overview
                    ) : currentView === 'mentors' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={() => setCurrentView('dashboard')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        Mentors Overview
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Manage and view all mentors</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Mentor Name</th>
                                            <th className="px-6 py-4">Domain</th>
                                            <th className="px-6 py-4">ID</th>
                                            <th className="px-6 py-4">Assigned Students</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                            {/* <th className="px-6 py-4"></th>
                                            <th className="px-6 py-4"></th> */}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mentorsList.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="p-12 text-center text-slate-400">
                                                    No mentors found.
                                                </td>
                                            </tr>
                                        ) : (
                                            mentorsList.map((mentor) => (
                                                <tr key={mentor.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-800">{mentor.username}</td>
                                                    <td className="px-6 py-4 text-slate-600">{mentor.domain}</td>
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{mentor.custom_id || mentor.id}</td>
                                                    <td className="px-6 py-4 font-semibold text-slate-700">
                                                        {usersList.filter(u => u.domain === mentor.domain && u.id !== mentor.id).length}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${mentor.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {mentor.status === 'Online' ? 'Online' : 'Offline'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                                                                Edit
                                                            </button>
                                                            <button className="text-red-500 hover:text-red-700 font-medium text-xs px-3 py-1 bg-red-50 rounded hover:bg-red-100 transition-colors">
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                    {/* <td className="px-6 py-4"></td>
                                                    <td className="px-6 py-4"></td> */}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        // Domain Management View
                    ) : currentView === 'domains' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={() => setCurrentView('dashboard')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        Domain Management
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Overview of active domains and assigned users</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">ID</th>
                                            <th className="px-6 py-4">Domains</th>
                                            <th className="px-6 py-4">Active Users</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {[...new Set(usersList.map(u => u.domain).filter(Boolean))].length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-slate-400">
                                                    No domains found.
                                                </td>
                                            </tr>
                                        ) : (
                                            [...new Set(usersList.map(u => u.domain).filter(Boolean))].map((domain, index) => (
                                                <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">#{index + 1}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-800">{domain}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            {usersList.filter(u => u.domain === domain && u.status === 'Online').map(u => (
                                                                <span key={u.id} className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block w-fit">
                                                                    {u.username} <span className="text-slate-400">({u.custom_id || u.id})</span>
                                                                </span>
                                                            ))}
                                                            {usersList.filter(u => u.domain === domain && u.status === 'Online').length === 0 && (
                                                                <span className="text-slate-400 italic text-xs">No active users</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4"></td>
                                                    <td className="px-6 py-4"></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        // Live Monitoring View
                    ) : currentView === 'monitoring' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="max-w-md mx-auto">
                                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mx-auto mb-6">
                                    <MonitorIcon size={40} />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-4 capitalize">Live Monitoring</h2>
                                <p className="text-slate-500 mb-8">
                                    The <span className="font-bold text-orange-500">Live Monitoring</span> module is initialized and ready for deployment.
                                </p>
                                <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                    <p className="text-sm text-slate-400 font-medium italic">
                                        [ Configuration Required: Map system-specific monitoring data and analytics here. ]
                                    </p>
                                </div>
                                <button
                                    onClick={() => setCurrentView('dashboard')}
                                    className="mt-8 text-orange-600 font-bold hover:underline flex items-center gap-2 mx-auto"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                    Return to Overview
                                </button>
                            </div>
                        </div>
                        // Logs View
                    ) : currentView === 'logs' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (selectedAuditProfile) {
                                                    handleCloseAuditProfile();
                                                    return;
                                                }
                                                setCurrentView('dashboard');
                                            }}
                                            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        {selectedAuditProfile ? 'User Activity Profile' : 'System Logs'}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {selectedAuditProfile
                                            ? `Daily activity summary for ${selectedAuditProfile.username} on ${selectedAuditProfile.dateLabel}`
                                            : 'Viewing all system activities and audit logs'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                        {logsData.length} Total Logs
                                    </span>
                                </div>
                            </div>
                            {selectedAuditProfile ? (
                                <UserAuditProfile
                                    profile={selectedAuditProfile}
                                    logs={logsData}
                                    onBack={handleCloseAuditProfile}
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                            <tr>
                                                <th className="px-6 py-4">ID</th>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Login Time</th>
                                                <th className="px-6 py-4">Logout Time</th>
                                                <th className="px-6 py-4">Username</th>
                                                <th className="px-6 py-4">Designation</th>
                                                <th className="px-6 py-4">Email</th>
                                                <th className="px-6 py-4">Domain</th>
                                                <th className="px-6 py-4">Role Type</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {logsData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="10" className="p-12 text-center text-slate-400">
                                                        No logs found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                logsData.map((log) => (
                                                    <LogStartRow
                                                        key={log.id}
                                                        {...log}
                                                        onSelectUser={() => handleOpenAuditProfile(log)}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                    ) : currentView === 'create-user' ? (
                        <CreateUserForm
                            onViewList={() => { setEditingData(null); handleSidebarNav('Users'); }}
                            initialData={editingData}
                        />
                    ) : (
                        // Reports View (Daily/Weekly)
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={() => navigate('/admin')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        {currentView === 'daily-reports' ? 'Daily Reports' : 'Weekly Reports'}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Viewing reports submitted by Super Admin</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">
                                        {reportsData.length} Reports
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">ID</th>
                                            <th className="px-6 py-4">Title / Project</th>
                                            <th className="px-6 py-4">Designation</th>
                                            <th className="px-6 py-4">Submitted By</th>
                                            <th className="px-6 py-4">{currentView === 'weekly-reports' ? 'Week' : 'Date'}</th>
                                            <th className="px-6 py-4">Day</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reportsData.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="p-12 text-center text-slate-400">
                                                    No reports found for this category.
                                                </td>
                                            </tr>
                                        ) : (
                                            reportsData.map((report) => (
                                                <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-400 font-mono text-[10px]">
                                                        #{report.id}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-800">{report.title || report.projectName}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {report.designation || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-slate-700 font-medium">{report.createdBy || report.name}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-slate-600">{currentView === 'weekly-reports' ? getWeekOfMonth(report.date) : (report.date ? (report.date.includes('-') && report.date.split('-').length === 3 ? report.date.split('-').reverse().join('/') : report.date) : 'N/A')}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400 italic">
                                                        {report.day}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${report.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                            report.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {report.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setSelectedReport(report)}
                                                            className="text-orange-500 hover:text-orange-700 font-bold text-xs"
                                                        >
                                                            VIEW DETAILS
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {selectedReport && (
                        <WeeklyReportDetailsModal 
                            report={selectedReport} 
                            onClose={() => setSelectedReport(null)} 
                        />
                    )}

                </main>
            </div >
        </div >
    );
};

// Active Components in sidebar 
const SidebarItem = ({ icon, label, active, activeBgColor, onClick }) => {
    const baseClasses = "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer font-medium";
    const activeClasses = active
        ? "bg-orange-500 text-white shadow-md shadow-orange-200"
        : activeBgColor || "text-slate-600 hover:bg-orange-50 hover:text-orange-600";

    return (
        <div className={`${baseClasses} ${activeClasses} mb-1`} onClick={onClick}>
            <span>{icon}</span>
            <span className="text-sm">{label}</span>
        </div>
    );
};

//
const MentorItem = ({ name, activity, avatarSeed }) => (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} alt={name} />
        </div>
        <div className="flex-1">
            <h4 className="font-bold text-sm text-slate-800">{name}</h4>
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Activity</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>{activity}</span>
            </div>
        </div>
    </div>
);

// Report Folder Component
const ReportFolder = ({ title, count, color = "text-orange-500" }) => (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3">
            <div className={`p-3 bg-white rounded-xl shadow-sm border border-slate-100 ${color}`}>
                <FolderIcon size={24} fill="currentColor" className="opacity-90" />
            </div>
            <h4 className="font-bold text-lg text-slate-800">{title}</h4>
        </div>
        <div className="mt-2 bg-white border border-slate-200 rounded-lg py-2 px-3 self-start flex items-center gap-2 shadow-sm">
            <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-white text-xs">
                <ChevronDownIcon size={14} />
            </div>
            <span className="text-sm font-semibold text-slate-700">{count}</span>
        </div>
    </div>
);

// Log Row Component(used in Recent Log Activity table)
const LogStartRow = ({ id, timestamp, login_time, logout_time, username, designation, email, domain, role, action, onSelectUser, idle_time }) => {
    const isLogin = action && (action.toLowerCase().includes('login') || action.toLowerCase().includes('log in') || action.toLowerCase().includes('logged in'));
    const isLogout = action && (action.toLowerCase().includes('logout') || action.toLowerCase().includes('log out') || action.toLowerCase().includes('logged out') || action.toLowerCase().includes('session completed'));
    
    // Determine status based on action
    const status = isLogin ? 'Online' : isLogout ? 'Offline' : 'Pending';
    
    // Use logout_time field if available, otherwise fallback to timestamp if it's a logout action
    const loginTimeValue = login_time || (!isLogout ? timestamp : null);
    const logoutTimeValue = logout_time || (isLogout ? timestamp : null);

    const displayLoginTime = formatIndianTime(loginTimeValue);
    const displayLogoutTime = formatIndianTime(logoutTimeValue);
    const displayDate = formatIndianDate(loginTimeValue || logoutTimeValue);

    return (
      <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
        <td className="px-6 py-4 font-mono text-xs text-slate-400 group-hover:text-slate-600 transition-colors">#{id}</td>
        <td className="px-6 py-4 text-sm text-slate-600">{displayDate}</td>
        <td className="px-6 py-4">
            {displayLoginTime ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-xs font-bold border border-green-100 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    {displayLoginTime}
                </span>
            ) : (
                <span className="text-slate-300 text-xs">-</span>
            )}
        </td>
        <td className="px-6 py-4">
            {displayLogoutTime ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-xs font-bold border border-red-100 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    {displayLogoutTime}
                </span>
            ) : (
                <span className="text-slate-300 text-xs">-</span>
            )}
        </td>
        <td className="px-6 py-4">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onSelectUser}
                    disabled={!onSelectUser}
                    className={`font-bold text-xs whitespace-nowrap transition-colors ${
                        onSelectUser ? 'text-slate-800 hover:text-orange-600' : 'text-slate-800 cursor-default'
                    }`}
                >
                    {username || 'N/A'}
                </button>
            </div>
        </td>
        <td className="px-6 py-4 text-slate-600 text-xs font-medium">{designation || 'N/A'}</td>
        <td className="px-6 py-4 text-slate-500 text-xs">{email || 'system@isms.com'}</td>
        <td className="px-6 py-4">
             <span className="text-slate-600 text-xs font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100 whitespace-nowrap">{domain}</span>
        </td>
        <td className="px-6 py-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                role === 'Admin' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                role === 'Mentor' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                'bg-slate-50 text-slate-600 border-slate-100'
            }`}>
                {role}
            </span>
        </td>
        <td className="px-6 py-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border whitespace-nowrap ${
                status === 'Online' ? 'bg-green-50 text-green-700 border-green-100' :
                status === 'Offline' ? 'bg-red-50 text-red-700 border-red-100' :
                'bg-yellow-50 text-yellow-700 border-yellow-100'
            }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                    status === 'Online' ? 'bg-green-500' :
                    status === 'Offline' ? 'bg-red-500' :
                    'bg-yellow-500'
                }`}></span>
                {status}
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

const UserAuditProfile = ({ profile, logs, onBack }) => {
    const userLogs = (logs || [])
        .filter((log) =>
            log.username?.trim().toLowerCase() === profile.username?.trim().toLowerCase()
        )
        .sort((a, b) => getIndianDateTimeMs(getLogPrimaryDateValue(a)) - getIndianDateTimeMs(getLogPrimaryDateValue(b)));
    const availableDateKeys = Array.from(
        new Set(
            userLogs
                .map((log) => getLogDateKey(log))
                .filter((value) => value && value !== 'N/A')
        )
    ).sort((a, b) => {
        const aLog = userLogs.find((log) => getLogDateKey(log) === a);
        const bLog = userLogs.find((log) => getLogDateKey(log) === b);
        return getIndianDateTimeMs(getLogPrimaryDateValue(bLog)) - getIndianDateTimeMs(getLogPrimaryDateValue(aLog));
    });
    const effectiveDateKey = availableDateKeys.includes(profile.dateKey)
        ? profile.dateKey
        : (availableDateKeys[0] || profile.dateKey);
    const effectiveDateLabel = effectiveDateKey || profile.dateLabel || 'N/A';
    const dailyLogs = userLogs
        .filter((log) => getLogDateKey(log) === effectiveDateKey);

    const uniqueDailyLogs = Array.from(
        dailyLogs.reduce((map, log) => {
            const sessionKey = [
                String(log.username || '').trim().toLowerCase(),
                log.login_time || '',
                log.logout_time || '',
                getLogDateKey(log) || '',
            ].join('__');

            const existing = map.get(sessionKey);
            if (!existing) {
                map.set(sessionKey, log);
                return map;
            }

            map.set(sessionKey, {
                ...existing,
                idle_time: Math.max(Number(existing.idle_time) || 0, Number(log.idle_time) || 0),
                logout_time: existing.logout_time || log.logout_time,
                timestamp: existing.timestamp || log.timestamp,
            });
            return map;
        }, new Map()).values()
    );

    const loginCandidates = uniqueDailyLogs
        .map((log) => log.login_time)
        .filter((value) => value && value !== 'NULL');
    const logoutCandidates = uniqueDailyLogs
        .map((log) => log.logout_time || ((log.action || '').toLowerCase().includes('logout') ? (log.timestamp || log.login_time) : null))
        .filter((value) => value && value !== 'NULL');
    const totalIdleSeconds = uniqueDailyLogs.reduce((sum, log) => sum + (Number(log.idle_time) || 0), 0);

    const firstLogin = loginCandidates.length
        ? loginCandidates.sort((a, b) => getIndianDateTimeMs(a) - getIndianDateTimeMs(b))[0]
        : null;
    const lastLogout = logoutCandidates.length
        ? logoutCandidates.sort((a, b) => getIndianDateTimeMs(b) - getIndianDateTimeMs(a))[0]
        : null;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">{profile.username}</h3>
                    <p className="text-sm text-slate-500">{profile.email}</p>
                    <p className="text-sm text-slate-500 mt-1">{profile.domain} • {profile.designation}</p>
                    <p className="text-sm text-slate-500">ID: {profile.custom_id || profile.id || '—'}</p>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                    Back To Logs
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <AuditSummaryCard title="User ID" value={profile.custom_id || profile.id || '—'} tone="slate" />
                <AuditSummaryCard title="Date" value={effectiveDateLabel} tone="slate" />
                <AuditSummaryCard title="First Login" value={firstLogin ? formatIndianDateTime(firstLogin) : '—'} tone="green" />
                <AuditSummaryCard title="Last Logout" value={lastLogout ? formatIndianDateTime(lastLogout) : '—'} tone="red" />
                <AuditSummaryCard title="Total Idle Time" value={formatIdleTime(totalIdleSeconds)} tone="amber" />
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800">Activity Timeline</h4>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{uniqueDailyLogs.length} Records</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-white text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Log ID</th>
                                <th className="px-6 py-4">Login Time</th>
                                <th className="px-6 py-4">Logout Time</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Idle Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {uniqueDailyLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">
                                        No activity found for this user on {effectiveDateLabel}.
                                    </td>
                                </tr>
                            ) : (
                                uniqueDailyLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">#{log.id}</td>
                                        <td className="px-6 py-4 text-xs font-semibold text-green-700">
                                            {log.login_time ? formatIndianDateTime(log.login_time) : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-semibold text-red-700">
                                            {log.logout_time ? formatIndianDateTime(log.logout_time) : '—'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-700 text-xs font-semibold bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                                {log.action || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-700 text-xs font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-100 whitespace-nowrap">
                                                {formatIdleTime(log.idle_time)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AuditSummaryCard = ({ title, value, tone }) => {
    const toneClass =
        tone === 'green'
            ? 'bg-green-50 border-green-100 text-green-700'
            : tone === 'red'
                ? 'bg-red-50 border-red-100 text-red-700'
                : tone === 'amber'
                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700';

    return (
        <div className={`rounded-2xl border p-4 ${toneClass}`}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">{title}</p>
            <p className="mt-2 text-sm font-bold break-words">{value}</p>
        </div>
    );
};

// --- Icons (Inline SVGs) ---
const HomeIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
);
const UsersIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const GlobeIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
);
const FileTextIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const MonitorIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
);
const UserCheckIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>
);
const LogOutIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);
const SearchIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
const MenuIcon = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
);
const ClockIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
);
const HelpCircleIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);
const FolderIcon = ({ size = 20, className = "", fill = "none" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
);
const ChevronDownIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9"></polyline></svg>
);

const UserPlusIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="17" y1="11" x2="23" y2="11"></line></svg>
);
const ActivityIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);

//User Form (For Creating New User)
const CreateUserForm = ({ onViewList, initialData }) => {
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        userId: "",
        role: "",
        domain: "",
        designation: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                fullName: initialData.username || "",
                email: initialData.email || `${initialData.username.replace(" ", ".").toLowerCase()}@isms.com`,
                password: "",
                userId: initialData.custom_id || "",
                role: initialData.role || "",
                domain: initialData.domain || "",
                designation: initialData.designation || "",
            });
        } else {
            setFormData({
                fullName: "",
                email: "",
                password: "",
                userId: "",
                role: "",
                domain: "",
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
            const response = await fetch(`${API_BASE_URL}/api/users${initialData ? `/${initialData.id}` : ''}`, {
                method: initialData ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    ...formData,
                    Domain: formData.domain,
                }),
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
                    className="text-orange-600 hover:text-orange-700 font-medium flex items-center gap-2"
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
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
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
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
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
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                                placeholder="e.g. NN/IN/XX/XXXX"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Employement Type
                            </label>
                            <select
                                name="designation"
                                value={formData.designation}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                            >
                                <option value="">Select Designation</option>
                                <option>Intern</option>
                                <option>Trainee</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Domain
                            </label>
                            <input
                                type="text"
                                name="domain"
                                value={formData.domain}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
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
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-50"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-6 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 ${isSubmitting ? "opacity-70 cursor-not-allowed" : ""}`}
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

// Weekly Report Details Modal matching requested format
const WeeklyReportDetailsModal = ({ report, onClose }) => {
    if (!report) return null;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

    let parsedTasks = null;
    try {
        if (report.reportContent && report.reportContent.startsWith('[')) {
            parsedTasks = JSON.parse(report.reportContent);
        }
    } catch (e) {
        console.error("Failed to parse weekly tasks");
    }

    // Default fallback mapping if not JSON
    const reportDataMappings = parsedTasks || [1, 2, 3, 4, 5, 6].map((dayCode) => ({
         day: dayCode,
         dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayCode-1],
         date: 'dd/mm/yy',
         tasks: dayCode === 1 ? report.reportContent : "Task 1: \nTask 2: \nTask 3: "
    }));

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl rounded-xl relative flex flex-col my-8 origin-top scale-95 animate-in zoom-in-95 duration-300">
                
                {/* Header - Non Printable Actions */}
                <div className="flex justify-between items-center p-4 border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-20 print:hidden rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <img src={logo} alt="Novanectar Logo" className="h-8" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800">Report Preview</h4>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold shadow-md shadow-blue-200"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Print Report
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all font-bold"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Back
                        </button>
                    </div>
                </div>

                {/* Paper Container - Specific Image Format */}
                <div className="flex-1 p-[20mm] bg-white print:p-0 text-slate-800 text-sm font-sans mx-auto w-full max-w-[190mm]">
                    
                    {/* Header Image */}
                    <div className="flex justify-center mb-6 mt-4">
                        <img src={logo} alt="Novanectar Logo" className="h-16 object-contain" />
                    </div>

                    <h1 className="text-center text-2xl font-normal mb-8 text-black">
                        Weekly Report Year ({currentYear})
                    </h1>

                    {/* Report Information Grid */}
                    <div className="space-y-4 mb-6">
                        <div className="flex"><span className="font-semibold w-40 shrink-0">Name:</span> <span className="flex-1">{report.name || report.createdBy}</span></div>
                        <div className="flex"><span className="font-semibold w-40 shrink-0">Position:</span> <span className="flex-1">{report.designation}</span></div>
                        <div className="flex"><span className="font-semibold w-40 shrink-0">Project Name:</span> <span className="flex-1">{report.title || report.projectName}</span></div>
                        <div className="flex"><span className="font-semibold w-40 shrink-0">Contact No:</span> <span className="flex-1">{report.mobileNumber || "N/A"}</span></div>
                        <div className="flex"><span className="font-semibold w-40 shrink-0">Mail:</span> <span className="flex-1">{report.email || "N/A"}</span></div>
                        <div className="flex"><span className="font-semibold w-40 shrink-0">Project Name:</span> <span className="flex-1">{report.title || report.projectName}</span></div>
                    </div>

                    {/* Introduction */}
                    <div className="mb-6">
                        <h2 className="font-bold mb-2">Introduction:</h2>
                        <p className="text-justify mb-4">
                            This report provides a comprehensive overview of the activities, performance, and
                            progress for the Week of <span className="font-semibold px-2 border-b border-black">{currentMonth}</span>, {currentYear}. It highlights key achievements,
                            challenges faced, and areas for improvement while analyzing key performance indicators
                            (KPIs) relevant to our operations.
                        </p>
                        <p className="text-justify mb-6">
                            The purpose of this report is to assess our monthly performance against set goals,
                            ensure transparency in operations, and facilitate data-driven decision-making.
                            Additionally, it outlines strategic plans for the upcoming month to enhance efficiency
                            and productivity.
                        </p>
                    </div>

                    {/* Executive Summary Table */}
                    <div className="mb-6">
                        <h2 className="font-bold mb-2">Executive Summary:</h2>
                        <div className="border border-black flex flex-col">
                            <div className="grid grid-cols-2 border-b border-black font-semibold text-[13px]">
                                <div className="p-2 border-r border-black">WEEKS/ DATES</div>
                                <div className="p-2">PROJECTS/TASKS (Time Slot)</div>
                            </div>
                            
                            {reportDataMappings.map((taskItem, index) => {
                                return (
                                    <div key={index} className={`grid grid-cols-2 text-[13px] ${index < 5 ? 'border-b border-black' : ''}`}>
                                        <div className="p-2 border-r border-black text-slate-700 min-w-0">
                                            Day {taskItem.day}, Date: {taskItem.date || 'dd/mm/yy'} ({taskItem.dayName})
                                        </div>
                                        <div className="p-2 whitespace-pre-wrap wrap-break-word min-w-0">
                                            {taskItem.tasks ? (
                                                <div className="italic text-blue-900 font-medium wrap-break-word">{taskItem.tasks}</div>
                                            ) : (
                                                <>
                                                    <div>Task 1:</div>
                                                    <div>Task 2:</div>
                                                    <div>Task 3:</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Future Aims */}
                    <div className="mb-6 mt-8">
                         <h2 className="font-bold mb-2">Future Aims:</h2>
                         <div className="grid grid-cols-2 items-stretch min-h-10 border border-black text-[13px]">
                             <div className="p-2 font-semibold min-w-0">Aim 1:</div>
                             <div className="border-l border-black p-2 whitespace-pre-wrap wrap-break-word   min-w-0 flex items-center">
                                 {report.weeklySummary || ''}
                             </div>
                         </div>
                    </div>

                    {/* Challenges */}
                    <div className="mb-10">
                         <h2 className="font-bold mb-2">Challenges:</h2>
                         <div className="min-h-10 whitespace-pre-wrap wrap-break-word text-[13px]">
                            {report.challenges || ''}
                         </div>
                    </div>

                    {/* Conclusion & Signatures */}
                    <div className="mt-8 mb-4">
                        <h2 className="font-bold mb-20">Conclusion:</h2>
                        
                        <div className="grid grid-cols-3 gap-6 text-[13px]">
                            <div className="text-left font-semibold">Mentore Sign</div>
                            <div className="text-center font-semibold">Department Approved Signature</div>
                            <div className="text-right font-semibold">HR Department Signature</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global CSS for Print */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                  body * { visibility: hidden; }
                  .print\\:hidden { display: none !important; }
                  .fixed { position: static !important; }
                  .inset-0 { position: static !important; }
                  .bg-white { background: transparent !important; }
                  .shadow-2xl { box-shadow: none !important; }
                  .p-4 { padding: 0 !important; }
                  .bg-slate-900\\/60 { background: transparent !important; }
                  .modal-container, .modal-container * { visibility: visible; }
                  .modal-container { position: absolute; left: 0; top: 0; width: 100%; }
                  @page { margin: 0; size: auto; }
                }
            `}} />
        </div>
    );
};

// Helper function to calculate week of month from date
const getWeekOfMonth = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    let date;
    // Handle different date formats
    if (dateString.includes('-') && dateString.split('-').length === 3) {
      // Format: YYYY-MM-DD
      const [year, month, day] = dateString.split('-');
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) return 'N/A';
    
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const weekNumber = Math.ceil((date.getDate() + firstDay.getDay()) / 7);
    
    // Convert to ordinal (1st, 2nd, 3rd, 4th, 5th)
    const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th'];
    return ordinals[weekNumber] || `${weekNumber}th`;
  } catch (error) {
    return 'N/A';
  }
};

export default Admin;
