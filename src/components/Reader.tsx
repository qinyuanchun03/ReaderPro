import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub, { Rendition, Book as EpubBook } from 'epubjs';
import { ChevronLeft, Menu, Settings, X, ChevronRight, Loader2, Copy, Highlighter, Database, List } from 'lucide-react';
import { Book, updateReadPosition, updateAnnotations } from '../lib/db';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ReaderProps {
  book: Book;
  onClose: () => void;
}

export default function Reader({ book, onClose }: ReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [toc, setToc] = useState<any[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [currentChapterHref, setCurrentChapterHref] = useState<string>('');
  const [totalLocations, setTotalLocations] = useState(0);
  const [annotations, setAnnotations] = useState<{ cfiRange: string; text: string }[]>(book.annotations || []);
  
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, text: string, cfiRange: string | null} | null>(null);
  const [mobilePill, setMobilePill] = useState<{text: string, cfiRange: string} | null>(null);
  const currentSelectionRef = useRef<{text: string, cfiRange: string} | null>(null);
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  // Smart UI Auto-hide state
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTurnTimeRef = useRef<number>(0);
  const consecutiveTurnsRef = useRef<number>(0);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 10000); // 10s idle
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls(prev => {
      const next = !prev;
      if (next) resetIdleTimer();
      return next;
    });
    // Reset consecutive turns when manually interacting
    consecutiveTurnsRef.current = 0;
  }, [resetIdleTimer]);

  const handlePageTurn = useCallback(() => {
    const now = Date.now();
    if (now - lastTurnTimeRef.current < 8000) {
      consecutiveTurnsRef.current += 1;
    } else {
      consecutiveTurnsRef.current = 1;
    }
    lastTurnTimeRef.current = now;

    if (consecutiveTurnsRef.current >= 2) {
      setShowControls(false);
    } else {
      resetIdleTimer();
    }
  }, [resetIdleTimer]);

  const turnTimestampsRef = useRef<number[]>([]);

  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    turnTimestampsRef.current = turnTimestampsRef.current.filter(t => now - t < 5000);
    if (turnTimestampsRef.current.length >= 10) {
      return false; // Block if more than 10 turns in 5 seconds
    }
    turnTimestampsRef.current.push(now);
    return true;
  }, []);

  const handlePrev = useCallback(async () => {
    if (isNavigating || !renditionRef.current) return;
    if (!checkRateLimit()) return;
    setIsNavigating(true);
    handlePageTurn();
    try {
      await renditionRef.current.prev();
    } catch (err) {
      console.error('Navigation error:', err);
    } finally {
      setIsNavigating(false);
    }
  }, [isNavigating, handlePageTurn, checkRateLimit]);

  const handleNext = useCallback(async () => {
    if (isNavigating || !renditionRef.current) return;
    if (!checkRateLimit()) return;
    setIsNavigating(true);
    handlePageTurn();
    try {
      await renditionRef.current.next();
    } catch (err) {
      console.error('Navigation error:', err);
    } finally {
      setIsNavigating(false);
    }
  }, [isNavigating, handlePageTurn, checkRateLimit]);

  const handlersRef = useRef({ handlePrev, handleNext, toggleControls });
  useEffect(() => {
    handlersRef.current = { handlePrev, handleNext, toggleControls };
  }, [handlePrev, handleNext, toggleControls]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!viewerRef.current || !book.data) return;

    const epub = ePub(book.data);
    bookRef.current = epub;

    const rendition = epub.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      manager: 'default',
    });

    renditionRef.current = rendition;

    // Inject Chinese Typography and Apple Design Styles using hooks (more stable than themes.default)
    if (rendition.hooks && rendition.hooks.content) {
      rendition.hooks.content.register((contents: any) => {
        if (contents && typeof contents.addStylesheetRules === 'function') {
          contents.addStylesheetRules({
            body: {
              'font-family': '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Inter", sans-serif !important',
              'line-height': '1.7 !important',
              'text-align': 'justify !important',
              'text-justify': 'inter-character !important',
              'padding': '0 20px !important',
              'color': '#1d1d1f !important',
              'transition': 'opacity 0.3s ease-in-out !important',
            },
            '::selection': {
              'background': 'rgba(0, 0, 0, 0.05) !important',
              'color': '#ff3b30 !important',
            },
            '.epubjs-hl': {
              'fill': 'rgba(255, 59, 48, 0.3) !important',
              'fill-opacity': '0.3 !important',
              'mix-blend-mode': 'multiply',
            }
          });
        }

        // Add custom context menu and click listeners to the iframe document
        contents.document.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          const selection = contents.window.getSelection();
          const isTextSelected = selection && !selection.isCollapsed;
          
          const viewerRect = viewerRef.current?.getBoundingClientRect();
          const offsetX = viewerRect ? viewerRect.left : 0;
          const offsetY = viewerRect ? viewerRect.top : 0;

          setContextMenu({
            x: e.clientX + offsetX,
            y: e.clientY + offsetY,
            text: isTextSelected && currentSelectionRef.current ? currentSelectionRef.current.text : '',
            cfiRange: isTextSelected && currentSelectionRef.current ? currentSelectionRef.current.cfiRange : null
          });
          setMobilePill(null);
        });

        contents.document.addEventListener('click', () => {
          setContextMenu(null);
          const selection = contents.window.getSelection();
          if (!selection || selection.isCollapsed) {
            setMobilePill(null);
            currentSelectionRef.current = null;
          }
        });
      });
    }

    const displayPromise = book.lastReadPosition 
      ? rendition.display(book.lastReadPosition)
      : rendition.display();

    displayPromise.then(() => {
      if (bookRef.current) {
        setLoading(false);
        // Restore existing annotations
        annotations.forEach(ann => {
          rendition.annotations.highlight(ann.cfiRange, {}, (e: any) => {});
        });
      }
    }).catch(err => {
      console.error('Display error:', err);
      if (bookRef.current) setLoading(false);
    });

    // Selection events
    rendition.on('selected', (cfiRange: string, contents: any) => {
      const selection = contents.window.getSelection();
      if (!selection || selection.isCollapsed) return;
      
      const text = selection.toString();
      currentSelectionRef.current = { text, cfiRange };
      
      if (isTouchDevice) {
        setMobilePill({ text, cfiRange });
      }
    });

    rendition.on('click', (e: any) => {
      setContextMenu(null);
      
      const contents = renditionRef.current?.getContents()[0];
      if (contents) {
        const selection = contents.window.getSelection();
        if (selection && !selection.isCollapsed) return;
        
        // Clear mobile pill if clicking away without selection
        setMobilePill(null);
        currentSelectionRef.current = null;
      }

      // Handle navigation and UI toggle
      const width = viewerRef.current?.clientWidth || window.innerWidth;
      const x = e.clientX || e.changedTouches?.[0]?.clientX;
      
      if (x !== undefined) {
        if (x < width * 0.2) handlersRef.current.handlePrev();
        else if (x > width * 0.8) handlersRef.current.handleNext();
        else handlersRef.current.toggleControls();
      }
    });
    
    // Handle swipes inside iframe
    let touchStartX = 0;
    let touchStartY = 0;
    rendition.on('touchstart', (e: any) => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    });

    rendition.on('touchend', (e: any) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;

      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) handlersRef.current.handleNext();
        else handlersRef.current.handlePrev();
      }
    });

    // Navigation events
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    rendition.on('keyup', onKeyUp);

    // Handle mouse wheel
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 50) {
        if (e.deltaY > 0) handleNext();
        else handlePrev();
      }
    };
    
    // We need to attach wheel event to the iframe content
    rendition.on('rendered', (section: any, view: any) => {
      if (!view || !view.iframe) return;
      const frame = view.iframe;
      try {
        if (frame && frame.contentWindow) {
          frame.contentWindow.addEventListener('wheel', onWheel);
          frame.contentWindow.addEventListener('click', toggleControls);
        }
      } catch (err) {
        console.warn('Could not attach events to iframe', err);
      }
    });

    // Progress tracking
    rendition.on('relocated', (location: any) => {
      if (!location || !location.start || !location.start.cfi) return;
      const cfi = location.start.cfi;
      updateReadPosition(book.id, cfi);
      
      setCurrentLocation(location);
      if (location.start.href) {
        setCurrentChapterHref(location.start.href);
      }

      if (bookRef.current?.locations && typeof bookRef.current.locations.percentageFromCfi === 'function') {
        const progress = bookRef.current.locations.percentageFromCfi(cfi);
        if (typeof progress === 'number') {
          setProgress(Math.round(progress * 100));
        }
      }
    });

    // Load TOC
    epub.loaded.navigation.then((nav) => {
      if (nav && nav.toc && bookRef.current) {
        setToc(nav.toc);
      }
    });

    // Generate locations for progress tracking (using requestIdleCallback for smoothness)
    epub.ready.then(() => {
      if (!bookRef.current) return;
      
      const generateLocations = () => {
        if (bookRef.current) {
          bookRef.current.locations.generate(1024).then((locations) => {
            setTotalLocations(locations.length);
          }).catch(err => console.warn('Location generation failed', err));
        }
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(generateLocations);
      } else {
        setTimeout(generateLocations, 1000);
      }
    });

    // Handle window resize
    const onResize = () => {
      if (renditionRef.current && viewerRef.current) {
        renditionRef.current.resize(viewerRef.current.offsetWidth, viewerRef.current.offsetHeight);
      }
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
        renditionRef.current = null;
      }
    };
  }, [book.id, book.data, book.lastReadPosition, toggleControls]);

  // Handle swipe gestures
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
  };

  const navigateTo = (cfi: string) => {
    renditionRef.current?.display(cfi);
    setShowToc(false);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="h-16 border-bottom border-near-black/5 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md z-20 select-none"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 hover:bg-apple-gray rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="font-semibold text-near-black line-clamp-1 max-w-[200px] sm:max-w-md">
                {book.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowToc(true)}
                className="p-2 hover:bg-apple-gray rounded-full transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <button className="p-2 hover:bg-apple-gray rounded-full transition-colors">
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Viewer */}
      <main 
        className="flex-1 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <Loader2 className="w-10 h-10 animate-spin text-apple-blue" />
          </div>
        )}
        <div ref={viewerRef} className="w-full h-full" />
        
        {/* Desktop Context Menu */}
        <AnimatePresence>
          {contextMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setContextMenu(null)} 
                onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed z-50 bg-white/90 backdrop-blur-xl shadow-2xl rounded-xl border border-near-black/10 overflow-hidden min-w-[220px] flex flex-col py-1.5"
                style={{ 
                  top: Math.min(contextMenu.y, window.innerHeight - 250) + 'px', 
                  left: Math.min(contextMenu.x, window.innerWidth - 220) + 'px',
                }}
              >
                <div className="px-4 py-2 text-xs font-semibold text-near-black/40 uppercase tracking-wider">
                  {contextMenu.text ? 'Selection Actions' : 'Global Actions'}
                </div>
                
                <button 
                  disabled={!contextMenu.text}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-apple-blue hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-near-black transition-colors flex items-center gap-3"
                  onClick={() => {
                    if (contextMenu.text) {
                      navigator.clipboard.writeText(contextMenu.text);
                      setContextMenu(null);
                      renditionRef.current?.getContents().forEach((c: any) => c.window.getSelection()?.removeAllRanges());
                    }
                  }}
                >
                  <Copy className="w-4 h-4" /> Copy Text
                </button>
                
                <button 
                  disabled={!contextMenu.text}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-apple-blue hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-near-black transition-colors flex items-center gap-3"
                  onClick={() => {
                    if (contextMenu.cfiRange) {
                      renditionRef.current?.annotations.highlight(contextMenu.cfiRange, {}, (e: any) => {});
                      const newAnnotations = [...annotations, { cfiRange: contextMenu.cfiRange, text: contextMenu.text }];
                      setAnnotations(newAnnotations);
                      updateAnnotations(book.id, newAnnotations);
                      setContextMenu(null);
                      renditionRef.current?.getContents().forEach((c: any) => c.window.getSelection()?.removeAllRanges());
                    }
                  }}
                >
                  <Highlighter className="w-4 h-4" /> Highlight
                </button>
                
                <button 
                  disabled={!contextMenu.text}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-apple-blue hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-near-black transition-colors flex items-center gap-3"
                  onClick={() => {
                    if (contextMenu.text) {
                      alert('Saved to Database (WIP)');
                      setContextMenu(null);
                    }
                  }}
                >
                  <Database className="w-4 h-4" /> Save to DB
                </button>
                
                {!contextMenu.text && (
                  <>
                    <div className="h-px bg-near-black/10 my-1.5 mx-2" />
                    <button 
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-apple-blue hover:text-white transition-colors flex items-center gap-3"
                      onClick={() => {
                        setShowToc(true);
                        setContextMenu(null);
                      }}
                    >
                      <List className="w-4 h-4" /> Table of Contents
                    </button>
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Mobile Action Pill */}
        <AnimatePresence>
          {mobilePill && (
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-near-black/90 backdrop-blur-xl shadow-2xl rounded-full border border-white/10 flex items-center overflow-hidden p-1.5"
            >
              <button 
                className="px-4 py-2 text-sm font-medium text-white hover:bg-white/20 rounded-full transition-colors flex items-center gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(mobilePill.text);
                  setMobilePill(null);
                  renditionRef.current?.getContents().forEach((c: any) => c.window.getSelection()?.removeAllRanges());
                }}
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <button 
                className="px-4 py-2 text-sm font-medium text-white hover:bg-white/20 rounded-full transition-colors flex items-center gap-2"
                onClick={() => {
                  renditionRef.current?.annotations.highlight(mobilePill.cfiRange, {}, (e: any) => {});
                  const newAnnotations = [...annotations, { cfiRange: mobilePill.cfiRange, text: mobilePill.text }];
                  setAnnotations(newAnnotations);
                  updateAnnotations(book.id, newAnnotations);
                  setMobilePill(null);
                  renditionRef.current?.getContents().forEach((c: any) => c.window.getSelection()?.removeAllRanges());
                }}
              >
                <Highlighter className="w-4 h-4" /> Highlight
              </button>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <button 
                className="px-4 py-2 text-sm font-medium text-white hover:bg-white/20 rounded-full transition-colors flex items-center gap-2"
                onClick={() => {
                  alert('Saved to Database (WIP)');
                  setMobilePill(null);
                }}
              >
                <Database className="w-4 h-4" /> Save
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click areas for navigation when controls are hidden */}
        {!showControls && (
          <>
            {/* Mini Progress Indicator */}
            {totalLocations > 0 && currentLocation && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
              >
                <div className="px-3 py-1 rounded-full bg-white/30 backdrop-blur-md border border-near-black/5 shadow-sm">
                  <span className="text-[10px] font-medium text-near-black/60 tracking-wider">
                    {bookRef.current?.locations.locationFromCfi(currentLocation.start.cfi)} / {totalLocations} ({progress}%)
                  </span>
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Bottom Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.footer
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="h-16 border-top border-near-black/5 flex items-center px-6 bg-white/80 backdrop-blur-md z-20 select-none"
          >
            <div className="flex-1 flex items-center gap-4">
              <div className="flex-1 h-1 bg-apple-gray rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-apple-blue"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-near-black/40 w-12 text-right">
                {progress}%
              </span>
            </div>
            <div className="flex items-center gap-4 ml-8">
              <button 
                onClick={handlePrev}
                className="p-2 hover:bg-apple-gray rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNext}
                className="p-2 hover:bg-apple-gray rounded-full transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>

      {/* TOC Sidebar */}
      <AnimatePresence>
        {showToc && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowToc(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-40 flex flex-col"
            >
              <div className="p-6 border-bottom border-near-black/5 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Contents</h3>
                <button 
                  onClick={() => setShowToc(false)}
                  className="p-2 hover:bg-apple-gray rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 select-none">
                {toc && toc.length > 0 ? (
                  toc.map((item, index) => {
                    const getBaseName = (path: string) => path ? path.split('/').pop()?.split('#')[0] || '' : '';
                    const isActive = currentChapterHref && getBaseName(currentChapterHref) === getBaseName(item.href);
                    
                    return (
                      <button
                        key={index}
                        onClick={() => navigateTo(item.href)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors text-sm font-medium mb-1",
                          isActive 
                            ? "bg-apple-blue text-white" 
                            : "text-near-black/80 hover:bg-apple-gray hover:text-near-black"
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-center text-near-black/40 py-8">No table of contents available</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
