'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { jwtDecode } from 'jwt-decode';

export default function Login() {
  const [user_id, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState(''); // 'success' | 'error'

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const redirectToDashboard = (role) => {
    switch (role) {
      case 'SUPER_USER':
      case 'CENTER_HEAD':
      case 'PROPERTY_MANAGER':
      case 'ACCOUNTANT':
        window.location.href = '/dashboard';
        break;
      default:
        window.location.href = '/unauthorized';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/users/token/', {
        user_id,
        password,
      });

      const {
        access,
        refresh,
        role,
        user_id: responseUserId,
        company_id,
      } = res.data;

      localStorage.setItem('access', access);
      localStorage.setItem('refresh', refresh);

      const decoded = jwtDecode(access);
      const decodedRole = decoded?.role || 'UNKNOWN';

      // Log the full response
      console.log('🔍 Login Response:', res.data);

      localStorage.setItem('role', role || decodedRole);
      if (responseUserId) localStorage.setItem('user_id', responseUserId);
      if (company_id) localStorage.setItem('company_id', company_id);

      console.log('✅ Logged in as:', role || decodedRole);

      setType('success');
      setMessage('Login successful! Redirecting...');

      setTimeout(() => redirectToDashboard(role || decodedRole), 1200);
    } catch (err) {
      console.error('Login error:', err);
      setType('error');
      setMessage('Login failed: Check your credentials');
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-gray-800 relative overflow-hidden">
      {message && (
        <div
          className={`absolute top-5 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-md transition-all duration-300 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {message}
        </div>
      )}

      {/* Left Visual */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 bg-igen relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1.5 }}
          className="absolute w-[600px] h-[600px] bg-shadow rounded-full blur-[120px] animate-pulse"
        ></motion.div>

        <motion.img
          src="/logo/igen.png"
          alt="Visual"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5 }}
          className="w-[600px] z-10"
        />
      </div>

      {/* Right Form */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 px-8 py-12">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="max-w-md w-full mx-auto"
        >
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-gray-700">Hi</h2>
            <motion.span
              animate={{ rotate: [0, 20, -15, 10, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              className="text-3xl"
            >
              👋
            </motion.span>
            <h2 className="text-2xl font-bold text-gray-700">Welcome back</h2>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Login to access your dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="text"
              value={user_id}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-4 py-2 border rounded-lg focus:outline-purple-600"
              required
            />
            <div className="text-right text-sm text-indigo-600 hover:underline cursor-pointer">
              Forgotten password?
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
            >
              Login
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
