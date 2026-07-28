import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  playAchievementFanfare,
  playComboStinger,
  playCompletionChime as playCompletionChimeTone,
  playConfettiPop,
  playJaredCompletion,
  playErlichCompletion,
  playRichardCompletion,
  playRussCompletionChime,
  playKonamiRainbow,
  playLevelUpFanfare,
  playGilfoyleCompletion,
  playStreakStinger,
  playXpPickup
} from '../../utils/agentChimes.js';
import { canvasConfettiAvailable } from '../../utils/appConfetti.js';
import {
  applyCompletedRun,
  applyOfficeEvent,
  writeToStorage as writeGamificationToStorage
} from '../../state/runGamificationStore.js';

/**
 * Run ceremony state: boot overlays, streak HUD emissions, completion delight,
 * konami / prompt easter eggs.
 *
 * @param {{
 *   prompt: string;
 *   promptEasterEggs: Array<{ match: RegExp, toast: string }>;
 *   konamiAchievement: { title?: string, subtitle?: string } | undefined;
 *   tryAgentSound: (playFn: (ctx: unknown) => void) => void;
 *   russStreak: number;
 *   setGamification: (value: unknown) => void;
 *   setOfficeRunSignal: (value: unknown) => void;
 *   celebrationTimerRef: import('react').MutableRefObject<ReturnType<typeof setTimeout> | null>;
 * }} deps
 */
