<!-- 작성: 2026-09-26 01:42 KST -->
# 웹 버전 / 데스크톱 버전 분리 설계

## 목표

손글씨 숫자 인식 프로그램을 두 버전으로 나눈다.

- **desktop_version**: 기존 PyTorch 학습 코드와 tkinter GUI를 그대로 옮긴다. 학습과 가중치의 원본이다.
- **web_version**: 외부 라이브러리 없이 순수 자바스크립트로 추론하는 정적 웹 앱을 새로 만든다. GitHub Pages에 그대로 올릴 수 있어야 한다.
- 각 폴더와 저장소 루트에 역할에 맞는 `CLAUDE.md`를 둔다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| GitHub Pages 첫 화면 | 루트 `index.html`(학번·이름 소개 페이지)은 그대로 두고 "웹 버전 실행하기" 링크만 추가한다. Pages 설정(`master` / 루트)은 바꾸지 않는다. 웹 앱 주소는 `https://hannah0326.github.io/Study01_MNIST/web_version/` |
| 가중치 형식 | float32 바이트를 base64로 인코딩해 `weights.js`에 넣는다. `<script>`로 읽으므로 file://로 열어도, Pages에서 열어도 동작한다 |
| 웹 화면 범위 | 데스크톱 `app.py`와 같은 기능에 터치 입력 지원을 더한다 |
| 구현 방식 | 모듈 분리 + 파이썬 기준값과 대조하는 테스트. 전처리는 캔버스 스무딩에 맡기지 않고 JS로 직접 구현한다 |
| 작업 브랜치 | `feature/web-desktop-split` |

## 1. 폴더 구조

```
Study01_MNIST/
├── index.html              # 기존 소개 페이지 + "웹 버전 실행하기" 링크
├── CLAUDE.md               # 저장소 개요와 공통 규칙
├── CLAUDE_전역.md          # 변경 없음
├── .gitignore              # desktop_version/data/ 등 이동한 경로 반영
├── docs/superpowers/       # 설계·계획 문서
├── desktop_version/
│   ├── CLAUDE.md
│   ├── model.py  preprocess.py  train.py  app.py  mnist_cnn.pt   # git mv로 이동 (이력 보존)
│   ├── export_web.py       # 새로 작성: 웹용 가중치·기준 데이터 생성
│   └── data/               # (git 제외) MNIST 원본. 로컬 폴더도 함께 옮긴다
└── web_version/
    ├── CLAUDE.md
    ├── index.html  style.css
    ├── preprocess.js  model.js  app.js
    ├── weights.js          # 자동 생성
    └── tests/
        ├── tests.html  tests.js
        └── reference.js    # 자동 생성
```

- `train.py`와 `app.py`는 `mnist_cnn.pt`와 `./data`를 현재 작업 폴더 기준으로 찾는다. 폴더를 옮기면서 실행 위치에 따라 경로가 깨지지 않도록 `Path(__file__).parent` 기준으로 바꾼다. 경로와 관련된 부분 외에는 데스크톱 코드를 수정하지 않는다.
- `mnist_cnn.pt`는 계속 git으로 관리한다. 웹 가중치를 다시 만들 때 원본으로 쓴다.

## 2. 가중치 내보내기 (`desktop_version/export_web.py`)

- `MnistCNN()`을 만들고 `mnist_cnn.pt`를 `load_state_dict`로 불러온다.
- `state_dict`의 텐서 8개를 아래 순서대로 float32 리틀엔디언 바이트로 이어 붙인다.
  `conv1.weight [32,1,3,3]`, `conv1.bias [32]`, `conv2.weight [64,32,3,3]`, `conv2.bias [64]`, `fc1.weight [128,3136]`, `fc1.bias [128]`, `fc2.weight [10,128]`, `fc2.bias [10]`
- 결과는 `../web_version/weights.js`에 저장한다. 파일에는 전역 변수 하나를 둔다. 값은 목차 `[{이름, 형태, 시작}]`(시작은 float 개수 기준 위치)와 base64 문자열로 이루어진다. 파일 맨 위에는 생성 시각(KST)과 "자동 생성 파일이니 직접 고치지 말 것"이라는 주석을 넣는다.
- 같은 실행에서 `../web_version/tests/reference.js`에 기준 데이터도 만든다.
  - **전처리 사례**: PIL로 280×280 검은 판에 굵기 22 흰 선으로 그린 손글씨 모양 몇 장과, 그 이미지를 `preprocess.모델_입력_이미지_만들기`에 넣은 28×28 결과. 여기에 가운데에서 벗어난 획, 가로로 긴 획, 점 하나 같은 경계 사례를 포함한다.
  - **추론 사례**: `desktop_version/data`의 MNIST 테스트 이미지 몇 장(28×28 원본 픽셀), 정답, PyTorch 로짓.
  - 이미지는 모두 uint8 바이트를 base64로 인코딩해 저장한다.

## 3. 추론 (`web_version/model.js`)

- 순전파만 구현한다. `합성곱(3×3, 패딩 1) → ReLU → 2×2 맥스풀 → 합성곱 → ReLU → 맥스풀 → 펼치기 → 전결합(3136→128) → ReLU → 전결합(128→10)`
- 펼치기는 채널·세로·가로(C·H·W) 순서로, `torch.flatten(x, 1)`과 같다.
- 드롭아웃은 추론할 때 아무 일도 하지 않으므로 생략한다.
- 층마다 순수 함수(`합성곱2d`, `맥스풀2x2`, `전결합`, `ReLU`, `소프트맥스`)로 나눠 따로 테스트할 수 있게 한다.
- 정규화 상수(평균 0.1307 / 표준편차 0.3081)는 `preprocess.py`와 같은 값을 JS 상수로 둔다.
- base64를 `Float32Array`로 복원한 뒤, 목차의 형태를 곱한 크기가 전체 길이와 맞지 않으면 예외를 던진다.
- 계산량은 곱셈 약 400만 번이라 메인 스레드에서 바로 계산한다. Web Worker는 쓰지 않는다.

