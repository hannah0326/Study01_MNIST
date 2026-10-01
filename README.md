<!-- 작성: 2026-10-01 12:36 KST -->
# MNIST 손글씨 숫자 인식

**2601951 신한나**

PyTorch CNN으로 MNIST를 학습하고, 직접 그린 손글씨 숫자를 인식하는 프로젝트입니다. 같은 모델을 두 가지 방식으로 실행합니다.

- **웹 버전 바로 실행:** https://hannah0326.github.io/Study01_MNIST/web_version/
- **소개 페이지:** https://hannah0326.github.io/Study01_MNIST/

## 두 가지 버전

| | 웹 버전 (`web_version/`) | 데스크톱 버전 (`desktop_version/`) |
|---|---|---|
| 실행 환경 | 브라우저 (설치 없음, 휴대폰 터치 지원) | Python + PyTorch + tkinter |
| 추론 | 외부 라이브러리 없이 순수 자바스크립트로 계산 | PyTorch |
| 역할 | GitHub Pages로 배포되는 정적 웹 앱 | 모델 학습, 가중치(`mnist_cnn.pt`)의 원본 |

두 버전 모두 캔버스에 숫자를 그리고 펜(마우스)을 떼면 자동으로 인식합니다. 화면에는 인식 결과, 확신도, 숫자별 확률 막대, 모델에 실제로 들어가는 28×28 입력이 표시됩니다.

### 모델

`MnistCNN`: 합성곱 1→32→64채널(3×3, 패딩 1), 2×2 맥스풀 2번, 드롭아웃, 완전연결 64·7·7→128→10. 마우스로 그린 숫자에 대비해 이동·회전·크기·기울기·획 굵기 데이터 증강을 쓰며 15 에폭 학습합니다.

### 전처리

캔버스 전체를 그냥 28×28로 줄이면 인식률이 크게 떨어집니다. 그래서 MNIST 데이터와 같은 모양으로 맞춥니다.

1. 글씨가 있는 영역만 잘라냅니다.
2. 긴 변이 20픽셀이 되도록 줄입니다(Lanczos).
3. 28×28 판 한가운데에 놓습니다.
4. 무게중심이 판의 중심에 오도록 옮깁니다.

웹 버전의 `preprocess.js`는 파이썬(PIL)의 이 과정을 픽셀 단위로 똑같이 재현합니다.

## 실행 방법

### 웹 버전

- 위의 웹 버전 주소로 접속하면 바로 사용할 수 있습니다.
- 저장소를 내려받았다면 `web_version/index.html`을 브라우저로 열어도 됩니다.
- 테스트는 `web_version/tests/tests.html`을 브라우저로 열면 실행됩니다. 단위 테스트와 파이썬·PyTorch 결과 대조 테스트가 있으며, 제목에 "통과 N / 실패 M"이 표시됩니다.

### 데스크톱 버전

필요한 패키지: `torch`, `torchvision`, `pillow`, `numpy`

```bash
python desktop_version/train.py        # MNIST를 내려받아 학습하고 mnist_cnn.pt 저장
python desktop_version/app.py          # 숫자를 그려 인식하는 tkinter 프로그램 실행
python desktop_version/export_web.py   # 가중치를 web_version/weights.js로 내보내고 웹 테스트 기준 데이터 생성
```

경로는 스크립트 위치를 기준으로 잡으므로 어느 폴더에서 실행해도 됩니다.

## 웹 버전이 가중치를 받는 방법

1. `desktop_version/train.py`가 학습한 가중치를 `mnist_cnn.pt`로 저장합니다.
2. `desktop_version/export_web.py`가 이를 base64로 인코딩한 float32 값으로 바꿔 `web_version/weights.js`에 씁니다.
3. 웹 버전은 이 파일을 `<script>`로 읽어 순수 자바스크립트로 순전파를 계산합니다.

그래서 서버 없이 정적 파일만으로 GitHub Pages에서 동작하고, 내려받은 파일을 더블클릭해 열어도 동작합니다. 모델을 다시 학습했다면 `export_web.py`를 다시 실행해야 웹 버전에 반영됩니다.

## 폴더 구조

```
├── index.html            # GitHub Pages 소개 페이지
├── CLAUDE.md             # 저장소 전체 안내 (Claude Code용)
├── CLAUDE_전역.md        # 전역 작업 지침
├── desktop_version/      # PyTorch 학습·tkinter 프로그램, export_web.py, CLAUDE.md
├── web_version/          # 웹 앱(index.html, app.js, model.js, preprocess.js, weights.js), tests/, CLAUDE.md
└── docs/superpowers/     # 웹·데스크톱 분리 설계 문서와 구현 계획
```

각 폴더의 `CLAUDE.md`에 파일별 역할과 작업 규칙이 자세히 적혀 있습니다.
