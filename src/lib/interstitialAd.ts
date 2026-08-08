import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";

// 앱인토스 콘솔에서 발급받은 운영 전면광고 그룹ID.
// 운영 ID를 개발 환경에 노출하면 제재 대상이라 PROD에서만 사용한다.
// 빈 문자열이면 preload/show 모두 조용히 no-op이 되도록 아래에서 가드한다.
const LIVE_INTERSTITIAL_AD_GROUP_ID = "ait.v2.live.ba6fa8e609b6427e";
const TEST_INTERSTITIAL_AD_GROUP_ID = "ait-ad-test-interstitial-id";

const AD_GROUP_ID = import.meta.env.PROD
  ? LIVE_INTERSTITIAL_AD_GROUP_ID
  : TEST_INTERSTITIAL_AD_GROUP_ID;

/** 네이티브가 아무 이벤트도 주지 않는 경우에도 화면이 갇히지 않도록 하는 안전장치(ms). */
const SHOW_TIMEOUT_MS = 4000;

type AdState = "idle" | "loading" | "ready" | "failed";

let state: AdState = "idle";

/**
 * 전면광고를 미리 불러온다.
 * 정책상 재생 시점에 로드하면 안 되므로 앱 시작 시 한 번, 그리고 광고를 소비할
 * 때마다 다음 광고를 다시 예열한다. 중복 호출은 상태로 막는다.
 */
export function preloadInterstitial(): void {
  if (!AD_GROUP_ID) return;
  if (state === "loading" || state === "ready") return;
  if (!loadFullScreenAd.isSupported()) return;

  state = "loading";
  try {
    loadFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === "loaded") state = "ready";
      },
      onError: (error) => {
        state = "failed";
        console.error("전면광고 로드 실패:", error);
      },
    });
  } catch (error) {
    state = "failed";
    console.error("전면광고 로드 호출 실패:", error);
  }
}

/**
 * 미리 불러온 전면광고를 노출한다.
 * 게임 흐름이 광고 때문에 멈추면 안 되므로 **절대 reject하지 않는다**.
 * 미지원·미로드·실패·타임아웃 모두 resolve한다.
 */
export function showInterstitial(): Promise<void> {
  if (!AD_GROUP_ID) return Promise.resolve();
  if (state !== "ready") return Promise.resolve();
  if (!showFullScreenAd.isSupported()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
      try {
        unsubscribe?.();
      } catch (error) {
        console.error("전면광고 구독 해제 실패:", error);
      }
      // 방금 쓴 광고는 소진됐으니 다음 판을 위해 다시 예열한다.
      state = "idle";
      preloadInterstitial();
      resolve();
    };

    timeoutId = setTimeout(() => {
      console.warn("전면광고 응답 없음, 타임아웃으로 진행합니다.");
      finish();
    }, SHOW_TIMEOUT_MS);

    try {
      unsubscribe = showFullScreenAd({
        options: { adGroupId: AD_GROUP_ID },
        onEvent: (event) => {
          if (event.type === "dismissed" || event.type === "failedToShow") {
            finish();
            return;
          }
          console.log("전면광고 이벤트:", event.type);
        },
        onError: (error) => {
          console.error("전면광고 노출 실패:", error);
          finish();
        },
      });
    } catch (error) {
      console.error("전면광고 노출 호출 실패:", error);
      finish();
    }
  });
}
