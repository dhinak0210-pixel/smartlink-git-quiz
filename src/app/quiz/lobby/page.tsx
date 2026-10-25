'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuizState } from '@/hooks/useQuizState';
import { LobbyScreen } from '@/components/quiz/LobbyScreen';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function QuizLobbyPage() {
  const router = useRouter();
  const { eventState, isLoading } = useQuizState(2000); // 2s polling in lobby

  const [studentName, setStudentName] = useState<string>('');
  const [collegeId, setCollegeId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const name = sessionStorage.getItem('smartlink_student_name') || 'Student';
      const id = sessionStorage.getItem('smartlink_student_college_id') || 'COLLEGE-ID';
      setStudentName(name);
      setCollegeId(id);
    }
  }, []);

  // When event status transitions to 'live', auto-route to /quiz
  useEffect(() => {
    if (eventState && eventState.status === 'live') {
      router.push('/quiz');
    }
  }, [eventState, router]);

  if (isLoading && !eventState) {
    return <LoadingSpinner label="Entering Arena Lobby..." />;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] py-10 px-4 sm:px-6 flex items-center justify-center">
      <LobbyScreen
        studentName={studentName}
        collegeId={collegeId}
        eventState={eventState}
      />
    </div>
  );
}
