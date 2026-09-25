# -*- coding: utf-8 -*-
"""MNIST 손글씨 숫자 인식을 위한 CNN(합성곱 신경망) 모델 정의"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class MnistCNN(nn.Module):
    """28x28 흑백 손글씨 숫자 이미지를 입력받아 0~9 중 하나로 분류하는 CNN"""

    def __init__(self):
        super().__init__()
        # 첫 번째 합성곱 블록: 1채널(흑백) -> 32채널
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=32, kernel_size=3, padding=1)
        # 두 번째 합성곱 블록: 32채널 -> 64채널
        self.conv2 = nn.Conv2d(in_channels=32, out_channels=64, kernel_size=3, padding=1)
        # 2x2 최대 풀링 (특징맵 크기를 절반으로 축소)
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)
        # 과적합 방지를 위한 드롭아웃
        self.dropout1 = nn.Dropout(0.25)
        self.dropout2 = nn.Dropout(0.5)
        # 28x28 -> (풀링 2번) -> 7x7, 채널 64개이므로 64*7*7의 입력을 받는 완전연결층
        self.fc1 = nn.Linear(64 * 7 * 7, 128)
        self.fc2 = nn.Linear(128, 10)  # 최종 출력: 숫자 0~9, 총 10개 클래스

    def forward(self, x):
        x = F.relu(self.conv1(x))
        x = self.pool(x)              # 28x28 -> 14x14
        x = F.relu(self.conv2(x))
        x = self.pool(x)              # 14x14 -> 7x7
        x = self.dropout1(x)
        x = torch.flatten(x, 1)       # 완전연결층에 입력하기 위해 1차원으로 펼침
        x = F.relu(self.fc1(x))
        x = self.dropout2(x)
        x = self.fc2(x)               # 소프트맥스 이전의 로짓(logit) 값 반환
        return x
