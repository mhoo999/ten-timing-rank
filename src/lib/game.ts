import { Game, Share, getSchemeUri } from "@apps-in-toss/web-framework";

/** 목표 시간: 정확히 10초 */
export const TARGET_MS = 10_000;

export interface TimingResult {
  /** 시작 ~ 멈춤까지 실제 경과 시간(ms) */
  elapsedMs: number;
  /** 목표 대비 오차(ms). 음수면 빨리 누름, 양수면 늦게 누름 */
  diffMs: number;
  /** 오차의 절댓값(ms) */
  absDiffMs: number;
  /** 리더보드 점수. 정확할수록 높음(정확히 10초 = 10000점) */
  score: number;
  /** 추정 상위 백분율(%). 작을수록 상위. 예: 8 → "상위 8%" */
  topPercent: number;
}

/**
 * 타이밍 오차로부터 "예상 상위 %"를 추정한다.
 * 토스 네이티브 리더보드는 실제 등수를 돌려주지 않으므로, 사람의 10초 체감
 * 오차 분포를 지수 CDF로 근사한 추정치다(실제 유저 분포 아님).
 * 오차가 작을수록 상위(작은 %)가 된다.
 */
export function estimateTopPercent(absDiffMs: number): number {
  const SCALE_MS = 1500; // 체감 오차 분포의 대략적 스케일
  const pct = (1 - Math.exp(-absDiffMs / SCALE_MS)) * 100;
  // 0.1% ~ 99% 사이로 제한 (완벽에 가까워도 최소 0.1%, 아무리 나빠도 99%)
  return Math.min(99, Math.max(0.1, pct));
}

/** 경과 시간으로부터 오차·점수·추정 상위%를 계산한다. */
export function computeResult(elapsedMs: number): TimingResult {
  const diffMs = elapsedMs - TARGET_MS;
  const absDiffMs = Math.abs(diffMs);
  // 오차가 작을수록 높은 점수. 리더보드는 높은 점수가 상위이므로 이렇게 변환한다.
  const score = Math.max(0, TARGET_MS - absDiffMs);
  return {
    elapsedMs,
    diffMs,
    absDiffMs,
    score,
    topPercent: estimateTopPercent(absDiffMs),
  };
}

/**
 * 추정 백분율을 사람이 읽기 좋은 등수 문자열로 포맷한다.
 * topPercent는 "나보다 정확한 사람의 비율(%)"이라, 작을수록 상위다.
 * - 상위 절반이면 "상위 X%" (예: 상위 8%)
 * - 하위 절반이면 "하위 Y%" (예: 하위 7%) — "상위 93%" 같은 혼동을 피한다.
 */
export function formatRank(topPercent: number): string {
  if (topPercent <= 50) {
    const digits = topPercent < 10 ? 1 : 0;
    return `상위 ${topPercent.toFixed(digits)}%`;
  }
  const bottom = 100 - topPercent;
  const digits = bottom < 10 ? 1 : 0;
  return `하위 ${bottom.toFixed(digits)}%`;
}

/** 초 단위 문자열로 포맷 (예: 9.83) */
export function toSeconds(ms: number, digits = 2): string {
  return (ms / 1000).toFixed(digits);
}

export interface Grade {
  emoji: string;
  label: string;
}

