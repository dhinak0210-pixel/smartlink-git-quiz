'use client';

import React, { useState, useEffect } from 'react';
import { QuestionEditor } from '@/components/admin/QuestionEditor';
import { Question } from '@/lib/utils/types';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/question/admin');
      if (res.ok) {
        const d = await res.json();
        setQuestions(d.questions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <LoadingSpinner label="Loading tournament question vault..." />
          </div>
        ) : (
          <QuestionEditor questions={questions} onRefresh={fetchQuestions} />
        )}
      </div>
    </div>
  );
}
