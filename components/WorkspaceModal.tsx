'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Workspace {
  workspaceId: string;
  name: string;
  inviteCode: string;
  members: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentWorkspaceId?: string | null;
}

export default function WorkspaceModal({ open, onClose, currentWorkspaceId }: Props) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('/api/workspace')
        .then(r => r.json())
        .then(d => setWorkspaces(d.workspaces || []))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    const res = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      const d = await res.json();
      onClose();
      router.push(`/dashboard?workspaceId=${d.workspace.workspaceId}`);
    } else {
      const d = await res.json();
      setError(d.error || 'Failed to create workspace');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length !== 6) return;
    setError('');
    const res = await fetch('/api/workspace/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: joinCode }),
    });
    if (res.ok) {
      const d = await res.json();
      onClose();
      router.push(`/dashboard?workspaceId=${d.workspace.workspaceId}`);
    } else {
      const d = await res.json();
      setError(d.error || 'Invalid invite code');
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-16 right-4 z-50 w-[420px] bg-[#0f1623] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">Workspaces</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Workspace list */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Workspaces</p>
                {loading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : workspaces.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No workspaces yet — create one below.</p>
                ) : (
                  <div className="space-y-2">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.workspaceId}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer group ${
                          ws.workspaceId === currentWorkspaceId
                            ? 'bg-purple-600/20 border-purple-500/40'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
                        }`}
                        onClick={() => { onClose(); router.push(`/dashboard?workspaceId=${ws.workspaceId}`); }}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{ws.name}</p>
                          <p className="text-xs text-gray-500">{ws.members.length} member{ws.members.length !== 1 ? 's' : ''}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyCode(ws.inviteCode, ws.workspaceId); }}
                          title="Copy invite code"
                          className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-purple-600/30 text-gray-400 hover:text-purple-300 border border-white/10 transition-all"
                        >
                          {copiedId === ws.workspaceId ? '✓ Copied' : `#${ws.inviteCode}`}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Create */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Create New</p>
                <form onSubmit={handleCreate} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Workspace name"
                    value={newName}
                    onChange={e => { setNewName(e.target.value); setError(''); }}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newName.trim()}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  >
                    Create
                  </button>
                </form>
              </div>

              {/* Join */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Join via Code</p>
                <form onSubmit={handleJoin} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="6-character code"
                    value={joinCode}
                    onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
                    maxLength={6}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={joinCode.length !== 6}
                    className="bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  >
                    Join
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
