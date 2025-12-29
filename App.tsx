
import React, { useState, useEffect } from 'react';
import { AVAILABLE_VOICES, VoiceName, ParagraphBlock, Book } from './types.ts';
import { geminiService } from './services/gemini.ts';
import { mergeAudioUrls } from './services/audio.ts';
import { AudioPlayer } from './components/AudioPlayer.tsx';
import { BookLibrary } from './components/BookLibrary.tsx';

type ViewMode = 'home' | 'upload' | 'manual' | 'studio' | 'naming';

export default function App() {
  const [view, setView] = useState<ViewMode>('home');
  const [library, setLibrary] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  
  // Appending context
  const [appendingToBookId, setAppendingToBookId] = useState<string | null>(null);

  // Temporary storage for creation flow
  const [tempParagraphs, setTempParagraphs] = useState<string[]>([]);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [manualText, setManualText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);

  // Load Library on Mount
  useEffect(() => {
    const saved = localStorage.getItem('supernova_library');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const cleaned = parsed.map((b: Book) => ({
          ...b,
          paragraphs: b.paragraphs.map(p => ({ ...p, audioUrl: null, status: 'idle' }))
        }));
        setLibrary(cleaned);
      } catch (e) {
        console.error("Failed to load library", e);
      }
    }
  }, []);

  // Save Library on Change
  useEffect(() => {
    if (library.length > 0) {
      const toSave = library.map(b => ({
        ...b,
        paragraphs: b.paragraphs.map(p => ({ ...p, audioUrl: null, status: 'idle' }))
      }));
      localStorage.setItem('supernova_library', JSON.stringify(toSave));
    }
  }, [library]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        try {
          const result = await geminiService.processDocument(base64, file.type);
          if (appendingToBookId) {
            appendParagraphsToBook(result.paragraphs);
          } else {
            setTempParagraphs(result.paragraphs);
            setBookTitle(result.title || '');
            setView('naming');
          }
        } catch (err) {
          setError("OCR Failed. Try a clearer scan.");
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("File error.");
      setIsProcessing(false);
    }
  };

  const createBook = () => {
    if (!bookTitle.trim()) return;

    let finalParagraphsText = tempParagraphs;
    if (view === 'manual') {
       finalParagraphsText = manualText.split(/\n\s*\n/).filter(line => line.trim().length > 0);
    }

    const newBook: Book = {
      id: crypto.randomUUID(),
      title: bookTitle,
      author: bookAuthor,
      createdAt: Date.now(),
      voice: selectedVoice,
      paragraphs: finalParagraphsText.map((text, i) => ({
        id: `p-${i}-${Date.now()}`,
        text,
        status: 'idle',
        audioUrl: null
      }))
    };

    setLibrary(prev => [newBook, ...prev]);
    setCurrentBook(newBook);
    setView('studio');
    setManualText('');
    setTempParagraphs([]);
    setBookAuthor('');
    setAppendingToBookId(null);
  };

  const appendParagraphsToBook = (newTexts: string[]) => {
    if (!currentBook) return;

    const newBlocks: ParagraphBlock[] = newTexts.map((text, i) => ({
      id: `p-append-${i}-${Date.now()}`,
      text,
      status: 'idle',
      audioUrl: null
    }));

    const updatedBook = {
      ...currentBook,
      paragraphs: [...currentBook.paragraphs, ...newBlocks]
    };

    setCurrentBook(updatedBook);
    setLibrary(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    setAppendingToBookId(null);
    setManualText('');
    setView('studio');
  };

  const handleManualContinue = () => {
    if (appendingToBookId) {
      const texts = manualText.split(/\n\s*\n/).filter(line => line.trim().length > 0);
      appendParagraphsToBook(texts);
    } else {
      setView('naming');
    }
  };

  const updateBookMetadata = () => {
    if (!currentBook || !bookTitle.trim()) return;
    const updatedBook = { ...currentBook, title: bookTitle, author: bookAuthor };
    setCurrentBook(updatedBook);
    setLibrary(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    setIsEditingMetadata(false);
  };

  const narrateParagraph = async (index: number) => {
    if (!currentBook) return;
    const p = currentBook.paragraphs[index];
    if (p.status === 'processing') return;

    const updatedParagraphs = [...currentBook.paragraphs];
    updatedParagraphs[index].status = 'processing';
    setCurrentBook({ ...currentBook, paragraphs: updatedParagraphs });

    try {
      const url = await geminiService.generateTTS(p.text, currentBook.voice);
      const finalParagraphs = [...currentBook.paragraphs];
      finalParagraphs[index].audioUrl = url;
      finalParagraphs[index].status = 'idle';
      const updatedBook = { ...currentBook, paragraphs: finalParagraphs };
      setCurrentBook(updatedBook);
      setLibrary(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    } catch (err: any) {
      const resetParagraphs = [...currentBook.paragraphs];
      resetParagraphs[index].status = 'idle';
      setCurrentBook({ ...currentBook, paragraphs: resetParagraphs });
      setError(err.message.includes('429') ? "Rate limit! Please wait 30s." : "Synthesis failed.");
    }
  };

  const handleMergeAndDownload = async () => {
    if (!currentBook) return;
    const urls = currentBook.paragraphs.map(p => p.audioUrl).filter((url): url is string => !!url);
    if (urls.length === 0) {
      setError("Generate some audio parts first!");
      return;
    }

    setIsMerging(true);
    try {
      const blob = await mergeAudioUrls(urls);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentBook.title.replace(/\s+/g, '_')}_Full.wav`;
      a.click();
    } catch (e) {
      setError("Merging failed. Ensure all parts are generated correctly.");
    } finally {
      setIsMerging(false);
    }
  };

  const deleteBook = (id: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      setLibrary(prev => prev.filter(b => b.id !== id));
      if (currentBook?.id === id) {
        setCurrentBook(null);
        setView('home');
      }
    }
  };

  const openBookInStudio = (book: Book) => {
    setCurrentBook(book);
    setBookTitle(book.title);
    setBookAuthor(book.author || '');
    setView('studio');
    setAppendingToBookId(null);
  };

  const startAppending = () => {
    if (!currentBook) return;
    setAppendingToBookId(currentBook.id);
    setView('upload');
  };

  return (
    <div className="min-h-screen bg-[#060609] text-slate-300 pb-20">
      <header className="h-20 border-b border-white/5 flex items-center px-8 justify-between bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" /></svg>
          </div>
          <h1 className="text-lg font-black uppercase tracking-tighter text-white seasons-text">Supernova AI</h1>
        </div>
        <div className="flex gap-6 items-center">
            {view !== 'home' && (
              <button onClick={() => setView('home')} className="text-[10px] font-black uppercase text-slate-500 hover:text-white tracking-widest transition-colors">Library</button>
            )}
            <button onClick={() => { setView('upload'); setBookTitle(''); setBookAuthor(''); setManualText(''); setAppendingToBookId(null); }} className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white">New Project</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:py-12">
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-black uppercase tracking-widest flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {view === 'home' && (
          <div className="space-y-12">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-white seasons-text">Your Library</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">Manage your Urdu audiobook collection.</p>
              </div>
            </div>
            <BookLibrary 
              books={library} 
              onSelectBook={openBookInStudio} 
              onDeleteBook={deleteBook} 
            />
          </div>
        )}

        {(view === 'upload') && (
          <div className="max-w-4xl mx-auto py-12 text-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-6xl font-black text-white seasons-text leading-tight">
                {appendingToBookId ? 'Add Content' : 'Create New Narrator'}
              </h2>
              <p className="text-slate-500 text-sm">
                {appendingToBookId 
                  ? `Select additional content to append to "${currentBook?.title}"`
                  : 'Choose how you want to provide your Urdu script.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative group border border-white/10 rounded-[2.5rem] p-12 bg-white/[0.01] hover:border-amber-500/50 transition-all cursor-pointer overflow-hidden text-center">
                {isProcessing ? (
                  <div className="space-y-6">
                    <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-amber-500 text-[10px] font-black uppercase tracking-[0.4em]">Scanning Document...</p>
                  </div>
                ) : (
                  <>
                    <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFile} />
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <h3 className="text-white font-bold text-xl mb-2">Upload Scan</h3>
                    <p className="text-slate-500 text-xs">AI extracts text from Images/PDFs</p>
                  </>
                )}
              </div>

              <button onClick={() => setView('manual')} className="relative group border border-white/10 rounded-[2.5rem] p-12 bg-white/[0.01] hover:border-amber-500/50 transition-all text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h3 className="text-white font-bold text-xl mb-2">Paste Text</h3>
                <p className="text-slate-500 text-xs">Type or paste Urdu manually</p>
              </button>
            </div>
            
            {appendingToBookId && (
              <button 
                onClick={() => setView('studio')}
                className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors tracking-widest"
              >
                Back to Studio
              </button>
            )}
          </div>
        )}

        {view === 'manual' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-4xl font-black text-white seasons-text">Manual Script</h2>
            <textarea 
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="یہاں اردو تحریر درج کریں..."
              className="w-full h-[400px] bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-10 text-white urdu-font text-3xl text-right leading-[2.5] outline-none focus:border-amber-500/30 transition-all resize-none shadow-2xl"
              dir="rtl"
            />
            <div className="flex justify-end gap-4">
               <button onClick={() => setView(appendingToBookId ? 'upload' : 'upload')} className="px-8 py-4 text-[10px] font-black uppercase text-slate-500">Back</button>
               <button onClick={handleManualContinue} className="px-12 py-4 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
                 {appendingToBookId ? 'Append to Book' : 'Continue'}
               </button>
            </div>
          </div>
        )}

        {view === 'naming' && (
          <div className="max-w-lg mx-auto py-20 space-y-12 animate-in zoom-in-95 duration-500">
             <div className="text-center space-y-4">
                <h2 className="text-5xl font-black text-white seasons-text">Finalize Project</h2>
                <p className="text-slate-500">Name your work and select the master narrator's voice.</p>
             </div>
             
             <div className="space-y-8">
               <div className="space-y-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Book/Project Title</label>
                   <input 
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="Enter Title..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-amber-500/50 outline-none"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Author (Optional)</label>
                   <input 
                    type="text"
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    placeholder="Enter Author Name..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-amber-500/50 outline-none"
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Narrator Voice</label>
                 <div className="grid grid-cols-2 gap-3">
                   {AVAILABLE_VOICES.map(v => (
                     <button 
                      key={v.name}
                      onClick={() => setSelectedVoice(v.name)}
                      className={`p-4 rounded-2xl border transition-all text-left ${selectedVoice === v.name ? 'bg-amber-500/10 border-amber-500 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}`}
                     >
                       <div className="font-bold text-sm">{v.label}</div>
                       <div className="text-[9px] opacity-60 uppercase tracking-tighter mt-1">{v.description}</div>
                     </button>
                   ))}
                 </div>
               </div>

               <button 
                onClick={createBook}
                disabled={!bookTitle.trim()}
                className="w-full py-5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
               >
                 Launch Studio
               </button>
             </div>
          </div>
        )}

        {view === 'studio' && currentBook && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8">
            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] flex flex-col md:flex-row gap-8 items-center justify-between">
              <div className="flex-1">
                {isEditingMetadata ? (
                  <div className="flex flex-col gap-4 max-w-md">
                    <input 
                      type="text"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      className="bg-black/50 border border-white/20 text-white text-3xl font-black rounded-xl px-4 py-2 outline-none focus:border-amber-500/50 urdu-font"
                      dir="rtl"
                    />
                    <input 
                      type="text"
                      value={bookAuthor}
                      onChange={(e) => setBookAuthor(e.target.value)}
                      placeholder="Author Name"
                      className="bg-black/50 border border-white/20 text-slate-400 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-amber-500/50"
                    />
                    <div className="flex gap-2">
                      <button onClick={updateBookMetadata} className="px-4 py-2 bg-amber-500 text-black rounded-lg text-[10px] font-black uppercase tracking-widest">Save Changes</button>
                      <button onClick={() => { setIsEditingMetadata(false); setBookTitle(currentBook.title); setBookAuthor(currentBook.author || ''); }} className="px-4 py-2 bg-white/5 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    <div className="flex items-center gap-4">
                      <h3 className="text-white font-black text-4xl urdu-font mb-2 cursor-pointer hover:text-amber-500 transition-colors" dir="rtl" onClick={() => setIsEditingMetadata(true)}>{currentBook.title}</h3>
                      <button onClick={() => setIsEditingMetadata(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-500 hover:text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </div>
                    <div className="flex gap-4 items-center">
                      {currentBook.author && <span className="text-slate-400 text-sm font-medium">{currentBook.author}</span>}
                      <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-amber-500/10 rounded">{currentBook.voice} Voice</span>
                      <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{currentBook.paragraphs.length} Paragraphs</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <button 
                  onClick={startAppending}
                  className="px-6 py-4 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  Add More Content
                </button>
                <button 
                  onClick={handleMergeAndDownload}
                  disabled={isMerging}
                  className="px-8 py-4 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-all flex items-center gap-2 shadow-xl shadow-white/5"
                >
                  {isMerging ? 'Merging...' : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
                      Download Full Audiobook
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {currentBook.paragraphs.map((p, index) => (
                <div key={p.id} className="group bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-white/10 transition-all">
                  <div className="p-10 flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                      <p className="text-white urdu-font text-3xl leading-[2.8] text-right" dir="rtl">{p.text}</p>
                    </div>
                    <div className="md:w-64 space-y-4 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/5 pt-6 md:pt-0 md:pl-8">
                      {p.audioUrl ? (
                        <AudioPlayer url={p.audioUrl} title={`Part ${index + 1}`} />
                      ) : (
                        <button 
                          onClick={() => narrateParagraph(index)}
                          disabled={p.status === 'processing'}
                          className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${p.status === 'processing' ? 'bg-white/5 text-slate-600 cursor-wait' : 'bg-amber-500 text-black hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/10'}`}
                        >
                          {p.status === 'processing' ? 'Processing...' : 'Narrate Part'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {view === 'studio' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest shadow-2xl flex items-center gap-4">
          <span className="flex w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Progress is saved locally. Audio resets on refresh unless downloaded.
        </div>
      )}
    </div>
  );
}