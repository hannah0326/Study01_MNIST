# -*- coding: utf-8 -*-
"""
손글씨 숫자 인식 GUI 프로그램

마우스로 캔버스에 숫자를 직접 그린 뒤 '인식' 버튼을 누르면,
학습된 CNN 모델(mnist_cnn.pt)이 어떤 숫자인지 예측해서 보여준다.
"""

import tkinter as tk
from tkinter import messagebox

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageDraw

from model import MnistCNN

가중치_경로 = "mnist_cnn.pt"
캔버스_크기 = 280          # 화면에 보여줄 캔버스 크기 (그리기 편하도록 확대)
모델_입력_크기 = 28        # 실제 모델에 입력할 이미지 크기 (MNIST 표준 크기)
펜_굵기 = 18

# MNIST 학습 때 사용한 것과 동일한 정규화 값
정규화_평균 = 0.1307
정규화_표준편차 = 0.3081


class 손글씨_인식_앱:
    def __init__(self, 루트):
        self.루트 = 루트
        self.루트.title("손글씨 숫자 인식")

        self.장치 = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.모델 = self._모델_불러오기()

        # 실제 예측에 사용할 그림은 PIL 이미지에 그대로 그려서 보관한다
        # (흰 배경 위에 검은색 글씨: 사람이 종이에 쓰는 방식과 동일)
        self.그림 = Image.new("L", (캔버스_크기, 캔버스_크기), color=255)
        self.그리기_도구 = ImageDraw.Draw(self.그림)

        self._화면_구성()

    def _모델_불러오기(self):
        모델 = MnistCNN().to(self.장치)
        try:
            모델.load_state_dict(torch.load(가중치_경로, map_location=self.장치))
        except FileNotFoundError:
            messagebox.showerror(
                "가중치 파일 없음",
                f"'{가중치_경로}' 파일을 찾을 수 없습니다.\n먼저 train.py를 실행해 모델을 학습시켜 주세요.",
            )
            raise
        모델.eval()
        return 모델

    def _화면_구성(self):
        self.캔버스 = tk.Canvas(
            self.루트, width=캔버스_크기, height=캔버스_크기, bg="white", cursor="cross"
        )
        self.캔버스.grid(row=0, column=0, columnspan=3, padx=10, pady=10)
        self.캔버스.bind("<B1-Motion>", self._그리는_중)
        self.캔버스.bind("<ButtonRelease-1>", self._펜_떼기)

        self.이전_좌표 = None

        self.결과_라벨 = tk.Label(self.루트, text="숫자를 그리고 [인식] 버튼을 누르세요", font=("맑은 고딕", 14))
        self.결과_라벨.grid(row=1, column=0, columnspan=3, pady=(0, 10))

        인식_버튼 = tk.Button(self.루트, text="인식", width=10, command=self._예측하기)
        인식_버튼.grid(row=2, column=0, padx=5, pady=(0, 10))

        지우기_버튼 = tk.Button(self.루트, text="지우기", width=10, command=self._캔버스_지우기)
        지우기_버튼.grid(row=2, column=1, padx=5, pady=(0, 10))

        종료_버튼 = tk.Button(self.루트, text="종료", width=10, command=self.루트.destroy)
        종료_버튼.grid(row=2, column=2, padx=5, pady=(0, 10))

    def _그리는_중(self, 이벤트):
        x, y = 이벤트.x, 이벤트.y
        if self.이전_좌표 is not None:
            x0, y0 = self.이전_좌표
            # 화면 캔버스에 선 그리기 (사용자에게 보이는 부분)
            self.캔버스.create_line(x0, y0, x, y, width=펜_굵기, fill="black",
                                   capstyle=tk.ROUND, smooth=True)
            # 실제 예측에 쓰일 PIL 이미지에도 동일하게 선 그리기
            self.그리기_도구.line([x0, y0, x, y], fill=0, width=펜_굵기)
        self.이전_좌표 = (x, y)

    def _펜_떼기(self, 이벤트):
        self.이전_좌표 = None

    def _캔버스_지우기(self):
        self.캔버스.delete("all")
        self.그림 = Image.new("L", (캔버스_크기, 캔버스_크기), color=255)
        self.그리기_도구 = ImageDraw.Draw(self.그림)
        self.결과_라벨.config(text="숫자를 그리고 [인식] 버튼을 누르세요")

    def _전처리(self):
        """캔버스에 그린 이미지를 모델 입력 형식(1x1x28x28 정규화 텐서)으로 변환"""
        # 28x28로 축소
        축소_이미지 = self.그림.resize((모델_입력_크기, 모델_입력_크기), Image.LANCZOS)
        # MNIST는 검은 배경(0)에 흰색 숫자(255)이므로, 흰 배경/검은 글씨인 캔버스 이미지를 반전
        픽셀_배열 = 255 - np.array(축소_이미지, dtype=np.float32)

        텐서 = torch.from_numpy(픽셀_배열)
        텐서 = 텐서.view(1, 1, 모델_입력_크기, 모델_입력_크기) / 255.0
        텐서 = (텐서 - 정규화_평균) / 정규화_표준편차
        return 텐서.to(self.장치)

    def _예측하기(self):
        입력_텐서 = self._전처리()
        with torch.no_grad():
            출력 = self.모델(입력_텐서)
            확률 = F.softmax(출력, dim=1)
            예측_숫자 = int(확률.argmax(dim=1).item())
            신뢰도 = float(확률[0, 예측_숫자].item()) * 100

        self.결과_라벨.config(text=f"예측 결과: {예측_숫자}  (신뢰도 {신뢰도:.1f}%)")


def main():
    루트 = tk.Tk()
    손글씨_인식_앱(루트)
    루트.mainloop()


if __name__ == "__main__":
    main()
