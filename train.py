# -*- coding: utf-8 -*-
"""MNIST 데이터셋으로 CNN 모델을 학습하고 가중치를 mnist_cnn.pt로 저장하는 스크립트"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

from model import MnistCNN

# 학습 관련 설정값
배치_크기 = 64
에폭_수 = 5
학습률 = 0.001
가중치_저장_경로 = "mnist_cnn.pt"


def 데이터로더_준비():
    """MNIST 학습/테스트 데이터셋을 내려받고 DataLoader로 변환"""
    # MNIST의 평균/표준편차로 정규화 (일반적으로 널리 쓰이는 값)
    변환 = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])

    학습_데이터셋 = datasets.MNIST(root="./data", train=True, download=True, transform=변환)
    테스트_데이터셋 = datasets.MNIST(root="./data", train=False, download=True, transform=변환)

    학습_로더 = DataLoader(학습_데이터셋, batch_size=배치_크기, shuffle=True)
    테스트_로더 = DataLoader(테스트_데이터셋, batch_size=배치_크기, shuffle=False)
    return 학습_로더, 테스트_로더


def 한_에폭_학습(모델, 로더, 손실함수, 옵티마이저, 장치):
    모델.train()
    누적_손실 = 0.0
    for 배치_idx, (이미지, 정답) in enumerate(로더):
        이미지, 정답 = 이미지.to(장치), 정답.to(장치)

        옵티마이저.zero_grad()
        출력 = 모델(이미지)
        손실 = 손실함수(출력, 정답)
        손실.backward()
        옵티마이저.step()

        누적_손실 += 손실.item()
        if (배치_idx + 1) % 200 == 0:
            print(f"  배치 {배치_idx + 1}/{len(로더)} - 손실: {손실.item():.4f}")

    return 누적_손실 / len(로더)


@torch.no_grad()
def 테스트_평가(모델, 로더, 손실함수, 장치):
    모델.eval()
    누적_손실 = 0.0
    정답_개수 = 0

    for 이미지, 정답 in 로더:
        이미지, 정답 = 이미지.to(장치), 정답.to(장치)
        출력 = 모델(이미지)
        누적_손실 += 손실함수(출력, 정답).item()
        예측 = 출력.argmax(dim=1)
        정답_개수 += (예측 == 정답).sum().item()

    평균_손실 = 누적_손실 / len(로더)
    정확도 = 100.0 * 정답_개수 / len(로더.dataset)
    return 평균_손실, 정확도


def main():
    장치 = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"사용 장치: {장치}")

    학습_로더, 테스트_로더 = 데이터로더_준비()

    모델 = MnistCNN().to(장치)
    손실함수 = nn.CrossEntropyLoss()
    옵티마이저 = optim.Adam(모델.parameters(), lr=학습률)

    for 에폭 in range(1, 에폭_수 + 1):
        print(f"\n=== 에폭 {에폭}/{에폭_수} ===")
        평균_학습_손실 = 한_에폭_학습(모델, 학습_로더, 손실함수, 옵티마이저, 장치)
        테스트_손실, 테스트_정확도 = 테스트_평가(모델, 테스트_로더, 손실함수, 장치)
        print(f"에폭 {에폭} 결과 - 학습 손실: {평균_학습_손실:.4f}, "
              f"테스트 손실: {테스트_손실:.4f}, 테스트 정확도: {테스트_정확도:.2f}%")

    torch.save(모델.state_dict(), 가중치_저장_경로)
    print(f"\n학습된 가중치를 '{가중치_저장_경로}' 파일로 저장했습니다.")


if __name__ == "__main__":
    main()
