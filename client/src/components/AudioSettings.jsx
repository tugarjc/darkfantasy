import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioStore } from '../stores/audioStore';

export default function AudioSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const {
    masterVolume, sfxVolume, musicVolume, muted, musicEnabled,
    setMasterVolume, setSfxVolume, setMusicVolume,
    toggleMute, startMusic, stopMusic,
  } = useAudioStore();

  return (
    <div className="relative">
      {/* Speaker button */}
      <button
        onClick={() => setOpen(!open)}
        className="text-muted hover:text-gold transition-colors p-1"
        title={t('audio.title')}
      >
        {muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-elevated border border-border rounded-lg p-3 w-56 shadow-xl">
            <h4 className="font-display text-sm text-gold mb-3">{t('audio.title')}</h4>

            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className={`w-full text-left text-xs px-2 py-1.5 rounded mb-2 transition-colors ${
                muted ? 'bg-blood/20 text-blood-glow' : 'bg-surface text-parchment'
              }`}
            >
              {muted ? t('audio.muted') : t('audio.title')} {muted ? '🔇' : '🔊'}
            </button>

            {/* Master */}
            <VolumeSlider
              label={t('audio.master')}
              value={masterVolume}
              onChange={(v) => setMasterVolume(v)}
            />

            {/* SFX */}
            <VolumeSlider
              label={t('audio.sfx')}
              value={sfxVolume}
              onChange={(v) => setSfxVolume(v)}
            />

            {/* Music */}
            <VolumeSlider
              label={t('audio.music')}
              value={musicVolume}
              onChange={(v) => setMusicVolume(v)}
            />

            {/* Music toggle */}
            <button
              onClick={musicEnabled ? stopMusic : startMusic}
              className={`w-full text-xs px-2 py-1.5 rounded mt-1 border transition-colors ${
                musicEnabled
                  ? 'border-gold/30 text-gold bg-gold/10 hover:bg-gold/20'
                  : 'border-border text-muted bg-surface hover:text-parchment'
              }`}
            >
              {musicEnabled ? t('audio.stop_music') : t('audio.play_music')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function VolumeSlider({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] text-muted mb-0.5">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-surface rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold"
      />
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function SpeakerMutedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}
