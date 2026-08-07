import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { ShieldCheck, ShieldAlert, Activity, PhoneCall, Clock, CheckCircle2, AlertTriangle, Send, RefreshCw, Radio } from 'lucide-react';

// Connect to backend Socket.io
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function App() {
  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    resolvedCount: 0,
    escalatedCount: 0,
    blockedCount: 0,
    queuedCount: 0,
    approvedCount: 0,
    resolutionRate: 100,
    escalationRate: 0
  });

  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to GuardAI backend telemetry stream');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('metrics_update', (newMetrics) => {
      setMetrics(newMetrics);
    });

    socket.on('initial_events', (initEvents) => {
      setEvents(initEvents);
    });

    socket.on('pipeline_event', (newEvent) => {
      setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Simulator helper to test live flows right from UI
  const triggerSimulation = async (type) => {
    setSimLoading(true);
    let payload = {};

    if (type === 'resolved') {
      payload = { userId: "demo_resolved_user", transcript: "Thanks, the password reset worked!", metadata: { retryCount: 0, sentimentScore: 0.9, botConfidence: 0.98 } };
    } else if (type === 'escalate') {
      payload = { userId: "demo_urgent_user", transcript: "My payment failed twice and money was debited!", metadata: { retryCount: 3, sentimentScore: -0.85, isUrgentTopic: true } };
    } else if (type === 'dnd') {
      // First toggle DND on, then send escalation
      await fetch(`${SOCKET_URL}/api/webhooks/dnd/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: "demo_dnd_user", isDND: true })
      });
      payload = { userId: "demo_dnd_user", transcript: "I need help with my account immediately.", metadata: { retryCount: 3, sentimentScore: -0.8 } };
    }

    try {
      await fetch(`${SOCKET_URL}/api/webhooks/kipps-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Simulation failed:", err);
    }
    setSimLoading(false);
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-md shadow-xl gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                GuardAI <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">Support Track</span>
              </h1>
              <p className="text-sm text-slate-400">Enterprise Compliance & Decision Guardrail for Kipps AI Agents</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {isConnected ? 'Telemetry Live' : 'Disconnected'}
            </span>
          </div>
          <div className="text-xs text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Socket.io Connected</span>
          </div>
        </div>
      </header>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-sm font-medium">
            <span>Total Inbound Chats</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-3">{metrics.totalEvents}</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {metrics.resolvedCount} Resolved directly by Bot
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-sm font-medium">
            <span>Voice Escalations</span>
            <PhoneCall className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400 mt-3">{metrics.escalatedCount}</div>
          <div className="text-xs text-slate-400 mt-1">
            Escalation Rate: <strong className="text-white">{metrics.escalationRate}%</strong>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-sm font-medium">
            <span>Compliance Blocked (DND/Cap)</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-bold text-rose-400 mt-3">{metrics.blockedCount}</div>
          <div className="text-xs text-slate-400 mt-1">Protected against regulatory fines</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-sm font-medium">
            <span>Queued for Window (Quiet Hours)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-400 mt-3">{metrics.queuedCount}</div>
          <div className="text-xs text-slate-400 mt-1">Scheduled for compliant 9AM delivery</div>
        </div>
      </div>

      {/* DEMO ACTION CONTROLS */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" /> Live Demo Simulation Deck
          </h2>
          <span className="text-xs text-slate-400">Click any scenario to instantly push webhooks to the backend pipeline</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            disabled={simLoading}
            onClick={() => triggerSimulation('resolved')}
            className="flex-1 min-w-[200px] bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 px-4 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Simulate Resolved Chat
          </button>
          <button 
            disabled={simLoading}
            onClick={() => triggerSimulation('escalate')}
            className="flex-1 min-w-[200px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-4 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 text-white shadow-lg shadow-emerald-900/30">
            <PhoneCall className="w-4 h-4" /> Simulate Urgent Escalation
          </button>
          <button 
            disabled={simLoading}
            onClick={() => triggerSimulation('dnd')}
            className="flex-1 min-w-[200px] bg-rose-950/50 hover:bg-rose-900/50 active:bg-rose-900 border border-rose-800/60 px-4 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 text-rose-300">
            <ShieldAlert className="w-4 h-4" /> Simulate DND Blocked Call
          </button>
        </div>
      </div>

      {/* LIVE EVENT STREAM AUDIT LOG */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h2 className="text-md font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" /> Live Pipeline Event Audit Trail
          </h2>
          <span className="text-xs font-mono text-slate-400">{events.length} events captured</span>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/50 sticky top-0 backdrop-blur">
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User ID</th>
                <th className="p-3.5">Pipeline Stage</th>
                <th className="p-3.5">Status / Decision</th>
                <th className="p-3.5">Metadata / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500 italic">
                    Waiting for inbound webhook events... Trigger a simulation above or fire a POST request!
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 text-xs font-mono text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3.5 font-mono text-xs text-indigo-300 font-medium">
                      {evt.userId}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                        {evt.stage}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                        evt.status === 'RESOLVED' || evt.status === 'APPROVED' || evt.status === 'CALL_TRIGGERED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : evt.status.includes('BLOCKED') || evt.status === 'HALTED'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : evt.status === 'QUEUED_FOR_WINDOW'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                      }`}>
                        {evt.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-slate-300 font-mono">
                      {JSON.stringify(evt.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}