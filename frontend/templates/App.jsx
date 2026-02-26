import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Admin from './Admin';
import SuperAdmin from './SuperAdmin';
import SubAdmin from './SubAdmin';
import Dashboard from './Dashboard';

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/admin/*" element={<Admin />} />
                <Route path="/super-admin/*" element={<SuperAdmin />} />
                <Route path="/mentor/*" element={<SubAdmin />} />
                <Route path="/dashboard" element={<Dashboard user="User" />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
};

export default App;
