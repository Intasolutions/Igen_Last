import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('access');

  // 🚫 No token: Redirect to login
  if (!token) {
    return <Navigate to="/" replace />;
  }

  try {
    // 🔐 Decode the JWT token
    const decoded = jwtDecode(token);
    const userRole = decoded?.role;

    // ✅ Check if user's role is allowed
    if (userRole && allowedRoles.includes(userRole)) {
      return children;
    }

    // ❌ Role not allowed
    return (
      <div style={{ padding: 40 }}>
        <h2>403 Forbidden - Unauthorized</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  } catch (err) {
    // ⚠️ Invalid or expired token
    console.error('Invalid token:', err);
    return <Navigate to="/" replace />;
  }
}
