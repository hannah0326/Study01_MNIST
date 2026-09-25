<!-- 작성: 2026-09-26 01:49 KST -->
# 웹/데스크톱 버전 분리 구현 계획

> **에이전트 작업자용:** 필수 하위 스킬: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans로 이 계획을 작업 단위로 실행한다. 각 단계는 체크박스(`- [ ]`)로 진행 상황을 표시한다.

**목표:** 기존 PyTorch/tkinter 코드를 `desktop_version/`으로 옮기고, 외부 라이브러리 없이 순수 JS로 추론하는 정적 웹 앱 `web_version/`을 새로 만든다.

**구조:** 데스크톱 쪽의 `export_web.py`가 `mnist_cnn.pt`를 base64 float32 `weights.js`로 내보낸다. 이때 파이썬 전처리 결과와 PyTorch 로짓을 담은 기준 데이터 `reference.js`도 함께 만든다. 웹 쪽의 `preprocess.js`는 PIL LANCZOS/AFFINE BILINEAR를 픽셀 단위로 재현하고, `model.js`는 CNN 순전파를 구현하며, `app.js`는 캔버스 화면을 맡는다. 브라우저 테스트 페이지는 JS 결과를 기준 데이터와 대조한다.

**기술 스택:** Python 3.12 + PyTorch 2.14(CPU)·torchvision·Pillow·NumPy(데스크톱·내보내기), 바닐라 HTML/CSS/JS(웹, 라이브러리 없음)

**스펙:** `docs/superpowers/specs/2026-09-26-web-desktop-split-design.md`

## 공통 제약

- 저장소에 올라가는 모든 텍스트(코드 주석, 문서, 커밋 메시지)는 한국어로 쓴다. 코드 식별자·명령어·고유명사는 예외다. 기존 파이썬 코드처럼 **식별자도 한국어**를 쓴다.
- **새로 만드는 파일**에는 첫 줄(HTML은 `<!DOCTYPE html>` 다음 줄)에 KST 작성 시각 주석을 단다. 형식은 `# 작성: YYYY-MM-DD HH:MM KST`(파이썬), `// 작성: ... KST`(JS), `/* 작성: ... KST */`(CSS), `<!-- 작성: ... KST -->`(HTML·MD)이다. 계획의 코드에 적힌 `{KST}`는 파일을 만들 때 아래 명령으로 얻은 실제 시각으로 바꾼다. Git Bash의 `TZ=Asia/Seoul`은 동작하지 않으므로 쓰지 않는다.
  ```bash
  powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'Korea Standard Time').ToString('yyyy-MM-dd HH:mm')"
  ```
- 파이썬 실행 파일은 `C:/Users/shinh/AppData/Local/Programs/Python/Python312/python.exe`이다. PATH의 `python`은 스토어 더미일 수 있다. 한글 출력이 깨지지 않도록 `PYTHONUTF8=1`을 붙인다. 아래에서는 이를 `$PY`로 적는다.
  ```bash
  PY="C:/Users/shinh/AppData/Local/Programs/Python/Python312/python.exe"; export PYTHONUTF8=1
  ```
- 웹 버전은 외부 라이브러리·CDN·빌드 도구·ES 모듈을 쓰지 않는다. 각 JS 파일은 IIFE로 감싸고 전역 객체 하나만 내보낸다(`window.전처리`, `window.모델`, `window.MNIST_가중치`, `window.기준_데이터`).
- Node.js가 없으므로 JS 테스트는 브라우저(`web_version/tests/tests.html`)에서 돌린다.
- 대조 허용 오차: 전처리는 픽셀 절대 차이 ≤ 2, 로짓은 절대 차이 ≤ 1e-3, 예측 숫자는 완전히 일치해야 한다.
- 작업 브랜치는 `feature/web-desktop-split`이다(이미 만들어져 있음). 커밋 메시지 끝에는 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`을 붙인다.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `desktop_version/{model,preprocess,train,app}.py`, `mnist_cnn.pt` | 루트에서 `git mv`. 경로 상수만 스크립트 위치 기준으로 수정 |
| `desktop_version/export_web.py` | 가중치 → `web_version/weights.js`, 기준 데이터 → `web_version/tests/reference.js` |
| `desktop_version/CLAUDE.md` | 데스크톱 버전 안내 |
| `web_version/preprocess.js` | `window.전처리`: PIL과 같은 전처리 + 정규화 |
| `web_version/model.js` | `window.모델`: base64 가중치 복원, 층 함수, 순전파 |
| `web_version/app.js`, `index.html`, `style.css` | 캔버스 화면 |
| `web_version/tests/tests.html`, `tests.js` | 브라우저 테스트 실행기와 테스트 |
| `web_version/CLAUDE.md` | 웹 버전 안내 |
| `CLAUDE.md`(루트), `index.html`(루트), `.gitignore` | 개요 문서, 웹 버전 링크, 무시 경로 |
| `.claude/launch.json` | 로컬 확인용 `http.server` 설정(git 제외) |

---

### 작업 1: 데스크톱 코드 이동과 경로 수정

**파일:**
- 이동: `model.py preprocess.py train.py app.py mnist_cnn.pt` → `desktop_version/`
- 수정: `desktop_version/app.py`(가중치 경로), `desktop_version/train.py`(가중치·데이터 경로), `.gitignore`, `CLAUDE.md`(루트)
- 생성: `desktop_version/CLAUDE.md`

**인터페이스:**
- 제공: `app.가중치_경로: Path`, `train.가중치_저장_경로: Path`, `train.데이터_폴더: Path`. 모두 `desktop_version/` 기준 절대 경로다. 작업 2의 `export_web.py`도 같은 방식(`Path(__file__).resolve().parent`)을 쓴다.

- [ ] **1단계: 파일 이동**

```bash
cd "C:/Users/shinh/OneDrive/문서/신한나/logistex/study01_MNIST"
mkdir -p desktop_version
git mv model.py preprocess.py train.py app.py mnist_cnn.pt desktop_version/
mv data desktop_version/data
rm -rf __pycache__
```

- [ ] **2단계: 실패하는 경로 점검 실행**

```bash
$PY - <<'EOF'
import sys; from pathlib import Path
sys.path.insert(0, "desktop_version")
import app, train
assert Path(app.가중치_경로).is_absolute() and Path(app.가중치_경로).is_file(), app.가중치_경로
assert Path(train.가중치_저장_경로).parent.name == "desktop_version", train.가중치_저장_경로
assert (Path(train.데이터_폴더) / "MNIST").is_dir(), "데이터 폴더"
import torch; from model import MnistCNN
MnistCNN().load_state_dict(torch.load(app.가중치_경로, map_location="cpu"))
print("경로 점검 통과")
EOF
```
예상: `AssertionError: mnist_cnn.pt`로 실패한다(상대 경로라서).

- [ ] **3단계: `desktop_version/app.py` 수정**

import 묶음 맨 위에 추가:
```python
from pathlib import Path
```
그리고 아래 줄을
```python
가중치_경로 = "mnist_cnn.pt"
```
다음과 같이 바꾼다.
```python
가중치_경로 = Path(__file__).resolve().parent / "mnist_cnn.pt"   # 실행 위치와 상관없이 이 파일 옆의 가중치를 쓴다
```

- [ ] **4단계: `desktop_version/train.py` 수정**

`import random` 다음 줄에 추가:
```python
from pathlib import Path
```
설정값 부분의
```python
가중치_저장_경로 = "mnist_cnn.pt"
```
을 아래로 바꾼다.
```python
기준_폴더 = Path(__file__).resolve().parent   # 실행 위치와 상관없이 이 파일이 있는 폴더를 기준으로 한다
가중치_저장_경로 = 기준_폴더 / "mnist_cnn.pt"
데이터_폴더 = 기준_폴더 / "data"
```
`데이터로더_준비()` 안의 두 `root="./data"`를 `root=데이터_폴더`로 바꾼다.

- [ ] **5단계: 경로 점검 다시 실행**

2단계 명령을 다시 실행한다. 예상: `경로 점검 통과`

- [ ] **6단계: `.gitignore` 교체**

```
__pycache__/
*.pyc
desktop_version/data/
.claude/launch.json
```

- [ ] **7단계: `desktop_version/CLAUDE.md` 생성**

````markdown
<!-- 작성: {KST} KST -->
# desktop_version

PyTorch로 MNIST CNN을 학습하고, tkinter GUI로 사용자가 직접 그린 숫자를 인식하는 데스크톱 버전이다. 학습된 가중치 `mnist_cnn.pt`의 원본이 이 폴더에 있다. 저장소 공통 규칙과 환경 주의사항은 루트 [CLAUDE.md](../CLAUDE.md)를 본다.

## 명령어

```bash
python desktop_version/train.py    # MNIST를 desktop_version/data에 내려받고 데이터 증강으로 15 에폭 학습, 가중치를 desktop_version/mnist_cnn.pt로 저장
python desktop_version/app.py      # 캔버스에 그린 숫자를 mnist_cnn.pt로 예측하는 tkinter GUI 실행 (mnist_cnn.pt 필요)
```

경로는 모두 스크립트 파일 위치 기준(`Path(__file__).resolve().parent`)이라 어느 폴더에서 실행해도 된다. 테스트 스위트와 린터는 설정되어 있지 않다.

## 구조

- [model.py](model.py) — `MnistCNN` 네트워크 정의(conv 1→32→64, 2×2 맥스풀 ×2, 드롭아웃, fc 64·7·7→128→10). `train.py`와 `app.py`가 모두 이 클래스를 쓰므로, 입력 1×1×28×28 / 출력 로짓 10개라는 형태가 학습과 추론 사이의 약속이다. 구조를 바꾸면 `web_version/model.js`도 바꿔야 한다.
- [preprocess.py](preprocess.py) — 손글씨 이미지를 MNIST 방식으로 바꾸는 전처리(글씨 영역 자르기 → 긴 변 20px로 축소 → 28×28 중앙 배치 → 무게중심 정렬)와 정규화 상수(평균 0.1307 / 표준편차 0.3081). 캔버스 전체를 그냥 28×28로 줄이면 인식률이 크게 떨어지므로 이 전처리가 정확도의 핵심이다. `web_version/preprocess.js`가 이 파일을 픽셀 단위로 재현하므로, 바꾸면 JS 쪽도 바꾸고 기준 데이터를 다시 만든다.
- [train.py](train.py) — `torchvision.datasets.MNIST`로 `data/`에 데이터를 내려받고, Adam + CrossEntropyLoss + 코사인 학습률 스케줄로 `MnistCNN`을 15 에폭 학습한다. 마우스로 그린 숫자에 대비해 데이터 증강(이동·회전·크기·기울기, 획 굵게 만들기)을 쓰며, 평가는 증강 없이 한다. 학습이 끝나면 `model.state_dict()`를 `mnist_cnn.pt`에 덮어쓴다.
- [app.py](app.py) — tkinter 캔버스 앱. 검은 캔버스에 흰 펜(굵기 22)으로 그린 획을 화면의 `Canvas`와 화면 밖 PIL `Image`에 동시에 그리고, 마우스를 떼면 `preprocess.py`로 전처리해 자동 인식한다. 인식 결과·확신도·숫자별 확률 막대·모델 입력(28×28) 미리보기를 보여준다.

`mnist_cnn.pt`는 전체 모델이 아니라 `state_dict`만 담고 있으므로, 불러올 때는 먼저 `MnistCNN()`을 만든 뒤 `load_state_dict`를 호출해야 한다. `data/`는 git에서 제외된다.
````

- [ ] **8단계: 루트 `CLAUDE.md` 전체 교체**

````markdown
# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 주는 안내입니다. 각 버전의 자세한 내용은 폴더별 CLAUDE.md를 본다.

## 프로젝트

MNIST 손글씨 숫자 인식 프로젝트이며, 두 버전으로 나뉜다.

- [desktop_version/](desktop_version/CLAUDE.md) — PyTorch CNN 학습(`train.py`)과 tkinter GUI(`app.py`). 학습된 가중치 `mnist_cnn.pt`의 원본이다.
- [web_version/](web_version/CLAUDE.md) — 외부 라이브러리 없이 순수 자바스크립트로 추론하는 정적 웹 앱. GitHub Pages로 배포된다.

원격 저장소: https://github.com/hannah0326/Study01_MNIST (공개, `master` 브랜치). GitHub Pages는 `master` 브랜치 루트를 배포한다. 루트 `index.html`은 소개 페이지이고, 웹 앱 주소는 https://hannah0326.github.io/Study01_MNIST/web_version/ 이다. `docs/superpowers/`에는 설계·구현 계획 문서가 있다.

## 작성 규칙

- 코드·주석·커밋 메시지·문서는 한국어로 쓴다(코드 식별자·명령어·고유명사 제외). 기존 코드처럼 식별자도 한국어를 쓴다.
- 새로 만드는 파일에는 대한민국 표준시(KST) 작성 시각 주석을 단다. 예: `# 작성: 2026-09-26 01:42 KST`, HTML·MD는 `<!-- 작성: ... KST -->`, JS는 `// 작성: ... KST`, CSS는 `/* 작성: ... KST */`. Git Bash에서는 `TZ=Asia/Seoul`이 동작하지 않으므로 PowerShell의 `[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'Korea Standard Time')`로 시각을 구한다.

