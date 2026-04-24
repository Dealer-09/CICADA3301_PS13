'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, SignOutButton } from '@clerk/nextjs';
import { motion } from 'framer-motion';

export default function WorkspaceSelectionPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoaded && user) {
      fetchWorkspaces();
    }
  }, [isLoaded, user]);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspace');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    
    setError('');
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName }),
      });
      
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard?workspaceId=${data.workspace.workspaceId}`);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to create workspace');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setError('');
    try {
      const res = await fetch('/api/workspace/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard?workspaceId=${data.workspace.workspaceId}`);
      } else {
        const err = await res.json();
        setError(err.error || 'Invalid invite code');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 md:p-16">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#050505] text-lg font-bold leading-none">S</span>
            </div>
            <span className="text-xl font-bold tracking-tight uppercase">Synapse</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60">{user?.primaryEmailAddress?.emailAddress}</span>
            <SignOutButton>
              <button className="text-sm font-semibold px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </header>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Welcome to Synapse</h1>
          <p className="text-white/60">Select a workspace to continue, or create a new one.</p>
        </motion.div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Workspaces List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 border-b border-white/10 pb-2">Your Workspaces</h2>
            {workspaces.length === 0 ? (
              <p className="text-sm text-white/40 italic">You don't belong to any workspaces yet.</p>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.workspaceId}
                  onClick={() => router.push(`/dashboard?workspaceId=${ws.workspaceId}`)}
                  className="w-full text-left p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-semibold text-lg">{ws.name}</h3>
                    <p className="text-xs text-white/40 mt-1">{ws.members.length} member{ws.members.length !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-400">Enter →</span>
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-[#111] border border-white/[0.05]">
              <h2 className="text-lg font-semibold mb-4">Create New Workspace</h2>
              <form onSubmit={handleCreateWorkspace} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Workspace Name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
                <button 
                  type="submit"
                  disabled={!newWorkspaceName.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Create
                </button>
              </form>
            </div>

            <div className="p-6 rounded-2xl bg-[#111] border border-white/[0.05]">
              <h2 className="text-lg font-semibold mb-4">Join via Code</h2>
              <form onSubmit={handleJoinWorkspace} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. A7B29X"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500 font-mono"
                />
                <button 
                  type="submit"
                  disabled={!joinCode.trim() || joinCode.length !== 6}
                  className="bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
