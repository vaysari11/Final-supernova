
import React from 'react';
import { Book } from '../types';

interface BookLibraryProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
}

export const BookLibrary: React.FC<BookLibraryProps> = ({ books, onSelectBook, onDeleteBook }) => {
  if (books.length === 0) {
    return (
      <div className="text-center py-20 bg-white/[0.02] rounded-3xl border-2 border-dashed border-white/5">
        <div className="mb-4 text-amber-500/20">
          <svg className="mx-auto w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-200 seasons-text">Library is Empty</h3>
        <p className="text-slate-400 mt-2">Create your first audiobook project to see it listed here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {books.map((book) => (
        <div 
          key={book.id} 
          className="group relative flex flex-col bg-white/[0.03] rounded-3xl overflow-hidden border border-white/5 hover:border-amber-500/30 transition-all duration-500 hover:-translate-y-2 shadow-2xl"
        >
          <div 
            className="h-48 bg-gradient-to-br from-indigo-950 via-slate-950 to-amber-950 p-6 flex flex-col justify-end cursor-pointer overflow-hidden relative"
            onClick={() => onSelectBook(book)}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-all"></div>
            <h3 className="text-white text-2xl font-bold line-clamp-2 urdu-font relative z-10" dir="rtl">{book.title}</h3>
            <p className="text-slate-400 text-sm mt-2 font-medium relative z-10">{book.author || 'Original Work'}</p>
          </div>
          
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-5 font-mono">
              <span className="bg-white/5 px-2 py-1 rounded-md">{book.paragraphs.length} Paragraphs</span>
              <span>{new Date(book.createdAt).toLocaleDateString()}</span>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => onSelectBook(book)}
                className="flex-1 bg-white/5 text-white py-3 rounded-xl font-bold hover:bg-white/10 transition-all border border-white/5 hover:border-white/10"
              >
                Listen Now
              </button>
              <button 
                onClick={() => onDeleteBook(book.id)}
                className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                title="Delete Project"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
