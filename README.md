# Number Palace

러닝 숫자야구 프로토타입입니다. 4개 레인에서 숫자를 수집하고, 3개 숫자를 모아 비밀 조합을 추측합니다.

## 실행

브라우저에서 `index.html`을 열면 바로 실행됩니다. 정적 서버로 확인하려면:

```bash
python3 -m http.server 8000
```

그 다음 `http://localhost:8000/`을 엽니다.

## 조작

- 왼쪽/오른쪽 방향키: 레인 이동
- Space: 공중제비
- 빈 레인 통과: 부스트 스택 증가
- 숫자와 박치기: 다음 웨이브에서 현재 숫자 3개 제외, 부스트 감소

## 구조

- `src/core/`: 숫자 조합, 웨이브 생성, 점수 계산 같은 순수 게임 규칙
- `src/game/`: 게임 루프, 입력, 오디오, 효과 상태
- `src/rendering/`: canvas 렌더러
- `src/ui/`: HUD 렌더링과 CSS
- `tests/`: core 로직 테스트
- `assets/`: 추후 이미지와 사운드 에셋 보관 위치

## 검증

현재 개발 환경에 Node가 없어 macOS JavaScript for Automation으로 테스트합니다.

```bash
osascript -l JavaScript tests/game-core.test.js
```
