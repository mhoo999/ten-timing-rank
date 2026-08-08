import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef } from "react";

// 앱인토스 콘솔에서 발급받은 운영 배너 광고그룹ID.
// 운영 ID를 개발 환경에서 노출하면 제재 대상이라, 빌드(PROD)에서만 사용하고
// dev에서는 테스트 ID를 쓴다.
const LIVE_BANNER_AD_GROUP_ID = "ait.v2.live.8b8499430e984171";
const TEST_BANNER_AD_GROUP_ID = "ait-ad-test-banner-id";

const BANNER_AD_GROUP_ID = import.meta.env.PROD
  ? LIVE_BANNER_AD_GROUP_ID
  : TEST_BANNER_AD_GROUP_ID;

/**
 * 토스 인앱 배너 광고.
 * - 토스앱/샌드박스에서만 실제로 렌더링되고, 브라우저 등 미지원 환경에서는
 *   안전하게 아무것도 표시하지 않는다(no-op).
 * - 배너는 화면 폭 100%, 높이 96px 권장.
 */
export function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!TossAds.initialize.isSupported() || !TossAds.attachBanner.isSupported()) {
      return;
    }

    // attachBanner는 광고 SDK가 로드된 뒤에만 동작한다. initialize()를 먼저 부르지
    // 않으면 "[toss-ad] Call initialize() before attaching an ad."로 throw한다.
    // initialize()는 비동기라서 onInitialized 안에서 붙여야 한다.
    let cancelled = false;
    let banner: { destroy: () => void } | undefined;

    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => {
            if (cancelled) return;
            try {
              banner = TossAds.attachBanner(BANNER_AD_GROUP_ID, el, {
                theme: "auto",
                callbacks: {
                  onNoFill: ({ adGroupId }) =>
                    console.warn("배너 광고 노출 없음(no fill):", adGroupId),
                  onAdFailedToRender: ({ adGroupId, error }) =>
                    console.error("배너 광고 렌더 실패:", adGroupId, error),
                },
              });
            } catch (error) {
              console.error("배너 광고 부착 실패:", error);
            }
          },
          onInitializationFailed: (error) =>
            console.error("광고 SDK 초기화 실패:", error),
        },
      });
    } catch (error) {
      console.error("광고 SDK 초기화 호출 실패:", error);
    }

    return () => {
      cancelled = true;
      try {
        banner?.destroy();
      } catch (error) {
        console.error("배너 광고 정리(cleanup) 실패:", error);
      }
    };
  }, []);

  return <div className="ad-banner" ref={containerRef} />;
}
