import React, { useState, useEffect, useRef } from 'react';
import { Plus, Book as BookIcon, Trash2, Loader2 } from 'lucide-react';
import ePub from 'epubjs';
import { Book as DbBook, getAllBooks, saveBook, deleteBook } from '../lib/db';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LibraryProps {
  onSelectBook: (book: DbBook) => void;
}

export default function Library({ onSelectBook }: LibraryProps) {
  const [books, setBooks] = useState<DbBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const allBooks = await getAllBooks();
      setBooks(allBooks.sort((a, b) => b.addedAt - a.addedAt));
    } catch (error) {
      console.error('Failed to load books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 50MB limit
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      if (navigator.vibrate) navigator.vibrate(200);
      alert('文件过大。为了保证丝滑的阅读体验，请上传 50MB 以内的书籍。');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const epub = ePub(arrayBuffer);
      const metadata = await epub.loaded.metadata;
      
      // Try to get cover
      let coverUrl: string | undefined;
      try {
        const coverPath = await epub.coverUrl();
        if (coverPath) coverUrl = coverPath;
      } catch (e) {
        console.warn('Could not load cover', e);
      }

      const newBook: DbBook = {
        id: crypto.randomUUID(),
        title: metadata.title || file.name.replace('.epub', ''),
        author: metadata.creator || '未知作者',
        cover: coverUrl,
        data: arrayBuffer,
        addedAt: Date.now(),
      };

      await saveBook(newBook);
      await loadBooks();
    } catch (error) {
      console.error('Failed to upload book:', error);
      alert('解析 EPUB 文件失败。请确保它是一个有效的 .epub 文件。');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这本书吗？')) {
      await deleteBook(id);
      await loadBooks();
    }
  };

  return (
    <div className="min-h-screen bg-apple-gray pt-24 pb-12 px-6 sm:px-12">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-5xl font-semibold text-near-black mb-2">书库</h1>
            <p className="text-near-black/60 text-xl">你个人的故事收藏夹。</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="apple-button-primary flex items-center gap-2 h-12 px-6 rounded-full"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            <span className="font-medium">添加书籍</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".epub"
            className="hidden"
          />
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-apple-blue" />
          </div>
        ) : books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-12 text-center border border-near-black/5 shadow-sm"
          >
            <div className="w-20 h-20 bg-apple-gray rounded-full flex items-center justify-center mx-auto mb-6">
              <BookIcon className="w-10 h-10 text-near-black/20" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">书库空空如也</h2>
            <p className="text-near-black/40 mb-8 max-w-md mx-auto">
              上传你的第一本 EPUB 电子书，开启阅读之旅。
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="apple-link text-lg inline-flex items-center gap-1"
            >
              上传书籍 <Plus className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            <AnimatePresence mode="popLayout">
              {books.map((book) => (
                <motion.div
                  key={book.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -8 }}
                  onClick={() => onSelectBook(book)}
                  className="group cursor-pointer"
                >
                  <div className="aspect-[2/3] bg-white rounded-xl shadow-lg overflow-hidden mb-4 relative border border-near-black/5">
                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-apple-gray to-white">
                        <BookIcon className="w-12 h-12 text-near-black/10 mb-4" />
                        <span className="text-sm font-medium text-near-black/40 line-clamp-3">
                          {book.title}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    <button
                      onClick={(e) => handleDelete(e, book.id)}
                      className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-semibold text-near-black line-clamp-1 group-hover:text-apple-blue transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-sm text-near-black/50 line-clamp-1">{book.author}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
