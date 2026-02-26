import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from './config';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('admin');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(getApiUrl('/api/login'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username.trim(),
                    password,
                    role,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || 'Login failed');
                setLoading(false);
                return;
            }

            // ✅ Save logged-in user
            localStorage.setItem(
                'currentUser',
                JSON.stringify({
                    username: data.user.username,
                    role: data.user.role,
                    domain: data.user.domain,
                    designation: data.user.designation,
                    custom_id: data.user.custom_id
                })
            );

            navigateBasedOnRole(data.user.role);
        } catch (err) {
            console.error(err);
            setError('Server not reachable. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const navigateBasedOnRole = (roleType) => {
        const role = roleType?.toLowerCase();
        if (role === 'superadmin') {
            navigate('/super-admin', { replace: true });
        } else if (role === 'admin') {
            navigate('/admin', { replace: true });
        } else if (role === 'mentor') {
            navigate('/mentor', { replace: true });
        } else if (role === 'user') {
            navigate('/dashboard', { replace: true });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-500 to-purple-600 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-slate-800">Welcome Back</h2>
                    <p className="text-slate-500 mt-2">Please sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                        >
                            <option value="superadmin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="mentor">Mentor</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 bg-indigo-600 text-white font-bold rounded-xl ${loading ? 'opacity-70 cursor-not-allowed' : ''
                            }`}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-400">
                    Powered by ISMS
                </p>
            </div>
        </div>
    );
};

export default Login;