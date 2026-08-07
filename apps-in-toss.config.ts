import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "ten-timing-rank",
  brand: {
    displayName: "10초의 신", // 화면에 노출될 앱의 한글 이름
    primaryColor: "#22C55E", // 화면에 노출될 앱의 기본 색상
    icon: "/app-icon.png", // 앱 아이콘. 출시용 런처 아이콘은 콘솔에서 업로드해주세요.
  },
  permissions: [],
  webBundleDir: "dist",
});
