// src/app/admin/review/page.tsx

import React from 'react';
import Link from 'next/link';
import { ReviewPanel } from '@/components/admin/ReviewPanel';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminReviewPage() {
  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-6xl mx-auto mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-text px-3 py-1.5 rounded-lg bg-surface border border-surface-border transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Admin Arena</span>
        </Link>
      </div>
      <ReviewPanel />
    </div>
  );
}
