<!-- 작성: 2026-09-26 02:40 KST -->
# web_version

외부 라이브러리 없이 순수 자바스크립트로 MNIST CNN 추론을 하는 정적 웹 앱이다. 빌드 단계 없이 GitHub Pages(https://hannah0326.github.io/Study01_MNIST/web_version/)에 그대로 배포된다. 저장소 공통 규칙은 루트 [CLAUDE.md](../CLAUDE.md)를 본다.

## 원칙

- 외부 라이브러리·CDN·빌드 도구·ES 모듈을 쓰지 않는다. `index.html`을 file://로 열어도 동작해야 하기 때문이다.
- 각 JS 파일은 IIFE로 감싸고 전역 객체 하나만 내보낸다: `window.MNIST_가중치`(weights.js), `window.전처리`(preprocess.js), `window.모델`(model.js).
- 스크립트 로딩 순서: `weights.js → preprocess.js → model.js → app.js`

## 파일

- [weights.js](weights.js) — **자동 생성, 직접 수정 금지.** `desktop_version/export_web.py`가 만든다. `window.MNIST_가중치 = {목차: [{이름, 형태, 시작}], 데이터: base64}`이고, 데이터는 float32 리틀엔디언이다.
- [preprocess.js](preprocess.js) — `desktop_version/preprocess.py`와 같은 전처리(자르기 → 긴 변 20px Lanczos 축소 → 28×28 중앙 배치 → 무게중심 BILINEAR 이동)와 정규화(평균 0.1307 / 표준편차 0.3081).
- [model.js](model.js) — base64 가중치 복원과 `MnistCNN` 순전파(합성곱 → ReLU → 맥스풀 ×2 → 전결합 ×2). 텐서 이름·순서·형태는 `export_web.py`의 `텐서_순서`, `model.py`와 같아야 한다.
- [app.js](app.js), [index.html](index.html), [style.css](style.css) — 캔버스 화면. Pointer Events로 마우스·터치를 함께 처리하며, 펜을 떼면 자동으로 인식한다. 색과 배치는 데스크톱 `app.py`와 맞춘다.
- [tests/](tests/) — `tests.html`(열면 실행), `tests.js`(실행기와 테스트), `reference.js`(**자동 생성**, 파이썬 전처리 결과와 PyTorch 로짓).

## 파이썬과의 약속

- `preprocess.js`는 PIL의 `resize(LANCZOS)`(고정소수점 22비트, 가로 → 세로 순서, 중간 8비트 반올림)와 `transform(AFFINE, BILINEAR)`(소수점 버림)를 픽셀 단위로 재현한다. 파이썬 `round()`의 짝수 반올림도 `파이썬_반올림`으로 맞춘다. 캔버스 `drawImage` 스무딩으로 바꾸지 않는다(브라우저마다 결과가 다르다).
- 대조 허용 오차: 전처리 픽셀 차이 ≤ 2(실제로는 0), 로짓 차이 ≤ 1e-3, 예측 숫자는 완전히 일치.
- 파이썬 쪽 모델이나 전처리를 바꾸면 JS도 함께 바꾸고 `python desktop_version/export_web.py`로 기준 데이터를 다시 만든다.

## 테스트

Node.js가 없으므로 브라우저에서 돌린다. 저장소 루트에서 로컬 서버를 띄우고(`python -m http.server 8000`) http://localhost:8000/web_version/tests/tests.html 을 연다. file://로 열어도 된다. 페이지 제목과 상단에 "통과 N / 실패 M"이 표시되고, `window.테스트_결과`에 `{통과, 실패, 실패_목록}`이 들어간다. 화면 확인은 http://localhost:8000/web_version/ 에서 한다.
