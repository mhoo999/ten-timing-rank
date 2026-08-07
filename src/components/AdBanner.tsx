import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef } from "react";

// TODO: 서비스 출시 전에 앱인토스 콘솔에서 발급한 배너 광고그룹ID로 교체해주세요.
const TEST_BANNER_AD_GROUP_ID = "ait-ad-test-banner-id";

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

    let banner: { destroy: () => void } | undefined;
    try {
      if (!TossAds.attachBanner.isSupported()) return;
      banner = TossAds.attachBanner(TEST_BANNER_AD_GROUP_ID, el, {
        theme: "auto",
      });
    } catch (error) {
      console.error("배너 광고 부착 실패:", error);
    }

    return () => {
      try {
        banner?.destroy();
      } catch (error) {
        console.error("배너 광고 정리(cleanup) 실패:", error);
      }
    };
  }, []);

  return <div className="ad-banner" ref={containerRef} />;
}
