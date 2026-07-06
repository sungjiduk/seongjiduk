import { defineConfig } from "vite";

// holymoly.cloud 루트/서브패스 어디에 놓여도 동작하도록 상대 경로 빌드
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    assetsInlineLimit: 0, // GLB/오디오는 항상 파일로 (5MB 예산 추적 용이)
  },
});
