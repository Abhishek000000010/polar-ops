'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken } from './api';

type UserRole = 'ADMIN' | 'LOGISTICS_OFFICER' | 'STATION_LEADER' | 'SCIENTIST';

interface AuthContextType {
  email: string;
  role: UserRole;
  name: string;
  setPersona: (email: string) => Promise<void>;
  demoUsers: any[];
}

const AuthContext = createContext<AuthContextType>({
  email: 'admin@ncpor.res.in',
  role: 'ADMIN',
  name: 'Dr. S. K. Roy (NCPOR Operations)',
  setPersona: async () => {},
  demoUsers: []
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string>('admin@ncpor.res.in');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [name, setName] = useState<string>('Dr. S. K. Roy (NCPOR Operations)');
  const [demoUsers, setDemoUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRes = await api.getDemoUsers();
        if (usersRes?.data) {
          setDemoUsers(usersRes.data);
        }
      } catch (e) {
        console.warn('Failed to fetch demo users', e);
      }
    };
    fetchUsers();
  }, []);

  const setPersona = async (newEmail: string) => {
    setEmail(newEmail);
    const user = demoUsers.find(u => u.email === newEmail);
    if (user) {
      setRole(user.role);
      setName(user.name);
    }
    const loginRes = await api.login(newEmail);
    if (loginRes?.data?.token) {
      setToken(loginRes.data.token);
    }
  };

  return (
    <AuthContext.Provider value={{ email, role, name, setPersona, demoUsers }}>
      {children}
    </AuthContext.Provider>
  );
}
