'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  KeyRound,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Shield,
  FileSpreadsheet,
  UserPlus,
  Trash2,
  Copy,
  Check,
  X,
  PlayCircle,
  LogOut,
  Mail,
  ShieldCheck,
  Info,
  Upload,
  FileUp,
  FileText,
  Sparkles,
  Download,
  CheckCircle2,
  Link2,
} from 'lucide-react';


interface StudentItem {
  id: string;
  name: string;
  email: string;
  register_no: string;
  status: string;
  join_code?: string;
  auth_user_id?: string | null;
  locked_until: string | null;
  join_attempts?: number;
  consent_at?: string | null;
  created_at?: string;
  active_session_id?: string | null;
}

interface NewContestantForm {
  name: string;
  email: string;
  registerNo: string;
  password: string;
  joinCode: string;
  autoProvisionAuth: boolean;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Add Contestant Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingContestant, setAddingContestant] = useState(false);
  const [form, setForm] = useState<NewContestantForm>({
    name: '',
    email: '',
    registerNo: '',
    password: '',
    joinCode: '',
    autoProvisionAuth: true,
  });

  // Multi-source Contestant Import Modal (Excel sheet, PDF, Google Form)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSource, setImportSource] = useState<'excel' | 'pdf' | 'google-form'>('excel');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [pastedFormText, setPastedFormText] = useState('');
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [parsedContestants, setParsedContestants] = useState<any[]>([]);
  const [importModalError, setImportModalError] = useState<string | null>(null);
  const [importModalSuccess, setImportModalSuccess] = useState<string | null>(null);

  // Created credentials modal state
  const [createdContestant, setCreatedContestant] = useState<{
    name: string;
    email: string;
    register_no: string;
    password?: string;
    join_code?: string;
    canLoginImmediately: boolean;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);


  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/students');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch {
      // Soft fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleAddContestant = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingContestant(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: form.name,
          email: form.email,
          registerNo: form.registerNo,
          password: form.password,
          joinCode: form.joinCode,
          autoProvisionAuth: form.autoProvisionAuth,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to add contestant');
        return;
      }

      setCreatedContestant(data.contestant);
      setIsAddModalOpen(false);
      setForm({
        name: '',
        email: '',
        registerNo: '',
        password: '',
        joinCode: '',
        autoProvisionAuth: true,
      });
      await fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setAddingContestant(false);
    }
  };

  const handleContestantFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setIsAnalyzingSource(true);
    setImportModalError(null);
    setImportModalSuccess(null);

    try {
      const data = new FormData();
      data.append('file', file);
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        body: data,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to process file');

      setParsedContestants(json.contestants || []);
      if (!json.contestants || json.contestants.length === 0) {
        setImportModalError('No valid contestants found in this file. Please verify email and name columns.');
      } else {
        setImportModalSuccess(`Found ${json.contestants.length} contestants in ${file.name}! Review below before importing.`);
      }
    } catch (err: any) {
      setImportModalError(err.message || 'Error processing file');
    } finally {
      setIsAnalyzingSource(false);
    }
  };

  const handleFetchGoogleSheet = async () => {
    if (!googleFormUrl.trim()) {
      setImportModalError('Please enter a Google Form or Google Sheets URL.');
      return;
    }
    setIsAnalyzingSource(true);
    setImportModalError(null);
    setImportModalSuccess(null);

    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'google-sheets-url', url: googleFormUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch Google Sheet');

      setParsedContestants(json.contestants || []);
      if (!json.contestants || json.contestants.length === 0) {
        setImportModalError('No contestant rows found in this Google Sheet. Ensure sheet is shared to anyone with link.');
      } else {
        setImportModalSuccess(`Fetched ${json.contestants.length} contestants from Google Sheet!`);
      }
    } catch (err: any) {
      setImportModalError(err.message);
    } finally {
      setIsAnalyzingSource(false);
    }
  };

  const handleParsePastedContestants = async () => {
    if (!pastedFormText.trim()) {
      setImportModalError('Please paste your Google Form response rows or table data.');
      return;
    }
    setIsAnalyzingSource(true);
    setImportModalError(null);
    setImportModalSuccess(null);

    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'text', text: pastedFormText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to parse text');

      setParsedContestants(json.contestants || []);
      if (!json.contestants || json.contestants.length === 0) {
        setImportModalError('Could not find contestant entries. Make sure each entry includes an email address.');
      } else {
        setImportModalSuccess(`Extracted ${json.contestants.length} contestants from pasted responses!`);
      }
    } catch (err: any) {
      setImportModalError(err.message);
    } finally {
      setIsAnalyzingSource(false);
    }
  };

  const handleCommitBulkImport = async () => {
    if (parsedContestants.length === 0) return;
    setIsSavingImport(true);
    setImportModalError(null);

    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: true, contestants: parsedContestants }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to import contestants');

      setMessage(`🎉 Successfully imported and provisioned ${json.createdCount} contestants! (${json.skippedCount || 0} existing skipped)`);
      setIsImportModalOpen(false);
      setParsedContestants([]);
      setImportFile(null);
      setGoogleFormUrl('');
      setPastedFormText('');
      await fetchStudents();
    } catch (err: any) {
      setImportModalError(err.message || 'Import failed');
    } finally {
      setIsSavingImport(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Name,Email,Register No,Join Code,Password\nAarav Sharma,aarav.sharma@klu.ac.in,CS2026001,ABCDEF,Klu@2026!\nPriya Patel,priya.patel@klu.ac.in,CS2026002,GHIJKL,Klu@2026!\nVikram Singh,vikram.singh@klu.ac.in,CS2026003,MNOPQR,Klu@2026!";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "smartlink_contestants_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleUnlock = async (studentId: string, email: string) => {
    setActionLoading(studentId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', studentId, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Successfully unlocked ${email}`);
        await fetchStudents();
      } else {
        alert(data.error || 'Failed to unlock');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetCredentials = async (student: StudentItem) => {
    if (!confirm(`Generate new login password and join code for ${student.name} (${student.email})?`)) return;
    setActionLoading(student.id);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-credentials', studentId: student.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedContestant({
          name: student.name,
          email: student.email,
          register_no: student.register_no,
          password: data.credentials.password,
          join_code: data.credentials.join_code,
          canLoginImmediately: true,
        });
        await fetchStudents();
      } else {
        alert(data.error || 'Failed to reset credentials');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteContestant = async (studentId: string, email: string, name: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY REMOVE ${name} (${email}) from the tournament?`)) return;
    setActionLoading(studentId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Contestant ${name} (${email}) removed.`);
        await fetchStudents();
      } else {
        alert(data.error || 'Failed to delete contestant');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleKick = async (studentId: string, email: string) => {
    if (!confirm(`Are you sure you want to terminate the active session for ${email}?`)) return;
    setActionLoading(studentId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick', studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Session kicked for ${email}`);
        await fetchStudents();
      } else {
        alert(data.error || 'Failed to kick session');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      alert('No students to export.');
      return;
    }
    const headers = ['ID', 'Name', 'Email', 'Register No', 'Status', 'Join Code', 'Auth Provisioned', 'Created At'];
    const rows = students.map((s) => [
      s.id,
      `"${s.name.replace(/"/g, '""')}"`,
      s.email,
      s.register_no || '',
      s.status,
      s.join_code || '',
      s.auth_user_id ? 'YES' : 'NO',
      s.created_at || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartlink_contestants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchQuery =
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.register_no && s.register_no.toLowerCase().includes(q));

    if (!matchQuery) return false;
    if (filter === 'locked') return Boolean(s.locked_until && new Date(s.locked_until) > new Date());
    if (filter === 'active') return s.status === 'logged_in' || s.status === 'in_quiz' || s.status === 'playing';
    if (filter === 'registered') return s.status === 'registered';
    if (filter === 'provisioned') return Boolean(s.auth_user_id || s.status === 'account_created');
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Users className="w-6 h-6 text-orange-400" />
                Contestant Directory & Management
              </h1>
              <p className="text-xs text-zinc-400">
                🔒 Admin-Controlled Registration | Total Contestants: {students.length} | Online: {students.filter(s => s.status === 'logged_in' || s.status === 'playing').length}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
              title="Download contestant credentials spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Export CSV
            </button>

            <button
              onClick={fetchStudents}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 rounded-lg text-xs font-semibold text-white shadow-lg shadow-orange-950/40 transition-colors"
              title="Import contestants via Excel sheet (.xlsx, .csv), PDF, or Google Form"
            >
              <Upload className="w-4 h-4" />
              <span>Import Contestants (Excel / PDF / Google Form)</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Contestant
            </button>
          </div>
        </div>

        {/* Informative Admin Notice */}
        <div className="p-3.5 bg-blue-950/30 border border-blue-800/40 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-200">Admin-Only Registration Mode Active:</span> Public contestant self-signup is restricted. Only Event Administrators can add contestants. Each added contestant is automatically provisioned with a secure Supabase Auth login and join code.
          </div>
        </div>

        {message && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by contestant name, college email, or register number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {(['all', 'provisioned', 'active', 'locked'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${
                  filter === tab
                    ? 'bg-zinc-800 text-orange-400 border border-zinc-700'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800/60'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Contestants Table */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 uppercase font-mono tracking-wider">
                <tr>
                  <th className="py-3 px-4">Contestant</th>
                  <th className="py-3 px-4">Register No</th>
                  <th className="py-3 px-4">Join Code</th>
                  <th className="py-3 px-4">Auth Status</th>
                  <th className="py-3 px-4">Tournament Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No matching contestants found. Click &quot;Add Contestant&quot; to register a student.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const isLocked = Boolean(s.locked_until && new Date(s.locked_until) > new Date());
                    return (
                      <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{s.name}</div>
                          <div className="text-zinc-500 font-mono text-[11px]">{s.email}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-300">
                          {s.register_no || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          {s.join_code || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {s.auth_user_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                              <ShieldCheck className="w-2.5 h-2.5" /> Provisioned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isLocked ? (
                            <span className="text-red-400 font-semibold flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                                s.status === 'logged_in' || s.status === 'in_quiz' || s.status === 'playing'
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                  : s.status === 'registered' || s.status === 'account_created'
                                  ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {s.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {isLocked ? (
                            <button
                              disabled={actionLoading === s.id}
                              onClick={() => handleUnlock(s.id, s.email)}
                              className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium transition-colors"
                              title="Unlock account"
                            >
                              <Unlock className="w-3 h-3 inline" />
                            </button>
                          ) : null}

                          <button
                            disabled={actionLoading === s.id}
                            onClick={() => handleResetCredentials(s)}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 rounded text-[11px] font-medium transition-colors"
                            title="Reset Credentials (Generate new password & join code)"
                          >
                            <KeyRound className="w-3 h-3 inline" />
                          </button>

                          <button
                            disabled={actionLoading === s.id}
                            onClick={() => handleKick(s.id, s.email)}
                            className="px-2 py-1 bg-zinc-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-zinc-700/60 rounded text-[11px] font-medium transition-colors"
                            title="Terminate Active Session"
                          >
                            <LogOut className="w-3 h-3 inline" />
                          </button>

                          <Link
                            href={`/admin/replay/${s.id}`}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-medium transition-colors inline-block"
                            title="Replay telemetry"
                          >
                            <PlayCircle className="w-3 h-3 inline" />
                          </Link>

                          <button
                            disabled={actionLoading === s.id}
                            onClick={() => handleDeleteContestant(s.id, s.email, s.name)}
                            className="px-2 py-1 bg-zinc-900 hover:bg-red-900/40 text-red-400 border border-zinc-800 hover:border-red-700 rounded text-[11px] font-medium transition-colors"
                            title="Delete Contestant"
                          >
                            <Trash2 className="w-3 h-3 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Contestant */}
        {/* Modal: Bulk Import Contestants (Excel / PDF / Google Form) */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-zinc-950 border border-orange-500/40 rounded-2xl p-6 shadow-2xl relative space-y-5 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>Import Contestants</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono">
                        Excel / PDF / Google Form
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-400">Bulk enroll participants and automatically provision login credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Source Switcher Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setImportSource('excel')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                    importSource === 'excel'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Excel Sheet (.xlsx / .csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportSource('pdf')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                    importSource === 'pdf'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-orange-400" />
                  <span>PDF Document (.pdf)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportSource('google-form')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                    importSource === 'google-form'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Google Form / Sheet</span>
                </button>
              </div>

              {importModalError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 rounded-xl flex items-center gap-2 shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{importModalError}</span>
                </div>
              )}

              {importModalSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 rounded-xl flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{importModalSuccess}</span>
                </div>
              )}

              <div className="space-y-4 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                {/* TAB 1: Excel */}
                {importSource === 'excel' && (
                  <div className="space-y-3">
                    <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-700 hover:border-emerald-500/60 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 cursor-pointer transition group text-center">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleContestantFileUpload}
                        disabled={isAnalyzingSource}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 group-hover:scale-110 transition-transform">
                        {isAnalyzingSource ? (
                          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                        ) : (
                          <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {importFile ? importFile.name : 'Click to select or drag & drop Excel / CSV file'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Supports <span className="text-emerald-400 font-mono">.xlsx</span>, <span className="text-emerald-400 font-mono">.xls</span>, or <span className="text-emerald-400 font-mono">.csv</span>
                      </p>
                    </label>

                    <div className="flex items-center justify-between text-xs bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                      <span className="text-zinc-400">Need a sample format with pre-built columns?</span>
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Template</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: PDF */}
                {importSource === 'pdf' && (
                  <div className="space-y-3">
                    <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-700 hover:border-orange-500/60 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 cursor-pointer transition group text-center">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleContestantFileUpload}
                        disabled={isAnalyzingSource}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-2 group-hover:scale-110 transition-transform">
                        {isAnalyzingSource ? (
                          <RefreshCw className="w-6 h-6 animate-spin text-orange-400" />
                        ) : (
                          <FileText className="w-6 h-6 text-orange-400" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {importFile ? importFile.name : 'Upload participant registration or nominal roll PDF'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Extracts student names, emails, and register numbers directly from PDF tables
                      </p>
                    </label>
                  </div>
                )}

                {/* TAB 3: Google Form / Google Sheets */}
                {importSource === 'google-form' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-300">
                        Google Sheet / Form Responses Public URL:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                          value={googleFormUrl}
                          onChange={(e) => setGoogleFormUrl(e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <button
                          type="button"
                          onClick={handleFetchGoogleSheet}
                          disabled={isAnalyzingSource || !googleFormUrl.trim()}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          {isAnalyzingSource ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                          <span>Fetch Responses</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        * Note: In Google Sheets, set Share to "Anyone with the link can view".
                      </p>
                    </div>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-zinc-800"></div>
                      <span className="flex-shrink mx-3 text-zinc-500 text-[10px] uppercase font-mono">OR PASTE DATA DIRECTLY</span>
                      <div className="flex-grow border-t border-zinc-800"></div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-300">
                        Paste Copied Google Form / Sheet Rows (TSV or CSV):
                      </label>
                      <textarea
                        rows={4}
                        placeholder={`Timestamp\tEmail\tName\tRegister No\n10/24/2026\tstudent1@klu.ac.in\tRahul Sharma\t21100301`}
                        value={pastedFormText}
                        onChange={(e) => setPastedFormText(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                      <button
                        type="button"
                        onClick={handleParsePastedContestants}
                        disabled={isAnalyzingSource || !pastedFormText.trim()}
                        className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Parse Copied Text</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* PARSED PREVIEW TABLE */}
                {parsedContestants.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          Found Contestants: {parsedContestants.length}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                          Ready to Provision
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setParsedContestants([])}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto border border-zinc-800 rounded-xl scrollbar-thin">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-zinc-900 sticky top-0 border-b border-zinc-800 text-[11px] text-zinc-400">
                          <tr>
                            <th className="p-2.5">#</th>
                            <th className="p-2.5">Name</th>
                            <th className="p-2.5">Email</th>
                            <th className="p-2.5">Register No</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
                          {parsedContestants.slice(0, 50).map((c, i) => (
                            <tr key={i} className="hover:bg-zinc-900/50">
                              <td className="p-2.5 text-zinc-500">{i + 1}</td>
                              <td className="p-2.5 text-white font-sans font-medium">{c.name}</td>
                              <td className="p-2.5 text-emerald-400">{c.email}</td>
                              <td className="p-2.5 text-zinc-300">{c.registerNo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedContestants.length > 50 && (
                        <div className="p-2 text-center text-[11px] text-zinc-500 bg-zinc-900 border-t border-zinc-800">
                          ... and {parsedContestants.length - 50} more contestants
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitBulkImport}
                  disabled={isSavingImport || parsedContestants.length === 0}
                  className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-orange-950/40 text-xs transition-colors flex items-center gap-1.5 font-mono"
                >
                  {isSavingImport ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enrolling & Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Import & Provision {parsedContestants.length} Contestants</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Single Contestant */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Add New Contestant</h2>
                    <p className="text-xs text-zinc-400">Admin-exclusive student enrollment</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddContestant} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Full Student Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">College Email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="e.g. 2100030001@klu.ac.in"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Register / Roll Number *</label>
                    <input
                      type="text"
                      required
                      value={form.registerNo}
                      onChange={(e) => setForm({ ...form, registerNo: e.target.value })}
                      placeholder="e.g. 2100030001"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      Initial Password <span className="text-zinc-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Auto-generated if blank"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      Join Code <span className="text-zinc-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.joinCode}
                      onChange={(e) => setForm({ ...form, joinCode: e.target.value })}
                      placeholder="Auto-generated 6-char"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="autoProvisionAuth"
                    checked={form.autoProvisionAuth}
                    onChange={(e) => setForm({ ...form, autoProvisionAuth: e.target.checked })}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="autoProvisionAuth" className="text-zinc-300 cursor-pointer">
                    <span className="font-semibold text-white block">Pre-Provision Supabase Auth Login</span>
                    <span className="text-[11px] text-zinc-400 block">
                      Enables the contestant to log in directly with their email & password without needing a separate self-signup form.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingContestant}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-colors flex items-center gap-1.5"
                  >
                    {addingContestant ? 'Enrolling Contestant...' : 'Enroll Contestant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Credentials Created / Revealed */}
        {createdContestant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl relative space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-950 border border-emerald-700/60 rounded-xl text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Contestant Credentials Ready</h2>
                    <p className="text-xs text-zinc-400">Share these login details directly with the contestant</p>
                  </div>
                </div>
                <button
                  onClick={() => setCreatedContestant(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Name:</span>
                  <span className="text-white font-sans font-semibold">{createdContestant.name}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Register No:</span>
                  <span className="text-zinc-300">{createdContestant.register_no}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Email:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">{createdContestant.email}</span>
                    <button
                      onClick={() => copyToClipboard(createdContestant.email, 'email')}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                      title="Copy email"
                    >
                      {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">Password:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">{createdContestant.password}</span>
                    <button
                      onClick={() => copyToClipboard(createdContestant.password || '', 'pwd')}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                      title="Copy password"
                    >
                      {copiedField === 'pwd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-500">Join Code:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 font-bold tracking-wider">{createdContestant.join_code}</span>
                    <button
                      onClick={() => copyToClipboard(createdContestant.join_code || '', 'code')}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                      title="Copy join code"
                    >
                      {copiedField === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    const messageText = `Hi ${createdContestant.name}!\nYour SmartLink Git Quiz credentials:\n• Email: ${createdContestant.email}\n• Password: ${createdContestant.password}\n• Join Code: ${createdContestant.join_code}\n\nLogin at: http://localhost:3000/login\nPre-event check: http://localhost:3000/test-login`;
                    copyToClipboard(messageText, 'all');
                  }}
                  className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {copiedField === 'all' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Copied Invitation Text!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Full Contestant Invitation Message</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setCreatedContestant(null)}
                  className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
