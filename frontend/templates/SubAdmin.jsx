//Mentor Dashboard 
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from './config';

const SubAdmin = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [currentView, setCurrentView] = useState('dashboard');
    const [reportsData, setReportsData] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState({ name: 'Mentor', domain: 'Domain Mentor' });
    const [domainStats, setDomainStats] = useState({ newUsers: '--', activity: '--' });
    const [tasks, setTasks] = useState([]);
    const [taskMenuOpen, setTaskMenuOpen] = useState(false);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        domain: '',
        assignedTo: '',
        userId: '',
        deadline: '',
        priority: 'Medium',
        description: ''
    });

    const pollingIntervalRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

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
                        app_url: 'Mentor Dashboard'
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
    // Fetch daily reports for the "Daily Reports" view with backend integration, polling, and error handling
    const handleReportClick = async (reportType = 'daily') => {
        try {
            setIsLoading(true);
            setError(null);
            const endpoint = reportType === 'weekly' ? 'weekly-reports' : 'daily-reports';
            console.log(`Opening SubAdmin ${reportType} reports`);

            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }

            const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error(`Failed to fetch reports`);

            const data = await response.json();
            setReportsData(data);
            setCurrentView(reportType === 'weekly' ? 'weekly-reports' : 'daily-reports');

            pollingIntervalRef.current = setInterval(async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/${endpoint}`);
                    if (res.ok) setReportsData(await res.json());
                } catch (err) { console.warn(err); }
            }, 3000);

        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    // Fetch users for the "Users" view with backend integration and error handling
    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json();
                setUsersList(data);
            }
        } catch (err) {
            console.warn("Real-time polling error for users:", err);
        }
    };

    const handleUsersClick = async () => {
        try {
            setIsLoading(true);
            setError(null);
            await fetchUsers();
            setCurrentView('users');
        } catch (err) {
            console.error("Failed to fetch users:", err);
            setError("Could not load user data.");
            setCurrentView('users');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const [uRes, rRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/users`),
                fetch(`${API_BASE_URL}/api/daily-reports`)
            ]);

            if (uRes.ok) {
                const allUsers = await uRes.json();
                setUsersList(allUsers);

                const storedUser = JSON.parse(localStorage.getItem('currentUser'));
                const mentorDomain = storedUser?.domain || currentUser.domain;

                if (mentorDomain && mentorDomain !== 'Domain Mentor') {
                    const domainUsers = allUsers.filter(u => u.department === mentorDomain);
                    const activeDomainUsers = domainUsers.filter(u => u.status === 'Active').length;
                    const activityPercentage = domainUsers.length > 0 ? Math.round((activeDomainUsers / domainUsers.length) * 100) : 0;

                    setDomainStats({
                        newUsers: activeDomainUsers,
                        activity: `${activityPercentage}%`
                    });
                }
            }
            if (rRes.ok) setReportsData(await rRes.json());
        } catch (err) {
            console.warn("Dashboard polling error:", err);
        }
    };
    // Centralized navigation handler for sidebar items
    const handleSidebarNav = (label) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        if (label === 'Dashboard') {
            navigate('/mentor');
        } else if (label === 'Daily Reports') {
            navigate('/mentor/daily-reports');
        } else if (label === 'Weekly Reports') {
            navigate('/mentor/weekly-reports');
        } else if (label === 'Users') {
            navigate('/mentor/users');
        } else if (label === 'Send Credentials') {
            navigate('/mentor/credentials');
        } else if (label === 'Assign New Task') {
            navigate('/mentor/assign-task');
        } else if (label === 'Assigned Tasks') {
            navigate('/mentor/assigned-tasks');
        } else if (label === 'Task Assigning') {
            navigate('/mentor/assigned-tasks');
        }
    };
    // Task creation handler with backend integration and frontend fallback
    const handleCreateTask = async (e) => {
        e.preventDefault();

        const taskData = {
            ...newTask,
            status: 'Pending',
            createdAt: new Date().toISOString()
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                const savedTask = await response.json();
                setTasks([savedTask, ...tasks]);
                navigate('/mentor/assigned-tasks');
                setNewTask({ title: '', domain: '', assignedTo: '', userId: '', deadline: '', priority: '', description: '' });
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to save task to backend");
            }
        } catch (err) {
            console.error("Error creating task:", err);
            setError(`Error creating task: ${err.message}`);
        }
    };

    const handleCheckTask = async (taskId) => {
        setTasks(prevTasks => prevTasks.map(task =>
            task.id === taskId ? { ...task, isChecked: true } : task
        ));

        // Send notification to Super Admin
        try {
            await fetch(`${API_BASE_URL}/api/notifications/super-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, message: "Task checked by Mentor" })
            });
            console.log(`Notification sent to Super Admin for task ${taskId}`);
        } catch (err) { console.error("Failed to send notification:", err); }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(prev => ({ ...prev, name: parsedUser.username, domain: parsedUser.domain || prev.domain }));
        }
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser && usersList.length > 0) {
            const parsedUser = JSON.parse(storedUser);
            const foundUser = usersList.find(u => u.username === parsedUser.username);
            if (foundUser && foundUser.department) {
                setCurrentUser(prev => ({ ...prev, domain: foundUser.department }));
            }
        }
    }, [usersList]);

    useEffect(() => {
        const path = location.pathname;
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        if (path.endsWith('/users')) {
            handleUsersClick();
            pollingIntervalRef.current = setInterval(fetchUsers, 3000);
        } else if (path.endsWith('/daily-reports')) {
            handleReportClick('daily');
        } else if (path.endsWith('/weekly-reports')) {
            handleReportClick('weekly');
        } else if (path.endsWith('/credentials')) {
            setCurrentView('credentials');
            setTaskMenuOpen(false);
        } else if (path.endsWith('/assign-task')) {
            setCurrentView('assign-task');
            setTaskMenuOpen(true);
            if (usersList.length === 0) {
                fetchUsers();
            }
        } else if (path.endsWith('/assigned-tasks') || path.endsWith('/task-assigning')) {
            setCurrentView('task-assigning');
            if (usersList.length === 0) {
                fetchUsers();
            }
            setTaskMenuOpen(true);

            // Fetch tasks from backend
            fetch(`${API_BASE_URL}/api/tasks`)
                .then(res => res.ok ? res.json() : [])
                .then(data => setTasks(data))
                .catch(err => console.error("Failed to fetch tasks:", err));
        } else {
            setCurrentView('dashboard');
            fetchDashboardData();
            pollingIntervalRef.current = setInterval(fetchDashboardData, 3000);
        }

        return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
    }, [location.pathname]);

    return (
        <div className="flex h-screen bg-[#F8F9FA] font-sans text-slate-800">

            {/* Sidebar */}
            <aside className={`w-64 bg-white flex flex-col border-r border-slate-200 shrink-0 transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-30 h-full`}>
                {/* Brand */}
                <div className="h-16 flex items-center px-6 bg-amber-500 text-white font-bold text-xl tracking-wide shadow-md z-10">
                    <span className="mr-2">⚡</span> Mentor
                </div>

                {/* User Card */}
                <div className="p-4 border-b border-slate-100 bg-amber-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Robert" alt="Mentor" className="w-full h-full bg-amber-100" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">Hello, {currentUser.name}!</p>
                            <p className="text-xs text-slate-500">{currentUser.domain}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    <SidebarItem icon={<HomeIcon />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => handleSidebarNav('Dashboard')} />

                    <SidebarItem icon={<UsersIcon />} label="Users" active={currentView === 'users'} onClick={() => handleSidebarNav('Users')} />
                    <SidebarItem icon={<SendIcon />} label="Send Credentials" active={currentView === 'credentials'} onClick={() => handleSidebarNav('Send Credentials')} />
                    <SidebarItem
                        icon={<TaskIcon />}
                        label="Task Assigning"
                        active={currentView === 'task-assigning' || currentView === 'assign-task'}
                        onClick={() => setTaskMenuOpen(!taskMenuOpen)}
                        hasSubmenu
                        isOpen={taskMenuOpen}
                    >
                        <div className="ml-9 mt-1 space-y-1 border-l-2 border-amber-200 pl-2">
                            <button
                                onClick={() => handleSidebarNav('Assign New Task')}
                                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${currentView === "assign-task" ? "text-amber-600 font-medium" : "text-slate-600 hover:text-amber-600"}`}
                            >Assign New Task</button>
                        </div>
                        <div className="ml-9 mt-1 space-y-1 border-l-2 border-amber-200 pl-2">
                            <button
                                onClick={() => handleSidebarNav('Assigned Tasks')}
                                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${currentView === "task-assigning" ? "text-amber-600 font-medium" : "text-slate-600 hover:text-amber-600"}`}
                            >Assigned Tasks</button>
                        </div>
                    </SidebarItem>
                    <SidebarItem icon={<FileTextIcon />} label="Daily Reports" active={currentView === 'daily-reports'} onClick={() => handleSidebarNav('Daily Reports')} />
                    <SidebarItem icon={<FileTextIcon />} label="Weekly Reports" active={currentView === 'weekly-reports'} onClick={() => handleSidebarNav('Weekly Reports')} />

                </nav>

                {/* Bottom User Info */}
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs overflow-hidden">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Robert" alt="User" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{currentUser.domain} <br></br>{currentUser.name}</p>
                        </div>
                    </div>

                    <div className="mt-3 space-y-1">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors font-medium"
                        >
                            <LogOutIcon size={16} /> Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Top Header */}
                <header className="h-16 bg-amber-500 text-white flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm">
                    <div className="flex items-center flex-1">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden mr-4 p-2 text-white/80 hover:bg-white/10 rounded-lg">
                            <MenuIcon />
                        </button>
                        <div className="relative w-full max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-amber-200" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-lg leading-5 bg-white/20 text-white placeholder-amber-100 focus:outline-none focus:bg-white/30 focus:ring-0 transition-all sm:text-sm"
                                placeholder="Search Users..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-white/80 hover:text-white transition-colors relative">
                            <BellIcon size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                        <div className="h-8 w-8 rounded-full border border-white/50 overflow-hidden bg-white">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Robert" alt="Profile" />
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:text-slate-800">

                    {isLoading && (
                        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                            <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
                                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="font-medium text-slate-700">Loading...</span>
                            </div>
                        </div>
                    )}

                    {currentView === 'dashboard' ? (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    <span>Hello, <span className="text-amber-600">{currentUser.name}</span>!</span>
                                    {currentUser.domain && (
                                        <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs rounded-full border border-amber-100 uppercase tracking-wider shadow-sm">
                                            {currentUser.domain}
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

                            {/* Domain Statistics */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-slate-800">Domain Statistics</h2>
                                    <button className="text-slate-400 hover:text-slate-600"><XCircleIcon size={20} /></button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Total Users Card */}
                                    <div
                                        onClick={handleUsersClick}
                                        className="bg-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                        <div className="relative z-10 flex items-center justify-between">
                                            <div className="flex gap-4">
                                                <div className="p-3 bg-white/20 rounded-lg h-fit">
                                                    <UsersIcon size={28} />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-bold">Total Users</h3>
                                                    <p className="text-blue-100 opacity-90 text-sm">Total Mentors</p>
                                                    <h3 className="text-2xl font-bold">Domain Users</h3>
                                                    <p className="text-blue-100 opacity-90 text-sm">Users in your domain</p>
                                                </div>
                                            </div>
                                            <div className="text-4xl font-bold opacity-20">{usersList.length || '#'}</div>
                                            <div className="text-4xl font-bold opacity-20">{usersList.filter(u => u.department === currentUser.domain).length || '#'}</div>
                                        </div>
                                    </div>

                                    {/* New Users/Admins Card */}
                                    <div className="bg-linear-to-r from-amber-400 to-yellow-400 rounded-xl p-5 text-white shadow-lg shadow-amber-200 relative overflow-hidden flex items-center justify-between">
                                        <div className="flex gap-4 items-center">
                                            {/* <div className="text-5xl font-bold text-white/90">1</div> */}
                                            <div className="text-5xl font-bold text-white/90">{domainStats.newUsers}</div>
                                            <div>
                                                <p className="font-bold leading-tight">New User</p>
                                                <p className="text-amber-100 text-sm">Admins Ready</p>
                                                <p className="font-bold leading-tight">Active Users</p>
                                                <p className="text-amber-100 text-sm">In your domain</p>
                                            </div>
                                        </div>
                                        <div className="bg-green-500/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
                                            <span className="text-xl font-bold">{domainStats.activity}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* My Domain Users Table */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                                    <h3 className="font-bold text-lg text-slate-800">My Domain Users</h3>
                                    <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-600">
                                        <FilterIcon size={18} />
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4">Name</th>
                                                <th className="px-6 py-4">Email</th>
                                                <th className="px-6 py-4">Last Active</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {usersList.filter(u => u.department === currentUser.domain).length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                                                        No users found in your domain ({currentUser.domain}).
                                                    </td>
                                                </tr>
                                            ) : (
                                                usersList.filter(u => u.department === currentUser.domain).slice(0, 5).map((user) => (
                                                    <UserRow
                                                        key={user.id}
                                                        name={user.username}
                                                        email={user.email || 'No email'}
                                                        active="Today"
                                                        status={user.status === 'Active' ? 'online' : 'offline'}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Recent Activities */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/30">
                                    <h3 className="font-bold text-lg text-slate-800">Recent Activities</h3>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</th>
                                                <th className="px-6 py-4">Activity</th>
                                                <th className="px-6 py-4">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(reportsData.length > 0 ? reportsData : []).slice(0, 5).map((report) => (
                                                <ActivityRow
                                                    key={report.id}
                                                    date={report.date}
                                                    time={report.day || "Submission"}
                                                    activity={`Report: ${report.title || report.projectName}`}
                                                    status={report.status === 'Completed' ? 'done' : 'pending'}
                                                />
                                            ))}
                                            {reportsData.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="px-6 py-8 text-center text-slate-400">
                                                        No recent activities found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : currentView === 'users' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50/30">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={() => navigate('/mentor')} className="p-1 hover:bg-blue-100 rounded-full transition-colors text-blue-600">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        System Users
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1 ml-8">Viewing all users from the central system</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold ring-1 ring-blue-200">
                                        {usersList.length} Total Users
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">ID</th>
                                            <th className="px-6 py-4">Username</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Domain</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {usersList.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="p-12 text-center text-slate-400">
                                                    No users found.
                                                </td>
                                            </tr>
                                        ) : (
                                            usersList.map((user) => (
                                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{user.custom_id || user.id}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                                {user.username.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800">{user.username}</p>
                                                                <p className="text-slate-400 text-xs">{user.email || 'No email'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 font-medium">{user.designation}</td>
                                                    <td className="px-6 py-4 text-slate-500 font-medium">{user.department}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                                            {user.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : currentView === 'credentials' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="max-w-md mx-auto">
                                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-6">
                                    <SendIcon size={40} />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-4">Send Credentials</h2>
                                <p className="text-slate-500 mb-8">
                                    This module is ready for credential management and communication tools.
                                </p>
                                <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                    <p className="text-sm text-slate-400 font-medium italic">
                                        [ Developer Note: Custom data and functionality for sending user credentials can be implemented here. ]
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/mentor')}
                                    className="mt-8 text-amber-600 font-bold hover:underline flex items-center gap-2 mx-auto"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                    Back to Dashboard
                                </button>
                            </div>
                        </div>
                    ) : currentView === 'assign-task' ? (
                        <div className="p-6 bg-slate-50">
                            <form onSubmit={handleCreateTask} className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-lg text-slate-800 mb-4">Create New Task</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
                                        <input
                                            type="text"
                                            required
                                            value={newTask.title}
                                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            placeholder="e.g. Review Security Logs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">User ID</label>
                                        <select
                                            required
                                            value={newTask.userId}
                                            onChange={(e) => {
                                                const selectedId = e.target.value;
                                                const selectedUser = usersList.find(u => (u.custom_id || String(u.id)) === selectedId);

                                                let name = '';
                                                let domain = '';

                                                if (selectedUser) {
                                                    name = selectedUser.username;
                                                    domain = selectedUser.department || '';
                                                }

                                                setNewTask({
                                                    ...newTask,
                                                    userId: selectedId,
                                                    assignedTo: name,
                                                    domain: domain
                                                });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="">Select ID</option>
                                            {usersList.map(u => (
                                                <option key={u.id} value={u.custom_id || u.id}>{u.custom_id || u.id}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                                        <select
                                            required
                                            value={newTask.assignedTo}
                                            onChange={(e) => {
                                                const selectedName = e.target.value;
                                                const selectedUser = usersList.find(u => u.username === selectedName);

                                                let newUserId = '';
                                                let newDomain = '';

                                                if (selectedUser) {
                                                    newUserId = selectedUser.id;
                                                    newDomain = selectedUser.department || '';
                                                }

                                                setNewTask({
                                                    ...newTask,
                                                    assignedTo: selectedName,
                                                    domain: newDomain,
                                                    userId: selectedUser?.custom_id || newUserId
                                                });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="">Select User</option>
                                            {usersList.map(u => (
                                                <option key={u.id} value={u.username}>{u.username}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Domain</label>
                                        <input
                                            type="text"
                                            required
                                            readOnly
                                            value={newTask.domain}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-500 focus:outline-none"
                                            placeholder="Auto-filled from user"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                                        <input
                                            type="date"
                                            required
                                            value={newTask.deadline}
                                            onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                        <select
                                            value={newTask.priority}
                                            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea
                                        rows="3"
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="Task details..."
                                    ></textarea>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/mentor/assigned-tasks')}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium shadow-sm"
                                    >
                                        Assign Task
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : currentView === 'task-assigning' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/30">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={() => navigate('/mentor')} className="p-1 hover:bg-amber-100 rounded-full transition-colors text-amber-600">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        Assigned Tasks
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1 ml-8">Assign and monitor domain-specific tasks</p>
                                </div>
                                <button
                                    onClick={() => navigate('/mentor/assign-task')}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium shadow-sm shadow-amber-200 transition-colors flex items-center gap-2"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Assign New Task
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Task Title</th>
                                            <th className="px-6 py-4">Domain</th>
                                            <th className="px-6 py-4">Assigned To</th>
                                            <th className="px-6 py-4">User ID</th>
                                            <th className="px-6 py-4">Priority</th>
                                            <th className="px-6 py-4">Deadline</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tasks.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="p-12 text-center text-slate-400">
                                                    No tasks assigned yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            tasks.map((task) => (
                                                <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-800">{task.title}</td>
                                                    <td className="px-6 py-4 text-slate-600">{task.domain}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold">
                                                                {task.assignedTo.charAt(0)}
                                                            </div>
                                                            {task.assignedTo}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">{task.userId}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${task.priority === 'High' || task.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                                                            task.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-green-100 text-green-700'
                                                            }`}>
                                                            {task.priority}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">{task.deadline}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${task.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                            task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {task.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {/* Checked Button */}
                                                        <button
                                                            onClick={() => handleCheckTask(task.id)}
                                                            disabled={task.isChecked}
                                                            className={`mr-3 px-3 py-1 rounded-md text-xs font-bold transition-colors ${task.isChecked
                                                                ? 'bg-green-100 text-green-700 cursor-default'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-green-50 hover:text-green-600'
                                                                }`}
                                                        >
                                                            {task.isChecked ? 'Checked' : 'Unchecked'}
                                                        </button>

                                                        {/* Delete Button */}
                                                        <button className="text-slate-400 hover:text-red-500 transition-colors">
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/30">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <button onClick={() => navigate('/mentor')} className="p-1 hover:bg-amber-100 rounded-full transition-colors text-amber-600">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                        </button>
                                        {currentView === 'weekly-reports' ? 'Weekly Reports' : 'Daily Reports'}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1 ml-8">System-wide {currentView === 'weekly-reports' ? 'weekly' : 'daily'} progress tracking</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold ring-1 ring-amber-200">
                                        {reportsData.length} New Reports
                                    </span>
                                </div>
                            </div>

                            {/* User Reports Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
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
                                    <tbody className="divide-y divide-slate-100">
                                        {reportsData.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="p-12 text-center text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <FileTextIcon size={40} />
                                                        <p>No daily reports found.</p>
                                                    </div>
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
                                                        {report.designation || 'Staff'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-slate-700 font-medium">{report.name || report.createdBy}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-slate-600 font-medium">{report.date}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400 italic text-xs">
                                                        {report.day}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${report.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                            report.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {report.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => alert(`Report Details:\n${report.reportContent || 'No details content.'}`)}
                                                            className="text-amber-600 hover:text-amber-800 font-bold text-xs bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 transition-colors"
                                                        >
                                                            VIEW CONTENT
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
            </div>
        </div>
    );
};

// --- Components ---

const SidebarItem = ({ icon, label, active, onClick, hasSubmenu, isOpen, children }) => {
    const baseClasses = "flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer font-medium";
    const activeClasses = active
        ? "bg-amber-500 text-white shadow-md shadow-amber-200"
        : "text-slate-600 hover:bg-amber-50 hover:text-amber-600";

    return (
        <div>
            <div className={`${baseClasses} ${activeClasses} mb-1`} onClick={onClick}>
                <div className="flex items-center gap-3">
                    <span>{icon}</span>
                    <span className="text-sm">{label}</span>
                </div>
                {hasSubmenu && (
                    <ChevronDownIcon
                        size={14}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""} ${active ? 'text-white' : 'text-slate-400'}`}
                    />
                )}
            </div>
            {isOpen && children}
        </div>
    );
};

const UserRow = ({ name, email, active, status }) => (
    <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-6 py-4 font-semibold text-slate-700">{name}</td>
        <td className="px-6 py-4 text-slate-500">{email}</td>
        <td className="px-6 py-4 text-slate-500">{active}</td>
        <td className="px-6 py-4 text-center">
            <span className={`inline-block w-3 h-3 rounded-full ${status === 'online' ? 'bg-green-500 shadow-sm shadow-green-300' : 'bg-slate-300'}`}></span>
        </td>
    </tr>
);

const ActivityRow = ({ date, time, activity, status }) => (
    <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-6 py-4 font-medium text-slate-700">
            {date} <span className="text-slate-400 text-xs ml-2"> - {time}</span>
        </td>
        <td className="px-6 py-4 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-full"><InfoIcon size={12} /></div>
            <span className="text-slate-600">{activity}</span>
        </td>
        <td className="px-6 py-4">
            <div className={`flex items-center gap-2 font-medium ${status === 'done' ? 'text-green-600' : 'text-slate-500'}`}>
                {status === 'done' ? <CheckCircleIcon size={16} /> : <ClockIcon size={16} />}
                <span className="capitalize">{status === 'done' ? 'Online' : status}</span>
            </div>
        </td>
    </tr>
);

// --- Icons ---
const HomeIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
);
const UsersIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const FileTextIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const SendIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);
const LogOutIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);
const SearchIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
const MenuIcon = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
);
const BellIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
);
const XCircleIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
);
const FilterIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
);
const CheckCircleIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
);
const ClockIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
);
const InfoIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);
const TaskIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="2"></rect><path d="M9 14l2 2 4-4"></path></svg>
);
const ChevronDownIcon = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9"></polyline></svg>
);

export default SubAdmin;
