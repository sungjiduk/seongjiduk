// 사운드 — Web Audio 절차 생성(음원 파일 없음: 저작권·용량 0).
//
// 배선법: main.js에서 createSound() 호출 후 updateFromScroll에서 sound.setAct(act) 호출.
//   const sound = createSound();          // boot() 안, overlay 생성 근처
//   sound.setAct(act);                    // updateFromScroll(t)의 actProgress 분기 뒤 한 줄
//
// 구성:
//   바람  = 화이트노이즈 버퍼 → BiquadFilter(lowpass) → 게인.
//           skydive에서 게인 최대, deck에서 낮게, arrival에선 거의 0.
//           느린 LFO가 필터 컷오프를 흔들어 "휘이잉" 돌풍감을 만든다.
//   패드  = 펜타토닉 화음(C3·G3·D4) 오실레이터 3개 + 느린 LFO 숨쉬기 게인.
//           arrival에서만 페이드 인, 최대 볼륨 ≈ -18dB.
//
// 자동재생 정책: AudioContext는 첫 pointerdown/keydown 이후에만 생성/resume.
// 토글(#sound-toggle) 클릭 자체가 pointerdown이므로 항상 정책을 만족한다.

/** 막별 바람 게인 (필터드 노이즈, 선형) */
const WIND_GAIN = { skydive: 0.35, deck: 0.12, arrival: 0.015 };
/** 막별 패드 게인 — arrival만 페이드 인. 0.12 ≈ -18dB */
const PAD_GAIN = { skydive: 0, deck: 0, arrival: 0.12 };
/** 펜타토닉 화음(C 메이저 펜타토닉: C3, G3, D4) + 상대 레벨 */
const PAD_NOTES = [
  { freq: 130.81, level: 1.0, detune: 0 },
  { freq: 196.0, level: 0.7, detune: 4 },
  { freq: 293.66, level: 0.45, detune: -3 },
];
const RAMP = 1.4; // setTargetAtTime 시간상수(초) — 막 전환 페이드

/**
 * 사운드 모듈. 실패(미지원 브라우저)해도 no-op 인터페이스를 반환해
 * 호출부가 분기 없이 쓸 수 있다.
 * @returns {{ setAct(actName:string):void, setEnabled(on:boolean):void, enabled:boolean }}
 */
export function createSound() {
  const btn = ensureToggle();
  const AC = window.AudioContext || window.webkitAudioContext;

  // Web Audio 미지원 → 토글은 비활성 유지, no-op 반환
  if (!AC) {
    return { setAct() {}, setEnabled() {}, enabled: false };
  }

  let enabled = false;
  let act = "skydive";
  let gestureDone = false;
  /** @type {AudioContext|null} 첫 제스처+ON 이후에만 생성 */
  let ctx = null;
  /** @type {{master:GainNode, wind:GainNode, pad:GainNode}|null} */
  let graph = null;
  let suspendTimer = 0;

  // --- 그래프 구성 (ctx 생성 시 1회) ---
  function buildGraph() {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // 바람: 루프 화이트노이즈 → lowpass → windGain → master
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 2);
    noise.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 340;
    lowpass.Q.value = 0.8;
    const wind = ctx.createGain();
    wind.gain.value = 0;
    noise.connect(lowpass).connect(wind).connect(master);
    noise.start();
    // 돌풍 LFO: 컷오프를 ±140Hz로 천천히 흔든다
    connectLFO(ctx, 0.17, 140, lowpass.frequency);

    // 패드: 펜타토닉 오실레이터 3개 → padGain → breath(숨쉬기) → master
    const pad = ctx.createGain();
    pad.gain.value = 0;
    const breath = ctx.createGain();
    breath.gain.value = 1;
    pad.connect(breath).connect(master);
    for (const { freq, level, detune } of PAD_NOTES) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(pad);
      osc.start();
    }
    // 숨쉬기 LFO: 패드 볼륨을 ±12% 아주 느리게
    connectLFO(ctx, 0.06, 0.12, breath.gain);

    graph = { master, wind, pad };
  }

  // --- 막 게인 적용 ---
  function applyAct() {
    if (!ctx || !graph) return;
    const now = ctx.currentTime;
    graph.wind.gain.setTargetAtTime(WIND_GAIN[act] ?? 0, now, RAMP);
    graph.pad.gain.setTargetAtTime(PAD_GAIN[act] ?? 0, now, RAMP);
  }

  function start() {
    clearTimeout(suspendTimer);
    if (!ctx) {
      ctx = new AC();
      buildGraph();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    graph.master.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
    applyAct();
  }

  function stop() {
    if (!ctx || !graph) return;
    graph.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    // 페이드아웃 뒤 컨텍스트 정지(배터리/CPU 절약)
    clearTimeout(suspendTimer);
    suspendTimer = setTimeout(() => {
      if (!enabled && ctx.state === "running") ctx.suspend().catch(() => {});
    }, 900);
  }

  function setEnabled(on) {
    enabled = !!on;
    btn.setAttribute("aria-pressed", String(enabled));
    btn.textContent = enabled ? "SOUND ON" : "SOUND OFF";
    if (enabled && gestureDone) start();
    else if (!enabled) stop();
    // enabled=true인데 아직 제스처가 없으면 첫 제스처 리스너가 start()한다
  }

  function setAct(actName) {
    if (actName === act) return;
    act = actName;
    applyAct();
  }

  // --- 자동재생 정책: 첫 사용자 제스처 이후에만 오디오 시작 ---
  function onFirstGesture() {
    gestureDone = true;
    window.removeEventListener("pointerdown", onFirstGesture);
    window.removeEventListener("keydown", onFirstGesture);
    if (enabled) start();
  }
  window.addEventListener("pointerdown", onFirstGesture, { passive: true });
  window.addEventListener("keydown", onFirstGesture);

  // --- 토글 활성화 (placeholder → 실제 컨트롤) ---
  btn.disabled = false;
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", "사운드 켜기/끄기");
  btn.title = "사운드";
  btn.textContent = "SOUND OFF";
  btn.addEventListener("click", () => setEnabled(!enabled));

  return {
    setAct,
    setEnabled,
    get enabled() {
      return enabled;
    },
  };
}

/** #sound-toggle이 없으면(마크업 누락) HUD 스타일로 생성해 붙인다 */
function ensureToggle() {
  let btn = document.getElementById("sound-toggle");
  if (btn) return btn;
  btn = document.createElement("button");
  btn.id = "sound-toggle";
  btn.className = "mono";
  btn.type = "button";
  btn.textContent = "SOUND OFF";
  (document.getElementById("hud") || document.body).appendChild(btn);
  return btn;
}

/** length초짜리 화이트노이즈 루프 버퍼 */
function makeNoiseBuffer(ctx, length) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** 느린 사인 LFO를 AudioParam에 ±depth로 연결 */
function connectLFO(ctx, freq, depth, param) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = depth;
  lfo.connect(g).connect(param);
  lfo.start();
}
