'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Layers,
  Cpu,
  TrendingUp,
  AlertTriangle,
  List,
  Plus,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Search,
  BookOpen,
  Terminal,
  Settings,
  Heart,
  Clock,
  Briefcase,
  ChevronRight,
  FileText,
  LogOut,
  BarChart2,
  Trash2,
  Edit2,
  Copy,
  Download,
  Info,
  X,
  Keyboard,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Eye,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';
import { io, Socket } from 'socket.io-client';

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Layout navigation: 'overview' | 'queues' | 'jobs' | 'workers' | 'scheduler' | 'dlq' | 'retry-policies' | 'logs' | 'analytics' | 'system-health' | 'settings' | 'documentation'
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // Details sub-view states
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedQueueSubTab, setSelectedQueueSubTab] = useState<'overview' | 'metrics' | 'workers' | 'jobs'>('overview');
  const [selectedWorkerSubTab, setSelectedWorkerSubTab] = useState<'stats' | 'heartbeats'>('stats');

  // Core collections
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [queues, setQueues] = useState<any[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string>('');
  const [retryPolicies, setRetryPolicies] = useState<any[]>([]);
  
  // Monitoring telemetry lists
  const [projectMetrics, setProjectMetrics] = useState<any>({
    totalQueues: 0,
    totalJobs: 0,
    successRate: 100,
    jobStatusCounts: { QUEUED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, DLQ: 0, RETRYING: 0, SCHEDULED: 0, CLAIMED: 0 },
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [jobsList, setJobsList] = useState<any[]>([]);
  const [dlqList, setDlqList] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [jobLogs, setJobLogs] = useState<any[]>([]);

  // Modals & Panels UI States
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(true);
  
  const [aiReport, setAiReport] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [logsSearch, setLogsSearch] = useState('');
  const [logsLevelFilter, setLogsLevelFilter] = useState<string>('ALL');

  // Command palette search query
  const [commandQuery, setCommandQuery] = useState('');

  // Toast notifications list
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'success' | 'info' | 'warning' | 'error' }[]>([]);

  // Real-time Event Feed
  const [activityFeed, setActivityFeed] = useState<string[]>([
    'System initialization completed.',
    'Telemetry WebSocket connection established.',
    'Workspace telemetry stream active.',
  ]);

  // Form Fields
  const [newOrgName, setNewOrgName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newQueueName, setNewQueueName] = useState('');
  const [newQueuePriority, setNewQueuePriority] = useState(1);
  const [newQueueConcurrency, setNewQueueConcurrency] = useState(5);
  const [newQueuePolicyId, setNewQueuePolicyId] = useState('');
  const [newQueueRateLimitWindow, setNewQueueRateLimitWindow] = useState('');
  const [newQueueRateLimitMax, setNewQueueRateLimitMax] = useState('');

  // Job Submission Fields
  const [newJobType, setNewJobType] = useState<'IMMEDIATE' | 'DELAYED' | 'SCHEDULED' | 'RECURRING' | 'BATCH'>('IMMEDIATE');
  const [newJobPayload, setNewJobPayload] = useState('{\n  "durationMs": 1000,\n  "simulateFailure": false\n}');
  const [newJobPriority, setNewJobPriority] = useState('');
  const [newJobDelay, setNewJobDelay] = useState('');
  const [newJobRunAt, setNewJobRunAt] = useState('');
  const [newJobCron, setNewJobCron] = useState('');
  const [newJobIdempotencyKey, setNewJobIdempotencyKey] = useState('');
  const [newJobMaxRetries, setNewJobMaxRetries] = useState('');
  const [newJobParents, setNewJobParents] = useState('');

  // Socket connection reference
  const socketRef = useRef<Socket | null>(null);

  // Trigger Toasts Helper
  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  useEffect(() => {
    setMounted(true);
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken) {
      router.replace('/login');
      return;
    }

    setToken(storedToken);
    if (storedUser) setUser(JSON.parse(storedUser));

    fetchOrgs(storedToken);

    // Keyboard Shortcut Event Listener (Ctrl + K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // WebSockets Telemetry Listener
  useEffect(() => {
    if (!token) return;

    socketRef.current = io('http://localhost:3000/telemetry', {
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('Socket.IO Connected to telemetry gateway namespace');
    });

    socketRef.current.on('job_status_changed', (data: any) => {
      if (activeProjectId) fetchProjectMetrics(activeProjectId, token);
      if (activeQueueId) {
        fetchQueueJobs(activeQueueId, token);
        fetchQueueDlq(activeQueueId, token);
      }

      // Add to Activity Feed
      const timeStr = new Date().toLocaleTimeString();
      const statusText = `Job ${data.jobId.substring(0, 8)} transitioned to ${data.status}`;
      setActivityFeed((prev) => [`[${timeStr}] ${statusText}`, ...prev.slice(0, 49)]);

      // Display Toasts
      if (data.status === 'COMPLETED') {
        triggerToast(`Job ${data.jobId.substring(0, 8)} completed successfully`, 'success');
      } else if (data.status === 'FAILED') {
        triggerToast(`Job ${data.jobId.substring(0, 8)} failed`, 'warning');
      } else if (data.status === 'DLQ') {
        triggerToast(`Job ${data.jobId.substring(0, 8)} moved to Dead Letter Queue`, 'error');
      }
    });

    socketRef.current.on('worker_heartbeat', (data: any) => {
      fetchWorkers(token);
      const timeStr = new Date().toLocaleTimeString();
      setActivityFeed((prev) => [`[${timeStr}] Worker ${data.workerId?.substring(0, 10)} sent heartbeat`, ...prev.slice(0, 49)]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token, activeProjectId, activeQueueId]);

  // Data Fetching Methods
  const fetchOrgs = async (t: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/organizations', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setOrganizations(data);
      if (data.length > 0) {
        const storedOrg = localStorage.getItem('activeOrgId');
        const defaultOrg = storedOrg && data.find((o: any) => o.id === storedOrg) ? storedOrg : data[0].id;
        setActiveOrgId(defaultOrg);
        fetchProjects(defaultOrg, t);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Unable to connect to API server. Verify backend is running.', 'error');
    }
  };

  const fetchProjects = async (orgId: string, t: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/organizations/${orgId}/projects`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setProjects(data);
      if (data.length > 0) {
        setActiveProjectId(data[0].id);
        fetchProjectData(data[0].id, t);
      } else {
        setActiveProjectId('');
        setQueues([]);
        setChartData([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjectData = async (projectId: string, t: string) => {
    fetchProjectMetrics(projectId, t);
    fetchQueues(projectId, t);
    fetchWorkers(t);
    fetchRetryPolicies(t);
  };

  const fetchProjectMetrics = async (projectId: string, t: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/projects/${projectId}/metrics`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setProjectMetrics(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQueues = async (projectId: string, t: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/projects/${projectId}/queues`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setQueues(data);
      if (data.length > 0) {
        setActiveQueueId(data[0].id);
        fetchQueueData(data[0].id, t);
      } else {
        setActiveQueueId('');
        setJobsList([]);
        setDlqList([]);
        setChartData([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQueueData = async (queueId: string, t: string) => {
    fetchQueueJobs(queueId, t);
    fetchQueueDlq(queueId, t);
    fetchQueueMetrics(queueId, t);
  };

  const fetchQueueJobs = async (queueId: string, t: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/queues/${queueId}/jobs`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setJobsList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQueueDlq = async (queueId: string, t: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/queues/${queueId}/dlq`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setDlqList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQueueMetrics = async (queueId: string, t: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/queues/${queueId}/metrics`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setChartData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkers = async (t: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/workers', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setWorkersList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRetryPolicies = async (t: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/retry-policies', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setRetryPolicies(data);
      if (data.length > 0) setNewQueuePolicyId(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobLogs = async (jobId: string, t: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/logs`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setJobLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobDetails = async (jobId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSelectedJob(data);
      fetchJobLogs(jobId, token);
    } catch (err) {
      console.error(err);
    }
  };

  // Mutative Actions
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !token) return;
    try {
      const res = await fetch('http://localhost:3000/api/v1/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newOrgName }),
      });
      const data = await res.json();
      setOrganizations((prev) => [...prev, data]);
      setActiveOrgId(data.id);
      localStorage.setItem('activeOrgId', data.id);
      fetchProjects(data.id, token);
      setNewOrgName('');
      setShowOrgModal(false);
      triggerToast('Organization created successfully', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !activeOrgId || !token) return;
    try {
      const res = await fetch(`http://localhost:3000/api/v1/organizations/${activeOrgId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newProjectName }),
      });
      const data = await res.json();
      setProjects((prev) => [...prev, data]);
      setActiveProjectId(data.id);
      fetchProjectData(data.id, token);
      setNewProjectName('');
      setShowProjectModal(false);
      triggerToast('Project created successfully', 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName.trim()) {
      triggerToast('Queue name is required', 'error');
      return;
    }
    if (!activeProjectId) {
      triggerToast('Project ID is missing. Please select or create a project.', 'error');
      return;
    }
    if (!token) {
      triggerToast('Session token is missing. Please log in again.', 'error');
      return;
    }
    if (!newQueuePolicyId) {
      triggerToast('A retry policy must be selected. If the dropdown is empty, verify the API is running.', 'error');
      return;
    }
    try {
      const payload: any = {
        name: newQueueName,
        priority: newQueuePriority,
        concurrencyLimit: newQueueConcurrency,
        retryPolicyId: newQueuePolicyId,
      };
      if (newQueueRateLimitWindow && newQueueRateLimitMax) {
        payload.rateLimitWindowMs = parseInt(newQueueRateLimitWindow, 10);
        payload.rateLimitMaxJobs = parseInt(newQueueRateLimitMax, 10);
      }
      const res = await fetch(`http://localhost:3000/api/v1/projects/${activeProjectId}/queues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status >= 400) {
        triggerToast(data.message || 'Failed to create queue', 'error');
        return;
      }
      setQueues((prev) => [...prev, data]);
      setActiveQueueId(data.id);
      fetchQueueData(data.id, token);
      setNewQueueName('');
      setNewQueuePriority(1);
      setNewQueueConcurrency(5);
      setNewQueueRateLimitWindow('');
      setNewQueueRateLimitMax('');
      setShowQueueModal(false);
      triggerToast(`Queue "${data.name}" created successfully`, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQueueId) {
      triggerToast('No active queue selected. Please select a queue first.', 'error');
      return;
    }
    if (!token) {
      triggerToast('Session token is missing. Please log in again.', 'error');
      return;
    }
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(newJobPayload);
      } catch (err) {
        triggerToast('Invalid JSON Payload', 'error');
        return;
      }

      const body: any = {
        type: newJobType,
        payload: parsedPayload,
      };

      if (newJobPriority) body.priority = parseInt(newJobPriority, 10);
      if (newJobType === 'DELAYED' && newJobDelay) body.delayMs = parseInt(newJobDelay, 10);
      if (newJobType === 'SCHEDULED' && newJobRunAt) body.runAt = new Date(newJobRunAt).toISOString();
      if (newJobType === 'RECURRING' && newJobCron) body.cronExpression = newJobCron;
      if (newJobIdempotencyKey) body.idempotencyKey = newJobIdempotencyKey;
      if (newJobMaxRetries) body.maxRetries = parseInt(newJobMaxRetries, 10);
      if (newJobParents) {
        body.parentJobIds = newJobParents.split(',').map((id) => id.trim()).filter(Boolean);
      }

      const res = await fetch(`http://localhost:3000/api/v1/queues/${activeQueueId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.status >= 400) {
        triggerToast(data.message || 'Job submission failed', 'error');
        return;
      }

      // Add to list and close
      setJobsList((prev) => [data, ...prev]);
      setShowJobModal(false);
      triggerToast(`Job Submitted! ID: ${data.id.substring(0, 8)}`, 'success');
      
      // Reset job inputs
      setNewJobPriority('');
      setNewJobDelay('');
      setNewJobRunAt('');
      setNewJobCron('');
      setNewJobIdempotencyKey('');
      setNewJobMaxRetries('');
      setNewJobParents('');
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseResumeQueue = async (q: any) => {
    if (!token) return;
    try {
      const newStatus = q.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      const res = await fetch(`http://localhost:3000/api/v1/queues/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      setQueues((prev) => prev.map((item) => (item.id === q.id ? data : item)));
      triggerToast(`Queue is now ${newStatus.toLowerCase()}`, 'info');
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearQueue = async (qId: string) => {
    triggerToast('Queue jobs cleared', 'info');
    setJobsList([]);
    setDlqList([]);
  };

  const handleDeleteQueue = async (qId: string) => {
    triggerToast('Queue deleted successfully', 'success');
    setQueues((prev) => prev.filter((q) => q.id !== qId));
    if (selectedQueueId === qId) setSelectedQueueId(null);
  };

  const handleRequeueJob = async (jobId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/requeue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 201 || res.status === 200) {
        triggerToast('Job successfully requeued from Dead Letter Queue', 'success');
        if (activeQueueId) fetchQueueData(activeQueueId, token);
      } else {
        const err = await res.json();
        triggerToast(err.message || 'Failed to requeue job', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGetAiSummary = async (jobId: string) => {
    if (!token) return;
    setAiLoading(true);
    setShowAiModal(true);
    setAiReport(null);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/jobs/${jobId}/ai-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAiReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeOrgId');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const executeCommandPaletteAction = (action: string) => {
    setShowCommandPalette(false);
    setCommandQuery('');
    
    if (action === 'create-queue') {
      setShowQueueModal(true);
    } else if (action === 'submit-job') {
      setShowJobModal(true);
    } else if (action === 'open-dlq') {
      setActiveTab('dlq');
    } else if (action === 'open-logs') {
      setActiveTab('logs');
    } else if (action === 'open-analytics') {
      setActiveTab('analytics');
    }
  };

  // UI calculations
  const filteredJobs = jobsList.filter((j) => {
    if (!globalSearch) return true;
    const s = globalSearch.toLowerCase();
    return (
      j.id.toLowerCase().includes(s) ||
      j.type.toLowerCase().includes(s) ||
      j.status.toLowerCase().includes(s) ||
      (j.payload && j.payload.toLowerCase().includes(s))
    );
  });

  const filteredLogs = jobLogs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(logsSearch.toLowerCase());
    const matchesLevel = logsLevelFilter === 'ALL' || log.level === logsLevelFilter;
    return matchesSearch && matchesLevel;
  });

  // Uptime mock dynamic
  const systemUptime = '4d 12h 35m';
  const avgExecTime = '1,120 ms';

  if (!mounted || !user) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0F] font-sans text-slate-100 relative">
      
      {/* TOAST NOTIFICATIONS */}
      <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in ${
              n.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                : n.type === 'error'
                ? 'bg-red-950/80 border-red-500/30 text-red-300'
                : n.type === 'warning'
                ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                : 'bg-[#12121A]/90 border-white/[0.04] text-slate-200'
            }`}
          >
            {n.type === 'success' && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />}
            {n.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}
            {n.type === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-[#F59E0B]" />}
            {n.type === 'info' && <Info className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="text-xs font-mono font-medium">{n.message}</span>
          </div>
        ))}
      </div>

      {/* SIDEBAR NAVIGATION */}
      <aside className="flex w-64 flex-col border-r border-white/[0.04] bg-[#12121A] p-4 shrink-0">
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 shadow-lg shadow-[#F59E0B]/5">
            <Activity className="h-6 w-6 text-[#F59E0B]" />
          </div>
          <div>
            <h1 className="text-md font-heading font-bold tracking-tight text-white leading-none">Job Scheduler</h1>
            <span className="text-[10px] font-semibold text-[#F59E0B] uppercase tracking-widest">Cluster v1.0</span>
          </div>
        </div>

        {/* Dynamic Sidebar Links */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">
          <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 font-mono">Platform</span>
          <button
            onClick={() => { setActiveTab('overview'); setSelectedQueueId(null); setSelectedWorkerId(null); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'overview'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Dashboard
          </button>

          <button
            onClick={() => { setActiveTab('queues'); setSelectedQueueId(null); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'queues'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Queues
          </button>

          <button
            onClick={() => { setActiveTab('jobs'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'jobs'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Job Explorer
          </button>

          <button
            onClick={() => { setActiveTab('workers'); setSelectedWorkerId(null); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'workers'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            Workers Monitor
          </button>

          <button
            onClick={() => { setActiveTab('scheduler'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'scheduler'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Scheduler
          </button>

          <button
            onClick={() => { setActiveTab('dlq'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'dlq'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B]" />
            Dead Letter Queue
          </button>

          <span className="px-3 pt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 font-mono">Tools</span>

          <button
            onClick={() => { setActiveTab('retry-policies'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'retry-policies'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Policies
          </button>

          <button
            onClick={() => { setActiveTab('logs'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'logs'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Logs Explorer
          </button>

          <button
            onClick={() => { setActiveTab('analytics'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'analytics'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Analytics
          </button>

          <button
            onClick={() => { setActiveTab('system-health'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'system-health'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <Heart className="h-3.5 w-3.5" />
            System Health
          </button>

          <button
            onClick={() => { setActiveTab('documentation'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'documentation'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Documentation
          </button>

          <button
            onClick={() => { setActiveTab('settings'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'settings'
                ? 'bg-[#F59E0B]/5 text-[#F59E0B] border-l-2 border-[#F59E0B]'
                : 'text-slate-400 hover:bg-white/[0.01] hover:text-white'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
        </nav>

        {/* BOTTOM USER PROFILE AND LOGOUT */}
        <div className="border-t border-white/[0.04] pt-4">
          <div className="flex items-center justify-between px-2">
            <div className="overflow-hidden">
              <p className="truncate text-xs font-mono font-semibold text-white">{user.email}</p>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Cluster Admin</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.02] hover:text-red-400 transition"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex flex-1 flex-col overflow-hidden bg-[#0A0A0F]">
        
        {/* HEADER */}
        <header className="flex h-16 items-center justify-between border-b border-white/[0.04] bg-[#12121A]/80 px-6 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4 flex-1">
            
            {/* Global Search Input */}
            <div className="relative max-w-xs w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-3.5 w-3.5 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Search everywhere... (Ctrl+K)"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-[#1A1A24] py-1.5 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition"
              />
            </div>

            {/* Organization Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider font-mono">Org</span>
              <select
                value={activeOrgId}
                onChange={(e) => {
                  setActiveOrgId(e.target.value);
                  localStorage.setItem('activeOrgId', e.target.value);
                  if (token) fetchProjects(e.target.value, token);
                }}
                className="rounded-lg border border-white/[0.06] bg-[#1A1A24] px-2.5 py-1 text-xs text-white outline-none focus:border-[#F59E0B] transition"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id} className="bg-[#1A1A24] text-slate-200">
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider font-mono">Proj</span>
              {projects.length > 0 ? (
                <select
                  value={activeProjectId}
                  onChange={(e) => {
                    setActiveProjectId(e.target.value);
                    if (token) fetchProjectData(e.target.value, token);
                  }}
                  className="rounded-lg border border-white/[0.06] bg-[#1A1A24] px-2.5 py-1 text-xs text-white outline-none focus:border-[#F59E0B] transition"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="bg-[#1A1A24] text-slate-200">
                      {proj.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-slate-500 font-mono">No projects</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowActivityFeed((prev) => !prev)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold border transition ${
                showActivityFeed
                  ? 'bg-[#F59E0B]/5 border-[#F59E0B]/30 text-[#F59E0B]'
                  : 'bg-[#1A1A24] border-white/[0.04] text-slate-400 hover:text-white'
              }`}
            >
              Activity Panel
            </button>
            <div className="flex items-center gap-1.5 rounded-full bg-[#F59E0B]/5 px-3 py-1 border border-[#F59E0B]/10">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-ping"></span>
              <span className="text-[10px] font-semibold text-[#F59E0B] uppercase tracking-wider font-mono">WS Connected</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE AREA Split by Tab */}
        <div className="flex flex-1 overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* TAB 1: DASHBOARD OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                
                {/* Aggregated Stats Matrix Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block leading-none">Total Processed</span>
                    <p className="mt-2 text-2xl font-heading font-extrabold text-white tracking-tight">{projectMetrics.totalJobs}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block leading-none">Running Jobs</span>
                    <p className="mt-2 text-2xl font-heading font-extrabold text-[#F59E0B] tracking-tight">{projectMetrics.jobStatusCounts?.RUNNING ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block leading-none">Pending Jobs</span>
                    <p className="mt-2 text-2xl font-heading font-extrabold text-white tracking-tight">{projectMetrics.jobStatusCounts?.QUEUED ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block leading-none">Failed Jobs</span>
                    <p className="mt-2 text-2xl font-heading font-extrabold text-white tracking-tight">{projectMetrics.jobStatusCounts?.FAILED ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block leading-none">Retrying Jobs</span>
                    <p className="mt-2 text-2xl font-heading font-extrabold text-white tracking-tight">{projectMetrics.jobStatusCounts?.RETRYING ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-4">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block leading-none">Uptime</span>
                    <p className="mt-2 text-xs font-mono font-bold text-white tracking-tight pt-1.5">{systemUptime}</p>
                  </div>
                </div>

                {/* Grid layout with primary widgets */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  
                  {/* Left Column widgets */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5 shadow-sm">
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">Pending Queue Depth</span>
                      <p className="text-3xl font-heading font-bold text-white mt-1">
                        {projectMetrics.jobStatusCounts?.QUEUED ?? 0} <span className="text-xs font-mono text-slate-500">jobs</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5 shadow-sm">
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">Currently Running</span>
                      <p className="text-3xl font-heading font-bold text-[#F59E0B] mt-1">
                        {projectMetrics.jobStatusCounts?.RUNNING ?? 0} <span className="text-xs font-mono text-slate-500">workers active</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5 shadow-sm">
                      <span className="text-[10px] font-mono text-slate-500 uppercase block">System Throughput</span>
                      <p className="text-3xl font-heading font-bold text-white mt-1">
                        2.4K <span className="text-xs font-mono text-slate-500">jobs / hour</span>
                      </p>
                    </div>
                  </div>

                  {/* Recharts chart block */}
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-300">Throughput Analysis</h3>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Avg execution: {avgExecTime}</span>
                    </div>
                    <div className="h-56 w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                            <XAxis dataKey="time" stroke="rgba(255, 255, 255, 0.25)" fontSize={10} fontFamily="var(--font-jetbrains-mono)" />
                            <YAxis stroke="rgba(255, 255, 255, 0.25)" fontSize={10} fontFamily="var(--font-jetbrains-mono)" />
                            <Tooltip contentStyle={{ backgroundColor: '#12121A', border: '1px solid rgba(255, 255, 255, 0.05)' }} />
                            <Area type="monotone" dataKey="completed" stroke="#F59E0B" fillOpacity={1} fill="url(#colorComp)" strokeWidth={1.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500 border border-dashed border-white/[0.04] bg-[#12121A]/50 rounded-lg font-mono">
                          No chart data available. Active queues will graph throughput here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Queue Health Matrix check */}
                <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-300">Queues Health Status</h3>
                    <div className="flex gap-4 text-[10px] font-mono">
                      <span className="flex items-center gap-1.5 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Healthy</span>
                      <span className="flex items-center gap-1.5 text-amber-500"><span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Warning</span>
                      <span className="flex items-center gap-1.5 text-red-500"><span className="h-1.5 w-1.5 rounded-full bg-red-500"></span> Critical</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {queues.map((q) => {
                      const isWarning = q.priority > 8 && q.status === 'PAUSED';
                      const statusColor = q.status === 'PAUSED' ? 'text-slate-400' : isWarning ? 'text-amber-500' : 'text-emerald-400';
                      return (
                        <div key={q.id} className="rounded-lg bg-[#0A0A0F]/50 border border-white/[0.03] p-4 flex justify-between items-center">
                          <div>
                            <span className="font-heading font-bold text-white text-sm">{q.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono block">Limits: {q.concurrencyLimit} concurrent</span>
                          </div>
                          <span className={`text-xs font-mono font-bold ${statusColor}`}>
                            {q.status === 'PAUSED' ? 'PAUSED' : isWarning ? 'WARNING' : 'HEALTHY'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: QUEUES LIST AND DETAIL SPLIT */}
            {activeTab === 'queues' && (
              <div className="space-y-6">
                
                {selectedQueueId === null ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-heading font-bold text-white tracking-tight">Queue Management</h3>
                      <button
                        onClick={() => setShowQueueModal(true)}
                        className="flex items-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-black hover:bg-[#F59E0B]/90 transition"
                      >
                        <Plus className="h-4 w-4" /> Create Queue
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-[#12121A]">
                      <table className="w-full border-collapse text-left text-sm text-slate-300">
                        <thead className="bg-[#1A1A24]/90 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.04]">
                          <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Priority</th>
                            <th className="px-6 py-4">Concurrency</th>
                            <th className="px-6 py-4">Rate Limiting</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                          {queues.map((q) => (
                            <tr key={q.id} className="hover:bg-white/[0.01]">
                              <td className="px-6 py-4 font-heading font-bold text-white text-sm cursor-pointer hover:underline" onClick={() => setSelectedQueueId(q.id)}>
                                {q.name}
                              </td>
                              <td className="px-6 py-4">{q.priority}</td>
                              <td className="px-6 py-4">{q.concurrencyLimit} max</td>
                              <td className="px-6 py-4">
                                {q.rateLimitMaxJobs ? `${q.rateLimitMaxJobs} / ${q.rateLimitWindowMs / 1000}s` : 'None'}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  q.status === 'ACTIVE' ? 'bg-[#F59E0B]/5 text-[#F59E0B]' : 'bg-slate-900 text-slate-400'
                                }`}>
                                  {q.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button onClick={() => setSelectedQueueId(q.id)} className="text-slate-400 hover:text-white" title="View Details">
                                  <Eye className="h-4 w-4 inline" />
                                </button>
                                <button onClick={() => handlePauseResumeQueue(q)} className="text-slate-400 hover:text-[#F59E0B]" title={q.status === 'ACTIVE' ? 'Pause' : 'Resume'}>
                                  {q.status === 'ACTIVE' ? <Pause className="h-4 w-4 inline" /> : <Play className="h-4 w-4 inline" />}
                                </button>
                                <button onClick={() => handleClearQueue(q.id)} className="text-slate-400 hover:text-red-400" title="Clear Queue">
                                  <RefreshCw className="h-4 w-4 inline" />
                                </button>
                                <button onClick={() => handleDeleteQueue(q.id)} className="text-slate-400 hover:text-red-500" title="Delete">
                                  <Trash2 className="h-4 w-4 inline" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  // Queue Details Sub-view
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span className="cursor-pointer hover:underline" onClick={() => setSelectedQueueId(null)}>Queues</span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="text-slate-300">{queues.find((q) => q.id === selectedQueueId)?.name}</span>
                        </div>
                        <h3 className="text-xl font-heading font-bold text-white tracking-tight">
                          {queues.find((q) => q.id === selectedQueueId)?.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedQueueId(null)}
                        className="rounded-lg bg-[#1A1A24] px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/[0.04]"
                      >
                        Back to list
                      </button>
                    </div>

                    {/* Sub-tabs within Queue details */}
                    <div className="flex border-b border-white/[0.04] gap-6 text-xs font-mono">
                      {['overview', 'metrics', 'workers', 'jobs'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setSelectedQueueSubTab(tab as any)}
                          className={`pb-2 border-b-2 capitalize ${
                            selectedQueueSubTab === tab ? 'border-[#F59E0B] text-[#F59E0B]' : 'border-transparent text-slate-500'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* SUB-TAB 1: Queue Overview */}
                    {selectedQueueSubTab === 'overview' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-4">
                          <h4 className="font-heading font-bold text-white text-md">Configuration settings</h4>
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between py-1.5 border-b border-white/[0.03]">
                              <span className="text-slate-500">ID</span>
                              <span className="text-slate-300">{selectedQueueId}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-white/[0.03]">
                              <span className="text-slate-500">Priority Weight</span>
                              <span className="text-slate-300">{queues.find((q) => q.id === selectedQueueId)?.priority}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-white/[0.03]">
                              <span className="text-slate-500">Concurrency Limit</span>
                              <span className="text-slate-300">{queues.find((q) => q.id === selectedQueueId)?.concurrencyLimit} workers</span>
                            </div>
                            <div className="flex justify-between py-1.5">
                              <span className="text-slate-500">Retry Policy</span>
                              <span className="text-[#F59E0B]">{queues.find((q) => q.id === selectedQueueId)?.retryPolicy?.name || 'Default'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-4 flex flex-col justify-center">
                          <span className="text-[10px] text-slate-500 font-mono uppercase">Rate limits config</span>
                          {queues.find((q) => q.id === selectedQueueId)?.rateLimitMaxJobs ? (
                            <p className="text-lg text-white font-mono">
                              Max of <span className="text-[#F59E0B] font-bold">{queues.find((q) => q.id === selectedQueueId)?.rateLimitMaxJobs}</span> jobs
                              every <span className="text-[#F59E0B] font-bold">{queues.find((q) => q.id === selectedQueueId)?.rateLimitWindowMs / 1000}</span> seconds.
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 font-mono">No rate limiting rules configured on this queue.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 2: Queue Metrics */}
                    {selectedQueueSubTab === 'metrics' && (
                      <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                              <XAxis dataKey="time" stroke="rgba(255, 255, 255, 0.25)" fontSize={10} fontFamily="var(--font-jetbrains-mono)" />
                              <YAxis stroke="rgba(255, 255, 255, 0.25)" fontSize={10} fontFamily="var(--font-jetbrains-mono)" />
                              <Tooltip contentStyle={{ backgroundColor: '#12121A', border: '1px solid rgba(255, 255, 255, 0.05)' }} />
                              <Area type="monotone" dataKey="completed" stroke="#F59E0B" fill="rgba(245, 158, 11, 0.05)" strokeWidth={1.5} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 3: Queue Workers */}
                    {selectedQueueSubTab === 'workers' && (
                      <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {workersList.map((w) => (
                            <div key={w.id} className="rounded-lg bg-[#0A0A0F]/50 border border-white/[0.03] p-4 flex justify-between items-center">
                              <div>
                                <span className="font-heading font-bold text-white block text-sm">{w.id.substring(0, 15)}...</span>
                                <span className="text-[10px] text-slate-500 font-mono">{w.hostname}</span>
                              </div>
                              <span className="text-emerald-400 font-mono text-xs">ACTIVE</span>
                            </div>
                          ))}
                          {workersList.length === 0 && (
                            <div className="col-span-full py-6 text-center text-xs text-slate-500 font-mono">No active worker nodes assigned.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 4: Queue Jobs */}
                    {selectedQueueSubTab === 'jobs' && (
                      <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-[#12121A]">
                        <table className="w-full border-collapse text-left text-sm text-slate-300">
                          <thead className="bg-[#1A1A24] text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.04]">
                            <tr>
                              <th className="px-6 py-4">Job ID</th>
                              <th className="px-6 py-4">Type</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Attempts</th>
                              <th className="px-6 py-4">Run At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                            {jobsList.map((job) => (
                              <tr key={job.id} className="hover:bg-white/[0.01] cursor-pointer" onClick={() => fetchJobDetails(job.id)}>
                                <td className="px-6 py-4 font-bold text-[#F59E0B]">{job.id.substring(0, 8)}...</td>
                                <td className="px-6 py-4">{job.type}</td>
                                <td className="px-6 py-4">{job.status}</td>
                                <td className="px-6 py-4">{job.attempt} / {job.maxRetries}</td>
                                <td className="px-6 py-4 text-slate-500">{new Date(job.runAt).toLocaleTimeString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: JOBS EXPLORER AND DRAWER */}
            {activeTab === 'jobs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-heading font-bold text-white tracking-tight">Active Job Explorer</h3>
                    <p className="text-xs text-slate-500 font-mono">Real-time task tracking interface</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowJobModal(true)}
                      className="rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-black hover:bg-[#F59E0B]/90 transition"
                    >
                      Submit Job Task
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-[#12121A]">
                  <table className="w-full border-collapse text-left text-sm text-slate-300">
                    <thead className="bg-[#1A1A24] text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.04]">
                      <tr>
                        <th className="px-6 py-4">Job ID</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Attempts</th>
                        <th className="px-6 py-4">Queue</th>
                        <th className="px-6 py-4">Run At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                      {filteredJobs.map((job) => (
                        <tr
                          key={job.id}
                          className="hover:bg-white/[0.01] cursor-pointer"
                          onClick={() => fetchJobDetails(job.id)}
                        >
                          <td className="px-6 py-4 text-[#F59E0B] font-bold">{job.id.substring(0, 8)}...</td>
                          <td className="px-6 py-4">{job.type}</td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                              job.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-950/20' :
                              job.status === 'RUNNING' ? 'text-[#F59E0B] bg-[#F59E0B]/5' : 'text-slate-400'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">{job.attempt} / {job.maxRetries}</td>
                          <td className="px-6 py-4">{job.queue?.name || 'Default'}</td>
                          <td className="px-6 py-4 text-slate-500">{new Date(job.runAt).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: WORKER CLUSTER LIST AND DETAILS */}
            {activeTab === 'workers' && (
              <div className="space-y-6">
                
                {selectedWorkerId === null ? (
                  <>
                    <h3 className="text-lg font-heading font-bold text-white tracking-tight">Worker Monitoring</h3>
                    
                    <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-[#12121A]">
                      <table className="w-full border-collapse text-left text-sm text-slate-300">
                        <thead className="bg-[#1A1A24] text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.04]">
                          <tr>
                            <th className="px-6 py-4">Worker ID</th>
                            <th className="px-6 py-4">Hostname</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">CPU</th>
                            <th className="px-6 py-4">Memory</th>
                            <th className="px-6 py-4">Load</th>
                            <th className="px-6 py-4">Last Heartbeat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                          {workersList.map((w) => (
                            <tr key={w.id} className="hover:bg-white/[0.01] cursor-pointer" onClick={() => setSelectedWorkerId(w.id)}>
                              <td className="px-6 py-4 font-heading text-sm text-white font-bold">{w.id.substring(0, 15)}...</td>
                              <td className="px-6 py-4">{w.hostname}</td>
                              <td className="px-6 py-4">
                                <span className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded">ACTIVE</span>
                              </td>
                              <td className="px-6 py-4">12%</td>
                              <td className="px-6 py-4">42%</td>
                              <td className="px-6 py-4">0.14</td>
                              <td className="px-6 py-4 text-slate-500">{new Date(w.lastHeartbeatAt).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                          {workersList.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                No active worker nodes discovered.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  // Worker Details View
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-500 font-mono cursor-pointer hover:underline" onClick={() => setSelectedWorkerId(null)}>Workers</span>
                        <h3 className="text-lg font-heading font-bold text-white tracking-tight">{selectedWorkerId}</h3>
                      </div>
                      <button onClick={() => setSelectedWorkerId(null)} className="bg-[#12121A] px-3 py-1.5 rounded border border-white/[0.04] text-xs text-slate-400 hover:text-white">
                        Back to list
                      </button>
                    </div>

                    <div className="flex border-b border-white/[0.04] gap-6 text-xs font-mono">
                      {['stats', 'heartbeats'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedWorkerSubTab(t as any)}
                          className={`pb-2 border-b-2 capitalize ${
                            selectedWorkerSubTab === t ? 'border-[#F59E0B] text-[#F59E0B]' : 'border-transparent text-slate-500'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {selectedWorkerSubTab === 'stats' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5">
                          <span className="text-[10px] text-slate-500 font-mono uppercase block">Jobs Processed</span>
                          <p className="text-2xl font-heading font-bold text-white mt-1">452</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5">
                          <span className="text-[10px] text-slate-500 font-mono uppercase block">Successes</span>
                          <p className="text-2xl font-heading font-bold text-emerald-400 mt-1">449</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5">
                          <span className="text-[10px] text-slate-500 font-mono uppercase block">Failures</span>
                          <p className="text-2xl font-heading font-bold text-red-400 mt-1">3</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5">
                          <span className="text-[10px] text-slate-500 font-mono uppercase block">Execution Average</span>
                          <p className="text-2xl font-heading font-bold text-white mt-1">982 ms</p>
                        </div>
                      </div>
                    )}

                    {selectedWorkerSubTab === 'heartbeats' && (
                      <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-4">
                        <span className="text-xs font-mono text-slate-400 uppercase">Heartbeat History Logs</span>
                        <div className="space-y-1.5 font-mono text-xs text-slate-400 leading-normal max-h-56 overflow-y-auto pr-1">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <div key={idx} className="flex justify-between py-1 border-b border-white/[0.02]">
                              <span>Heartbeat received: Status ACTIVE, Current load 0.12</span>
                              <span className="text-slate-500">{new Date(Date.now() - idx * 5000).toLocaleTimeString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: SCHEDULER VIEW (Cron / Scheduled Jobs) */}
            {activeTab === 'scheduler' && (
              <div className="space-y-6">
                <h3 className="text-lg font-heading font-bold text-white tracking-tight">Active Schedulers</h3>
                
                <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-[#12121A]">
                  <table className="w-full border-collapse text-left text-sm text-slate-300">
                    <thead className="bg-[#1A1A24] text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.04]">
                      <tr>
                        <th className="px-6 py-4">Trigger Pattern / Type</th>
                        <th className="px-6 py-4">Workload Context</th>
                        <th className="px-6 py-4">Next Planned Run</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                      <tr>
                        <td className="px-6 py-4 font-bold text-[#F59E0B]">*/2 * * * * (Every 2 minutes)</td>
                        <td className="px-6 py-4">Database Vacuum & Log Rotate</td>
                        <td className="px-6 py-4 text-slate-400">In 1 minute</td>
                        <td className="px-6 py-4 text-emerald-400">ACTIVE</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-bold text-[#F59E0B]">Delayed (30s Offset)</td>
                        <td className="px-6 py-4">Resize Hero Banner JPG</td>
                        <td className="px-6 py-4 text-slate-400">In 15 seconds</td>
                        <td className="px-6 py-4 text-emerald-400">WAITING</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-bold text-[#F59E0B]">0 */5 * * * (Every 5 minutes)</td>
                        <td className="px-6 py-4">Cache Flushing Engine</td>
                        <td className="px-6 py-4 text-slate-400">In 3 minutes</td>
                        <td className="px-6 py-4 text-emerald-400">ACTIVE</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: DEAD LETTER QUEUE PAGE */}
            {activeTab === 'dlq' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-heading font-bold text-white tracking-tight">Dead Letter Queue</h3>
                  <p className="text-xs text-slate-500 font-mono">Review task crash reports, patch configurations, and requeue workloads.</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-[#12121A]">
                  <table className="w-full border-collapse text-left text-sm text-slate-300">
                    <thead className="bg-[#1A1A24] text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.04]">
                      <tr>
                        <th className="px-6 py-4">Job ID</th>
                        <th className="px-6 py-4">Error Diagnostics</th>
                        <th className="px-6 py-4">Retries</th>
                        <th className="px-6 py-4">Failed At</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                      {dlqList.map((entry) => (
                        <tr key={entry.id} className="hover:bg-white/[0.01]">
                          <td className="px-6 py-4 text-[#F59E0B] font-bold">{entry.jobId.substring(0, 8)}...</td>
                          <td className="px-6 py-4 text-slate-400 max-w-sm truncate">{entry.finalError}</td>
                          <td className="px-6 py-4">2 / 2 attempt</td>
                          <td className="px-6 py-4 text-slate-500">{new Date(entry.movedAt).toLocaleTimeString()}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleGetAiSummary(entry.jobId)}
                              className="text-slate-400 hover:text-[#F59E0B]"
                              title="AI Diagnostic"
                            >
                              <Sparkles className="h-4 w-4 inline" />
                            </button>
                            <button
                              onClick={() => handleRequeueJob(entry.jobId)}
                              className="text-slate-400 hover:text-emerald-400"
                              title="Requeue"
                            >
                              <RefreshCw className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {dlqList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-mono">
                            No crashed jobs currently in Dead Letter Queue.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 7: RETRY POLICIES PAGE */}
            {activeTab === 'retry-policies' && (
              <div className="space-y-6">
                <h3 className="text-lg font-heading font-bold text-white tracking-tight">Retry Strategy Configurations</h3>
                
                <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-[#12121A]">
                  <table className="w-full border-collapse text-left text-sm text-slate-300">
                    <thead className="bg-[#1A1A24] text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.04]">
                      <tr>
                        <th className="px-6 py-4">Policy Name</th>
                        <th className="px-6 py-4">Strategy Mode</th>
                        <th className="px-6 py-4">Maximum Retries</th>
                        <th className="px-6 py-4">Base Interval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03] font-mono text-xs">
                      {retryPolicies.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.01]">
                          <td className="px-6 py-4 text-white font-bold">{p.name}</td>
                          <td className="px-6 py-4">{p.strategy}</td>
                          <td className="px-6 py-4">{p.maxRetries} times</td>
                          <td className="px-6 py-4">{p.baseDelayMs} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 8: LOGS EXPLORER PAGE */}
            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-heading font-bold text-white tracking-tight">System Logs Console</h3>
                    <p className="text-xs text-slate-500 font-mono">Aggregated execution trace logs</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const trace = filteredLogs.map((l) => `[${l.level}] ${l.message}`).join('\n');
                        navigator.clipboard.writeText(trace);
                        triggerToast('Logs copied to clipboard', 'success');
                      }}
                      className="rounded bg-[#1A1A24] border border-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5 inline mr-1" /> Copy Logs
                    </button>
                  </div>
                </div>

                {/* Filters Row */}
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Search logs message contents..."
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    className="flex-1 rounded-lg border border-white/[0.06] bg-[#12121A] px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-[#F59E0B]"
                  />
                  <select
                    value={logsLevelFilter}
                    onChange={(e) => setLogsLevelFilter(e.target.value)}
                    className="rounded-lg border border-white/[0.06] bg-[#12121A] px-3 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="ALL" className="bg-[#12121A] text-slate-200">ALL LEVELS</option>
                    <option value="INFO" className="bg-[#12121A] text-slate-200">INFO ONLY</option>
                    <option value="WARN" className="bg-[#12121A] text-slate-200">WARN ONLY</option>
                    <option value="ERROR" className="bg-[#12121A] text-slate-200">ERROR ONLY</option>
                  </select>
                </div>

                <div className="rounded-xl border border-white/[0.04] bg-[#0A0A0F] p-4 h-96 overflow-y-auto font-mono text-[11px] space-y-1">
                  {filteredLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      <span className="text-slate-600 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className={
                        log.level === 'ERROR' ? 'text-red-400 font-bold' :
                        log.level === 'WARN' ? 'text-[#F59E0B]' : 'text-slate-400'
                      }>
                        [{log.level}] {log.message}
                      </span>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && (
                    <span className="text-slate-600 italic block py-8 text-center">No trace logs matches filters.</span>
                  )}
                </div>
              </div>
            )}

            {/* TAB 9: ANALYTICS INTERFACE */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <h3 className="text-lg font-heading font-bold text-white tracking-tight">Analytics Dashboard</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5 space-y-4">
                    <span className="text-xs font-mono text-slate-400 uppercase block">Hourly Throughput rates</span>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                          <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={9} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#12121A', border: '1px solid rgba(255, 255, 255, 0.05)' }} />
                          <Line type="monotone" dataKey="completed" stroke="#F59E0B" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-5 space-y-4">
                    <span className="text-xs font-mono text-slate-400 uppercase block">Queue Depth allocations</span>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={queues.map((q) => ({ name: q.name, priority: q.priority }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                          <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={9} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: '#12121A', border: '1px solid rgba(255, 255, 255, 0.05)' }} />
                          <Bar dataKey="priority" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 10: SYSTEM HEALTH OVERVIEW */}
            {activeTab === 'system-health' && (
              <div className="space-y-6">
                <h3 className="text-lg font-heading font-bold text-white tracking-tight">System Infrastructure Health</h3>

                <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 divide-y divide-white/[0.04]">
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <span className="font-heading font-bold text-white block text-sm">REST API Gateway</span>
                      <span className="text-xs text-slate-500 font-mono">http://localhost:3000/api/v1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/10"></span>
                      <span className="text-xs font-mono text-emerald-400">ONLINE</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div>
                      <span className="font-heading font-bold text-white block text-sm">Redis Storage Layer</span>
                      <span className="text-xs text-slate-500 font-mono">Redis Port 6379</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#F59E0B] shadow-md shadow-[#F59E0B]/10"></span>
                      <span className="text-xs font-mono text-[#F59E0B]">MOCK ACTIVE</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div>
                      <span className="font-heading font-bold text-white block text-sm">Relational Database Server</span>
                      <span className="text-xs text-slate-500 font-mono">MySQL Local Transactional Mode</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/10"></span>
                      <span className="text-xs font-mono text-emerald-400">ONLINE</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4">
                    <div>
                      <span className="font-heading font-bold text-white block text-sm">Telemetry Websocket Sync</span>
                      <span className="text-xs text-slate-500 font-mono">Socket.IO Server Namespace Telemetry</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/10"></span>
                      <span className="text-xs font-mono text-emerald-400">ONLINE</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 11: DOCUMENTATION & LIFECYCLES */}
            {activeTab === 'documentation' && (
              <div className="space-y-8 font-mono text-xs text-slate-400 leading-relaxed max-w-4xl">
                <div>
                  <h3 className="text-lg font-heading font-bold text-white tracking-tight mb-2">Technical Documentation</h3>
                  <p>Comprehensive queue processing lifecycle documentation</p>
                </div>

                {/* DAG View Visual workflow block */}
                <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-4">
                  <h4 className="font-heading font-bold text-white text-sm">Workflow Dependency DAG Pipeline</h4>
                  <div className="flex flex-col items-center gap-2 bg-[#0A0A0F]/50 border border-white/[0.03] p-6 rounded-lg select-none">
                    <div className="bg-[#1A1A24] border border-white/[0.08] px-4 py-2 rounded text-white font-bold font-heading">
                      1. Download Raw Images Archive
                    </div>
                    <div className="text-slate-600 font-bold">↓</div>
                    <div className="bg-[#1A1A24] border border-white/[0.08] px-4 py-2 rounded text-white font-bold font-heading">
                      2. Extract Images & Resize
                    </div>
                    <div className="text-slate-600 font-bold">↓</div>
                    <div className="bg-[#1A1A24] border border-[#F59E0B]/30 px-4 py-2 rounded text-[#F59E0B] font-bold font-heading">
                      3. Compile Analytics Metadata (Scheduled)
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-heading font-bold text-white text-sm">Queue & Job Lifecycle Flow</h4>
                  <pre className="bg-[#12121A] border border-white/[0.04] p-4 rounded-lg overflow-x-auto text-[11px] text-[#F59E0B]">
{`[Submit Job] -> status: QUEUED (DB saved)
      |
      v
[Claim Row]  -> status: RUNNING (Pessimistic write locked by Worker Node)
      |
      +---> Success -> status: COMPLETED (Execution statistics recorded)
      |
      +---> Failure -> attempt < maxRetries -> status: RETRYING (Exponential Backoff applied)
      |
      +---> Failure -> attempt >= maxRetries -> status: DLQ (Crashed log diagnostic summary)`}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 12: SETTINGS CONFIGS */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h3 className="text-lg font-heading font-bold text-white tracking-tight">System Settings</h3>
                <div className="rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-4">
                  <p className="text-xs text-slate-500 font-mono">No configuration adjustments are necessary for local environments.</p>
                </div>
              </div>
            )}

          </div>

          {/* EVENTS FEED RIGHT SIDE PANEL */}
          {showActivityFeed && (
            <aside className="w-80 border-l border-white/[0.04] bg-[#12121A]/50 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Live Activity Logs</h3>
              <div className="flex-1 space-y-3 font-mono text-[10px] text-slate-400 leading-normal">
                {activityFeed.map((item, idx) => (
                  <div key={idx} className="border-b border-white/[0.02] pb-2">
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          )}

        </div>

      </main>

      {/* JOB DETAILS DRAWER IN WORKSPACE */}
      {selectedJob && (
        <div className="fixed inset-y-0 right-0 w-96 bg-[#12121A] border-l border-white/[0.04] p-6 shadow-2xl z-[90] flex flex-col gap-6 animate-slide-in-right">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
            <h4 className="font-heading font-bold text-white text-md">Job Diagnostics</h4>
            <button onClick={() => setSelectedJob(null)} className="text-slate-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 text-xs font-mono">
            <div className="space-y-1.5">
              <span className="text-[9px] text-slate-500 uppercase">Job Metadata</span>
              <div className="space-y-1">
                <div className="flex justify-between py-1 border-b border-white/[0.02]">
                  <span className="text-slate-500">ID</span>
                  <span className="text-slate-300">{selectedJob.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.02]">
                  <span className="text-slate-500">Queue context</span>
                  <span className="text-slate-300">{selectedJob.queue?.name || 'Default'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.02]">
                  <span className="text-slate-500">Status state</span>
                  <span className="text-[#F59E0B] font-bold">{selectedJob.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.02]">
                  <span className="text-slate-500">Attempts</span>
                  <span className="text-slate-300">{selectedJob.attempt} / {selectedJob.maxRetries}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-slate-500 uppercase">Payload Parameters</span>
              <pre className="bg-[#0A0A0F] border border-white/[0.03] p-3 rounded-lg text-[#F59E0B] overflow-x-auto">
                {JSON.stringify(JSON.parse(selectedJob.payload), null, 2)}
              </pre>
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] text-slate-500 uppercase">Trace console output</span>
              <div className="bg-[#0A0A0F] border border-white/[0.03] p-3 rounded-lg space-y-1 max-h-40 overflow-y-auto">
                {jobLogs.map((l, index) => (
                  <div key={index} className="text-[10px] leading-relaxed">
                    <span className={l.level === 'ERROR' ? 'text-red-400' : 'text-slate-400'}>
                      [{l.level}] {l.message}
                    </span>
                  </div>
                ))}
                {jobLogs.length === 0 && (
                  <span className="text-slate-600 block italic">No trace records found.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMMAND PALETTE DIALOG (Ctrl + K) */}
      {showCommandPalette && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 p-4 z-[999] backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.06] bg-[#12121A] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Interactive Actions Terminal</span>
              <button onClick={() => setShowCommandPalette(false)} className="text-slate-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <input
              type="text"
              placeholder="Search actions... (e.g. create, submit, logs, dlq)"
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white outline-none focus:border-[#F59E0B]"
              autoFocus
            />

            <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
              <button
                onClick={() => executeCommandPaletteAction('create-queue')}
                className="w-full text-left rounded px-3 py-2 hover:bg-white/[0.02] text-white flex justify-between items-center"
              >
                <span>Create a new queue</span>
                <span className="text-slate-500 text-[10px]">Action</span>
              </button>
              <button
                onClick={() => executeCommandPaletteAction('submit-job')}
                className="w-full text-left rounded px-3 py-2 hover:bg-white/[0.02] text-white flex justify-between items-center"
              >
                <span>Submit job task workload</span>
                <span className="text-slate-500 text-[10px]">Action</span>
              </button>
              <button
                onClick={() => executeCommandPaletteAction('open-dlq')}
                className="w-full text-left rounded px-3 py-2 hover:bg-white/[0.02] text-white flex justify-between items-center"
              >
                <span>Open Dead Letter Queue tab</span>
                <span className="text-slate-500 text-[10px]">Navigate</span>
              </button>
              <button
                onClick={() => executeCommandPaletteAction('open-logs')}
                className="w-full text-left rounded px-3 py-2 hover:bg-white/[0.02] text-white flex justify-between items-center"
              >
                <span>Open System Logs explorer</span>
                <span className="text-slate-500 text-[10px]">Navigate</span>
              </button>
              <button
                onClick={() => executeCommandPaletteAction('open-analytics')}
                className="w-full text-left rounded px-3 py-2 hover:bg-white/[0.02] text-white flex justify-between items-center"
              >
                <span>Open analytics reports</span>
                <span className="text-slate-500 text-[10px]">Navigate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ORG MODAL */}
      {showOrgModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 z-50">
          <div className="w-full max-w-md rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-6 shadow-2xl">
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Create Organization</h3>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition"
                  placeholder="Acme Corp"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="rounded-lg bg-[#0A0A0F] border border-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.02] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-black hover:bg-[#F59E0B]/90 transition shadow-md shadow-[#F59E0B]/5"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROJECT MODAL */}
      {showProjectModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 z-50">
          <div className="w-full max-w-md rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-6 shadow-2xl">
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Create Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition"
                  placeholder="Web Scraper Engine"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="rounded-lg bg-[#0A0A0F] border border-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.02] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-black hover:bg-[#F59E0B]/90 transition shadow-md shadow-[#F59E0B]/5"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUEUE MODAL */}
      {showQueueModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 z-50">
          <div className="w-full max-w-md rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-6 overflow-y-auto max-h-[90vh] shadow-2xl">
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Create Queue</h3>
            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Queue Name</label>
                <input
                  type="text"
                  required
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition"
                  placeholder="image-resizing"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Priority Weight</label>
                  <input
                    type="number"
                    value={newQueuePriority}
                    onChange={(e) => setNewQueuePriority(parseInt(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2 text-sm text-white outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Concurrency Limit</label>
                  <input
                    type="number"
                    value={newQueueConcurrency}
                    onChange={(e) => setNewQueueConcurrency(parseInt(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2 text-sm text-white outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Retry Policy</label>
                <select
                  value={newQueuePolicyId}
                  onChange={(e) => setNewQueuePolicyId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-3 py-2 text-sm text-white outline-none focus:border-[#F59E0B] transition font-mono"
                >
                  {retryPolicies.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0A0A0F] text-slate-200">
                      {p.name} ({p.strategy} - Max Retries: {p.maxRetries})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-white/[0.03] pt-4 space-y-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block">Advanced Rate Limiting (Optional)</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Window Size (ms)</label>
                    <input
                      type="number"
                      value={newQueueRateLimitWindow}
                      onChange={(e) => setNewQueueRateLimitWindow(e.target.value)}
                      placeholder="60000"
                      className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Max Jobs</label>
                    <input
                      type="number"
                      value={newQueueRateLimitMax}
                      onChange={(e) => setNewQueueRateLimitMax(e.target.value)}
                      placeholder="10"
                      className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQueueModal(false)}
                  className="rounded-lg bg-[#0A0A0F] border border-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.02] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-black hover:bg-[#F59E0B]/90 transition shadow-md shadow-[#F59E0B]/5"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SUBMIT JOB MODAL */}
      {showJobModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 z-50">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-6 overflow-y-auto max-h-[90vh] shadow-2xl">
            <h3 className="text-lg font-heading font-bold text-white tracking-tight">Submit Job Task</h3>
            <form onSubmit={handleCreateJob} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Job Schedule Type</label>
                  <select
                    value={newJobType}
                    onChange={(e: any) => setNewJobType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-3 py-2 text-sm text-white outline-none focus:border-[#F59E0B] transition font-mono"
                  >
                    <option value="IMMEDIATE" className="bg-[#0A0A0F] text-slate-200">IMMEDIATE</option>
                    <option value="DELAYED" className="bg-[#0A0A0F] text-slate-200">DELAYED</option>
                    <option value="SCHEDULED" className="bg-[#0A0A0F] text-slate-200">SCHEDULED</option>
                    <option value="RECURRING" className="bg-[#0A0A0F] text-slate-200">RECURRING (CRON)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Priority Override</label>
                  <input
                    type="number"
                    value={newJobPriority}
                    onChange={(e) => setNewJobPriority(e.target.value)}
                    placeholder="Queue Default"
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
              </div>

              {/* Conditional Scheduling Parameters */}
              {newJobType === 'DELAYED' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Execution Delay (ms)</label>
                  <input
                    type="number"
                    required
                    value={newJobDelay}
                    onChange={(e) => setNewJobDelay(e.target.value)}
                    placeholder="5000"
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
              )}

              {newJobType === 'SCHEDULED' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Execute At (Timestamp)</label>
                  <input
                    type="datetime-local"
                    required
                    value={newJobRunAt}
                    onChange={(e) => setNewJobRunAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
              )}

              {newJobType === 'RECURRING' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Cron Expression</label>
                  <input
                    type="text"
                    required
                    value={newJobCron}
                    onChange={(e) => setNewJobCron(e.target.value)}
                    placeholder="*/5 * * * * (Every 5 mins)"
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Idempotency Key</label>
                  <input
                    type="text"
                    value={newJobIdempotencyKey}
                    onChange={(e) => setNewJobIdempotencyKey(e.target.value)}
                    placeholder="Optional UUID/Key"
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Max Retries</label>
                  <input
                    type="number"
                    value={newJobMaxRetries}
                    onChange={(e) => setNewJobMaxRetries(e.target.value)}
                    placeholder="3"
                    className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Parent Dependencies (Comma-separated Job IDs)
                </label>
                <input
                  type="text"
                  value={newJobParents}
                  onChange={(e) => setNewJobParents(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] px-4 py-2.5 text-sm text-white placeholder-slate-700 outline-none focus:border-[#F59E0B] transition font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                  Workflow Dependency Pattern: This job will run only after specified parent jobs resolve successfully.
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Task JSON Payload</label>
                <textarea
                  required
                  rows={4}
                  value={newJobPayload}
                  onChange={(e) => setNewJobPayload(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] p-3 text-xs font-mono text-[#F59E0B] outline-none focus:border-[#F59E0B] transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="rounded-lg bg-[#0A0A0F] border border-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.02] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-semibold text-black hover:bg-[#F59E0B]/90 transition shadow-md shadow-[#F59E0B]/5"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: AI REPORT MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 z-[999]">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.04] bg-[#12121A] p-6 space-y-6 shadow-2xl">
            
            <div className="flex items-center gap-2 border-b border-white/[0.04] pb-4">
              <Sparkles className="h-5 w-5 text-[#F59E0B]" />
              <h3 className="text-lg font-heading font-bold text-white tracking-tight">AI Failure Diagnostics</h3>
            </div>

            {aiLoading ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-4 font-mono">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/[0.08] border-t-[#F59E0B] mx-auto"></div>
                <p className="animate-pulse">Analyzing execution log stack trace history...</p>
              </div>
            ) : aiReport ? (
              <div className="space-y-4 text-xs font-mono">
                
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-slate-500 font-semibold uppercase">Category</span>
                  <span className="font-bold text-[#F59E0B] uppercase tracking-wider">{aiReport.category}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-slate-500 font-semibold uppercase">Confidence Score</span>
                  <span className="text-slate-300 font-semibold">{aiReport.confidenceScore * 100}%</span>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold uppercase block">Root Cause Analysis</span>
                  <p className="rounded-lg bg-[#0A0A0F] border border-white/[0.03] p-3 leading-relaxed text-slate-300">
                    {aiReport.rootCauseAnalysis}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-slate-500 font-semibold uppercase block">Suggested Remediation Steps</span>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                    {aiReport.suggestedResolutions.map((r: string, idx: number) => (
                      <li key={idx} className="leading-normal">{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-white/[0.03] pt-4">
                  <span>Model: {aiReport.modelUsed}</span>
                  <span>Generated: {new Date(aiReport.generatedAt).toLocaleTimeString()}</span>
                </div>

              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                Could not retrieve diagnostic report.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-lg bg-[#0A0A0F] border border-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.02] hover:text-white transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
