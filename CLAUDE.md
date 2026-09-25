# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 주는 안내입니다.

## 프로젝트

MNIST 손글씨 숫자 인식 프로젝트. PyTorch CNN으로 MNIST를 학습하고, tkinter GUI로 사용자가 직접 그린 숫자를 인식한다. 이 저장소의 모든 코드·주석·커밋 메시지·문서는 한국어로 작성하며, 새로 작성하는 내용도 한국어로 맞춘다.

원격 저장소: https://github.com/hannah0326/Study01_MNIST (공개, `master` 브랜치). `index.html`은 GitHub Pages로 배포된다. 패키지 명세 파일(`requirements.txt`/`pyproject.toml`)은 없으며, 의존성은 pip로 직접 설치했다.

## 명령어

```bash
python train.py         # MNIST를 ./data에 내려받고 5 에폭 학습, 가중치를 mnist_cnn.pt로 저장
python app.py           # 캔버스에 그린 숫자를 mnist_cnn.pt로 예측하는 tkinter GUI 실행 (mnist_cnn.pt 필요)
```

테스트 스위트와 린터는 설정되어 있지 않다.

이 컴퓨터에서는 셸에 따라 PATH의 `python`/`pip`이 실제 인터프리터가 아니라 Windows 스토어 더미 실행 파일로 잡힐 수 있다. winget으로 설치한 실제 인터프리터 경로는 `C:\Users\shinh\AppData\Local\Programs\Python\Python312\python.exe`이다. `import torch`가 `WinError 4551`(애플리케이션 제어 정책 차단)로 실패하면 Windows 스마트 앱 제어가 서명되지 않은 torch DLL을 막고 있는 것이므로, 설정 → 개인 정보 및 보안 → Windows 보안 → 앱 및 브라우저 제어에서 사용자가 직접 꺼야 한다 (보안 설정 변경이므로 스크립트로 우회하지 않는다).

## 구조

- [model.py](model.py) — `MnistCNN` 네트워크 정의 (conv 1→32→64, 2×2 맥스풀 ×2, 드롭아웃, fc 64·7·7→128→10). `train.py`와 `app.py`가 모두 이 클래스를 가져다 쓰므로, 입력 1×1×28×28 / 출력 로짓 10개라는 형태가 학습과 추론 사이의 약속이다.
- [train.py](train.py) — `torchvision.datasets.MNIST`로 `./data`에 데이터를 내려받고, Adam + CrossEntropyLoss로 `MnistCNN`을 학습하며 매 에폭마다 평가한 뒤 `model.state_dict()`를 `mnist_cnn.pt`(상대 경로, 실행할 때마다 덮어씀)로 저장한다.
- [app.py](app.py) — tkinter 캔버스 앱. 마우스 획을 화면의 `Canvas`와 화면 밖 PIL `Image`(흰 배경, 검은 획)에 동시에 그려서, 같은 그림을 모델 입력으로 전처리한다. 예측 시 PIL 이미지를 28×28로 줄이고, 색을 반전(MNIST는 검은 배경에 흰 숫자라 사용자가 그리는 방식과 반대)한 뒤, **`train.py`와 같은 평균/표준편차**(0.1307 / 0.3081, 두 파일에 상수로 중복 정의됨)로 정규화한다. 한쪽의 정규화를 바꾸면 다른 쪽도 같이 바꿔야 한다.

`mnist_cnn.pt`는 전체 모델이 아니라 `state_dict`만 담고 있으므로, 불러올 때는 먼저 `MnistCNN()`을 만든 뒤 `load_state_dict`를 호출해야 한다.