## 두 버전의 관계

웹 버전은 데스크톱 버전이 학습한 가중치를 내보내 쓴다. `desktop_version/model.py`(모델 구조)나 `desktop_version/preprocess.py`(전처리)를 바꾸면 `web_version/model.js`/`preprocess.js`도 함께 바꿔야 한다.

가중치를 갱신하는 순서:

```bash
python desktop_version/train.py        # mnist_cnn.pt 다시 학습
python desktop_version/export_web.py   # web_version/weights.js, web_version/tests/reference.js 다시 생성
```

그다음 `web_version/tests/tests.html`을 열어 테스트가 모두 통과하는지 확인하고, 세 파일을 함께 커밋한다.

## 환경

패키지 명세 파일(`requirements.txt`/`pyproject.toml`)은 없으며, 의존성(torch, torchvision, pillow, numpy)은 pip로 직접 설치했다. Node.js는 설치되어 있지 않으므로 JS 테스트는 브라우저에서 돌린다.

이 컴퓨터에서는 셸에 따라 PATH의 `python`/`pip`이 실제 인터프리터가 아니라 Windows 스토어 더미 실행 파일로 잡힐 수 있다. winget으로 설치한 실제 인터프리터 경로는 `C:\Users\shinh\AppData\Local\Programs\Python\Python312\python.exe`이다. `import torch`가 `WinError 4551`(애플리케이션 제어 정책 차단)로 실패하면 Windows 스마트 앱 제어가 서명되지 않은 torch DLL을 막고 있는 것이다. 이때는 사용자가 설정 → 개인 정보 및 보안 → Windows 보안 → 앱 및 브라우저 제어에서 직접 꺼야 한다(보안 설정 변경이므로 스크립트로 우회하지 않는다).
````

- [ ] **9단계: 커밋**

```bash
git add -A desktop_version .gitignore CLAUDE.md
git status --short   # 예상: R 이동 5개, M 2개(.gitignore, CLAUDE.md), A desktop_version/CLAUDE.md
git commit -F - <<'EOF'
기존 코드를 desktop_version 폴더로 이동

- model.py, preprocess.py, train.py, app.py, mnist_cnn.pt를 git mv로 옮김
- 가중치·데이터 경로를 스크립트 위치 기준으로 바꿔 어느 폴더에서 실행해도 동작하게 함
- desktop_version/CLAUDE.md 추가, 루트 CLAUDE.md를 저장소 개요로 정리

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### 작업 2: 웹용 가중치·기준 데이터 내보내기 (`export_web.py`)

**파일:**
- 생성: `desktop_version/export_web.py`
- 생성(자동): `web_version/weights.js`, `web_version/tests/reference.js`
- 수정: `desktop_version/CLAUDE.md`

**인터페이스:**
- 사용: `model.MnistCNN`, `preprocess.모델_입력_이미지_만들기`, `preprocess.텐서로_변환`
- 제공(JS 전역):
  - `window.MNIST_가중치 = { 목차: [{이름: string, 형태: number[], 시작: number}], 데이터: string }`. 시작은 float 개수 기준 위치이고, 데이터는 float32 리틀엔디언 바이트의 base64다. 텐서 순서는 `conv1.weight, conv1.bias, conv2.weight, conv2.bias, fc1.weight, fc1.bias, fc2.weight, fc2.bias`이다.
  - `window.기준_데이터 = { 전처리_사례: [{이름, 입력: base64(280×280 uint8), 기대: base64(28×28 uint8), 예측: number}], 추론_사례: [{이름, 입력: base64(28×28 uint8), 정답: number, 로짓: number[10]}] }`

- [ ] **1단계: 실패하는 내보내기 점검 실행**

```bash
$PY - <<'EOF'
import base64, json, sys; from pathlib import Path
import numpy as np, torch
sys.path.insert(0, "desktop_version")
from model import MnistCNN
def 읽기(경로, 변수):
    글 = Path(경로).read_text(encoding="utf-8")
    머리 = f"window.{변수} = "
    시작 = 글.index(머리) + len(머리)
    return json.loads(글[시작:글.rindex(";")])
가중치 = 읽기("web_version/weights.js", "MNIST_가중치")
바이트 = base64.b64decode(가중치["데이터"]); 값 = np.frombuffer(바이트, dtype="<f4")
상태 = torch.load("desktop_version/mnist_cnn.pt", map_location="cpu")
for 항목 in 가중치["목차"]:
    원본 = 상태[항목["이름"]].numpy()
    assert list(원본.shape) == 항목["형태"], 항목["이름"]
    조각 = 값[항목["시작"]: 항목["시작"] + 원본.size].reshape(원본.shape)
    assert np.array_equal(조각, 원본), 항목["이름"]
assert 값.size == sum(t.numel() for t in 상태.values()) == 421642
기준 = 읽기("web_version/tests/reference.js", "기준_데이터")
assert len(기준["전처리_사례"]) == 6 and len(기준["추론_사례"]) == 8
for 사례 in 기준["전처리_사례"]:
    assert len(base64.b64decode(사례["입력"])) == 280 * 280 and len(base64.b64decode(사례["기대"])) == 28 * 28
for 사례 in 기준["추론_사례"]:
    assert len(base64.b64decode(사례["입력"])) == 28 * 28 and len(사례["로짓"]) == 10
print("내보내기 점검 통과")
EOF
```
예상: `FileNotFoundError: ... web_version/weights.js`

- [ ] **2단계: `desktop_version/export_web.py` 작성**

```python
# 작성: {KST} KST
# -*- coding: utf-8 -*-
"""mnist_cnn.pt를 웹 버전이 읽는 weights.js로 내보내고, 웹 테스트용 기준 데이터(reference.js)를 만든다"""

import base64
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw
from torchvision import datasets

from model import MnistCNN
from preprocess import 모델_입력_이미지_만들기, 텐서로_변환

기준_폴더 = Path(__file__).resolve().parent
가중치_경로 = 기준_폴더 / "mnist_cnn.pt"
데이터_폴더 = 기준_폴더 / "data"
웹_폴더 = 기준_폴더.parent / "web_version"
웹_가중치_경로 = 웹_폴더 / "weights.js"
기준_데이터_경로 = 웹_폴더 / "tests" / "reference.js"

# web_version/model.js가 이 순서와 형태를 전제로 가중치를 읽는다
텐서_순서 = ["conv1.weight", "conv1.bias", "conv2.weight", "conv2.bias",
            "fc1.weight", "fc1.bias", "fc2.weight", "fc2.bias"]

캔버스_크기 = 280
펜_굵기 = 22            # app.py와 같은 굵기
MNIST_사례_개수 = 8

# 전처리 기준 데이터로 쓸 손글씨: (이름, 획 목록). 획은 이어서 그릴 점들의 목록이다.
손글씨_사례 = [
    ("세로선 1", [[(140, 40), (140, 240)]]),
    ("숫자 7", [[(70, 60), (210, 60), (120, 240)]]),
    ("타원 0", [[(140, 40), (200, 80), (210, 150), (190, 220), (140, 245),
                (90, 220), (70, 150), (80, 80), (140, 40)]]),
    ("구석의 작은 4", [[(40, 20), (25, 70), (80, 70)], [(65, 30), (65, 110)]]),
    ("가로로 긴 선", [[(20, 150), (260, 150)]]),
    ("점 하나", [[(200, 200)]]),
]


