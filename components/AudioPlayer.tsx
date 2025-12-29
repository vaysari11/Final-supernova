
import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  url: string;
  title: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, title }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Calculate percentage for CSS background fill
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 flex flex-col gap-4 shadow-xl">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-200 truncate urdu-font text-lg" dir="rtl">{title}</span>
        <span className="text-[10px] text-amber-500 font-black tracking-widest font-mono uppercase bg-amber-500/10 px-2 py-1 rounded-md">
            {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      
      <div className="flex items-center gap-6">
        <button 
          onClick={togglePlay}
          className="w-14 h-14 flex items-center justify-center bg-amber-500 text-slate-950 rounded-full hover:bg-amber-400 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-amber-500/20 shrink-0"
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          )}
        </button>
        
        <div className="relative flex-1 group">
            <input 
              type="range" 
              min="0" 
              max={duration || 0} 
              step="0.1"
              value={currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = val;
                setCurrentTime(val);
              }}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500 relative z-10"
              style={{
                background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}%, rgba(255,255,255,0.1) 100%)`
              }}
            />
            {/* Visual glow effect behind handle */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-amber-500/30 blur-md rounded-full pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            ></div>
        </div>
      </div>

      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={onTimeUpdate} 
        onLoadedMetadata={onLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <style>{`
        input[type='range']::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #fff;
          border: 3px solid #f59e0b;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
          transition: transform 0.1s ease;
        }
        input[type='range']:active::-webkit-slider-thumb {
          transform: scale(1.3);
        }
      `}</style>
    </div>
  );
};
