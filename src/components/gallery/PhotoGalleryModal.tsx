import React, { useState, useMemo } from 'react';
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useChallenge } from '../../context/ChallengeContext';
import { formatPrettyDate, getDayNumber } from '../../services/rulesEngine';
import { Segmented, Sheet } from '../ui';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({ isOpen, onClose }) => {
  const { allUsersLogs, users, currentUser, config } = useChallenge();
  const challengers = users.filter(u => u.role !== 'admin');
  const defaultId = challengers.some(c => c.id === currentUser?.id) ? currentUser!.id : challengers[0]?.id || 'user_1';
  const [selectedUserId, setSelectedUserId] = useState<string>(defaultId);
  const [mode, setMode] = useState<'grid' | 'compare'>('grid');
  const [slider, setSlider] = useState(50);
  const [active, setActive] = useState<number | null>(null);

  const photos = useMemo(() => {
    const logs = allUsersLogs[selectedUserId] || {};
    return Object.values(logs)
      .filter(l => Boolean(l.tasks?.progressPhoto?.photoUrl))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(l => ({
        date: l.date,
        dayNumber: getDayNumber(l.date, config.startDate),
        url: l.tasks.progressPhoto.photoUrl!,
      }));
  }, [allUsersLogs, selectedUserId, config.startDate]);

  if (!isOpen) return null;
  const first = photos[0];
  const latest = photos[photos.length - 1];

  return (
    <Sheet open onClose={onClose} title="Progress photos" subtitle={`${photos.length} photo${photos.length === 1 ? '' : 's'}`} size="lg">
      <div className="space-y-4">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {challengers.map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedUserId(c.id);
                setActive(null);
              }}
              className={`h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5 ${
                selectedUserId === c.id ? 'bg-white text-ink-950' : 'bg-white/[0.06] text-zinc-300'
              }`}
            >
              {c.avatar} {c.name}
            </button>
          ))}
        </div>

        {photos.length >= 2 && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'grid', label: 'All photos' },
              { value: 'compare', label: 'First vs latest' },
            ]}
          />
        )}

        {photos.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Camera className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-[15px] font-semibold text-zinc-300">No photos yet</p>
            <p className="text-sm text-zinc-500">Add your daily photo in the checklist.</p>
          </div>
        ) : mode === 'compare' && first && latest ? (
          <div className="space-y-2">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/5] w-full select-none bg-black">
              <img src={latest.url} alt="Latest" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}>
                <img src={first.url} alt="First" className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <span className="absolute top-3 left-3 chip bg-black/70 text-white">Day {first.dayNumber}</span>
              <span className="absolute top-3 right-3 chip bg-black/70 text-white">Day {latest.dayNumber}</span>
              <div className="absolute inset-y-0 w-0.5 bg-white pointer-events-none" style={{ left: `${slider}%` }} />
              <input
                type="range"
                min="0"
                max="100"
                value={slider}
                onChange={e => setSlider(Number(e.target.value))}
                aria-label="Compare slider"
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
              />
            </div>
            <p className="text-center text-[12px] text-zinc-500">Drag across the photo to compare</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p, i) => (
              <button key={p.date} onClick={() => setActive(i)} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-black">
                <img src={p.url} alt={`Day ${p.dayNumber}`} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute bottom-1 left-1 chip h-5 bg-black/70 text-white">D{p.dayNumber}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {active !== null && photos[active] && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 pt-safe">
            <span className="text-[15px] font-semibold text-white">
              Day {photos[active].dayNumber} · {formatPrettyDate(photos[active].date)}
            </span>
            <button onClick={() => setActive(null)} aria-label="Close" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2">
            <img src={photos[active].url} alt="Enlarged" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="flex items-center justify-between px-4 h-20 pb-safe">
            <button
              disabled={active === 0}
              onClick={() => setActive(active - 1)}
              className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <span className="text-sm text-zinc-400 tabular">
              {active + 1} / {photos.length}
            </span>
            <button
              disabled={active === photos.length - 1}
              onClick={() => setActive(active + 1)}
              className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
};
