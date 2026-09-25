// 작성: 2026-09-26 02:13 KST
// 손글씨 이미지를 MNIST 방식(28x28, 20x20 상자, 무게중심 정렬)으로 바꾸는 전처리.
// desktop_version/preprocess.py(PIL LANCZOS 축소, AFFINE BILINEAR 이동)를 픽셀 단위로 똑같이 재현한다.
// 브라우저마다 결과가 다른 캔버스 drawImage 스무딩은 쓰지 않는다.
(function () {
  "use strict";

  // MNIST 학습 때 사용한 정규화 값 (preprocess.py와 같음)
  const 정규화_평균 = 0.1307;
  const 정규화_표준편차 = 0.3081;

  const 모델_입력_크기 = 28;
  const 숫자_상자_크기 = 20;     // MNIST는 숫자를 20x20 상자에 맞춘 뒤 28x28 한가운데에 놓는다
  const 글씨_판정_밝기 = 30;     // 이 값보다 밝은 픽셀을 글씨로 본다

  // PIL Resample.c의 8비트 고정소수점 계산과 같은 정밀도
  const 정밀도_비트 = 22;
  const 고정소수점_1 = 2 ** 정밀도_비트;

  /** 파이썬 round()와 같이 정확히 .5면 짝수 쪽으로 반올림한다 */
  function 파이썬_반올림(값) {
    const 내림 = Math.floor(값);
    const 나머지 = 값 - 내림;
    if (나머지 > 0.5) return 내림 + 1;
    if (나머지 < 0.5) return 내림;
    return 내림 % 2 === 0 ? 내림 : 내림 + 1;
  }

  /** 밝기 30을 넘는 픽셀의 경계 상자. 아래·오른쪽은 끝 다음 위치다. 글씨가 없으면 null */
  function 글씨_영역_찾기(픽셀, 너비, 높이) {
    let 위 = 높이, 왼쪽 = 너비, 아래 = -1, 오른쪽 = -1;
    for (let y = 0; y < 높이; y++) {
      for (let x = 0; x < 너비; x++) {
        if (픽셀[y * 너비 + x] > 글씨_판정_밝기) {
          if (y < 위) 위 = y;
          if (y > 아래) 아래 = y;
          if (x < 왼쪽) 왼쪽 = x;
          if (x > 오른쪽) 오른쪽 = x;
        }
      }
    }
    if (아래 < 0) return null;
    return { 위, 왼쪽, 아래: 아래 + 1, 오른쪽: 오른쪽 + 1 };
  }

  function 싱크(x) {
    if (x === 0) return 1;
    x *= Math.PI;
    return Math.sin(x) / x;
  }

  function Lanczos(x) {
    return -3 <= x && x < 3 ? 싱크(x) * 싱크(x / 3) : 0;
  }

  /** PIL의 precompute_coeffs + normalize_coeffs_8bpp와 같은 방식으로 한 축의 정수 가중치를 구한다 */
  function 축소_계수(입력_크기, 출력_크기) {
    const 배율 = 입력_크기 / 출력_크기;
    const 필터_배율 = Math.max(배율, 1);
    const 반경 = 3 * 필터_배율;
    const 역배율 = 1 / 필터_배율;
    const 계수들 = [];
    for (let 출력 = 0; 출력 < 출력_크기; 출력++) {
      const 중심 = (출력 + 0.5) * 배율;
      let 시작 = Math.trunc(중심 - 반경 + 0.5);
      if (시작 < 0) 시작 = 0;
      let 끝 = Math.trunc(중심 + 반경 + 0.5);
      if (끝 > 입력_크기) 끝 = 입력_크기;
      const 실수_가중치 = [];
      let 합 = 0;
      for (let i = 시작; i < 끝; i++) {
        const w = Lanczos((i - 중심 + 0.5) * 역배율);
        실수_가중치.push(w);
        합 += w;
      }
      const 가중치 = 실수_가중치.map((w) => {
        const 정규 = 합 !== 0 ? w / 합 : w;
        return 정규 < 0 ? Math.trunc(-0.5 + 정규 * 고정소수점_1) : Math.trunc(0.5 + 정규 * 고정소수점_1);
      });
      계수들.push({ 시작, 가중치 });
    }
    return 계수들;
  }

  /** PIL clip8: 고정소수점 합을 0~255 정수로 바꾼다 */
  function 바이트로_자르기(합) {
    if (합 >= 256 * 고정소수점_1) return 255;
    if (합 <= 0) return 0;
    return Math.floor(합 / 고정소수점_1);
  }

  /** PIL Image.resize(LANCZOS)와 같은 축소. 가로를 먼저 계산하고 8비트로 반올림한 뒤 세로를 계산한다 */
  function Lanczos_축소(픽셀, 너비, 높이, 새_너비, 새_높이) {
    let 현재 = 픽셀;
    if (새_너비 !== 너비) {
      const 계수들 = 축소_계수(너비, 새_너비);
      const 출력 = new Uint8ClampedArray(새_너비 * 높이);
      for (let y = 0; y < 높이; y++) {
        for (let x = 0; x < 새_너비; x++) {
          const { 시작, 가중치 } = 계수들[x];
          let 합 = 고정소수점_1 / 2;
          for (let i = 0; i < 가중치.length; i++) 합 += 현재[y * 너비 + 시작 + i] * 가중치[i];
          출력[y * 새_너비 + x] = 바이트로_자르기(합);
        }
      }
      현재 = 출력;
    }
    if (새_높이 !== 높이) {
      const 계수들 = 축소_계수(높이, 새_높이);
      const 출력 = new Uint8ClampedArray(새_너비 * 새_높이);
      for (let y = 0; y < 새_높이; y++) {
        const { 시작, 가중치 } = 계수들[y];
        for (let x = 0; x < 새_너비; x++) {
          let 합 = 고정소수점_1 / 2;
          for (let i = 0; i < 가중치.length; i++) 합 += 현재[(시작 + i) * 새_너비 + x] * 가중치[i];
          출력[y * 새_너비 + x] = 바이트로_자르기(합);
        }
      }
      현재 = 출력;
    }
    return 현재 === 픽셀 ? Uint8ClampedArray.from(픽셀) : 현재;
  }

  /** PIL Image.transform(AFFINE, (1, 0, -이동_x, 0, 1, -이동_y), BILINEAR)와 같은 평행 이동. 판 밖은 0 */
  function 쌍선형_이동(픽셀, 크기, 이동_x, 이동_y) {
    const 출력 = new Uint8ClampedArray(크기 * 크기);
    const 안으로 = (v) => (v < 0 ? 0 : v >= 크기 ? 크기 - 1 : v);
    for (let y = 0; y < 크기; y++) {
      for (let x = 0; x < 크기; x++) {
        // 출력 픽셀의 중심(+0.5)을 입력 좌표로 옮긴다
        let 입력_x = (x + 0.5) - 이동_x;
        let 입력_y = (y + 0.5) - 이동_y;
        if (입력_x < 0 || 입력_x >= 크기 || 입력_y < 0 || 입력_y >= 크기) continue;
        입력_x -= 0.5;
        입력_y -= 0.5;
        const x0 = Math.floor(입력_x);
        const y0 = Math.floor(입력_y);
        const dx = 입력_x - x0;
        const dy = 입력_y - y0;
        const 왼쪽 = 안으로(x0);
        const 오른쪽 = 안으로(x0 + 1);
        const 윗줄 = 안으로(y0) * 크기;
        const 위_값 = 픽셀[윗줄 + 왼쪽] + (픽셀[윗줄 + 오른쪽] - 픽셀[윗줄 + 왼쪽]) * dx;
        let 아래_값 = 위_값;
        if (y0 + 1 >= 0 && y0 + 1 < 크기) {
          const 아랫줄 = (y0 + 1) * 크기;
          아래_값 = 픽셀[아랫줄 + 왼쪽] + (픽셀[아랫줄 + 오른쪽] - 픽셀[아랫줄 + 왼쪽]) * dx;
        }
        // PIL은 반올림하지 않고 소수점을 버린다
        출력[y * 크기 + x] = Math.trunc(위_값 + (아래_값 - 위_값) * dy);
      }
    }
    return 출력;
  }

  /** 검은 배경/흰 글씨의 흑백 픽셀 배열을 MNIST 방식의 28x28 배열로 바꾼다. 글씨가 없으면 null */
  function 모델_입력_이미지_만들기(픽셀, 너비, 높이) {
    const 영역 = 글씨_영역_찾기(픽셀, 너비, 높이);
    if (영역 === null) return null;

    // 1) 글씨가 있는 영역만 잘라낸다
    const 자른_너비 = 영역.오른쪽 - 영역.왼쪽;
    const 자른_높이 = 영역.아래 - 영역.위;
    const 자른 = new Uint8ClampedArray(자른_너비 * 자른_높이);
    for (let y = 0; y < 자른_높이; y++) {
      for (let x = 0; x < 자른_너비; x++) {
        자른[y * 자른_너비 + x] = 픽셀[(영역.위 + y) * 너비 + 영역.왼쪽 + x];
      }
    }

    // 2) 가로세로 비율을 유지한 채 긴 변이 20픽셀이 되도록 줄인다
    const 배율 = 숫자_상자_크기 / Math.max(자른_너비, 자른_높이);
    const 새_너비 = Math.max(1, 파이썬_반올림(자른_너비 * 배율));
    const 새_높이 = Math.max(1, 파이썬_반올림(자른_높이 * 배율));
    const 줄인 = Lanczos_축소(자른, 자른_너비, 자른_높이, 새_너비, 새_높이);

    // 3) 28x28 검은 판 한가운데에 붙인다
    const 판 = new Uint8ClampedArray(모델_입력_크기 * 모델_입력_크기);
    const 왼쪽_여백 = Math.floor((모델_입력_크기 - 새_너비) / 2);
    const 위_여백 = Math.floor((모델_입력_크기 - 새_높이) / 2);
    for (let y = 0; y < 새_높이; y++) {
      for (let x = 0; x < 새_너비; x++) {
        판[(위_여백 + y) * 모델_입력_크기 + 왼쪽_여백 + x] = 줄인[y * 새_너비 + x];
      }
    }

    // 4) 무게중심이 판의 중심에 오도록 평행 이동한다
    let 총합 = 0, 가로_합 = 0, 세로_합 = 0;
    for (let y = 0; y < 모델_입력_크기; y++) {
      for (let x = 0; x < 모델_입력_크기; x++) {
        const 값 = 판[y * 모델_입력_크기 + x];
        총합 += 값;
        가로_합 += 값 * x;
        세로_합 += 값 * y;
      }
    }
    const 이동_x = (모델_입력_크기 - 1) / 2 - 가로_합 / 총합;
    const 이동_y = (모델_입력_크기 - 1) / 2 - 세로_합 / 총합;
    return 쌍선형_이동(판, 모델_입력_크기, 이동_x, 이동_y);
  }

  /** 28x28 픽셀(0~255)을 모델 입력으로 쓸 정규화된 Float32Array로 바꾼다 */
  function 정규화된_입력(이미지) {
    const 입력 = new Float32Array(이미지.length);
    for (let i = 0; i < 이미지.length; i++) 입력[i] = (이미지[i] / 255 - 정규화_평균) / 정규화_표준편차;
    return 입력;
  }

  window.전처리 = {
    정규화_평균,
    정규화_표준편차,
    모델_입력_크기,
    파이썬_반올림,
    글씨_영역_찾기,
    Lanczos_축소,
    쌍선형_이동,
    모델_입력_이미지_만들기,
    정규화된_입력,
  };
})();
