import React, { useState, useMemo } from 'react';
import { X, Camera, ChevronLeft, ChevronRight, Download, Sparkles, SplitSquareVertical } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { parseDate, formatDate } from '../../services/rulesEngine';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({ isOpen, onClose }) => {
  const { allUsersLogs, users, currentUser } = useChallenge();
  const challengers = users.filter(u => u.role !== 'admin');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || 'user_1');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const targetLogs = allUsersLogs[selectedUserId] || {};

  // Extract all photos sorted chronologically
  const photoEntries = useMemo(() => {
    return Object.values(targetLogs)
      .filter(l => Boolean(l.tasks?.progressPhoto?.photoUrl))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(l => ({
        date: l.date,
        dayNumber: l.dayNumber,
        url: l.tasks.progressPhoto.photoUrl!,
        formattedDate: new Date(l.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }));
  }, [targetLogs]);

  if (!isOpen) return null;

  const firstPhoto = photoEntries[0];
  const latestPhoto = photoEntries[photoEntries.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in text-xs">
      <div className="w-full max-w-lg bg-[#121318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">75 HARD Transformation Gallery</h3>
              <p className="text-[11px] text-slate-400">Daily physique evolution ({photoEntries.length} photos)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Challenger Switcher Tabs & Mode Toggles */}
        <div className="p-3 border-b border-white/[0.06] bg-black/30 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
            {challengers.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedUserId(c.id)}
                className={`py-1 px-2.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all ${
                  selectedUserId === c.id
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <span>{c.avatar}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {photoEntries.length >= 2 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center space-x-1 shrink-0 transition-all ${
                compareMode
                  ? 'bg-amber-500 text-black font-extrabold'
                  : 'bg-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>{compareMode ? 'Grid View' : 'Compare Day 1 vs Now'}</span>
            </button>
          )}
        </div>

        {/* Gallery Content */}
        <div className="p-4 overflow-y-auto flex-1 no-scrollbar space-y-4">
          {photoEntries.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Camera className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-semibold text-slate-300 text-sm">No Progress Photos Logged Yet</p>
              <p className="text-xs text-slate-500">
                Upload your daily physique picture in the Daily Tracker to see your 75-day transformation unfold!
              </p>
            </div>
          ) : compareMode && firstPhoto && latestPhoto ? (
            /* DAY 1 VS NOW COMPARISON SLIDER */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="text-amber-400">Day {firstPhoto.dayNumber} ({firstPhoto.formattedDate})</span>
                <span className="text-emerald-400">Day {latestPhoto.dayNumber} ({latestPhoto.formattedDate})</span>
              </div>

              {/* Side by side compare */}
              <div className="relative rounded-2xl overflow-hidden aspect-[4/5] max-h-[50vh] border border-white/10 select-none mx-auto w-full max-w-sm">
                <img
                  src={latestPhoto.url}
                  alt="Latest"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <img
                    src={firstPhoto.url}
                    alt="First"
                    className="absolute inset-0 w-full h-full object-cover max-w-none"
                    style={{ width: '100%', height: '100%' }}
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-black text-amber-400 border border-amber-500/30">
                    DAY {firstPhoto.dayNumber}
                  </div>
                </div>

                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-black text-emerald-400 border border-emerald-500/30">
                  DAY {latestPhoto.dayNumber}
                </div>

                {/* Slider divider line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center font-bold text-[9px] shadow-lg">
                    ⇄
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={e => setSliderPosition(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                />
              </div>

              <p className="text-center text-[11px] text-slate-400">
                Drag slider to compare Day {firstPhoto.dayNumber} vs Day {latestPhoto.dayNumber}
              </p>
            </div>
          ) : (
            /* PHOTO GRID VIEW */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {photoEntries.map((photo, index) => (
                <div
                  key={photo.date}
                  onClick={() => setActivePhotoIndex(index)}
                  className="relative rounded-xl overflow-hidden aspect-[3/4] border border-white/10 group cursor-pointer bg-black/40 hover:border-rose-500/50 transition-all"
                >
                  <img
                    src={photo.url}
                    alt={`Day ${photo.dayNumber}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-black text-white border border-white/20">
                    Day {photo.dayNumber}
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-medium text-slate-300 text-center truncate">
                    {photo.formattedDate}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High-res Lightbox Modal */}
        {activePhotoIndex !== null && photoEntries[activePhotoIndex] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/95 backdrop-blur-md">
            <button
              onClick={() => setActivePhotoIndex(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/80 text-white hover:bg-black z-50"
            >
              <X className="w-6 h-6" />
            </button>

            <button
              onClick={() => setActivePhotoIndex(Math.max(0, activePhotoIndex - 1))}
              disabled={activePhotoIndex === 0}
              className="absolute left-2 p-2 rounded-full bg-black/80 text-white hover:bg-black disabled:opacity-20 z-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="max-w-md w-full max-h-[85vh] flex flex-col items-center">
              <img
                src={photoEntries[activePhotoIndex].url}
                alt="Enlarged"
                className="w-full max-h-[75vh] object-contain rounded-2xl"
              />
              <div className="mt-3 text-center">
                <span className="text-sm font-extrabold text-white">
                  Day {photoEntries[activePhotoIndex].dayNumber} ({photoEntries[activePhotoIndex].formattedDate})
                </span>
              </div>
            </div>

            <button
              onClick={() => setActivePhotoIndex(Math.min(photoEntries.length - 1, activePhotoIndex + 1))}
              disabled={activePhotoIndex === photoEntries.length - 1}
              className="absolute right-2 p-2 rounded-full bg-black/80 text-white hover:bg-black disabled:opacity-20 z-50"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
