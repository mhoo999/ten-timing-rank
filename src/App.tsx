import "./App.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdBanner } from "./components/AdBanner";
import {
  computeResult,
  formatRank,
  pickGrade,
  shareResult,
  toSeconds,
  type TimingResult,
} from "./lib/game";
import { preloadInterstitial, showInterstitial } from "./lib/interstitialAd";

type Phase = "idle" | "ready" | "running" | "result" | "rewind";

/** "준비…" 구간. */
const READY_MS = 1000;
/** "시작!" 구간. 이 구간이 끝나면서 "시작!"이 사라지는 순간이 0초다. */
const GO_MS = 600;
/** 버튼이 아래에서부터 다 차오르는 시간. 다 차는 순간이 곧 출발 신호다. */
const CHARGE_MS = READY_MS + GO_MS;
/** 결과 화면에서 등수 칸만 스피너를 돌리는 시간. 기록에는 섞이지 않는다. */
const RANK_REVEAL_MS = 700;
/** 다시하기 → (광고) → 대기 사이의 로딩 연출 시간. */
const REWIND_MS = 900;
/** 다시하기 N회마다 전면광고를 1회 노출한다. */
const AD_EVERY_N_RETRIES = 2;

function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<TimingResult | null>(null);
  // running 진입 직후 "시작!"을 덮어 보여주는 동안 true.
  const [showGo, setShowGo] = useState(false);
  const startedAtRef = useRef(0);
  const retriesRef = useRef(0);

  // 재생 시점에 로드하면 광고가 늦게 뜨므로 앱 시작과 함께 예열해둔다.
  useEffect(() => {
    preloadInterstitial();
  }, []);

  const start = useCallback(() => {
    setResult(null);
    setPhase("ready");
  }, []);

  // 준비…(1.0s) → 시작!(0.6s) → 계측 시작. 버튼 게이지가 다 차는 시점과 같다.
  useEffect(() => {
    if (phase !== "ready") return;
    const goId = setTimeout(() => setShowGo(true), READY_MS);
    const startId = setTimeout(() => {
      setShowGo(false);
      setPhase("running");
    }, CHARGE_MS);
    return () => {
      clearTimeout(goId);
      clearTimeout(startId);
    };
  }, [phase]);

  // 계측 시작 시각은 "시작!"이 사라지고 버튼이 활성화되는 순간에 맞춘다.
  // 타임아웃 콜백에서 바로 찍으면 페인트보다 한 프레임 빨라 체감과 어긋난다.
  useEffect(() => {
    if (phase !== "running") return;
    // 백그라운드 탭 등으로 rAF가 안 뜨는 경우에도 이전 판의 시각이 남지 않도록 먼저 채운다.
    startedAtRef.current = performance.now();
    const frameId = requestAnimationFrame(() => {
      startedAtRef.current = performance.now();
    });
    return () => cancelAnimationFrame(frameId);
  }, [phase]);

  const stop = useCallback(() => {
    // 기록은 누른 순간에 확정한다. 뒤따르는 연출 시간은 절대 섞이지 않는다.
    const elapsed = performance.now() - startedAtRef.current;
    setResult(computeResult(elapsed));
    setPhase("result");
  }, []);

  const retry = useCallback(() => {
    setPhase("rewind");
  }, []);

  // 로딩 연출 → (2판마다) 전면광고 → 대기 화면.
  // 연출과 광고를 동시에 돌리면 스피너가 보이기도 전에 광고가 덮으므로 순차 실행한다.
  useEffect(() => {
    if (phase !== "rewind") return;
    let cancelled = false;

    retriesRef.current += 1;
    const wantsAd = retriesRef.current % AD_EVERY_N_RETRIES === 0;

    const id = setTimeout(() => {
      void (async () => {
        if (wantsAd) await showInterstitial();
        if (cancelled) return;
        setResult(null);
        setPhase("idle");
      })();
    }, REWIND_MS);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [phase]);

  return (
    <div className="app">
      <main className="stage">
        {phase === "idle" && <IdleScreen onStart={start} />}
        {(phase === "ready" || phase === "running") && (
          <PlayScreen
            armed={phase === "running"}
            showGo={showGo}
            onStop={stop}
          />
        )}
        {phase === "result" && result != null && (
          <ResultScreen result={result} onRetry={retry} />
        )}
        {phase === "rewind" && (
          <LoadingScreen message="시간을 되돌리는 중이에요" />
        )}
      </main>
      <AdBanner />
    </div>
  );
}

function IdleScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="screen">
      <div className="hero">
        <p className="eyebrow">체감시간 챌린지</p>
        <h1 className="title">
          10초의 <span className="accent">신</span>
        </h1>
        <p className="subtitle">시계를 보지 말고 딱 10초를 세보세요.</p>
      </div>
      <button type="button" className="big-btn big-btn--start" onClick={onStart}>
        시작
      </button>
    </section>
  );
}

/**
 * 준비 → 계측을 한 화면에서 처리한다.
 * 멈춤 버튼은 준비 단계부터 비활성 상태로 자리를 잡고 아래에서부터 등속으로 차오른다.
 * 게이지가 다 차는 순간 = "시작!"이 사라지는 순간 = 버튼이 활성화되는 순간 = 0초로,
 * 셋이 모두 겹쳐 있어 사용자가 붙잡을 출발 신호가 하나뿐이다. 등속이라 도달 시점을
 * 미리 예측할 수 있는 것이 핵심 — 깜빡 나타나는 신호보다 반응 편차가 작다.
 * 두 페이즈가 같은 컴포넌트를 쓰므로 버튼 DOM이 유지돼 위치도 흔들리지 않는다.
 */
function PlayScreen({
  armed,
  showGo,
  onStop,
}: {
  armed: boolean;
  showGo: boolean;
  onStop: () => void;
}) {
  return (
    <section className="screen">
      <div className="hero play-hero">
        {!armed ? (
          showGo ? (
            <p className="count-go">시작!</p>
          ) : (
            <p className="count-ready">준비…</p>
          )
        ) : (
          <div>
            <p className="eyebrow eyebrow--live">● 재는 중</p>
            <h2 className="running-guide">
              마음속으로 <b>10초</b>를 세고
              <br />
              정확한 순간 멈추세요
            </h2>
          </div>
        )}
      </div>
      <button
        type="button"
        className="big-btn big-btn--stop"
        onClick={onStop}
        disabled={!armed}
      >
        {/* 게이지는 충전 중일 때만 붙인다. 애니메이션 길이는 CHARGE_MS 단일 소스에서 온다. */}
        {!armed && (
          <span
            className="big-btn-fill"
            style={{ animationDuration: `${CHARGE_MS}ms` }}
            aria-hidden="true"
          />
        )}
        <span className="big-btn-label">멈춰!</span>
      </button>
    </section>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <section className="screen screen--center">
      <span className="spinner" aria-hidden="true" />
      <p className="loading-text" role="status">
        {message}
      </p>
    </section>
  );
}

function ResultScreen({
  result,
  onRetry,
}: {
  result: TimingResult;
  onRetry: () => void;
}) {
  const early = result.diffMs < 0;
  // 결과당 한 번만 뽑아 리렌더에도 문구가 바뀌지 않게 한다.
  const verdict = useMemo(() => pickGrade(result.absDiffMs), [result]);
  // 기록은 즉시 보여주고 등수 칸만 잠깐 스피너를 돌린다.
  const [rankReady, setRankReady] = useState(false);

  useEffect(() => {
    setRankReady(false);
    const id = setTimeout(() => setRankReady(true), RANK_REVEAL_MS);
    return () => clearTimeout(id);
  }, [result]);

  return (
    <section className="screen">
      <div className="result-card">
        {/* 1) 버튼을 누른 순간의 실제 시간 (0.0001초 단위) */}
        <div className="result-elapsed">
          <span className="result-elapsed-num">{toSeconds(result.elapsedMs, 4)}</span>
          <span className="result-elapsed-unit">초</span>
        </div>
        <p className={`result-diff ${early ? "is-early" : "is-late"}`}>
          {result.absDiffMs < 0.5
            ? "완벽해요!"
            : `10초보다 ${toSeconds(result.absDiffMs, 4)}초 ${early ? "빨랐어요" : "늦었어요"}`}
        </p>

        {/* 2) 추정 상위/하위 % — 잠깐 스피너를 돌린 뒤 공개한다 */}
        <div className="result-rank">
          {rankReady ? (
            <>
              <span className="result-rank-value">
                {formatRank(result.topPercent)}
              </span>
              <span className="result-rank-caption">
                {verdict.emoji} {verdict.label}
              </span>
            </>
          ) : (
            <span className="spinner" aria-label="등수 계산 중" role="status" />
          )}
        </div>
      </div>

      {/* 3) 다시하기 · 공유하기 */}
      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          다시하기
        </button>
        <button
          type="button"
          className="btn btn--sub"
          onClick={() => void shareResult(result)}
        >
          공유하기
        </button>
      </div>
    </section>
  );
}

export default App;
