import { toast as sonnerToast, ExternalToast } from "sonner";

// A pleasant "pop" sound for notifications (base64 encoded mp3/wav or synthesize)
const playSound = () => {
  if (typeof window === "undefined") return;
  
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Smooth bell-like sound
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Ignore audio errors (e.g. user hasn't interacted with document yet)
  }
};

export const toast = (message: string, data?: ExternalToast) => {
  playSound();
  return sonnerToast(message, data);
};

toast.success = (message: string, data?: ExternalToast) => {
  playSound();
  return sonnerToast.success(message, data);
};

toast.error = (message: string, data?: ExternalToast) => {
  playSound();
  return sonnerToast.error(message, data);
};

toast.info = (message: string, data?: ExternalToast) => {
  playSound();
  return sonnerToast.info(message, data);
};

toast.warning = (message: string, data?: ExternalToast) => {
  playSound();
  return sonnerToast.warning(message, data);
};

toast.promise = sonnerToast.promise;
toast.dismiss = sonnerToast.dismiss;
