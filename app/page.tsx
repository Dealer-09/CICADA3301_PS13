'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30 selection:text-white overflow-hidden">
      {/* Subtle background noise/gradient */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
      <div className="fixed inset-0 bg-gradient-to-tr from-purple-900/10 via-transparent to-indigo-900/10 pointer-events-none z-0"></div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 md:px-16 lg:px-24">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-[#050505] text-lg font-bold leading-none">G</span>
          </div>
          <span className="text-xl font-bold tracking-tight uppercase letter-spacing-widest">Graphy</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="flex items-center gap-8"
        >
          <Link href="/dashboard" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
            Get Started
          </Link>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-8 md:px-16 lg:px-24">
        <div className="max-w-4xl w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] mb-8">
              Knowledge <br />
              <span className="text-white/40 italic font-serif serif">Evolved.</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            A state-of-the-art AI extraction engine that transforms unstructured natural language into persistent, navigable knowledge graphs in real-time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link 
              href="/dashboard"
              className="group relative px-8 py-4 bg-white text-[#050505] font-bold rounded-full overflow-hidden transition-all duration-500 hover:pr-12"
            >
              <span className="relative z-10">Enter Dashboard</span>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </motion.div>
        </div>

        {/* Feature Grid - Minimalist */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-48 w-full max-w-6xl"
        >
          {[
            {
              title: "Real-time Extraction",
              desc: "Powered by Llama-3, Graphy extracts complex entities and relationships as you type."
            },
            {
              title: "Neo4j Persistence",
              desc: "Industrial-grade graph storage ensuring your data is structured, searchable, and scaleable."
            },
            {
              title: "Collaborative Intelligence",
              desc: "Sync your research with teams in real-time via high-performance WebSocket channels."
            }
          ].map((feature, i) => (
            <div key={i} className="group p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500">
              <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed group-hover:text-white/60 transition-colors">
                {feature.desc}
              </p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-16 px-8 md:px-16 lg:px-24 border-t border-white/5 mt-24">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-xs text-white/30 uppercase tracking-[0.2em]">© 2025 Graphy — CICADA3301 Project</p>
          <div className="flex gap-8">
            <a href="#" className="text-xs text-white/30 hover:text-white transition-colors uppercase tracking-[0.1em]">Twitter</a>
            <a href="#" className="text-xs text-white/30 hover:text-white transition-colors uppercase tracking-[0.1em]">Github</a>
            <a href="#" className="text-xs text-white/30 hover:text-white transition-colors uppercase tracking-[0.1em]">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
