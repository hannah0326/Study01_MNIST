# -*- coding: utf-8 -*-
"""
손글씨 숫자 인식기 (MNIST CNN)

검은 캔버스에 마우스로 숫자를 쓰고 마우스를 떼면 자동으로 인식한다.
인식 결과, 확신도, 숫자별 확률, 모델에 실제로 들어가는 28x28 입력 이미지를 함께 보여준다.
"""

import tkinter as tk
from tkinter import messagebox

import torch
import torch.nn.functional as F
from PIL import Image, ImageDraw, ImageTk

from model import MnistCNN
from preprocess import 모델_입력_이미지_만들기, 텐서로_변환

가중치_경로 = "mnist_cnn.pt"
캔버스_크기 = 280
펜_굵기 = 22
미리보기_크기 = 112       # 28x28 모델 입력을 4배로 확대해서 보여준다

글꼴 = "맑은 고딕"
배경색 = "#f0f0f0"
강조색 = "#2563eb"
막대_기본색 = "#d1d5db"
막대_바탕색 = "#ffffff"
글자색 = "#111827"
보조_글자색 = "#6b7280"

막대_너비 = 190
막대_높이 = 14


class 손글씨_인식_앱:
    def __init__(self, 루트):
        self.루트 = 루트
        self.루트.title("손글씨 숫자 인식기 (MNIST CNN)")
        self.루트.configure(bg=배경색)
        self.루트.resizable(False, False)

        self.장치 = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.모델 = self._모델_불러오기()

        # 실제 예측에 쓰는 그림: 검은 배경에 흰 글씨 (MNIST와 같은 방향)
        self.그림 = Image.new("L", (캔버스_크기, 캔버스_크기), color=0)
        self.그리기_도구 = ImageDraw.Draw(self.그림)
        self.이전_좌표 = None

        self._화면_구성()
        self._결과_초기화()

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
        왼쪽 = tk.Frame(self.루트, bg=배경색)
        왼쪽.grid(row=0, column=0, padx=(16, 8), pady=16, sticky="n")
        오른쪽 = tk.Frame(self.루트, bg=배경색)
        오른쪽.grid(row=0, column=1, padx=(8, 16), pady=16, sticky="n")

        # ---- 왼쪽: 그리기 영역 ----
        tk.Label(왼쪽, text="여기에 숫자를 써 주세요 (0~9)", font=(글꼴, 11, "bold"),
                 bg=배경색, fg=글자색).pack(anchor="w", pady=(0, 6))

        self.캔버스 = tk.Canvas(왼쪽, width=캔버스_크기, height=캔버스_크기, bg="black",
                              highlightthickness=1, highlightbackground="#9ca3af", cursor="cross")
        self.캔버스.pack()
        self.캔버스.bind("<B1-Motion>", self._그리는_중)
        self.캔버스.bind("<ButtonRelease-1>", self._펜_떼기)

        버튼_줄 = tk.Frame(왼쪽, bg=배경색)
        버튼_줄.pack(fill="x", pady=(10, 0))
        tk.Button(버튼_줄, text="인식하기", width=12, command=self._예측하기).pack(side="left")
        tk.Button(버튼_줄, text="지우기", width=12, command=self._캔버스_지우기).pack(side="right")

        tk.Label(왼쪽, text="마우스를 떼면 자동으로 인식합니다.", font=(글꼴, 9),
                 bg=배경색, fg=보조_글자색).pack(anchor="w", pady=(8, 0))

        # ---- 오른쪽: 결과 영역 ----
        tk.Label(오른쪽, text="인식 결과", font=(글꼴, 11, "bold"),
                 bg=배경색, fg=글자색).pack(anchor="w")

        self.결과_숫자 = tk.Label(오른쪽, text="-", font=(글꼴, 56, "bold"), bg=배경색, fg="#1e293b")
        self.결과_숫자.pack(pady=(0, 0))
        self.확신도_라벨 = tk.Label(오른쪽, text="확신도: -", font=(글꼴, 10), bg=배경색, fg=보조_글자색)
        self.확신도_라벨.pack()

        tk.Label(오른쪽, text="숫자별 확률", font=(글꼴, 11, "bold"),
                 bg=배경색, fg=글자색).pack(anchor="w", pady=(12, 4))

        막대_틀 = tk.Frame(오른쪽, bg=막대_바탕색, highlightthickness=1, highlightbackground="#d1d5db")
        막대_틀.pack(fill="x")
        self.막대_캔버스 = []
        self.막대_퍼센트 = []
        for 숫자 in range(10):
            줄 = tk.Frame(막대_틀, bg=막대_바탕색)
            줄.pack(fill="x", padx=6, pady=2)
            tk.Label(줄, text=str(숫자), width=2, anchor="w", font=(글꼴, 9),
                     bg=막대_바탕색, fg=글자색).pack(side="left")
            막대 = tk.Canvas(줄, width=막대_너비, height=막대_높이, bg="#eef0f3", highlightthickness=0)
            막대.pack(side="left", padx=4)
            퍼센트 = tk.Label(줄, text="0.0%", width=6, anchor="e", font=(글꼴, 9),
                            bg=막대_바탕색, fg=보조_글자색)
            퍼센트.pack(side="left")
            self.막대_캔버스.append(막대)
            self.막대_퍼센트.append(퍼센트)

        tk.Label(오른쪽, text="모델 입력 (28x28)", font=(글꼴, 11, "bold"),
                 bg=배경색, fg=글자색).pack(anchor="w", pady=(12, 4))
        self.미리보기_캔버스 = tk.Canvas(오른쪽, width=미리보기_크기, height=미리보기_크기, bg="black",
                                    highlightthickness=0)
        self.미리보기_캔버스.pack(anchor="w")
        self.미리보기_사진 = None

    # ---------- 그리기 ----------
    def _그리는_중(self, 이벤트):
        x, y = 이벤트.x, 이벤트.y
        if self.이전_좌표 is None:
            self.이전_좌표 = (x, y)
        x0, y0 = self.이전_좌표
        self.캔버스.create_line(x0, y0, x, y, width=펜_굵기, fill="white",
                              capstyle=tk.ROUND, smooth=True)
        self.그리기_도구.line([x0, y0, x, y], fill=255, width=펜_굵기)
        반지름 = 펜_굵기 / 2
        self.그리기_도구.ellipse([x - 반지름, y - 반지름, x + 반지름, y + 반지름], fill=255)
        self.이전_좌표 = (x, y)

    def _펜_떼기(self, 이벤트):
        self.이전_좌표 = None
        self._예측하기()

    def _캔버스_지우기(self):
        self.캔버스.delete("all")
        self.그림 = Image.new("L", (캔버스_크기, 캔버스_크기), color=0)
        self.그리기_도구 = ImageDraw.Draw(self.그림)
        self.이전_좌표 = None
        self._결과_초기화()

    # ---------- 예측 ----------
    def _예측하기(self):
        입력_이미지 = 모델_입력_이미지_만들기(self.그림)
        if 입력_이미지 is None:
            self._결과_초기화()
            return

        with torch.no_grad():
            출력 = self.모델(텐서로_변환(입력_이미지).to(self.장치))
            확률 = F.softmax(출력, dim=1)[0].cpu().tolist()

        예측_숫자 = max(range(10), key=lambda i: 확률[i])
        self._결과_표시(예측_숫자, 확률)
        self._미리보기_표시(입력_이미지)

    def _결과_표시(self, 예측_숫자, 확률):
        self.결과_숫자.config(text=str(예측_숫자))
        self.확신도_라벨.config(text=f"확신도: {확률[예측_숫자] * 100:.1f}%")
        for 숫자 in range(10):
            self._막대_그리기(숫자, 확률[숫자], 강조=(숫자 == 예측_숫자))

    def _막대_그리기(self, 숫자, 비율, 강조):
        막대 = self.막대_캔버스[숫자]
        막대.delete("all")
        채움_너비 = int(막대_너비 * 비율)
        if 채움_너비 > 0:
            막대.create_rectangle(0, 0, 채움_너비, 막대_높이, fill=강조색 if 강조 else 막대_기본색, width=0)
        self.막대_퍼센트[숫자].config(text=f"{비율 * 100:.1f}%")

    def _미리보기_표시(self, 입력_이미지):
        확대 = 입력_이미지.resize((미리보기_크기, 미리보기_크기), Image.NEAREST)
        self.미리보기_사진 = ImageTk.PhotoImage(확대)
        self.미리보기_캔버스.delete("all")
        self.미리보기_캔버스.create_image(0, 0, anchor="nw", image=self.미리보기_사진)

    def _결과_초기화(self):
        self.결과_숫자.config(text="-")
        self.확신도_라벨.config(text="확신도: -")
        for 숫자 in range(10):
            self._막대_그리기(숫자, 0.0, 강조=False)
        self.미리보기_캔버스.delete("all")


def main():
    루트 = tk.Tk()
    손글씨_인식_앱(루트)
    루트.mainloop()


if __name__ == "__main__":
    main()
