<!-- 작성: 2026-09-26 01:58 KST -->
# desktop_version

PyTorch로 MNIST CNN을 학습하고, tkinter GUI로 사용자가 직접 그린 숫자를 인식하는 데스크톱 버전이다. 학습된 가중치 `mnist_cnn.pt`의 원본이 이 폴더에 있다. 저장소 공통 규칙과 환경 주의사항은 루트 [CLAUDE.md](../CLAUDE.md)를 본다.

## 명령어

```bash
python desktop_version/train.py    # MNIST를 desktop_version/data에 내려받고 데이터 증강으로 15 에폭 학습, 가중치를 desktop_version/mnist_cnn.pt로 저장
python desktop_version/app.py      # 캔버스에 그린 숫자를 mnist_cnn.pt로 예측하는 tkinter GUI 실행 (mnist_cnn.pt 필요)
python desktop_version/export_web.py   # mnist_cnn.pt → web_version/weights.js, 웹 테스트 기준 데이터 → web_version/tests/reference.js
```

경로는 모두 스크립트 파일 위치 기준(`Path(__file__).resolve().parent`)이라 어느 폴더에서 실행해도 된다. 테스트 스위트와 린터는 설정되어 있지 않다.

## 구조

- [model.py](model.py) — `MnistCNN` 네트워크 정의(conv 1→32→64, 2×2 맥스풀 ×2, 드롭아웃, fc 64·7·7→128→10). `train.py`와 `app.py`가 모두 이 클래스를 쓰므로, 입력 1×1×28×28 / 출력 로짓 10개라는 형태가 학습과 추론 사이의 약속이다. 구조를 바꾸면 `web_version/model.js`도 바꿔야 한다.
- [preprocess.py](preprocess.py) — 손글씨 이미지를 MNIST 방식으로 바꾸는 전처리(글씨 영역 자르기 → 긴 변 20px로 축소 → 28×28 중앙 배치 → 무게중심 정렬)와 정규화 상수(평균 0.1307 / 표준편차 0.3081). 캔버스 전체를 그냥 28×28로 줄이면 인식률이 크게 떨어지므로 이 전처리가 정확도의 핵심이다. `web_version/preprocess.js`가 이 파일을 픽셀 단위로 재현하므로, 바꾸면 JS 쪽도 바꾸고 기준 데이터를 다시 만든다.
- [train.py](train.py) — `torchvision.datasets.MNIST`로 `data/`에 데이터를 내려받고, Adam + CrossEntropyLoss + 코사인 학습률 스케줄로 `MnistCNN`을 15 에폭 학습한다. 마우스로 그린 숫자에 대비해 데이터 증강(이동·회전·크기·기울기, 획 굵게 만들기)을 쓰며, 평가는 증강 없이 한다. 학습이 끝나면 `model.state_dict()`를 `mnist_cnn.pt`에 덮어쓴다.
- [app.py](app.py) — tkinter 캔버스 앱. 검은 캔버스에 흰 펜(굵기 22)으로 그린 획을 화면의 `Canvas`와 화면 밖 PIL `Image`에 동시에 그리고, 마우스를 떼면 `preprocess.py`로 전처리해 자동 인식한다. 인식 결과·확신도·숫자별 확률 막대·모델 입력(28×28) 미리보기를 보여준다.
- [export_web.py](export_web.py) — `mnist_cnn.pt`의 텐서 8개를 정해진 순서(`텐서_순서`)대로 float32 리틀엔디언으로 이어 붙여 base64로 만들고 `web_version/weights.js`(`window.MNIST_가중치 = {목차, 데이터}`)에 쓴다. 같은 실행에서 PIL로 그린 손글씨 6개의 파이썬 전처리 결과와 MNIST 테스트 이미지 8장의 PyTorch 로짓을 `web_version/tests/reference.js`에 기준 데이터로 쓴다. 모델을 다시 학습하면 반드시 다시 실행한다.

`mnist_cnn.pt`는 전체 모델이 아니라 `state_dict`만 담고 있으므로, 불러올 때는 먼저 `MnistCNN()`을 만든 뒤 `load_state_dict`를 호출해야 한다. `data/`는 git에서 제외된다.
