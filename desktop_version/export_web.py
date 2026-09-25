# 작성: 2026-09-26 02:05 KST
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