export function useRunCeremony({
  prompt,
  promptEasterEggs,
  konamiAchievement,
  tryAgentSound,
  russStreak,
  setGamification,
  setOfficeRunSignal,
  celebrationTimerRef
}) {
  const [bootSeq, setBootSeq] = useState({ trigger: 0, variant: null });
  const [streakHudToasts, setStreakHudToasts] = useState([]);
  const [streakHudAchievement, setStreakHudAchievement] = useState(null);
  const [streakHudLevelUp, setStreakHudLevelUp] = useState(null);
  const [xpBarFlashKey, setXpBarFlashKey] = useState(0);
  const [celebratingEntryId, setCelebratingEntryId] = useState(null);
  const streakEmissionSeqRef = useRef(0);

  const processSlopEmissions = useCallback(
    (emissions, now) => {
      if (!Array.isArray(emissions) || emissions.length === 0) return;
      const reduceMotion =
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stamped = emissions.map((e) => {
        const seq = streakEmissionSeqRef.current + 1;
        streakEmissionSeqRef.current = seq;
        return { ...e, id: `slop-${now}-${seq}` };
      });
      const toasts = stamped.filter(
        (e) => e.kind === 'xp' || e.kind === 'streak' || e.kind === 'combo' || e.kind === 'text'
      );
      const banner = stamped.find((e) => e.kind === 'achievement' || e.kind === 'prestige');
      const levelUpEmission = stamped.find((e) => e.kind === 'levelUp');
      if (toasts.length > 0) {
        setStreakHudToasts((q) => [...q, ...toasts]);
        for (const t of toasts) {
          setTimeout(() => {
            setStreakHudToasts((q) => q.filter((x) => x.id !== t.id));
          }, 1800);
        }
      }
      if (levelUpEmission) {
        setStreakHudLevelUp(levelUpEmission);
        setXpBarFlashKey((n) => n + 1);
        setTimeout(() => {
          setStreakHudLevelUp((current) => (current?.id === levelUpEmission.id ? null : current));
        }, 5200);
      }
      if (banner) {
        setStreakHudAchievement(banner);
        setTimeout(() => {
          setStreakHudAchievement((current) => (current?.id === banner.id ? null : current));
        }, 3200);
      }
      for (const e of emissions) {
        if (e.kind === 'xp') {
          tryAgentSound(playXpPickup);
        } else if (e.kind === 'streak' && e.streak >= 2) {
          tryAgentSound((ctx) => playStreakStinger(ctx, e.streak));
        } else if (e.kind === 'combo') {
          tryAgentSound((ctx) => playComboStinger(ctx, e.combo));
        } else if (e.kind === 'levelUp') {
          tryAgentSound(playLevelUpFanfare);
          if (!reduceMotion && canvasConfettiAvailable()) {
            try {
              confetti({
                particleCount: 110,
                spread: 75,
                startVelocity: 55,
                ticks: 220,
                origin: { x: 0.18, y: 0.55 },
                colors: ['#fde68a', '#fcd34d', '#f59e0b', '#ec4899', '#a855f7']
              });
              confetti({
                particleCount: 110,
                spread: 75,
                startVelocity: 55,
                ticks: 220,
                origin: { x: 0.82, y: 0.55 },
                colors: ['#22d3ee', '#60a5fa', '#a855f7', '#f472b6', '#fde68a']
              });
            } catch {
              // ignore
            }
          }
        } else if (e.kind === 'achievement' || e.kind === 'prestige') {
          tryAgentSound(playAchievementFanfare);
          if (!reduceMotion && canvasConfettiAvailable()) {
            try {
              confetti({
                particleCount: 160,
                spread: 110,
                startVelocity: 60,
                ticks: 240,
                origin: { x: 0.5, y: 0.35 },
                colors: ['#fde68a', '#fcd34d', '#f59e0b', '#ec4899', '#a855f7', '#22d3ee']
              });
            } catch {
              // ignore
            }
          }
        }
      }
    },
    [tryAgentSound]
  );

  const triggerCompletionDelight = useCallback(
    (entryId, variant = 'general', extras = {}) => {
      setOfficeRunSignal((prev) => ({ id: (prev?.id ?? 0) + 1, variant }));
      setCelebratingEntryId(entryId);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      const dwellMs = variant === 'russ' ? 1100 : 900;
      celebrationTimerRef.current = setTimeout(() => setCelebratingEntryId(null), dwellMs);
      if (variant === 'russ') tryAgentSound(playRussCompletionChime);
      else if (variant === 'gilfoyle') tryAgentSound(playGilfoyleCompletion);
      else if (variant === 'dinesh') tryAgentSound(playDineshCompletion);
      else if (variant === 'erlich') tryAgentSound(playErlichCompletion);
      else if (variant === 'jared') tryAgentSound(playJaredCompletion);
      else if (variant === 'richard') tryAgentSound(playRichardCompletion);
      else tryAgentSound(playCompletionChimeTone);

      const reduceMotion =
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const variantPalettes = {
        gilfoyle: ['#2563eb', '#60a5fa', '#bfdbfe', '#1d4ed8'],
        dinesh: ['#7c3aed', '#a78bfa', '#ddd6fe', '#5b21b6'],
        erlich: ['#ea580c', '#fb923c', '#fed7aa', '#c2410c'],
        russ: ['#f97316', '#ec4899', '#a855f7', '#22d3ee', '#fde047'],
        jared: ['#b91c1c', '#f97316', '#fde68a', '#7c2d12'],
        richard: ['#0d9488', '#22d3ee', '#ccfbf1', '#0f766e'],
        barker: ['#ca8a04', '#facc15', '#fde68a', '#854d0e'],
        general: ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff']
      };
      const palette = variantPalettes[variant] || variantPalettes.general;
      if (!reduceMotion && canvasConfettiAvailable()) {
        try {
          const burstParticles = variant === 'russ' ? 120 : 70;
          confetti({
            particleCount: burstParticles,
            spread: variant === 'russ' ? 92 : 70,
            startVelocity: variant === 'russ' ? 55 : 42,
            ticks: 200,
            origin: { x: 0.5, y: 0.4 },
            colors: palette
          });
        } catch {
          // canvas-confetti can throw in headless test envs; ignore.
        }
        tryAgentSound(playConfettiPop);
      }

      const knownVariants = ['gilfoyle', 'dinesh', 'erlich', 'russ', 'jared', 'richard', 'barker'];
      if (knownVariants.includes(variant)) {
        const now = Date.now();
        const inferredRussDepth = variant === 'russ' ? russStreak + 1 : undefined;
        setGamification((current) => {
          const { state, emissions } = applyCompletedRun(current, {
            variant,
            now,
            russDepth: extras?.russDepth ?? inferredRussDepth,
            critiquePerfect: extras?.critiquePerfect,
            runCostUsd: extras?.runCostUsd
          });
          if (typeof window !== 'undefined') {
            writeGamificationToStorage(window.localStorage, state);
          }
          processSlopEmissions(emissions, now);
          return state;
        });
      }
    },
    [
      celebrationTimerRef,
      russStreak,
      processSlopEmissions,
      setGamification,
      setOfficeRunSignal,
      tryAgentSound
    ]
  );

  const handleOfficeEvent = useCallback(
    (kind, extras = {}) => {
      const now = Date.now();
      setGamification((current) => {
        const { state, emissions } = applyOfficeEvent(current, { kind, now, ...extras });
        if (typeof window !== 'undefined') {
          writeGamificationToStorage(window.localStorage, state);
        }
        processSlopEmissions(emissions, now);
        return state;
      });
    },
    [processSlopEmissions, setGamification]
  );

  const promptEasterEggsFiredRef = useRef(new Set());
  const promptEasterEggSeqRef = useRef(0);
  useEffect(() => {
    if (!prompt) return;
    const eggs = promptEasterEggs ?? [];
    for (const egg of eggs) {
      if (egg.match.test(prompt) && !promptEasterEggsFiredRef.current.has(egg.toast)) {
        promptEasterEggsFiredRef.current.add(egg.toast);
        const seq = promptEasterEggSeqRef.current + 1;
        promptEasterEggSeqRef.current = seq;
        const toast = { id: `easter-${Date.now()}-${seq}`, kind: 'text', label: egg.toast };
        setStreakHudToasts((q) => [...q, toast]);
        setTimeout(() => {
          setStreakHudToasts((q) => q.filter((x) => x.id !== toast.id));
        }, 1800);
      }
    }
  }, [prompt, promptEasterEggs]);

  const konamiBufferRef = useRef([]);
  const konamiFiredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sequence = [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'b',
      'a'
    ];
    function isEditable(target) {
      if (!target) return false;
      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      return target.isContentEditable === true;
    }
    function handleKey(e) {
      if (konamiFiredRef.current) return;
      if (isEditable(e.target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      konamiBufferRef.current = [...konamiBufferRef.current, key].slice(-sequence.length);
      const buf = konamiBufferRef.current;
      if (buf.length !== sequence.length) return;
      for (let i = 0; i < sequence.length; i++) {
        if (buf[i] !== sequence[i]) return;
      }
      konamiFiredRef.current = true;
      const konami = konamiAchievement;
      const banner = {
        id: `konami-${Date.now()}`,
        title: konami?.title ?? '',
        subtitle: konami?.subtitle ?? ''
      };
      setStreakHudAchievement(banner);
      setTimeout(() => {
        setStreakHudAchievement((current) => (current?.id === banner.id ? null : current));
      }, 3200);
      tryAgentSound(playAchievementFanfare);
      setTimeout(() => tryAgentSound(playKonamiRainbow), 120);
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('slopitect-rainbow-tint');
        setTimeout(() => document.body.classList.remove('slopitect-rainbow-tint'), 5200);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // tryAgentSound is stable enough for this listener and we want a one-shot lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [konamiAchievement]);

  return {
    bootSeq,
    setBootSeq,
    streakHudToasts,
    streakHudAchievement,
    streakHudLevelUp,
    xpBarFlashKey,
    celebratingEntryId,
    triggerCompletionDelight,
    handleOfficeEvent
  };
}
