import React from 'react';
import { AdminNav } from './AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <AdminNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