def base64_문자열(바이트):
    return base64.b64encode(바이트).decode("ascii")


def 한국_시각():
    return datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M")


def JS_파일_쓰기(경로, 변수_이름, 값, 설명):
    """값을 JSON으로 바꿔 `window.변수_이름 = ...;` 한 줄짜리 JS 파일로 저장한다"""
    경로.parent.mkdir(parents=True, exist_ok=True)
    내용 = (f"// 작성: {한국_시각()} KST\n"
           f"// {설명}\n"
           "// desktop_version/export_web.py가 자동으로 만든 파일이므로 직접 고치지 않는다.\n"
           f"window.{변수_이름} = {json.dumps(값, ensure_ascii=False)};\n")
    경로.write_text(내용, encoding="utf-8")


def 가중치_내보내기(상태):
    """state_dict를 {목차, 데이터(float32 리틀엔디언 바이트의 base64)}로 바꾼다"""
    목차, 조각들, 시작 = [], [], 0
    for 이름 in 텐서_순서:
        배열 = 상태[이름].detach().cpu().numpy().astype("<f4")
        목차.append({"이름": 이름, "형태": list(배열.shape), "시작": 시작})
        조각들.append(배열.tobytes(order="C"))
        시작 += 배열.size
    return {"목차": 목차, "데이터": base64_문자열(b"".join(조각들))}


def 손글씨_그리기(획_목록):
    """app.py와 같은 방식(굵은 선 + 점마다 둥근 끝)으로 280x280 검은 판에 흰 획을 그린다"""
    그림 = Image.new("L", (캔버스_크기, 캔버스_크기), 0)
    도구 = ImageDraw.Draw(그림)
    반지름 = 펜_굵기 / 2
    for 획 in 획_목록:
        이전 = 획[0]
        for x, y in 획:
            도구.line([이전[0], 이전[1], x, y], fill=255, width=펜_굵기)
            도구.ellipse([x - 반지름, y - 반지름, x + 반지름, y + 반지름], fill=255)
            이전 = (x, y)
    return 그림


@torch.no_grad()
def 기준_데이터_만들기(모델):
    """웹 버전 대조 테스트에 쓸 파이썬 전처리 결과와 PyTorch 로짓을 만든다"""
    전처리_사례 = []
    for 이름, 획_목록 in 손글씨_사례:
        그림 = 손글씨_그리기(획_목록)
        결과 = 모델_입력_이미지_만들기(그림)
        로짓 = 모델(텐서로_변환(결과))[0]
        전처리_사례.append({
            "이름": 이름,
            "입력": base64_문자열(np.array(그림, dtype=np.uint8).tobytes()),
            "기대": base64_문자열(np.array(결과, dtype=np.uint8).tobytes()),
            "예측": int(로짓.argmax()),
        })

    테스트_데이터셋 = datasets.MNIST(root=데이터_폴더, train=False, download=True)
    추론_사례 = []
    for 번호 in range(MNIST_사례_개수):
        이미지, 정답 = 테스트_데이터셋[번호]      # PIL 'L' 이미지와 정답 숫자
        로짓 = 모델(텐서로_변환(이미지))[0]
        추론_사례.append({
            "이름": f"MNIST 테스트 {번호}번",
            "입력": base64_문자열(np.array(이미지, dtype=np.uint8).tobytes()),
            "정답": int(정답),
            "로짓": [float(값) for 값 in 로짓],
        })
    return {"전처리_사례": 전처리_사례, "추론_사례": 추론_사례}


def main():
    모델 = MnistCNN()
    모델.load_state_dict(torch.load(가중치_경로, map_location="cpu"))
    모델.eval()

    JS_파일_쓰기(웹_가중치_경로, "MNIST_가중치", 가중치_내보내기(모델.state_dict()),
               "MnistCNN 가중치 (float32 리틀엔디언 바이트를 base64로 인코딩)")
    개수 = sum(p.numel() for p in 모델.parameters())
    print(f"가중치 {개수}개를 '{웹_가중치_경로}'에 저장했습니다.")

    JS_파일_쓰기(기준_데이터_경로, "기준_데이터", 기준_데이터_만들기(모델),
               "웹 버전 테스트용 기준 데이터 (파이썬 전처리 결과와 PyTorch 로짓)")
    print(f"기준 데이터를 '{기준_데이터_경로}'에 저장했습니다.")


if __name__ == "__main__":
    main()
```

- [ ] **3단계: 내보내기 실행**

```bash
$PY desktop_version/export_web.py
```
예상: `가중치 421642개를 '...web_version\weights.js'에 저장했습니다.`, `기준 데이터를 '...reference.js'에 저장했습니다.`

- [ ] **4단계: 1단계 점검 다시 실행**

예상: `내보내기 점검 통과`. `ls -la web_version/weights.js`는 약 2.2MB여야 한다.

- [ ] **5단계: `desktop_version/CLAUDE.md` 보완**

명령어 블록에 한 줄을 추가한다.
```bash
python desktop_version/export_web.py   # mnist_cnn.pt → web_version/weights.js, 웹 테스트 기준 데이터 → web_version/tests/reference.js
```
구조 목록 맨 끝에 한 항목을 추가한다.
```markdown
- [export_web.py](export_web.py) — `mnist_cnn.pt`의 텐서 8개를 정해진 순서(`텐서_순서`)대로 float32 리틀엔디언으로 이어 붙여 base64로 만들고 `web_version/weights.js`(`window.MNIST_가중치 = {목차, 데이터}`)에 쓴다. 같은 실행에서 PIL로 그린 손글씨 6개의 파이썬 전처리 결과와 MNIST 테스트 이미지 8장의 PyTorch 로짓을 `web_version/tests/reference.js`에 기준 데이터로 쓴다. 모델을 다시 학습하면 반드시 다시 실행한다.
```

- [ ] **6단계: 커밋**

```bash
git add desktop_version/export_web.py desktop_version/CLAUDE.md web_version/weights.js web_version/tests/reference.js
git commit -F - <<'EOF'
웹 버전용 가중치·기준 데이터 내보내기 스크립트 추가

export_web.py가 mnist_cnn.pt를 base64 float32 weights.js로 내보내고,
JS 대조 테스트에 쓸 파이썬 전처리 결과와 PyTorch 로짓을 reference.js로 만든다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### 작업 3: 브라우저 테스트 실행기와 전처리 (`preprocess.js`)

**파일:**
- 생성: `web_version/tests/tests.html`, `web_version/tests/tests.js`, `web_version/preprocess.js`, `.claude/launch.json`(git 제외)

**인터페이스:**
- 사용: `window.기준_데이터`(작업 2)
- 제공: `window.전처리 = { 정규화_평균, 정규화_표준편차, 모델_입력_크기, 파이썬_반올림(값) → 정수, 글씨_영역_찾기(픽셀, 너비, 높이) → {위, 왼쪽, 아래, 오른쪽}|null (아래·오른쪽은 끝 다음 위치), Lanczos_축소(픽셀, 너비, 높이, 새_너비, 새_높이) → Uint8ClampedArray, 쌍선형_이동(픽셀, 크기, 이동_x, 이동_y) → Uint8ClampedArray, 모델_입력_이미지_만들기(픽셀, 너비, 높이) → Uint8ClampedArray(784)|null, 정규화된_입력(이미지28) → Float32Array(784) }`
- 제공(테스트 파일 안): `테스트(이름, 함수)`, `확인(조건, 메시지)`, `같음(실제, 기대, 메시지)`, `근사_배열(실제, 기대, 허용_오차, 메시지) → 최대 차이`, `base64_바이트(문자열) → Uint8Array`. 테스트 함수가 값을 돌려주면 결과 줄에 비고로 표시한다. 모두 실행한 뒤 `window.테스트_결과 = {통과, 실패, 실패_목록}`와 `document.title = "통과 N / 실패 M"`을 설정한다.

- [ ] **1단계: 로컬 서버 설정 `.claude/launch.json` 생성**

