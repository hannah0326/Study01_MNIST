# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MNIST 손글씨 숫자 인식 프로젝트. PyTorch CNN으로 MNIST를 학습하고, tkinter GUI로 사용자가 직접 그린 숫자를 인식한다. All code and comments in this repo are written in Korean — keep new code and comments in Korean to match.

Not a git repository. No package manifest (`requirements.txt`/`pyproject.toml`) — dependencies were installed directly via pip.

## Commands

```bash
python train.py         # MNIST를 ./data에 내려받고 5 에폭 학습, 가중치를 mnist_cnn.pt로 저장
python predict_gui.py   # 캔버스에 그린 숫자를 mnist_cnn.pt로 예측하는 tkinter GUI 실행 (mnist_cnn.pt 필요)
```

No test suite or linter is configured.

On this machine, `python`/`pip` on PATH may resolve to the Windows Store stub instead of the real interpreter depending on the shell; the actual interpreter installed via winget is at `C:\Users\shinh\AppData\Local\Programs\Python\Python312\python.exe`. If `import torch` fails with `WinError 4551` (애플리케이션 제어 정책 차단), Windows Smart App Control is blocking the unsigned torch DLLs — it must be turned off in Settings → Privacy & security → Windows Security → App & browser control (a security-setting change, not something to script around).

## Architecture

- [model.py](model.py) — `MnistCNN`: the network definition (conv 1→32→64, 2×2 maxpool ×2, dropout, fc 64·7·7→128→10). Both `train.py` and `predict_gui.py` import this class, so its input/output shape (1×1×28×28 in, 10 logits out) is the contract between training and inference.
- [train.py](train.py) — downloads MNIST via `torchvision.datasets.MNIST` into `./data`, trains `MnistCNN` with Adam + CrossEntropyLoss, evaluates each epoch, and saves `model.state_dict()` to `mnist_cnn.pt` (relative path, overwritten on each run).
- [predict_gui.py](predict_gui.py) — tkinter canvas app. Mouse strokes are drawn both on the visible `Canvas` and in parallel onto an off-screen PIL `Image` (white background, black strokes) so the same drawing can be preprocessed for the model. On predict, the PIL image is downsampled to 28×28, colors inverted (MNIST digits are white-on-black, opposite of what the user draws), and normalized with the **same mean/std as `train.py`** (0.1307 / 0.3081, duplicated as constants in both files — if you change normalization in one, update the other).

`mnist_cnn.pt` is a `state_dict` only (not a full pickled model), so any loader must construct `MnistCNN()` first and call `load_state_dict`.
