// 작성: 2026-09-26 02:22 KST
// MnistCNN(desktop_version/model.py)의 순전파를 외부 라이브러리 없이 순수 자바스크립트로 구현한다.
// 가중치는 weights.js가 정의한 window.MNIST_가중치 {목차, 데이터}에서 읽는다.
(function () {
  "use strict";

  // desktop_version/export_web.py의 텐서_순서와 MnistCNN의 형태
  const 텐서_형태 = {
    "conv1.weight": [32, 1, 3, 3],
    "conv1.bias": [32],
    "conv2.weight": [64, 32, 3, 3],
    "conv2.bias": [64],
    "fc1.weight": [128, 64 * 7 * 7],
    "fc1.bias": [128],
    "fc2.weight": [10, 128],
    "fc2.bias": [10],
  };

  const 원소_개수 = (형태) => 형태.reduce((곱, 값) => 곱 * 값, 1);

  function base64_바이트(문자열) {
    const 이진 = atob(문자열);
    const 바이트 = new Uint8Array(이진.length);
    for (let i = 0; i < 이진.length; i++) 바이트[i] = 이진.charCodeAt(i);
    return 바이트;
  }

  /** {목차, 데이터}를 {이름: Float32Array}로 복원한다. 목차와 데이터 크기가 맞지 않으면 예외 */
  function 가중치_복원(원본) {
    const 바이트 = base64_바이트(원본.데이터);
    if (바이트.length % 4 !== 0) throw new Error("가중치 바이트 수가 4의 배수가 아닙니다");
    const 전체_개수 = 바이트.length / 4;
    const 보기 = new DataView(바이트.buffer);
    const 가중치 = {};
    let 합계 = 0;
    for (const { 이름, 형태, 시작 } of 원본.목차) {
      const 개수 = 원소_개수(형태);
      if (시작 + 개수 > 전체_개수) throw new Error(`${이름}: 가중치 데이터가 모자랍니다`);
      const 값들 = new Float32Array(개수);
      for (let i = 0; i < 개수; i++) 값들[i] = 보기.getFloat32((시작 + i) * 4, true);
      가중치[이름] = 값들;
      합계 += 개수;
    }
    if (합계 !== 전체_개수) throw new Error(`가중치 개수가 맞지 않습니다: 목차 ${합계}개, 데이터 ${전체_개수}개`);
    return 가중치;
  }

  /** 3x3 합성곱(패딩 1, 보폭 1). 입력은 [입력_채널, 높이, 너비], 커널은 [출력_채널, 입력_채널, 3, 3]을 펼친 배열 */
  function 합성곱2d(입력, 입력_채널, 높이, 너비, 커널, 편향, 출력_채널) {
    const 출력 = new Float32Array(출력_채널 * 높이 * 너비);
    for (let o = 0; o < 출력_채널; o++) {
      for (let y = 0; y < 높이; y++) {
        for (let x = 0; x < 너비; x++) {
          let 합 = 편향[o];
          for (let c = 0; c < 입력_채널; c++) {
            for (let ky = 0; ky < 3; ky++) {
              const iy = y + ky - 1;
              if (iy < 0 || iy >= 높이) continue;
              for (let kx = 0; kx < 3; kx++) {
                const ix = x + kx - 1;
                if (ix < 0 || ix >= 너비) continue;
                합 += 입력[(c * 높이 + iy) * 너비 + ix] * 커널[((o * 입력_채널 + c) * 3 + ky) * 3 + kx];
              }
            }
          }
          출력[(o * 높이 + y) * 너비 + x] = 합;
        }
      }
    }
    return 출력;
  }

  /** 음수를 0으로 바꾼다 (배열을 직접 고치고 그대로 돌려준다) */
  function ReLU(배열) {
    for (let i = 0; i < 배열.length; i++) if (배열[i] < 0) 배열[i] = 0;
    return 배열;
  }

  /** 2x2 최대 풀링(보폭 2). 입력 [채널, 높이, 너비] → 출력 [채널, 높이/2, 너비/2] */
  function 맥스풀2x2(입력, 채널, 높이, 너비) {
    const 새_높이 = 높이 >> 1;
    const 새_너비 = 너비 >> 1;
    const 출력 = new Float32Array(채널 * 새_높이 * 새_너비);
    for (let c = 0; c < 채널; c++) {
      for (let y = 0; y < 새_높이; y++) {
        for (let x = 0; x < 새_너비; x++) {
          const 기준 = (c * 높이 + y * 2) * 너비 + x * 2;
          출력[(c * 새_높이 + y) * 새_너비 + x] = Math.max(
            입력[기준], 입력[기준 + 1], 입력[기준 + 너비], 입력[기준 + 너비 + 1]);
        }
      }
    }
    return 출력;
  }

  /** 완전연결층. 가중치는 [출력_개수, 입력_개수]를 펼친 배열 (torch nn.Linear와 같음) */
  function 전결합(입력, 가중치, 편향, 출력_개수) {
    const 입력_개수 = 입력.length;
    const 출력 = new Float32Array(출력_개수);
    for (let o = 0; o < 출력_개수; o++) {
      let 합 = 편향[o];
      const 시작 = o * 입력_개수;
      for (let i = 0; i < 입력_개수; i++) 합 += 입력[i] * 가중치[시작 + i];
      출력[o] = 합;
    }
    return 출력;
  }

  /** 로짓을 확률로 바꾼다. 가장 큰 값을 빼서 exp가 넘치지 않게 한다 */
  function 소프트맥스(로짓) {
    const 최대 = Math.max(...로짓);
    const 지수 = Array.from(로짓, (값) => Math.exp(값 - 최대));
    const 합 = 지수.reduce((a, b) => a + b, 0);
    return 지수.map((값) => 값 / 합);
  }

  /** 정규화된 28x28 입력(Float32Array 784개)으로 로짓 10개를 계산한다. 드롭아웃은 추론 때 하는 일이 없어 생략 */
  function 순전파(가중치, 입력) {
    let x = ReLU(합성곱2d(입력, 1, 28, 28, 가중치["conv1.weight"], 가중치["conv1.bias"], 32));
    x = 맥스풀2x2(x, 32, 28, 28);                       // 28x28 -> 14x14
    x = ReLU(합성곱2d(x, 32, 14, 14, 가중치["conv2.weight"], 가중치["conv2.bias"], 64));
    x = 맥스풀2x2(x, 64, 14, 14);                       // 14x14 -> 7x7, [64,7,7]을 펼친 순서가 곧 torch.flatten 결과
    x = ReLU(전결합(x, 가중치["fc1.weight"], 가중치["fc1.bias"], 128));
    return 전결합(x, 가중치["fc2.weight"], 가중치["fc2.bias"], 10);
  }

  /** weights.js 원본으로 신경망을 만든다. 텐서가 빠졌거나 형태가 MnistCNN과 다르면 예외 */
  function 모델_만들기(원본) {
    const 가중치 = 가중치_복원(원본);
    for (const [이름, 형태] of Object.entries(텐서_형태)) {
      if (!가중치[이름] || 가중치[이름].length !== 원소_개수(형태)) {
        throw new Error(`${이름}: 가중치가 없거나 형태가 [${형태}]와 맞지 않습니다`);
      }
    }
    return { 가중치, 로짓_계산: (입력) => 순전파(가중치, 입력) };
  }

  window.모델 = { base64_바이트, 가중치_복원, 모델_만들기, 합성곱2d, ReLU, 맥스풀2x2, 전결합, 소프트맥스 };
})();