JSON은 주석을 달 수 없고 git에서도 제외되므로 작성 시각 주석을 생략한다.
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "web",
      "runtimeExecutable": "C:\\Users\\shinh\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
      "runtimeArgs": ["-m", "http.server", "8000"],
      "port": 8000
    }
  ]
}
```

- [ ] **2단계: `web_version/tests/tests.html` 작성**

```html
<!DOCTYPE html>
<!-- 작성: {KST} KST -->
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>웹 버전 테스트</title>
  <style>
    body { font-family: "맑은 고딕", sans-serif; margin: 24px; }
    #요약 { font-weight: bold; margin-bottom: 12px; }
    .통과 { color: #15803d; }
    .실패 { color: #b91c1c; }
    li { margin: 2px 0; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>웹 버전 테스트</h1>
  <div id="요약">실행 중...</div>
  <ul id="목록"></ul>
  <script src="reference.js"></script>
  <script src="../preprocess.js"></script>
  <script src="tests.js"></script>
</body>
</html>
```

- [ ] **3단계: 실행기와 전처리 테스트 `web_version/tests/tests.js` 작성**

```js
// 작성: {KST} KST
// 외부 라이브러리 없이 동작하는 작은 테스트 실행기와 웹 버전 테스트 모음. tests.html을 브라우저로 열면 실행된다.
(function () {
  "use strict";

  // ---------- 실행기 ----------
  const 테스트_목록 = [];

  function 테스트(이름, 함수) {
    테스트_목록.push({ 이름, 함수 });
  }

  function 확인(조건, 메시지) {
    if (!조건) throw new Error(메시지);
  }

  function 같음(실제, 기대, 메시지) {
    if (실제 !== 기대) throw new Error(`${메시지}: 기대 ${기대}, 실제 ${실제}`);
  }

  function 근사_배열(실제, 기대, 허용_오차, 메시지) {
    같음(실제.length, 기대.length, `${메시지} 길이`);
    let 최대_차이 = 0;
    let 위치 = -1;
    for (let i = 0; i < 기대.length; i++) {
      const 차이 = Math.abs(실제[i] - 기대[i]);
      if (Number.isNaN(차이)) throw new Error(`${메시지}: ${i}번째 값이 NaN`);
      if (차이 > 최대_차이) {
        최대_차이 = 차이;
        위치 = i;
      }
    }
    if (최대_차이 > 허용_오차) {
      throw new Error(`${메시지}: 최대 차이 ${최대_차이}(위치 ${위치})가 허용 오차 ${허용_오차}보다 큼`);
    }
    return 최대_차이;
  }

  function base64_바이트(문자열) {
    const 이진 = atob(문자열);
    const 바이트 = new Uint8Array(이진.length);
    for (let i = 0; i < 이진.length; i++) 바이트[i] = 이진.charCodeAt(i);
    return 바이트;
  }

  function 가장_큰_위치(값들) {
    let 위치 = 0;
    for (let i = 1; i < 값들.length; i++) if (값들[i] > 값들[위치]) 위치 = i;
    return 위치;
  }

  function 실행() {
    const 목록 = document.getElementById("목록");
    const 실패_목록 = [];
    for (const { 이름, 함수 } of 테스트_목록) {
      const 항목 = document.createElement("li");
      try {
        const 비고 = 함수();
        항목.className = "통과";
        항목.textContent = `통과 - ${이름}` + (비고 === undefined ? "" : ` (${비고})`);
      } catch (오류) {
        항목.className = "실패";
        항목.textContent = `실패 - ${이름}: ${오류.message}`;
        실패_목록.push(`${이름}: ${오류.message}`);
      }
      목록.appendChild(항목);
    }
    const 통과 = 테스트_목록.length - 실패_목록.length;
    const 요약 = `통과 ${통과} / 실패 ${실패_목록.length}`;
    const 요약_칸 = document.getElementById("요약");
    요약_칸.textContent = 요약;
    요약_칸.className = 실패_목록.length ? "실패" : "통과";
    document.title = 요약;
    window.테스트_결과 = { 통과, 실패: 실패_목록.length, 실패_목록 };
  }

  // ---------- 전처리 (preprocess.js) ----------
  테스트("파이썬_반올림은 .5를 짝수 쪽으로 반올림한다", () => {
    const { 파이썬_반올림 } = window.전처리;
    같음(파이썬_반올림(12.5), 12, "12.5");
    같음(파이썬_반올림(13.5), 14, "13.5");
    같음(파이썬_반올림(0.5), 0, "0.5");
    같음(파이썬_반올림(2.4), 2, "2.4");
    같음(파이썬_반올림(2.6), 3, "2.6");
  });

  테스트("글씨_영역_찾기는 밝기 30 초과 픽셀의 경계 상자를 돌려준다", () => {
    const 픽셀 = new Uint8ClampedArray(5 * 4);   // 너비 5, 높이 4
    픽셀[0] = 30;                                // 30은 글씨로 보지 않는다
    픽셀[1 * 5 + 1] = 31;
    픽셀[2 * 5 + 3] = 200;
    const 영역 = window.전처리.글씨_영역_찾기(픽셀, 5, 4);
    같음(JSON.stringify(영역), JSON.stringify({ 위: 1, 왼쪽: 1, 아래: 3, 오른쪽: 4 }), "영역");
  });

  테스트("글씨가 없으면 글씨_영역_찾기와 모델_입력_이미지_만들기가 null", () => {
    const 빈_판 = new Uint8ClampedArray(280 * 280).fill(30);
    같음(window.전처리.글씨_영역_찾기(빈_판, 280, 280), null, "영역");
    같음(window.전처리.모델_입력_이미지_만들기(빈_판, 280, 280), null, "모델 입력");
  });

  테스트("Lanczos_축소는 고른 밝기를 그대로 유지한다", () => {
    const 픽셀 = new Uint8ClampedArray(40 * 30).fill(100);
    const 결과 = window.전처리.Lanczos_축소(픽셀, 40, 30, 20, 15);
    근사_배열(결과, new Array(20 * 15).fill(100), 0, "축소 결과");
  });

  테스트("Lanczos_축소는 크기가 같으면 복사본을 돌려준다", () => {
    const 픽셀 = Uint8ClampedArray.from([1, 2, 3, 4]);
    const 결과 = window.전처리.Lanczos_축소(픽셀, 2, 2, 2, 2);
    근사_배열(결과, [1, 2, 3, 4], 0, "결과");
    확인(결과 !== 픽셀, "원본과 다른 배열이어야 함");
  });

  테스트("쌍선형_이동: 정수 이동과 0.5 이동(소수점은 버림)", () => {
    const { 쌍선형_이동 } = window.전처리;
    const 판 = Uint8ClampedArray.from([0, 0, 0, 0, 91, 0, 0, 0, 0]);
    근사_배열(쌍선형_이동(판, 3, 1, 0), [0, 0, 0, 0, 0, 91, 0, 0, 0], 0, "오른쪽 1칸");
    근사_배열(쌍선형_이동(판, 3, 0.5, 0), [0, 0, 0, 0, 45, 45, 0, 0, 0], 0, "오른쪽 0.5칸");
    근사_배열(쌍선형_이동(판, 3, 0, -1), [0, 91, 0, 0, 0, 0, 0, 0, 0], 0, "위로 1칸");
  });

  테스트("정규화된_입력은 (값/255 - 0.1307) / 0.3081", () => {
    const 이미지 = new Uint8ClampedArray(784);
    이미지[0] = 255;
    const 입력 = window.전처리.정규화된_입력(이미지);
    같음(입력.length, 784, "길이");
    근사_배열([입력[0], 입력[1]], [(1 - 0.1307) / 0.3081, -0.1307 / 0.3081], 1e-6, "값");
  });

  for (const 사례 of window.기준_데이터.전처리_사례) {
    테스트(`전처리 대조: ${사례.이름}`, () => {
      const 결과 = window.전처리.모델_입력_이미지_만들기(base64_바이트(사례.입력), 280, 280);
      확인(결과 !== null, "결과가 null");
      return `최대 차이 ${근사_배열(결과, base64_바이트(사례.기대), 2, "28x28 픽셀")}`;
    });
  }

  실행();
})();
```

- [ ] **4단계: 테스트가 실패하는지 확인**

`preview_start`(name `web`)로 서버를 띄우고 내장 브라우저로 `http://localhost:8000/web_version/tests/tests.html`을 연다. `javascript_tool`로 `window.테스트_결과`를 읽는다.
예상: `window.전처리`가 없어 전처리 테스트가 모두 실패한다(`실패 13`: 단위 7 + 대조 6).

- [ ] **5단계: `web_version/preprocess.js` 작성**

```js
// 작성: {KST} KST
// 손글씨 이미지를 MNIST 방식(28x28, 20x20 상자, 무게중심 정렬)으로 바꾸는 전처리.
// desktop_version/preprocess.py(PIL LANCZOS 축소, AFFINE BILINEAR 이동)를 픽셀 단위로 똑같이 재현한다.
// 브라우저마다 결과가 다른 캔버스 drawImage 스무딩은 쓰지 않는다.
(function () {
  "use strict";

  // MNIST 학습 때 사용한 정규화 값 (preprocess.py와 같음)
  const 정규화_평균 = 0.1307;
  const 정규화_표준편차 = 0.3081;

  const 모델_입력_크기 = 28;
  const 숫자_상자_크기 = 20;     // MNIST는 숫자를 20x20 상자에 맞춘 뒤 28x28 한가운데에 놓는다
  const 글씨_판정_밝기 = 30;     // 이 값보다 밝은 픽셀을 글씨로 본다

  // PIL Resample.c의 8비트 고정소수점 계산과 같은 정밀도
  const 정밀도_비트 = 22;
  const 고정소수점_1 = 2 ** 정밀도_비트;

  /** 파이썬 round()와 같이 정확히 .5면 짝수 쪽으로 반올림한다 */
  function 파이썬_반올림(값) {
    const 내림 = Math.floor(값);
    const 나머지 = 값 - 내림;
    if (나머지 > 0.5) return 내림 + 1;
    if (나머지 < 0.5) return 내림;
    return 내림 % 2 === 0 ? 내림 : 내림 + 1;
  }

  /** 밝기 30을 넘는 픽셀의 경계 상자. 아래·오른쪽은 끝 다음 위치다. 글씨가 없으면 null */
  function 글씨_영역_찾기(픽셀, 너비, 높이) {
    let 위 = 높이, 왼쪽 = 너비, 아래 = -1, 오른쪽 = -1;
    for (let y = 0; y < 높이; y++) {
      for (let x = 0; x < 너비; x++) {
        if (픽셀[y * 너비 + x] > 글씨_판정_밝기) {
          if (y < 위) 위 = y;
          if (y > 아래) 아래 = y;
          if (x < 왼쪽) 왼쪽 = x;
          if (x > 오른쪽) 오른쪽 = x;
        }
      }
    }
    if (아래 < 0) return null;
    return { 위, 왼쪽, 아래: 아래 + 1, 오른쪽: 오른쪽 + 1 };
  }

  function 싱크(x) {
    if (x === 0) return 1;
    x *= Math.PI;
    return Math.sin(x) / x;
  }

  function Lanczos(x) {
    return -3 <= x && x < 3 ? 싱크(x) * 싱크(x / 3) : 0;
  }

  /** PIL의 precompute_coeffs + normalize_coeffs_8bpp와 같은 방식으로 한 축의 정수 가중치를 구한다 */
  function 축소_계수(입력_크기, 출력_크기) {
    const 배율 = 입력_크기 / 출력_크기;
    const 필터_배율 = Math.max(배율, 1);
    const 반경 = 3 * 필터_배율;
    const 역배율 = 1 / 필터_배율;
    const 계수들 = [];
    for (let 출력 = 0; 출력 < 출력_크기; 출력++) {
      const 중심 = (출력 + 0.5) * 배율;
      let 시작 = Math.trunc(중심 - 반경 + 0.5);
      if (시작 < 0) 시작 = 0;
      let 끝 = Math.trunc(중심 + 반경 + 0.5);
      if (끝 > 입력_크기) 끝 = 입력_크기;
      const 실수_가중치 = [];
      let 합 = 0;
      for (let i = 시작; i < 끝; i++) {
        const w = Lanczos((i - 중심 + 0.5) * 역배율);
        실수_가중치.push(w);
        합 += w;
      }
      const 가중치 = 실수_가중치.map((w) => {
        const 정규 = 합 !== 0 ? w / 합 : w;
        return 정규 < 0 ? Math.trunc(-0.5 + 정규 * 고정소수점_1) : Math.trunc(0.5 + 정규 * 고정소수점_1);
      });
      계수들.push({ 시작, 가중치 });
    }
    return 계수들;
  }

  /** PIL clip8: 고정소수점 합을 0~255 정수로 바꾼다 */
  function 바이트로_자르기(합) {
    if (합 >= 256 * 고정소수점_1) return 255;
    if (합 <= 0) return 0;
    return Math.floor(합 / 고정소수점_1);
  }

  /** PIL Image.resize(LANCZOS)와 같은 축소. 가로를 먼저 계산하고 8비트로 반올림한 뒤 세로를 계산한다 */
  function Lanczos_축소(픽셀, 너비, 높이, 새_너비, 새_높이) {
    let 현재 = 픽셀;
    if (새_너비 !== 너비) {
      const 계수들 = 축소_계수(너비, 새_너비);
      const 출력 = new Uint8ClampedArray(새_너비 * 높이);
      for (let y = 0; y < 높이; y++) {
        for (let x = 0; x < 새_너비; x++) {
          const { 시작, 가중치 } = 계수들[x];
          let 합 = 고정소수점_1 / 2;
          for (let i = 0; i < 가중치.length; i++) 합 += 현재[y * 너비 + 시작 + i] * 가중치[i];
          출력[y * 새_너비 + x] = 바이트로_자르기(합);
        }
      }
      현재 = 출력;
    }
    if (새_높이 !== 높이) {
      const 계수들 = 축소_계수(높이, 새_높이);
      const 출력 = new Uint8ClampedArray(새_너비 * 새_높이);
      for (let y = 0; y < 새_높이; y++) {
        const { 시작, 가중치 } = 계수들[y];
        for (let x = 0; x < 새_너비; x++) {
          let 합 = 고정소수점_1 / 2;
          for (let i = 0; i < 가중치.length; i++) 합 += 현재[(시작 + i) * 새_너비 + x] * 가중치[i];
          출력[y * 새_너비 + x] = 바이트로_자르기(합);
        }
      }
      현재 = 출력;
    }
    return 현재 === 픽셀 ? Uint8ClampedArray.from(픽셀) : 현재;
  }

  /** PIL Image.transform(AFFINE, (1, 0, -이동_x, 0, 1, -이동_y), BILINEAR)와 같은 평행 이동. 판 밖은 0 */
  function 쌍선형_이동(픽셀, 크기, 이동_x, 이동_y) {
    const 출력 = new Uint8ClampedArray(크기 * 크기);
    const 안으로 = (v) => (v < 0 ? 0 : v >= 크기 ? 크기 - 1 : v);
    for (let y = 0; y < 크기; y++) {
      for (let x = 0; x < 크기; x++) {
        // 출력 픽셀의 중심(+0.5)을 입력 좌표로 옮긴다
        let 입력_x = (x + 0.5) - 이동_x;
        let 입력_y = (y + 0.5) - 이동_y;
        if (입력_x < 0 || 입력_x >= 크기 || 입력_y < 0 || 입력_y >= 크기) continue;
        입력_x -= 0.5;
        입력_y -= 0.5;
        const x0 = Math.floor(입력_x);
        const y0 = Math.floor(입력_y);
        const dx = 입력_x - x0;
        const dy = 입력_y - y0;
        const 왼쪽 = 안으로(x0);
        const 오른쪽 = 안으로(x0 + 1);
        const 윗줄 = 안으로(y0) * 크기;
        const 위_값 = 픽셀[윗줄 + 왼쪽] + (픽셀[윗줄 + 오른쪽] - 픽셀[윗줄 + 왼쪽]) * dx;
        let 아래_값 = 위_값;
        if (y0 + 1 >= 0 && y0 + 1 < 크기) {
          const 아랫줄 = (y0 + 1) * 크기;
          아래_값 = 픽셀[아랫줄 + 왼쪽] + (픽셀[아랫줄 + 오른쪽] - 픽셀[아랫줄 + 왼쪽]) * dx;
        }
        // PIL은 반올림하지 않고 소수점을 버린다
        출력[y * 크기 + x] = Math.trunc(위_값 + (아래_값 - 위_값) * dy);
      }
    }
    return 출력;
  }

  /** 검은 배경/흰 글씨의 흑백 픽셀 배열을 MNIST 방식의 28x28 배열로 바꾼다. 글씨가 없으면 null */
  function 모델_입력_이미지_만들기(픽셀, 너비, 높이) {
    const 영역 = 글씨_영역_찾기(픽셀, 너비, 높이);
    if (영역 === null) return null;

    // 1) 글씨가 있는 영역만 잘라낸다
    const 자른_너비 = 영역.오른쪽 - 영역.왼쪽;
    const 자른_높이 = 영역.아래 - 영역.위;
    const 자른 = new Uint8ClampedArray(자른_너비 * 자른_높이);
    for (let y = 0; y < 자른_높이; y++) {
      for (let x = 0; x < 자른_너비; x++) {
        자른[y * 자른_너비 + x] = 픽셀[(영역.위 + y) * 너비 + 영역.왼쪽 + x];
      }
    }

    // 2) 가로세로 비율을 유지한 채 긴 변이 20픽셀이 되도록 줄인다
    const 배율 = 숫자_상자_크기 / Math.max(자른_너비, 자른_높이);
    const 새_너비 = Math.max(1, 파이썬_반올림(자른_너비 * 배율));
    const 새_높이 = Math.max(1, 파이썬_반올림(자른_높이 * 배율));
    const 줄인 = Lanczos_축소(자른, 자른_너비, 자른_높이, 새_너비, 새_높이);

    // 3) 28x28 검은 판 한가운데에 붙인다
    const 판 = new Uint8ClampedArray(모델_입력_크기 * 모델_입력_크기);
    const 왼쪽_여백 = Math.floor((모델_입력_크기 - 새_너비) / 2);
    const 위_여백 = Math.floor((모델_입력_크기 - 새_높이) / 2);
    for (let y = 0; y < 새_높이; y++) {
      for (let x = 0; x < 새_너비; x++) {
        판[(위_여백 + y) * 모델_입력_크기 + 왼쪽_여백 + x] = 줄인[y * 새_너비 + x];
      }
    }

    // 4) 무게중심이 판의 중심에 오도록 평행 이동한다
    let 총합 = 0, 가로_합 = 0, 세로_합 = 0;
    for (let y = 0; y < 모델_입력_크기; y++) {
      for (let x = 0; x < 모델_입력_크기; x++) {
        const 값 = 판[y * 모델_입력_크기 + x];
        총합 += 값;
        가로_합 += 값 * x;
        세로_합 += 값 * y;
      }
    }
    const 이동_x = (모델_입력_크기 - 1) / 2 - 가로_합 / 총합;
    const 이동_y = (모델_입력_크기 - 1) / 2 - 세로_합 / 총합;
    return 쌍선형_이동(판, 모델_입력_크기, 이동_x, 이동_y);
  }

  /** 28x28 픽셀(0~255)을 모델 입력으로 쓸 정규화된 Float32Array로 바꾼다 */
  function 정규화된_입력(이미지) {
    const 입력 = new Float32Array(이미지.length);
    for (let i = 0; i < 이미지.length; i++) 입력[i] = (이미지[i] / 255 - 정규화_평균) / 정규화_표준편차;
    return 입력;
  }

  window.전처리 = {
    정규화_평균,
    정규화_표준편차,
    모델_입력_크기,
    파이썬_반올림,
    글씨_영역_찾기,
    Lanczos_축소,
    쌍선형_이동,
    모델_입력_이미지_만들기,
    정규화된_입력,
  };
})();
```

- [ ] **6단계: 테스트 통과 확인**

테스트 페이지를 새로고침하고 `window.테스트_결과`를 읽는다.
예상: `{통과: 13, 실패: 0}`. 대조 사례의 비고는 모두 "최대 차이 0" 또는 1 이하여야 한다. 파이썬 검증에서는 무작위 획 40개 모두 차이가 0이었다.

- [ ] **7단계: 커밋**

```bash
git add web_version/tests/tests.html web_version/tests/tests.js web_version/preprocess.js
git commit -F - <<'EOF'
웹 버전 전처리와 브라우저 테스트 실행기 추가

preprocess.js가 PIL LANCZOS 축소와 AFFINE BILINEAR 이동을 픽셀 단위로 재현하며,
tests.html에서 파이썬 기준 데이터와 대조한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### 작업 4: 순수 JS 추론 (`model.js`)

**파일:**
- 생성: `web_version/model.js`
- 수정: `web_version/tests/tests.html`(스크립트 추가), `web_version/tests/tests.js`(모델 테스트 추가)

**인터페이스:**
- 사용: `window.MNIST_가중치`(작업 2), `window.전처리.정규화된_입력`, `window.전처리.모델_입력_이미지_만들기`(작업 3)
- 제공: `window.모델 = { base64_바이트(문자열) → Uint8Array, 가중치_복원(원본) → {이름: Float32Array}, 모델_만들기(원본) → { 가중치, 로짓_계산(입력: Float32Array(784)) → Float32Array(10) }, 합성곱2d(입력, 입력_채널, 높이, 너비, 커널, 편향, 출력_채널) → Float32Array, ReLU(배열) → 같은 배열(제자리 수정), 맥스풀2x2(입력, 채널, 높이, 너비) → Float32Array, 전결합(입력, 가중치, 편향, 출력_개수) → Float32Array, 소프트맥스(로짓) → number[] }`

- [ ] **1단계: `tests.html`에 스크립트 추가**

`<script src="reference.js"></script>` 앞에 `<script src="../weights.js"></script>`를 넣고, `<script src="../preprocess.js"></script>` 다음에 `<script src="../model.js"></script>`를 넣는다. 최종 순서는 다음과 같다.
```html
  <script src="../weights.js"></script>
  <script src="reference.js"></script>
  <script src="../preprocess.js"></script>
  <script src="../model.js"></script>
  <script src="tests.js"></script>
```

- [ ] **2단계: `tests.js`에 모델 테스트 추가**

`tests.js`의 맨 끝 `실행();` 바로 앞에 아래를 넣는다.
```js
  // ---------- 모델 (model.js) ----------
  /** 실수 배열을 float32 리틀엔디언 바이트의 base64로 만든다 (weights.js 형식) */
  function 실수_base64(값들) {
    const 보기 = new DataView(new ArrayBuffer(값들.length * 4));
    값들.forEach((값, i) => 보기.setFloat32(i * 4, 값, true));
    return btoa(String.fromCharCode(...new Uint8Array(보기.buffer)));
  }

  테스트("base64_바이트는 base64를 바이트로 복원한다", () => {
    근사_배열(window.모델.base64_바이트("AAEC/w=="), [0, 1, 2, 255], 0, "바이트");
  });

  테스트("가중치_복원은 목차대로 Float32Array를 잘라낸다", () => {
    const 원본 = {
      목차: [{ 이름: "가", 형태: [2], 시작: 0 }, { 이름: "나", 형태: [1], 시작: 2 }],
      데이터: 실수_base64([1.5, -2, 0.25]),
    };
    const 가중치 = window.모델.가중치_복원(원본);
    근사_배열(가중치["가"], [1.5, -2], 0, "가");
    근사_배열(가중치["나"], [0.25], 0, "나");
  });

  테스트("가중치_복원은 목차와 데이터 크기가 다르면 예외를 던진다", () => {
    const 남음 = { 목차: [{ 이름: "가", 형태: [2], 시작: 0 }], 데이터: 실수_base64([1, 2, 3]) };
    const 모자람 = { 목차: [{ 이름: "가", 형태: [4], 시작: 0 }], 데이터: 실수_base64([1, 2, 3]) };
    for (const 원본 of [남음, 모자람]) {
      let 던짐 = false;
      try { window.모델.가중치_복원(원본); } catch (e) { 던짐 = true; }
      확인(던짐, `예외가 나야 함: ${JSON.stringify(원본.목차)}`);
    }
  });

  테스트("모델_만들기는 형태가 MnistCNN과 다르면 예외를 던진다", () => {
    const 원본 = { 목차: [{ 이름: "conv1.bias", 형태: [3], 시작: 0 }], 데이터: 실수_base64([1, 2, 3]) };
    let 던짐 = false;
    try { window.모델.모델_만들기(원본); } catch (e) { 던짐 = true; }
    확인(던짐, "예외가 나야 함");
  });

  테스트("합성곱2d: 모든 값이 1인 3x3 커널, 패딩 1", () => {
    const 입력 = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const 결과 = window.모델.합성곱2d(입력, 1, 3, 3, new Float32Array(9).fill(1), [0.5], 1);
    근사_배열(결과, [12.5, 21.5, 16.5, 27.5, 45.5, 33.5, 24.5, 39.5, 28.5], 1e-6, "출력");
  });

  테스트("합성곱2d: [출력, 입력, 세로, 가로] 커널 순서와 채널 구분", () => {
    const 입력 = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    const 커널 = new Float32Array(2 * 2 * 3 * 3);
    커널[0] = 1;    // 출력 0 ← 입력 채널 0의 왼쪽 위 이웃
    커널[34] = 2;   // 출력 1 ← 입력 채널 1의 바로 아래 이웃 × 2  (((1*2+1)*3+2)*3+1 = 34)
    const 결과 = window.모델.합성곱2d(입력, 2, 3, 3, 커널, [0, 0], 2);
    근사_배열(결과, [0, 0, 0, 0, 1, 2, 0, 4, 5, 80, 100, 120, 140, 160, 180, 0, 0, 0], 1e-6, "출력");
  });

  테스트("ReLU는 음수를 0으로 바꾼다", () => {
    근사_배열(window.모델.ReLU(Float32Array.from([-1, 0, 2])), [0, 0, 2], 0, "출력");
  });

  테스트("맥스풀2x2는 채널마다 2x2 칸의 최댓값을 고른다", () => {
    const 채널0 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const 채널1 = 채널0.map((v) => -v);
    const 결과 = window.모델.맥스풀2x2(Float32Array.from([...채널0, ...채널1]), 2, 4, 4);
    근사_배열(결과, [6, 8, 14, 16, -1, -3, -9, -11], 0, "출력");
  });

  테스트("전결합은 가중치 [출력, 입력] 순서로 곱한다", () => {
    const 결과 = window.모델.전결합(Float32Array.from([1, 2, 3]), Float32Array.from([1, 0, -1, 0.5, 0.5, 0.5]), [0.1, -1], 2);
    근사_배열(결과, [-1.9, 2], 1e-6, "출력");
  });

  테스트("소프트맥스는 확률 합이 1이고 큰 값에서도 넘치지 않는다", () => {
    const { 소프트맥스 } = window.모델;
    근사_배열(소프트맥스([0, Math.log(2)]), [1 / 3, 2 / 3], 1e-9, "작은 값");
    근사_배열(소프트맥스([1000, 1000]), [0.5, 0.5], 1e-9, "큰 값");
  });

  테스트("weights.js를 불러와 MnistCNN 가중치로 복원한다", () => {
    const 신경망 = window.모델.모델_만들기(window.MNIST_가중치);
    같음(신경망.가중치["fc1.weight"].length, 128 * 3136, "fc1.weight 길이");
  });

  for (const 사례 of window.기준_데이터.추론_사례) {
    테스트(`추론 대조: ${사례.이름} (정답 ${사례.정답})`, () => {
      const 신경망 = window.모델.모델_만들기(window.MNIST_가중치);
      const 로짓 = 신경망.로짓_계산(window.전처리.정규화된_입력(base64_바이트(사례.입력)));
      const 차이 = 근사_배열(로짓, 사례.로짓, 1e-3, "로짓");
      같음(가장_큰_위치(로짓), 가장_큰_위치(사례.로짓), "예측 숫자");
      return `최대 차이 ${차이.toExponential(2)}`;
    });
  }

  for (const 사례 of window.기준_데이터.전처리_사례) {
    테스트(`전처리→추론 전체 흐름: ${사례.이름}`, () => {
      const 신경망 = window.모델.모델_만들기(window.MNIST_가중치);
      const 이미지 = window.전처리.모델_입력_이미지_만들기(base64_바이트(사례.입력), 280, 280);
      const 로짓 = 신경망.로짓_계산(window.전처리.정규화된_입력(이미지));
      같음(가장_큰_위치(로짓), 사례.예측, "예측 숫자");
      return `예측 ${사례.예측}`;
    });
  }
```

- [ ] **3단계: 모델 테스트가 실패하는지 확인**

테스트 페이지를 새로고침한다. 예상: 전처리 13개는 통과하고, 모델 테스트 25개(단위 11 + 추론 대조 8 + 전체 흐름 6)는 `window.모델` 없음으로 실패한다(`통과 13 / 실패 25`).

- [ ] **4단계: `web_version/model.js` 작성**

```js
// 작성: {KST} KST
// MnistCNN(desktop_version/model.py)의 순전파를 외부 라이브러리 없이 순수 자바스크립트로 구현한다.
// 가중치는 weights.js가 정의한 window.MNIST_가중치 {목차, 데이터}에서 읽는다.
(function () {
  "use strict";

  // desktop_version/export_web.py의 텐서_순서와 MnistCNN의 형태
  const 텐서_형태 = {
    "conv1.weight": [32, 1, 3, 3],
    "conv1.bias": [32],
    "conv2.weight": [64, 32, 3, 3],
    "conv2.bias": [64],
    "fc1.weight": [128, 64 * 7 * 7],
    "fc1.bias": [128],
    "fc2.weight": [10, 128],
    "fc2.bias": [10],
  };

  const 원소_개수 = (형태) => 형태.reduce((곱, 값) => 곱 * 값, 1);

  function base64_바이트(문자열) {
    const 이진 = atob(문자열);
    const 바이트 = new Uint8Array(이진.length);
    for (let i = 0; i < 이진.length; i++) 바이트[i] = 이진.charCodeAt(i);
    return 바이트;
  }

  /** {목차, 데이터}를 {이름: Float32Array}로 복원한다. 목차와 데이터 크기가 맞지 않으면 예외 */
  function 가중치_복원(원본) {
    const 바이트 = base64_바이트(원본.데이터);
    if (바이트.length % 4 !== 0) throw new Error("가중치 바이트 수가 4의 배수가 아닙니다");
    const 전체_개수 = 바이트.length / 4;
    const 보기 = new DataView(바이트.buffer);
    const 가중치 = {};
    let 합계 = 0;
    for (const { 이름, 형태, 시작 } of 원본.목차) {
      const 개수 = 원소_개수(형태);
      if (시작 + 개수 > 전체_개수) throw new Error(`${이름}: 가중치 데이터가 모자랍니다`);
      const 값들 = new Float32Array(개수);
      for (let i = 0; i < 개수; i++) 값들[i] = 보기.getFloat32((시작 + i) * 4, true);
      가중치[이름] = 값들;
      합계 += 개수;
    }
    if (합계 !== 전체_개수) throw new Error(`가중치 개수가 맞지 않습니다: 목차 ${합계}개, 데이터 ${전체_개수}개`);
    return 가중치;
  }

  /** 3x3 합성곱(패딩 1, 보폭 1). 입력은 [입력_채널, 높이, 너비], 커널은 [출력_채널, 입력_채널, 3, 3]을 펼친 배열 */
  function 합성곱2d(입력, 입력_채널, 높이, 너비, 커널, 편향, 출력_채널) {
    const 출력 = new Float32Array(출력_채널 * 높이 * 너비);
    for (let o = 0; o < 출력_채널; o++) {
      for (let y = 0; y < 높이; y++) {
        for (let x = 0; x < 너비; x++) {
          let 합 = 편향[o];
          for (let c = 0; c < 입력_채널; c++) {
            for (let ky = 0; ky < 3; ky++) {
              const iy = y + ky - 1;
              if (iy < 0 || iy >= 높이) continue;
              for (let kx = 0; kx < 3; kx++) {
                const ix = x + kx - 1;
                if (ix < 0 || ix >= 너비) continue;
                합 += 입력[(c * 높이 + iy) * 너비 + ix] * 커널[((o * 입력_채널 + c) * 3 + ky) * 3 + kx];
              }
            }
          }
          출력[(o * 높이 + y) * 너비 + x] = 합;
        }
      }
    }
    return 출력;
  }

  /** 음수를 0으로 바꾼다 (배열을 직접 고치고 그대로 돌려준다) */
  function ReLU(배열) {
    for (let i = 0; i < 배열.length; i++) if (배열[i] < 0) 배열[i] = 0;
    return 배열;
  }

  /** 2x2 최대 풀링(보폭 2). 입력 [채널, 높이, 너비] → 출력 [채널, 높이/2, 너비/2] */
  function 맥스풀2x2(입력, 채널, 높이, 너비) {
    const 새_높이 = 높이 >> 1;
    const 새_너비 = 너비 >> 1;
    const 출력 = new Float32Array(채널 * 새_높이 * 새_너비);
    for (let c = 0; c < 채널; c++) {
      for (let y = 0; y < 새_높이; y++) {
        for (let x = 0; x < 새_너비; x++) {
          const 기준 = (c * 높이 + y * 2) * 너비 + x * 2;
          출력[(c * 새_높이 + y) * 새_너비 + x] = Math.max(
            입력[기준], 입력[기준 + 1], 입력[기준 + 너비], 입력[기준 + 너비 + 1]);
        }
      }
    }
    return 출력;
  }

  /** 완전연결층. 가중치는 [출력_개수, 입력_개수]를 펼친 배열 (torch nn.Linear와 같음) */
  function 전결합(입력, 가중치, 편향, 출력_개수) {
    const 입력_개수 = 입력.length;
    const 출력 = new Float32Array(출력_개수);
    for (let o = 0; o < 출력_개수; o++) {
      let 합 = 편향[o];
      const 시작 = o * 입력_개수;
      for (let i = 0; i < 입력_개수; i++) 합 += 입력[i] * 가중치[시작 + i];
      출력[o] = 합;
    }
    return 출력;
  }

  /** 로짓을 확률로 바꾼다. 가장 큰 값을 빼서 exp가 넘치지 않게 한다 */
  function 소프트맥스(로짓) {
    const 최대 = Math.max(...로짓);
    const 지수 = Array.from(로짓, (값) => Math.exp(값 - 최대));
    const 합 = 지수.reduce((a, b) => a + b, 0);
    return 지수.map((값) => 값 / 합);
  }

  /** 정규화된 28x28 입력(Float32Array 784개)으로 로짓 10개를 계산한다. 드롭아웃은 추론 때 하는 일이 없어 생략 */
  function 순전파(가중치, 입력) {
    let x = ReLU(합성곱2d(입력, 1, 28, 28, 가중치["conv1.weight"], 가중치["conv1.bias"], 32));
    x = 맥스풀2x2(x, 32, 28, 28);                       // 28x28 -> 14x14
    x = ReLU(합성곱2d(x, 32, 14, 14, 가중치["conv2.weight"], 가중치["conv2.bias"], 64));
    x = 맥스풀2x2(x, 64, 14, 14);                       // 14x14 -> 7x7, [64,7,7]을 펼친 순서가 곧 torch.flatten 결과
    x = ReLU(전결합(x, 가중치["fc1.weight"], 가중치["fc1.bias"], 128));
    return 전결합(x, 가중치["fc2.weight"], 가중치["fc2.bias"], 10);
  }

  /** weights.js 원본으로 신경망을 만든다. 텐서가 빠졌거나 형태가 MnistCNN과 다르면 예외 */
  function 모델_만들기(원본) {
    const 가중치 = 가중치_복원(원본);
    for (const [이름, 형태] of Object.entries(텐서_형태)) {
      if (!가중치[이름] || 가중치[이름].length !== 원소_개수(형태)) {
        throw new Error(`${이름}: 가중치가 없거나 형태가 [${형태}]와 맞지 않습니다`);
      }
    }
    return { 가중치, 로짓_계산: (입력) => 순전파(가중치, 입력) };
  }

  window.모델 = { base64_바이트, 가중치_복원, 모델_만들기, 합성곱2d, ReLU, 맥스풀2x2, 전결합, 소프트맥스 };
})();
```

- [ ] **5단계: 테스트 통과 확인**

새로고침한 뒤 `window.테스트_결과`를 읽는다. 예상: `{통과: 38, 실패: 0}`. 추론 대조 비고는 "최대 차이 1e-5" 정도여야 한다.

- [ ] **6단계: 커밋**

```bash
git add web_version/model.js web_version/tests/tests.html web_version/tests/tests.js
git commit -F - <<'EOF'
순수 자바스크립트 CNN 추론 추가

model.js가 weights.js의 base64 float32 가중치를 복원하고 MnistCNN 순전파를 계산한다.
PyTorch 로짓과의 대조 테스트와 전처리→추론 전체 흐름 테스트를 추가했다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### 작업 5: 웹 화면 (`index.html`, `style.css`, `app.js`)

**파일:**
- 생성: `web_version/index.html`, `web_version/style.css`, `web_version/app.js`

**인터페이스:**
- 사용: `window.MNIST_가중치`, `window.전처리.모델_입력_이미지_만들기`, `window.전처리.정규화된_입력`, `window.모델.모델_만들기`, `window.모델.소프트맥스`

- [ ] **1단계: `web_version/index.html` 작성**

```html
<!DOCTYPE html>
<!-- 작성: {KST} KST -->
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>손글씨 숫자 인식기 (웹 버전)</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>2601951 신한나</header>
  <main>
    <h1>손글씨 숫자 인식기 <small>웹 버전</small></h1>
    <p class="보조">PyTorch로 학습한 CNN을 외부 라이브러리 없이 브라우저에서 순수 자바스크립트로 실행합니다.</p>
    <div class="배치">
      <section>
        <h2>여기에 숫자를 써 주세요 (0~9)</h2>
        <canvas id="캔버스" width="280" height="280"></canvas>
        <div class="버튼_줄">
          <button id="인식_버튼" type="button">인식하기</button>
          <button id="지우기_버튼" type="button">지우기</button>
        </div>
        <p class="보조">펜을 떼면 자동으로 인식합니다.</p>
      </section>
      <section class="결과">
        <h2>인식 결과</h2>
        <div id="결과_숫자" class="결과_숫자">-</div>
        <div id="확신도" class="보조 가운데">확신도: -</div>
        <p id="오류" class="오류" hidden></p>
        <h2>숫자별 확률</h2>
        <ol id="막대_목록" class="막대_목록"></ol>
        <h2>모델 입력 (28x28)</h2>
        <canvas id="미리보기" width="28" height="28"></canvas>
      </section>
    </div>
    <p><a href="../">← 프로젝트 소개로 돌아가기</a></p>
  </main>
  <script src="weights.js"></script>
  <script src="preprocess.js"></script>
  <script src="model.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **2단계: `web_version/style.css` 작성**

```css
/* 작성: {KST} KST */
/* 색과 배치는 desktop_version/app.py 화면과 맞춘다 */
body { font-family: "맑은 고딕", sans-serif; margin: 0; background: #f0f0f0; color: #111827; }
header { padding: 16px 24px; background: #24292f; color: #fff; font-size: 1.25rem; font-weight: bold; }
main { padding: 24px; max-width: 760px; margin: 0 auto; }
h1 { margin: 0 0 4px; font-size: 1.5rem; }
h1 small { font-size: 0.9rem; font-weight: normal; color: #6b7280; }
h2 { margin: 16px 0 6px; font-size: 1rem; }
section > h2:first-child { margin-top: 0; }
.보조 { color: #6b7280; font-size: 0.9rem; }
.가운데 { text-align: center; }

.배치 { display: flex; gap: 32px; align-items: flex-start; margin-top: 16px; }
.결과 { flex: 1; min-width: 0; }

#캔버스 { display: block; width: 280px; max-width: 100%; background: #000; border: 1px solid #9ca3af; cursor: crosshair; touch-action: none; }
#캔버스.비활성 { opacity: 0.5; cursor: not-allowed; }
.버튼_줄 { display: flex; justify-content: space-between; max-width: 282px; margin-top: 10px; }
button { font: inherit; padding: 6px 20px; border: 1px solid #9ca3af; border-radius: 4px; background: #fff; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.결과_숫자 { font-size: 4.5rem; font-weight: bold; line-height: 1.1; text-align: center; color: #1e293b; }
.오류 { color: #b91c1c; font-size: 0.9rem; }

.막대_목록 { list-style: none; margin: 0; padding: 6px; background: #fff; border: 1px solid #d1d5db; }
.막대_목록 li { display: flex; align-items: center; gap: 8px; margin: 2px 0; font-size: 0.85rem; }
.막대_목록 .숫자 { width: 1em; }
.막대_목록 .막대 { flex: 1; height: 14px; background: #eef0f3; }
.막대_목록 .채움 { display: block; width: 0; height: 100%; background: #d1d5db; }
.막대_목록 .채움.강조 { background: #2563eb; }
.막대_목록 .퍼센트 { width: 3.5em; text-align: right; color: #6b7280; }

#미리보기 { display: block; width: 112px; height: 112px; background: #000; image-rendering: pixelated; }

/* 휴대폰처럼 좁은 화면에서는 위아래로 배치한다 */
@media (max-width: 640px) {
  main { padding: 16px; }
  .배치 { flex-direction: column; gap: 16px; }
  .결과 { width: 100%; }
}
```

- [ ] **3단계: `web_version/app.js` 작성**

```js
// 작성: {KST} KST
// 웹 버전 화면: 캔버스에 그린 숫자를 preprocess.js로 전처리하고 model.js로 인식해 결과를 보여준다.
// 마우스·터치·펜을 Pointer Events 하나로 처리한다.
(function () {
  "use strict";

  const 캔버스_크기 = 280;
  const 펜_굵기 = 22;             // desktop_version/app.py와 같은 굵기
  const 가중치_오류_문구 = "가중치 파일을 불러오지 못했습니다. desktop_version/export_web.py를 실행하세요.";

  const 캔버스 = document.getElementById("캔버스");
  const 붓 = 캔버스.getContext("2d", { willReadFrequently: true });
  const 미리보기 = document.getElementById("미리보기");
  const 미리보기_붓 = 미리보기.getContext("2d");
  const 결과_숫자 = document.getElementById("결과_숫자");
  const 확신도 = document.getElementById("확신도");
  const 오류 = document.getElementById("오류");
  const 막대_목록 = document.getElementById("막대_목록");
  const 인식_버튼 = document.getElementById("인식_버튼");
  const 지우기_버튼 = document.getElementById("지우기_버튼");

  const 막대들 = [];              // 숫자별 {채움, 퍼센트} 요소
  let 신경망 = null;              // 가중치를 불러오지 못하면 null로 남는다
  let 이전_좌표 = null;           // 그리는 중이 아니면 null

  // ---------- 화면 구성 ----------
  function 막대_만들기() {
    for (let 숫자 = 0; 숫자 < 10; 숫자++) {
      const 줄 = document.createElement("li");
      줄.innerHTML = `<span class="숫자">${숫자}</span><span class="막대"><span class="채움"></span></span><span class="퍼센트">0.0%</span>`;
      막대_목록.appendChild(줄);
      막대들.push({ 채움: 줄.querySelector(".채움"), 퍼센트: 줄.querySelector(".퍼센트") });
    }
  }

  function 막대_그리기(숫자, 비율, 강조) {
    const { 채움, 퍼센트 } = 막대들[숫자];
    채움.style.width = `${비율 * 100}%`;
    채움.classList.toggle("강조", 강조);
    퍼센트.textContent = `${(비율 * 100).toFixed(1)}%`;
  }

  function 결과_초기화() {
    결과_숫자.textContent = "-";
    확신도.textContent = "확신도: -";
    for (let 숫자 = 0; 숫자 < 10; 숫자++) 막대_그리기(숫자, 0, false);
    미리보기_붓.clearRect(0, 0, 미리보기.width, 미리보기.height);
  }

  function 결과_표시(예측_숫자, 확률) {
    결과_숫자.textContent = String(예측_숫자);
    확신도.textContent = `확신도: ${(확률[예측_숫자] * 100).toFixed(1)}%`;
    for (let 숫자 = 0; 숫자 < 10; 숫자++) 막대_그리기(숫자, 확률[숫자], 숫자 === 예측_숫자);
  }

  function 미리보기_표시(이미지) {
    const 데이터 = 미리보기_붓.createImageData(28, 28);
    for (let i = 0; i < 이미지.length; i++) {
      데이터.data[i * 4] = 데이터.data[i * 4 + 1] = 데이터.data[i * 4 + 2] = 이미지[i];
      데이터.data[i * 4 + 3] = 255;
    }
    미리보기_붓.putImageData(데이터, 0, 0);
  }

  // ---------- 그리기 ----------
  function 캔버스_지우기() {
    붓.fillStyle = "#000";
    붓.fillRect(0, 0, 캔버스_크기, 캔버스_크기);
    이전_좌표 = null;
    결과_초기화();
  }

  /** 화면 좌표를 캔버스 내부 좌표(280x280)로 바꾼다. CSS로 크기가 줄어도 맞게 계산한다 */
  function 캔버스_좌표(이벤트) {
    const 상자 = 캔버스.getBoundingClientRect();
    return {
      x: (이벤트.clientX - 상자.left - 캔버스.clientLeft) * (캔버스.width / 캔버스.clientWidth),
      y: (이벤트.clientY - 상자.top - 캔버스.clientTop) * (캔버스.height / 캔버스.clientHeight),
    };
  }

  function 점_찍기(좌표) {
    붓.fillStyle = "#fff";
    붓.beginPath();
    붓.arc(좌표.x, 좌표.y, 펜_굵기 / 2, 0, Math.PI * 2);
    붓.fill();
  }

  function 선_긋기(시작, 끝) {
    붓.strokeStyle = "#fff";
    붓.lineWidth = 펜_굵기;
    붓.lineCap = "round";
    붓.beginPath();
    붓.moveTo(시작.x, 시작.y);
    붓.lineTo(끝.x, 끝.y);
    붓.stroke();
  }

  function 펜_누르기(이벤트) {
    if (!신경망) return;
    이벤트.preventDefault();
    캔버스.setPointerCapture(이벤트.pointerId);
    이전_좌표 = 캔버스_좌표(이벤트);
    점_찍기(이전_좌표);
  }

  function 펜_움직이기(이벤트) {
    if (이전_좌표 === null) return;
    const 지금 = 캔버스_좌표(이벤트);
    선_긋기(이전_좌표, 지금);
    이전_좌표 = 지금;
  }

  function 펜_떼기() {
    if (이전_좌표 === null) return;
    이전_좌표 = null;
    인식하기();
  }

  // ---------- 인식 ----------
  function 인식하기() {
    if (!신경망) return;
    const 화소 = 붓.getImageData(0, 0, 캔버스_크기, 캔버스_크기).data;
    const 흑백 = new Uint8ClampedArray(캔버스_크기 * 캔버스_크기);
    for (let i = 0; i < 흑백.length; i++) 흑백[i] = 화소[i * 4];   // 흰 글씨이므로 R 채널이 곧 밝기

    const 입력_이미지 = window.전처리.모델_입력_이미지_만들기(흑백, 캔버스_크기, 캔버스_크기);
    if (입력_이미지 === null) {
      결과_초기화();
      return;
    }
    const 로짓 = 신경망.로짓_계산(window.전처리.정규화된_입력(입력_이미지));
    const 확률 = window.모델.소프트맥스(로짓);
    let 예측_숫자 = 0;
    for (let 숫자 = 1; 숫자 < 10; 숫자++) if (확률[숫자] > 확률[예측_숫자]) 예측_숫자 = 숫자;
    결과_표시(예측_숫자, 확률);
    미리보기_표시(입력_이미지);
  }

  // ---------- 시작 ----------
  막대_만들기();
  try {
    신경망 = window.모델.모델_만들기(window.MNIST_가중치);
  } catch (e) {
    console.error(e);
    오류.textContent = 가중치_오류_문구;
    오류.hidden = false;
    인식_버튼.disabled = true;
    지우기_버튼.disabled = true;
    캔버스.classList.add("비활성");
  }
  캔버스_지우기();

  캔버스.addEventListener("pointerdown", 펜_누르기);
  캔버스.addEventListener("pointermove", 펜_움직이기);
  캔버스.addEventListener("pointerup", 펜_떼기);
  캔버스.addEventListener("pointercancel", 펜_떼기);
  인식_버튼.addEventListener("click", 인식하기);
  지우기_버튼.addEventListener("click", 캔버스_지우기);
})();
```

- [ ] **4단계: 브라우저에서 동작 확인**

`http://localhost:8000/web_version/`을 연다.
1. 콘솔 오류가 없어야 한다(`read_console_messages` onlyErrors).
2. 캔버스 가운데에 세로로 `left_click_drag`해 "1"을 그린다. 결과 숫자가 1, 확신도가 표시되고, 1번 막대만 파란색이며, 미리보기에 28×28 세로 획이 보여야 한다.
3. [지우기]를 누르면 결과가 "-"로 돌아가야 한다.
4. 가로 획을 드래그한 뒤 이어서 오른쪽 위에서 왼쪽 아래로 사선을 드래그해 "7"을 그린다. 결과가 7이어야 한다(아니면 스크린샷을 남기고 보고한다).
5. `resize_window` preset `mobile`로 좁은 화면에서 위아래 배치가 되는지, 가로 스크롤이 없는지 스크린샷으로 확인한다. 확인 후 preset `desktop`으로 되돌린다.
6. 오류 처리 확인: `mv web_version/weights.js web_version/weights.js.bak` → 새로고침 → "가중치 파일을 불러오지 못했습니다..." 문구와 버튼 비활성을 확인한다 → `mv web_version/weights.js.bak web_version/weights.js`로 되돌리고 새로고침해 정상 동작을 다시 확인한다.

- [ ] **5단계: 커밋**

```bash
git add web_version/index.html web_version/style.css web_version/app.js
git commit -F - <<'EOF'
웹 버전 손글씨 인식 화면 추가

데스크톱 app.py와 같은 구성(캔버스, 인식 결과, 확신도, 숫자별 확률 막대, 28x28 입력 미리보기)이며,
Pointer Events로 마우스와 터치를 함께 지원하고 좁은 화면에서는 위아래로 배치한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### 작업 6: 소개 페이지 링크, 웹 CLAUDE.md, 최종 점검

**파일:**
- 수정: `index.html`(루트)
- 생성: `web_version/CLAUDE.md`

- [ ] **1단계: 루트 `index.html`의 `<main>` 내용 교체**

```html
  <main>
    <h1>MNIST 손글씨 숫자 인식</h1>
    <p>PyTorch CNN으로 MNIST를 학습하고, 직접 그린 손글씨 숫자를 인식하는 프로젝트입니다.</p>
    <ul>
      <li><a href="web_version/"><strong>웹 버전 실행하기</strong></a> — 설치 없이 브라우저에서 바로 숫자를 그려 인식합니다. 외부 라이브러리 없이 순수 자바스크립트로 추론합니다.</li>
      <li>데스크톱 버전 — 저장소의 <code>desktop_version</code> 폴더에 있는 PyTorch 학습 코드와 tkinter 프로그램입니다.</li>
    </ul>
    <p><a href="https://github.com/hannah0326/Study01_MNIST">GitHub 저장소</a></p>
  </main>
```

- [ ] **2단계: `web_version/CLAUDE.md` 생성**

````markdown
<!-- 작성: {KST} KST -->
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
````

- [ ] **3단계: 최종 점검**

1. `http://localhost:8000/web_version/tests/tests.html` → `window.테스트_결과`가 `{통과: 38, 실패: 0}`이어야 한다.
2. `http://localhost:8000/` → "웹 버전 실행하기" 링크를 누르면 웹 앱으로 이동해야 한다.
3. 작업 1의 경로 점검과 작업 2의 내보내기 점검 명령을 다시 실행해 둘 다 통과해야 한다.
4. `git status --short`에 의도하지 않은 파일(`__pycache__`, `desktop_version/data`, `.claude/launch.json`, `weights.js.bak`)이 없어야 한다.

- [ ] **4단계: 커밋**

```bash
git add index.html web_version/CLAUDE.md
git commit -F - <<'EOF'
소개 페이지에 웹 버전 링크 추가 및 web_version CLAUDE.md 작성

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
