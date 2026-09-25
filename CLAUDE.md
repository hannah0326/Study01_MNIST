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
