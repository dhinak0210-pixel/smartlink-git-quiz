// src/app/results/page.tsx
import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';

interface LeaderboardEntry {
  rank: number;
  name: string;
  total_points: number;
  correct_count: number;
}

async function getPublishedResults(): Promise<{
  published: boolean;
  top3: LeaderboardEntry[];
  top10: LeaderboardEntry[];
} | null> {
  try {
    // Check if results are published
    const { data: state } = await supabaseAdmin
      .from('quiz_state')
      .select('results_published')
      .limit(1)
      .maybeSingle();

    if (!state?.results_published) {
      return null;
    }

    // Fetch leaderboard (prefer verified_leaderboard, fallback to leaderboard)
    let { data: leaderboard } = await supabaseAdmin
      .from('verified_leaderboard')
      .select('*')
      .order('rank')
      .limit(10);

    if (!leaderboard || leaderboard.length === 0) {
      const fallback = await supabaseAdmin
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(10);
      leaderboard = fallback.data;
    }

    if (!leaderboard || leaderboard.length === 0) {
      return null;
    }

    // Resolve student names (Never expose college IDs or emails on public page)
    const studentIds = leaderboard.map((l: any) => l.student_id || l.id);
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, name')
      .in('id', studentIds);

    const nameMap = new Map(students?.map((s: any) => [s.id, s.name]) || []);

    const entries: LeaderboardEntry[] = leaderboard.map((l: any, i: number) => {
      const sid = l.student_id || l.id;
      return {
        rank: l.rank || i + 1,
        name: nameMap.get(sid) || l.name || 'Anonymous Finalist',
        total_points: l.total_points ?? 0,
        correct_count: l.correct_count ?? l.correct_answers ?? 0,
      };
    });

    return {
      published: true,
      top3: entries.slice(0, 3),
      top10: entries,
    };
  } catch (err) {
    console.error('Failed to load published results:', err);
    return null;
  }
}

export default async function ResultsPage() {
  const results = await getPublishedResults();

  if (!results) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-slate-800/80 border border-slate-700/80 p-8 rounded-2xl shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 text-3xl">
            ⏳
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">SmartLink Git Quiz</h1>
          <p className="text-slate-400 text-base leading-relaxed">
            The results are currently being verified and finalized by the organizers.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-700/60 text-sm text-slate-500">
            Results will be published as soon as verification completes. Stay tuned!
          </div>
        </div>
      </main>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <span>✨</span> Official Results
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
            SmartLink Git Quiz Results
          </h1>
          <p className="text-slate-400 text-base md:text-lg">
            Hearty congratulations to all finalists and participants!
          </p>
        </div>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-12 items-end pt-4">
          {/* 2nd place */}
          <div className="text-center">
            {results.top3[1] && (
              <div className="bg-slate-900/90 border border-slate-700 rounded-2xl shadow-xl p-4 md:p-6 relative group hover:border-slate-500 transition">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center mx-auto -mt-10 mb-2 shadow-lg text-2xl">
                  {medals[1]}
                </div>
                <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Runner-up</div>
                <p className="font-bold text-base md:text-lg text-white truncate">{results.top3[1].name}</p>
                <p className="text-xl md:text-2xl font-mono text-indigo-400 font-bold mt-1">
                  {results.top3[1].total_points.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {results.top3[1].correct_count}/15 correct
                </p>
              </div>
            )}
          </div>

          {/* 1st place (taller) */}
          <div className="text-center">
            {results.top3[0] && (
              <div className="bg-gradient-to-b from-slate-900 to-indigo-950/40 border-2 border-amber-500/60 rounded-2xl shadow-2xl p-5 md:p-8 relative transform md:-translate-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto -mt-14 mb-3 shadow-xl text-3xl">
                  {medals[0]}
                </div>
                <div className="text-xs uppercase font-extrabold tracking-widest text-amber-400 mb-1">Champion</div>
                <p className="font-extrabold text-lg md:text-xl text-white truncate">{results.top3[0].name}</p>
                <p className="text-2xl md:text-4xl font-mono text-amber-300 font-extrabold mt-1">
                  {results.top3[0].total_points.toLocaleString()}
                </p>
                <p className="text-xs md:text-sm text-slate-300 mt-1 font-medium">
                  {results.top3[0].correct_count}/15 correct
                </p>
              </div>
            )}
          </div>

          {/* 3rd place */}
          <div className="text-center">
            {results.top3[2] && (
              <div className="bg-slate-900/90 border border-slate-700 rounded-2xl shadow-xl p-4 md:p-6 relative group hover:border-slate-500 transition">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center mx-auto -mt-10 mb-2 shadow-lg text-2xl">
                  {medals[2]}
                </div>
                <div className="text-xs uppercase font-bold tracking-wider text-amber-600/80 mb-1">2nd Runner-up</div>
                <p className="font-bold text-base md:text-lg text-white truncate">{results.top3[2].name}</p>
                <p className="text-xl md:text-2xl font-mono text-indigo-400 font-bold mt-1">
                  {results.top3[2].total_points.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {results.top3[2].correct_count}/15 correct
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top 10 Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
          <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-white font-bold text-base md:text-lg flex items-center gap-2">
              <span>🏅</span> Top 10 Leaderboard
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
              Verified
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3.5 w-20">Rank</th>
                  <th className="px-6 py-3.5">Student Name</th>
                  <th className="px-6 py-3.5 text-center">Correct</th>
                  <th className="px-6 py-3.5 text-right">Final Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {results.top10.map((entry) => (
                  <tr key={entry.rank} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-semibold text-slate-200">
                      {entry.rank <= 3 ? (
                        <span className="text-lg">{medals[entry.rank - 1]}</span>
                      ) : (
                        <span className="text-slate-400 font-mono">#{entry.rank}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{entry.name}</td>
                    <td className="px-6 py-4 text-center font-mono text-slate-400">
                      {entry.correct_count}/15
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-indigo-400 font-bold">
                      {entry.total_points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center mt-10">
          <div className="inline-block p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
            Top 3 winners receive an official Winner Certificate, and all participants receive their Certificate of Participation at{' '}
            <Link href="/download" className="text-indigo-400 font-semibold hover:text-indigo-300 underline ml-1">
              /download
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
