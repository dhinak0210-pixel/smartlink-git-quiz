import React from 'react';
import { AdminLoginForm } from '@/components/auth/AdminLoginForm';

export default function AdminLoginPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <AdminLoginForm />
    </div>
  );
}
