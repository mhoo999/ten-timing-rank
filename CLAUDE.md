# 10초의 신 (ten-timing-rank)

App-specific facts. The shared Apps in Toss playbook is in `../CLAUDE.md` — SDK rules, review blockers, and the release pipeline live there and are not repeated here.

## Identity — do not change

| | |
|---|---|
| `appName` | `10sgod` — **immutable**, matches the console registration |
| displayName | 10초의 신 |
| primaryColor | `#22C55E` (note: not the Toss blue; this app is intentionally green) |
| App type | **game** in the console; `webViewType: "game"` in `vite.config.ts`. No Game Center API is actually called — see below |
| Bundle | `10sgod.ait`, ~3.4MB — far under the 100MB cap |

Ad group IDs. Both files gate on `import.meta.env.PROD` so dev always gets the test ID — keep that gate, never let a live ID reach a dev build.

| Slot | Live | File |
|---|---|---|
| Banner | `ait.v2.live.8b8499430e984171` | `src/components/AdBanner.tsx` |
| Interstitial | `ait.v2.live.ba6fa8e609b6427e` | `src/lib/interstitialAd.ts` |

An empty live ID stays a supported state: `preloadInterstitial`/`showInterstitial` become no-ops, so a prod build ships fine and just shows no interstitial.

## Structure

- `src/App.tsx` — the whole UI. Phase machine `idle → ready → running → stopping → result → rewind → idle`, `useState`; elapsed time from `performance.now()` via `startedAtRef`. Screens are local components (`IdleScreen`, `ReadyScreen`, `RunningScreen`, `LoadingScreen`, `ResultScreen`).
- `src/lib/game.ts` — all scoring, ranking, and share logic. Pure functions + SDK wrappers that swallow failures. **Put logic here, not in App.tsx.**
- `src/lib/interstitialAd.ts` — 전면광고 preload/show 래퍼. `showInterstitial()` **never rejects** (미지원·미로드·실패·4s 타임아웃 모두 resolve) so the game loop can never stall behind an ad.
- `src/components/AdBanner.tsx` — persistent banner below `<main>`, mounted once for all phases.
- `src/App.css` — the banner needs a definite height; `.ad-banner:not(:empty) { height: 96px }` is load-bearing, see `../CLAUDE.md` §3.

### 페이즈 타이밍 — 계측 정확도가 걸려 있다

`ready`(준비… 1.0s) → `running` 진입 순간이 계측 시작이다. `startedAtRef`는 running 진입 effect에서 동기적으로 한 번 찍고 `requestAnimationFrame`에서 다시 덮어쓴다 — rAF 쪽이 "시작!"이 실제 그려지는 시점에 더 가깝고, 동기 대입은 백그라운드 탭에서 rAF가 안 뜰 때의 폴백이다. **연출 시간(준비 1.0s, 멈춤 후 스피너 0.7s, 다시하기 로딩 0.9s)은 기록에 절대 섞이면 안 된다** — `stop()`이 클릭 순간에 elapsed를 확정하기 때문. 3.0초를 눌렀을 때 결과가 2.0초로 나오는지가 이 불변식의 회귀 테스트다.

전면광고는 다시하기 **2회마다** 1회(`AD_EVERY_N_RETRIES`). 광고는 네이티브 오버레이라 그 위에 텍스트를 못 얹으므로, "시간을 되돌리는 중이에요"는 광고 직전 우리 `rewind` 화면에 뜬다. 광고가 없는 판에도 같은 로딩 화면을 거쳐 전환 흐름을 일정하게 유지한다.

## Design decisions — do not "fix" these

**No leaderboard, no score submission. Deliberate.** All Game Center code was removed: `submitScore`, `openLeaderboard`, `isLeaderboardSupported`, and the now-pointless `score` field on `TimingResult`. `src/lib/game.ts` no longer imports `Game`. Do not add a ranking screen, a "랭킹 보기" button, or score submission back. The game is a single-player loop: play → see your own result → retry or share.

`vite.config.ts` still sets `webViewType: "game"` and the console registration is still type game — left alone on purpose, since the console app type is immutable and the setting is harmless without Game APIs.

**The percentile is a local estimate, by design.** There is no server and no leaderboard, so `estimateTopPercent()` approximates the human 10-second error distribution with an exponential CDF (`SCALE_MS = 1500`) — it is not computed from real players. `formatRank()` flips to "하위 N%" past the halfway point to avoid a confusing "상위 93%". Accepted as-is; do not build a backend to make it real.

Consequence: **the app calls no Toss API except `Share` and `TossAds`.** Everything else is local, so almost all behavior is verifiable in `npm run dev` — only the banner needs a real device.

## Open items

- **[USER] 실기기 확인**: 전면광고가 실제로 뜨고 닫은 뒤 대기 화면으로 복귀하는지는 샌드박스 실기기에서만 검증 가능. dev mock은 이벤트만 흉내낸다.
- Uncommitted work in the tree: `src/App.css`, `src/components/AdBanner.tsx` (banner-height and `initialize()` fixes).
- Console-side status — review submitted, released — is not knowable from this repo. Ask the user before assuming any of it.
