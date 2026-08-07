import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import aitDevtools from "@apps-in-toss/devtools/unplugin";

export default defineConfig({
  plugins: [
    // 앱인토스 devtools: 브라우저에서 SDK를 mock하고 devtools 패널을 제공한다.
    // webViewType: 'game' → 게임 모드로 진입해 게임센터 리더보드 API를 사용할 수 있다.
    aitDevtools.vite({ webViewType: "game" }),
    react(),
  ],
});
