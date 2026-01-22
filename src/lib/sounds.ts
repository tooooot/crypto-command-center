// Sound utility for trading notifications
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Play a success chime sound (coin sound)
export const playSuccessChime = () => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Coin-like sound: quick ascending notes
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.log('Sound not supported');
  }
};

// Play profit celebration sound
export const playProfitSound = () => {
  try {
    const ctx = getAudioContext();
    
    // First note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.value = 523.25; // C5
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.setValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);
    
    // Second note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.value = 659.25; // E5
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.01, ctx.currentTime + 0.3);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.3);
    
    // Third note (higher)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.type = 'sine';
    osc3.frequency.value = 783.99; // G5
    gain3.gain.setValueAtTime(0.4, ctx.currentTime + 0.3);
    gain3.gain.setValueAtTime(0.01, ctx.currentTime + 0.5);
    osc3.start(ctx.currentTime + 0.3);
    osc3.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log('Sound not supported');
  }
};
