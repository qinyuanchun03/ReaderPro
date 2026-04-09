/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Library from './components/Library';
import Reader from './components/Reader';
import { Book } from './lib/db';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navigation Bar (Sticky Glass) */}
      <nav className="fixed top-0 inset-x-0 h-12 glass z-30 flex items-center justify-center px-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
            <div className="w-3 h-3 bg-black rounded-sm" />
          </div>
          <span className="text-white text-sm font-semibold tracking-tight">Reader Pro</span>
        </div>
      </nav>

      <main>
        <Library onSelectBook={setSelectedBook} />
      </main>

      {/* Reader Overlay */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50"
          >
            <Reader 
              book={selectedBook} 
              onClose={() => setSelectedBook(null)} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-apple-gray py-12 px-6 border-t border-near-black/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-40">
            <div className="w-5 h-5 bg-near-black rounded-md flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-sm" />
            </div>
            <span className="text-near-black text-xs font-semibold tracking-tight uppercase">Reader Pro</span>
          </div>
          <p className="text-near-black/40 text-sm">
            为文字的纯粹而设计。
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-near-black/40 hover:text-near-black transition-colors text-sm">隐私</a>
            <a href="#" className="text-near-black/40 hover:text-near-black transition-colors text-sm">条款</a>
            <a href="#" className="text-near-black/40 hover:text-near-black transition-colors text-sm">支持</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
