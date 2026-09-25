# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 주는 안내입니다.

## 프로젝트

MNIST 손글씨 숫자 인식 프로젝트. PyTorch CNN으로 MNIST를 학습하고, tkinter GUI로 사용자가 직접 그린 숫자를 인식한다. 이 저장소의 모든 코드·주석·커밋 메시지·문서는 한국어로 작성하며, 새로 작성하는 내용도 한국어로 맞춘다.

원격 저장소: https://github.com/hannah0326/Study01_MNIST (공개, `master` 브랜치). `index.html`은 GitHub Pages로 배포된다. 패키지 명세 파일(`requirements.txt`/`pyproject.toml`)은 없으며, 의존성은 pip로 직접 설치했다.

## 명령어

```bash
python train.py         # MNIST를 ./data에 내려받고 데이터 증강으로 15 에폭 학습, 가중치를 mnist_cnn.pt로 저장
python app.py           # 캔버스에 그린 숫자를 mnist_cnn.pt로 예측하는 tkinter GUI 실행 (mnist_cnn.pt 필요)
```

테스트 스위트와 린터는 설정되어 있지 않다.

이 컴퓨터에서는 셸에 따라 PATH의 `python`/`pip`이 실제 인터프리터가 아니라 Windows 스토어 더미 실행 파일로 잡힐 수 있다. winget으로 설치한 실제 인터프리터 경로는 `C:\Users\shinh\AppData\Local\Programs\Python\Python312\python.exe`이다. `import torch`가 `WinError 4551`(애플리케이션 제어 정책 차단)로 실패하면 Windows 스마트 앱 제어가 서명되지 않은 torch DLL을 막고 있는 것이므로, 설정 → 개인 정보 및 보안 → Windows 보안 → 앱 및 브라우저 제어에서 사용자가 직접 꺼야 한다 (보안 설정 변경이므로 스크립트로 우회하지 않는다).

## 구조

- [model.py](model.py) — `MnistCNN` 네트워크 정의 (conv 1→32→64, 2×2 맥스풀 ×2, 드롭아웃, fc 64·7·7→128→10). `train.py`와 `app.py`가 모두 이 클래스를 가져다 쓰므로, 입력 1×1×28×28 / 출력 로짓 10개라는 형태가 학습과 추론 사이의 약속이다.
- [preprocess.py](preprocess.py) — 손글씨 이미지를 MNIST 방식으로 바꾸는 전처리(글씨 영역 자르기 → 긴 변 20px로 축소 → 28×28 중앙 배치 → 무게중심 정렬)와 정규화 상수(평균 0.1307 / 표준편차 0.3081). 캔버스 전체를 그냥 28×28로 줄이면 인식률이 크게 떨어지므로 이 전처리가 정확도의 핵심이다. `train.py`와 `app.py`가 정규화 상수를 여기서 함께 가져다 쓴다.
- [train.py](train.py) — `torchvision.datasets.MNIST`로 `./data`에 데이터를 내려받고, Adam + CrossEntropyLoss로 `MnistCNN`을 15 에폭 학습한다. 마우스로 그린 숫자에 대비해 데이터 증강(이동·회전·크기·기울기, 획 굵게 만들기)을 쓰며, 평가는 증강 없이 한다. 학습이 끝나면 `model.state_dict()`를 `mnist_cnn.pt`(상대 경로, 실행할 때마다 덮어씀)로 저장한다.
- [app.py](app.py) — tkinter 캔버스 앱. 검은 캔버스에 흰 펜으로 그린 획을 화면의 `Canvas`와 화면 밖 PIL `Image`에 동시에 그리고, 마우스를 떼면 `preprocess.py`로 전처리해 자동 인식한다. 인식 결과·확신도·숫자별 확률 막대·모델 입력(28×28) 미리보기를 보여준다.

`mnist_cnn.pt`는 전체 모델이 아니라 `state_dict`만 담고 있으므로, 불러올 때는 먼저 `MnistCNN()`을 만든 뒤 `load_state_dict`를 호출해야 한다.
