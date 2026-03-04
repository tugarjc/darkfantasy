import { create } from 'zustand';

const SOUND_DEFS = {
  ui_click:       { src: '/audio/ui_click.mp3', volume: 0.3 },
  build_start:    { src: '/audio/build_start.mp3', volume: 0.5 },
  build_complete: { src: '/audio/build_complete.mp3', volume: 0.6 },
  combat:         { src: '/audio/combat.mp3', volume: 0.5 },
  notification:   { src: '/audio/notification.mp3', volume: 0.4 },
  error:          { src: '/audio/error.mp3', volume: 0.4 },
};

const MUSIC_SRC = '/audio/ambient.mp3';
const MUSIC_BASE_VOL = 0.15;

function loadPrefs() {
  try {
    const saved = localStorage.getItem('audio_prefs');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { masterVolume: 0.5, sfxVolume: 0.7, musicVolume: 0.3, muted: false, musicEnabled: false };
}

function savePrefs(patch) {
  try {
    const current = loadPrefs();
    localStorage.setItem('audio_prefs', JSON.stringify({ ...current, ...patch }));
  } catch { /* ignore */ }
}

export const useAudioStore = create((set, get) => {
  const prefs = loadPrefs();

  return {
    masterVolume: prefs.masterVolume,
    sfxVolume: prefs.sfxVolume,
    musicVolume: prefs.musicVolume,
    muted: prefs.muted,
    musicEnabled: prefs.musicEnabled,
    initialized: false,

    // Internal Howl refs
    _sounds: {},
    _music: null,
    _Howl: null,

    init: async () => {
      if (get().initialized) return;
      try {
        const { Howl, Howler } = await import('howler');
        const state = get();
        Howler.volume(state.muted ? 0 : state.masterVolume);

        // Pre-load SFX
        const sounds = {};
        for (const [key, def] of Object.entries(SOUND_DEFS)) {
          sounds[key] = new Howl({
            src: [def.src],
            volume: def.volume * state.sfxVolume,
            preload: true,
            onloaderror: () => { /* stub file missing, ignore */ },
          });
        }

        set({ _sounds: sounds, _Howl: Howl, initialized: true });

        // Start music if was enabled
        if (state.musicEnabled) {
          const music = new Howl({
            src: [MUSIC_SRC],
            volume: MUSIC_BASE_VOL * state.musicVolume * state.masterVolume,
            loop: true,
            preload: true,
            onloaderror: () => { /* ignore */ },
          });
          music.play();
          set({ _music: music });
        }
      } catch { /* howler not available */ }
    },

    play: (soundKey) => {
      const state = get();
      if (state.muted || !state.initialized) return;
      const howl = state._sounds[soundKey];
      if (howl) howl.play();
    },

    startMusic: () => {
      const state = get();
      if (!state.initialized || !state._Howl) return;
      if (state._music) { state._music.play(); set({ musicEnabled: true }); savePrefs({ musicEnabled: true }); return; }
      const music = new state._Howl({
        src: [MUSIC_SRC],
        volume: MUSIC_BASE_VOL * state.musicVolume * state.masterVolume,
        loop: true,
        onloaderror: () => { /* ignore */ },
      });
      music.play();
      set({ _music: music, musicEnabled: true });
      savePrefs({ musicEnabled: true });
    },

    stopMusic: () => {
      const state = get();
      if (state._music) {
        state._music.pause();
      }
      set({ musicEnabled: false });
      savePrefs({ musicEnabled: false });
    },

    setMasterVolume: (vol) => {
      import('howler').then(({ Howler }) => { Howler.volume(vol); }).catch(() => {});
      set({ masterVolume: vol });
      savePrefs({ masterVolume: vol });
    },

    setSfxVolume: (vol) => {
      const state = get();
      for (const [key, howl] of Object.entries(state._sounds)) {
        howl.volume(SOUND_DEFS[key].volume * vol);
      }
      set({ sfxVolume: vol });
      savePrefs({ sfxVolume: vol });
    },

    setMusicVolume: (vol) => {
      const state = get();
      if (state._music) {
        state._music.volume(MUSIC_BASE_VOL * vol * state.masterVolume);
      }
      set({ musicVolume: vol });
      savePrefs({ musicVolume: vol });
    },

    toggleMute: () => {
      const state = get();
      const newMuted = !state.muted;
      import('howler').then(({ Howler }) => {
        Howler.volume(newMuted ? 0 : state.masterVolume);
      }).catch(() => {});
      set({ muted: newMuted });
      savePrefs({ muted: newMuted });
    },
  };
});