## 4. 전처리 (`web_version/preprocess.js`)

입력은 280×280 흑백 `Uint8ClampedArray`로, 캔버스 `getImageData`의 R 채널이다. `preprocess.py`와 같은 네 단계를 거친다.

1. 밝기가 30을 넘는 픽셀의 경계 상자를 구해 잘라낸다. 글씨가 없으면 `null`을 돌려준다.
2. 가로세로 비율을 유지한 채 긴 변이 20px이 되도록 줄인다. 새 크기는 `max(1, round(변 × 배율))`이다. 축소는 **PIL과 같은 방식의 Lanczos(a=3)** 로 구현한다. 축소할 때 커널 폭을 배율만큼 늘리고, 가로 → 세로 순서로 따로 계산하며, 두 단계 사이에서 8비트로 반올림한다.
3. 28×28 검은 판의 `((28−w)//2, (28−h)//2)` 위치에 붙인다.
4. 무게중심을 판의 중심 13.5로 옮긴다. **PIL `AFFINE` + `BILINEAR`** 와 같은 방식으로 구현한다. 출력 픽셀 중심(+0.5)을 입력 좌표로 옮긴 뒤 −0.5 해서 쌍선형 보간하고, 판 밖은 0으로 채운다.

출력은 28×28 `Uint8ClampedArray`이고, 정규화된 `Float32Array`로 바꾸는 함수를 따로 둔다.

## 5. 화면 (`index.html` / `style.css` / `app.js`)

- 헤더 "2601951 신한나"는 루트 소개 페이지와 같은 스타일로 맞춘다.
- 왼쪽: 280×280 검은 캔버스(흰 펜, 굵기 22, 둥근 끝), [인식하기]·[지우기] 버튼, "펜을 떼면 자동으로 인식합니다" 안내.
- 오른쪽: 인식 결과 숫자(크게), 확신도 %, 숫자별 확률 막대 10개(1위만 `#2563eb`, 나머지는 `#d1d5db`), 모델 입력 28×28 미리보기(4배 확대, `image-rendering: pixelated`).
- 입력은 Pointer Events(`pointerdown/move/up/cancel`)로 받아 마우스·터치·펜을 모두 처리한다. 캔버스에 `touch-action: none`을 준다. CSS 크기가 달라져도 좌표를 캔버스 내부 좌표 280×280으로 변환한다.
- 폭이 좁은 화면에서는 좌우 배치를 위아래 배치로 바꾼다.
- 스크립트는 `weights.js → preprocess.js → model.js → app.js` 순서로 읽는 일반 `<script>`다. ES 모듈은 file://에서 막히므로 쓰지 않는다.
- **오류 처리**: 가중치가 없거나 복원에 실패하면 결과 영역에 "가중치 파일을 불러오지 못했습니다. desktop_version/export_web.py를 실행하세요."를 표시하고 캔버스와 버튼을 비활성화한다.

## 6. 테스트

Node.js가 설치되어 있지 않으므로 브라우저에서 테스트한다.

- `web_version/tests/tests.html`: 직접 만든 작은 테스트 실행기(외부 라이브러리 없음)로 통과·실패 목록과 개수를 화면에 표시한다.
- **단위 테스트**: 손으로 계산한 작은 예제로 `합성곱2d`(패딩 포함), `맥스풀2x2`, `전결합`, `소프트맥스`, base64 → Float32 복원, 경계 상자 계산, 빈 입력 → `null`을 확인한다.
- **대조 테스트** (`reference.js` 사용)
  - 전처리: 같은 280×280 입력에서 파이썬 결과와 픽셀별 절대 차이가 **2 이하**여야 한다.
  - 추론: 같은 28×28 입력에서 PyTorch 로짓과 절대 차이가 **1e-3 이하**이고, 예측 숫자가 완전히 같아야 한다.
- 수동 확인: 앱 내장 브라우저로 `web_version/index.html`을 열어 숫자를 직접 그리고, 좁은 화면 배치도 확인한다.
- 데스크톱 확인: 이동한 뒤 저장소 루트에서 `desktop_version/app.py`의 모델 로드 경로와 `train.py`의 데이터 경로가 올바르게 잡히는지, 모듈 import와 가중치 로드 수준에서 점검한다. 15 에폭 재학습은 하지 않는다.

## 7. CLAUDE.md 구성

- **루트 `CLAUDE.md`**: 저장소 개요, 두 버전의 관계(desktop이 원본이고 web은 내보낸 결과물), 가중치 갱신 순서(`train.py` → `export_web.py` → 커밋), GitHub Pages 주소, 한국어·KST 주석 규칙.
- **`desktop_version/CLAUDE.md`**: 기존 루트 내용(명령어, 실제 Python 경로, 스마트 앱 제어 주의, 모듈 구조, state_dict 로드 방법)에 `export_web.py` 설명을 더한다.
- **`web_version/CLAUDE.md`**: 외부 라이브러리 금지, 스크립트 로딩 순서, 파일별 역할, `weights.js`/`reference.js`는 자동 생성 파일이라는 점, 파이썬 전처리와 일치해야 한다는 약속, 테스트 방법.

## 범위 밖

- 웹에서 학습하기, WebGL/WebGPU 가속, 가중치 양자화, 층별 특징맵 시각화.
- 데스크톱 코드의 기능 변경(경로 수정만 한다).
