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

배너(`AdBanner.tsx`)와 전면광고(`interstitialAd.ts`) 모두 `import.meta.env.PROD`로 운영/테스트 ID를 가른다. **그 게이트를 유지할 것 — 운영 ID가 dev 빌드에 닿으면 제재 대상이다.** 전면광고는 운영 ID가 빈 문자열이어도 정상 동작한다(preload/show가 no-op).

## Structure

- `src/App.tsx` — the whole UI. 페이즈 머신과 화면 컴포넌트가 전부 여기 있다.
- `src/lib/game.ts` — all scoring, ranking, and share logic. Pure functions + SDK wrappers that swallow failures. **Put logic here, not in App.tsx.**
- `src/lib/interstitialAd.ts` — 전면광고 preload/show 래퍼.
- `src/components/AdBanner.tsx` — persistent banner below `<main>`, mounted once for all phases.
- `src/App.css` — the banner needs a definite height; `.ad-banner:not(:empty) { height: 96px }` is load-bearing, see `../CLAUDE.md` §3.

## Design decisions — do not "fix" these

**No leaderboard, no score submission. Deliberate.** All Game Center code was removed: `submitScore`, `openLeaderboard`, `isLeaderboardSupported`, and the now-pointless `score` field on `TimingResult`. `src/lib/game.ts` no longer imports `Game`. Do not add a ranking screen, a "랭킹 보기" button, or score submission back. The game is a single-player loop: play → see your own result → retry or share.

`vite.config.ts` still sets `webViewType: "game"` and the console registration is still type game — left alone on purpose, since the console app type is immutable and the setting is harmless without Game APIs.

**The percentile is a local estimate, by design.** There is no server and no leaderboard, so `estimateTopPercent()` approximates the human 10-second error distribution with an exponential CDF (`SCALE_MS = 1500`) — it is not computed from real players. `formatRank()` flips to "하위 N%" past the halfway point to avoid a confusing "상위 93%". Accepted as-is; do not build a backend to make it real.

Consequence: **the app calls no Toss API except `Share` and `TossAds`.** Everything else is local, so almost all behavior is verifiable in `npm run dev` — only the banner needs a real device.

## Open items

- **[USER] 실기기 확인**: 전면광고가 실제로 뜨고 닫은 뒤 대기 화면으로 복귀하는지는 샌드박스 실기기에서만 검증 가능. dev mock은 이벤트만 흉내낸다.
- Console-side status — review submitted, released — is not knowable from this repo. Ask the user before assuming any of it.