/** 오차 구간별 재밌는 코멘트 풀. 각 구간에서 하나를 랜덤으로 뽑는다. */
const GRADE_TIERS: { max: number; options: Grade[] }[] = [
  {
    max: 30,
    options: [
      { emoji: "🐐", label: "넌 인간 시계냐" },
      { emoji: "🎯", label: "시간의 지배자" },
      { emoji: "⏱️", label: "타이밍 만렙" },
      { emoji: "👑", label: "10초의 신 강림" },
    ],
  },
  {
    max: 100,
    options: [
      { emoji: "🔥", label: "거의 신의 영역" },
      { emoji: "😮", label: "손이 기억하나 봐요" },
      { emoji: "✨", label: "소름 돋는 감각" },
    ],
  },
  {
    max: 300,
    options: [
      { emoji: "👏", label: "감각 좋은데요?" },
      { emoji: "💪", label: "꽤 정확해요" },
      { emoji: "😎", label: "베테랑의 냄새" },
    ],
  },
  {
    max: 600,
    options: [
      { emoji: "🙂", label: "나쁘지 않아요" },
      { emoji: "👍", label: "평타는 쳤어요" },
      { emoji: "🕐", label: "무난한 편" },
    ],
  },
  {
    max: 1200,
    options: [
      { emoji: "😌", label: "그럭저럭이에요" },
      { emoji: "🤔", label: "살짝 아쉬워요" },
      { emoji: "🌀", label: "감이 흔들렸어요" },
    ],
  },
  {
    max: 2500,
    options: [
      { emoji: "😅", label: "감 잃으셨어요?" },
      { emoji: "🫠", label: "오늘은 좀…" },
      { emoji: "🐢", label: "느긋하시네요" },
    ],
  },
];

const WORST_GRADES: Grade[] = [
  { emoji: "🙈", label: "시계 보고 오세요" },
  { emoji: "💀", label: "이게 10초라고요?" },
  { emoji: "🤯", label: "우주로 가버렸어요" },
  { emoji: "🛸", label: "시간 개념 실종" },
];

/** 오차(ms)에 맞는 코멘트를 랜덤으로 하나 뽑는다. */
export function pickGrade(absDiffMs: number): Grade {
  const tier = GRADE_TIERS.find((t) => absDiffMs < t.max);
  const options = tier ? tier.options : WORST_GRADES;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * 현재 환경(토스앱)에서 게임센터 리더보드를 쓸 수 있는지 여부.
 * 브라우저 등 미지원 환경에서는 false.
 */
export function isLeaderboardSupported(): boolean {
  try {
    return (
      Game.setLeaderboardScore.isSupported() &&
      Game.openLeaderboard.isSupported()
    );
  } catch {
    return false;
  }
}

/**
 * 점수를 토스 게임센터 리더보드에 제출한다.
 * 미지원 환경이거나 실패하면 false를 반환한다.
 */
export async function submitScore(score: number): Promise<boolean> {
  try {
    if (!Game.setLeaderboardScore.isSupported()) return false;
    // score는 실수형 숫자의 "문자열"이어야 한다.
    const res = await Game.setLeaderboardScore({ score: score.toFixed(2) });
    return res != null;
  } catch (error) {
    console.error("리더보드 점수 제출 실패:", error);
    return false;
  }
}

/** 토스 게임센터 리더보드 네이티브 화면을 연다. */
export async function openLeaderboard(): Promise<void> {
  try {
    if (!Game.openLeaderboard.isSupported()) return;
    await Game.openLeaderboard();
  } catch (error) {
    console.error("리더보드 열기 실패:", error);
  }
}

/**
 * 결과를 토스 공유 시트로 공유한다. 앱을 여는 딥링크도 함께 붙인다.
 * 링크 생성이나 공유가 불가한 환경에서는 조용히 단계적으로 무시한다.
 */
export async function shareResult(result: TimingResult): Promise<void> {
  const base =
    `⏱️ 10초의 신\n` +
    `내 기록 ${toSeconds(result.elapsedMs, 4)}초 · ${formatRank(result.topPercent)}\n` +
    `너도 10초에 도전해봐!`;

  // 이 앱을 여는 intoss:// 딥링크로 공유 링크를 만든다(가능한 경우).
  let message = base;
  try {
    const path = getSchemeUri();
    const link = await Share.createLink({ path });
    if (link) message = `${base}\n${link}`;
  } catch (error) {
    console.error("공유 링크 생성 실패:", error);
  }

  try {
    await Share.sendMessage({ message });
  } catch (error) {
    console.error("공유 실패:", error);
  }
}
