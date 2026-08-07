import "./App.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdBanner } from "./components/AdBanner";
import {
  computeResult,
  formatRank,
  pickGrade,
  shareResult,
  submitScore,
  toSeconds,
  type TimingResult,
} from "./lib/game";

type Phase = "idle" | "running" | "result";

function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<TimingResult | null>(null);
  const startedAtRef = useRef(0);

  const start = useCallback(() => {
    startedAtRef.current = performance.now();
    setResult(null);
    setPhase("running");
  }, []);

  const stop = useCallback(() => {
    const elapsed = performance.now() - startedAtRef.current;
    setResult(computeResult(elapsed));
    setPhase("result");
  }, []);

  const retry = useCallback(() => {
    setPhase("idle");
    setResult(null);
  }, []);

  // 결과가 나오면 조용히 토스 게임센터 리더보드에 점수를 제출한다.
  // (미지원 환경에서는 내부적으로 no-op)
  useEffect(() => {
    if (phase !== "result" || result == null) return;
    void submitScore(result.score);
  }, [phase, result]);

  return (
    <div className="app">
      <main className="stage">
        {phase === "idle" && <IdleScreen onStart={start} />}
        {phase === "running" && <RunningScreen onStop={stop} />}
        {phase === "result" && result != null && (
          <ResultScreen result={result} onRetry={retry} />
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

function RunningScreen({ onStop }: { onStop: () => void }) {
  return (
    <section className="screen">
      <div className="hero">
        <p className="eyebrow eyebrow--live">● 재는 중</p>
        <h2 className="running-guide">
          마음속으로 <b>10초</b>를 세고
          <br />
          정확한 순간 멈추세요
        </h2>
      </div>
      <button
        type="button"
        className="big-btn big-btn--stop"
        onClick={onStop}
      >
        멈춰!
      </button>
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

        {/* 2) 추정 상위/하위 % */}
        <div className="result-rank">
          <span className="result-rank-value">{formatRank(result.topPercent)}</span>
          <span className="result-rank-caption">
            {verdict.emoji} {verdict.label}
          </span>
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
