//Admin Dashboard
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from './config';

const Admin = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reportsData, setReportsData] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [logsData, setLogsData] = useState([]);
    const [mentorPerformance, setMentorPerformance] = useState([]);
    const [currentView, setCurrentView] = useState('dashboard');
    const pollingIntervalRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState({ name: 'Admin', domain: 'Admin Dashboard' });
    const [dashboardStats, setDashboardStats] = useState({ dailyProductivity: '--', weeklyActivity: '--' });
    const [editingData, setEditingData] = useState(null);


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
                        app_url: 'Admin Dashboard'
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
        navigate('/');
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
    const handleReportFolderClick = async (reportType) => {
        try {
            setIsLoading(true);
            setError(null);
            const endpoint = reportType.toLowerCase().includes('daily') ? 'daily-reports' : 'weekly-reports';

            // Fetch reports from SuperAdmin API
            const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${reportType} reports`);
            }

            const data = await response.json();
            setReportsData(data);
            setCurrentView(reportType.toLowerCase().includes('daily') ? 'daily-reports' : 'weekly-reports');

            // Set up real-time polling - refresh every 3 seconds
            pollingIntervalRef.current = setInterval(async () => {
                try {
                    const refreshResponse = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });

                    if (refreshResponse.ok) {
                        const updatedData = await refreshResponse.json();
                        setReportsData(updatedData);
                    }
                } catch (err) {
                    console.warn(`Real-time polling error for ${reportType}:`, err);
                }
            }, 3000);

        } catch (err) {
            console.error(`Error fetching reports:`, err);
            setError(`Failed to load reports: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json();
                setUsersList(data);

                // Also update dashboard stats based on new users list
                const activeUsers = data.filter(u => u.status === 'Active').length;
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
            const response = await fetch(`${API_BASE_URL}/api/logs`);
            if (response.ok) {
                const data = await response.json();
                setLogsData(data);
            }
        } catch (err) {
            console.warn("Real-time polling error for logs:", err);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const [uRes, rRes, lRes, mRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/users`),
                fetch(`${API_BASE_URL}/api/daily-reports`),
                fetch(`${API_BASE_URL}/api/logs`),
                fetch(`${API_BASE_URL}/api/mentors/performance`)
            ]);

            if (uRes.ok) {
                const users = await uRes.json();
                setUsersList(users);
                const activeUsers = users.filter(u => u.status === 'Active').length;
                const productivity = users.length > 0 ? Math.round((activeUsers / users.length) * 100) : 0;
                setDashboardStats({
                    dailyProductivity: `${productivity}%`,
                    weeklyActivity: `${productivity}%`
                });
            }
            if (rRes.ok) setReportsData(await rRes.json());
            if (lRes.ok) setLogsData(await lRes.json());
            if (mRes.ok) setMentorPerformance(await mRes.json());
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

    // URL-based view management
    useEffect(() => {
        const path = location.pathname;
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        if (path.endsWith('/users')) {
            handleUsersNav();
            pollingIntervalRef.current = setInterval(fetchUsers, 3000);
        } else if (path.endsWith('/create-user')) {
            setCurrentView('create-user');
        } else if (path.endsWith('/daily-reports')) {
            handleReportFolderClick('Daily Reports');
        } else if (path.endsWith('/weekly-reports')) {
            handleReportFolderClick('Weekly Reports');
        } else if (path.endsWith('/domains')) {
            setCurrentView('domains');
            if (usersList.length === 0) {
                fetch(`${API_BASE_URL}/api/users`)
                    .then(res => res.ok ? res.json() : [])
                    .then(data => setUsersList(data))
                    .catch(err => console.error("Failed to fetch users for domains", err));
            }
        } else if (path.endsWith('/monitoring')) {
            setCurrentView('monitoring');
        } else if (path.endsWith('/mentors')) {
            setCurrentView('mentors');
        } else if (path.endsWith('/logs')) {
            setCurrentView('logs');
            fetchLogs();
            pollingIntervalRef.current = setInterval(fetchLogs, 3000);
        } else {
            handleDashboardNav();
            pollingIntervalRef.current = setInterval(fetchDashboardData, 3000);
        }

        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
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
                designation: parsedUser.designation || ''
            }));
        }
    }, []);

    return (
        <div className="flex h-screen bg-[#F8F9FA] font-sans text-slate-800">

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
                    <span className="mr-2">⚡</span> Admin
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
                                                {usersList.filter(u => u.role && u.role.toLowerCase().includes('mentor')).length}
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
                                                logsData.map((log) => (
                                                    <LogStartRow
                                                        key={log.id}
                                                        id={log.id}
                                                        date={log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'N/A'}
                                                        time={log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                                                        username={log.username}
                                                        designation={log.designation}
                                                        email={log.email}
                                                        domain={log.domain || 'System'}
                                                        role={log.role || 'User'}
                                                        action={log.action}
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
                                            <th className="px-6 py-4">User Details</th>
                                            <th className="px-6 py-4">Domain</th>
                                            <th className="px-6 py-4">Designation</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {usersList.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-slate-400">
                                                    No users found in the system.
                                                </td>
                                            </tr>
                                        ) : (
                                            usersList.map((user) => (
                                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{user.custom_id || user.id}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold border border-orange-200 shadow-sm">
                                                                {user.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800">{user.username}</p>
                                                                <p className="text-slate-400 text-xs">{user.email || 'no-email@system.com'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{user.designation}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 font-medium">{user.department}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {user.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => { setEditingData(user); setCurrentView('create-user'); navigate('/admin/create-user'); }}
                                                            className="text-orange-500 hover:text-orange-700 font-bold text-xs uppercase"
                                                        >
                                                            Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
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
                                        {usersList.filter(u => u.role && u.role.toLowerCase().includes('mentor')).length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="p-12 text-center text-slate-400">
                                                    No mentors found.
                                                </td>
                                            </tr>
                                        ) : (
                                            usersList.filter(u => u.role && u.role.toLowerCase().includes('mentor')).map((user) => (
                                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-800">{user.username}</td>
                                                    <td className="px-6 py-4 text-slate-600">{user.department}</td>
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{user.custom_id || user.id}</td>
                                                    <td className="px-6 py-4 font-semibold text-slate-700">
                                                        {usersList.filter(u => u.department === user.department && u.id !== user.id).length}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {user.status === 'Active' ? 'Online' : 'Offline'}
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
                                        {[...new Set(usersList.map(u => u.department).filter(Boolean))].length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-slate-400">
                                                    No domains found.
                                                </td>
                                            </tr>
                                        ) : (
                                            [...new Set(usersList.map(u => u.department).filter(Boolean))].map((domain, index) => (
                                                <tr key={index} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">#{index + 1}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-800">{domain}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            {usersList.filter(u => u.department === domain && u.status === 'Active').map(u => (
                                                                <span key={u.id} className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block w-fit">
                                                                    {u.username} <span className="text-slate-400">({u.custom_id || u.id})</span>
                                                                </span>
                                                            ))}
                                                            {usersList.filter(u => u.department === domain && u.status === 'Active').length === 0 && (
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
                                        <button onClick={() => setCurrentView('dashboard')} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        System Logs
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">Viewing all system activities and audit logs</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                        {logsData.length} Total Logs
                                    </span>
                                </div>
                            </div>
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
                                                    id={log.id}
                                                    date={log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'N/A'}
                                                    time={log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                                                    username={log.username}
                                                    designation={log.designation}
                                                    email={log.email}
                                                    domain={log.domain || 'System'}
                                                    role={log.role || 'User'}
                                                    action={log.action}
                                                />
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
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
                                            <th className="px-6 py-4">Date</th>
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
                                                        <div className="text-slate-600">{report.date}</div>
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
                                                            onClick={() => alert(`Content: ${report.reportContent || 'No content provided'}`)}
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
const LogStartRow = ({ id, date, time, username, designation, email, domain, role, action }) => {
    const isLogin = action && (action.toLowerCase().includes('log in') || action.toLowerCase().includes('logged in'));
    const isLogout = action && (action.toLowerCase().includes('log out') || action.toLowerCase().includes('logged out'));

    return (
      <tr className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
        <td className="px-6 py-4 font-mono text-xs text-slate-400 group-hover:text-slate-600 transition-colors">#{id}</td>
        <td className="px-6 py-4 text-sm text-slate-600">{date}</td>
        <td className="px-6 py-4">
            {isLogin ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-xs font-bold border border-green-100 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    {time}
                </span>
            ) : (
                <span className="text-slate-300 text-xs">-</span>
            )}
        </td>
        <td className="px-6 py-4">
            {isLogout ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-xs font-bold border border-red-100 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    {time}
                </span>
            ) : (
                <span className="text-slate-300 text-xs">-</span>
            )}
        </td>
        <td className="px-6 py-4">
            <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-xs whitespace-nowrap">{username || 'N/A'}</span>
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
             <span className="text-slate-700 text-xs font-semibold bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                {action}
            </span>
        </td>
      </tr>
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
                body: JSON.stringify(formData),
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



export default Admin;
