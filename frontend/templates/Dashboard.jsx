import React from 'react';

const Dashboard = ({ user }) => {
    return (
        <div>
            <h2>Welcome, {user} 👋</h2>
            <p>This is your dashboard.</p>
            <a href="/logout">Logout</a>
        </div>
    );
};

export default Dashboard;
