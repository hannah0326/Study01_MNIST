// 작성: 2026-09-26 02:13 KST
// 외부 라이브러리 없이 동작하는 작은 테스트 실행기와 웹 버전 테스트 모음. tests.html을 브라우저로 열면 실행된다.
(function () {
  "use strict";

  // ---------- 실행기 ----------
  const 테스트_목록 = [];

  function 테스트(이름, 함수) {
    테스트_목록.push({ 이름, 함수 });
  }

  function 확인(조건, 메시지) {
    if (!조건) throw new Error(메시지);
  }

  function 같음(실제, 기대, 메시지) {
    if (실제 !== 기대) throw new Error(`${메시지}: 기대 ${기대}, 실제 ${실제}`);
  }

  function 근사_배열(실제, 기대, 허용_오차, 메시지) {
    같음(실제.length, 기대.length, `${메시지} 길이`);
    let 최대_차이 = 0;
    let 위치 = -1;
    for (let i = 0; i < 기대.length; i++) {
      const 차이 = Math.abs(실제[i] - 기대[i]);
      if (Number.isNaN(차이)) throw new Error(`${메시지}: ${i}번째 값이 NaN`);
      if (차이 > 최대_차이) {
        최대_차이 = 차이;
        위치 = i;
      }
    }
    if (최대_차이 > 허용_오차) {
      throw new Error(`${메시지}: 최대 차이 ${최대_차이}(위치 ${위치})가 허용 오차 ${허용_오차}보다 큼`);
    }
    return 최대_차이;
  }

  function base64_바이트(문자열) {
    const 이진 = atob(문자열);
    const 바이트 = new Uint8Array(이진.length);
    for (let i = 0; i < 이진.length; i++) 바이트[i] = 이진.charCodeAt(i);
    return 바이트;
  }

  function 가장_큰_위치(값들) {
    let 위치 = 0;
    for (let i = 1; i < 값들.length; i++) if (값들[i] > 값들[위치]) 위치 = i;
    return 위치;
  }

  function 실행() {
    const 목록 = document.getElementById("목록");
    const 실패_목록 = [];
    for (const { 이름, 함수 } of 테스트_목록) {
      const 항목 = document.createElement("li");
      try {
        const 비고 = 함수();
        항목.className = "통과";
        항목.textContent = `통과 - ${이름}` + (비고 === undefined ? "" : ` (${비고})`);
      } catch (오류) {
        항목.className = "실패";
        항목.textContent = `실패 - ${이름}: ${오류.message}`;
        실패_목록.push(`${이름}: ${오류.message}`);
      }
      목록.appendChild(항목);
    }
    const 통과 = 테스트_목록.length - 실패_목록.length;
    const 요약 = `통과 ${통과} / 실패 ${실패_목록.length}`;
    const 요약_칸 = document.getElementById("요약");
    요약_칸.textContent = 요약;
    요약_칸.className = 실패_목록.length ? "실패" : "통과";
    document.title = 요약;
    window.테스트_결과 = { 통과, 실패: 실패_목록.length, 실패_목록 };
  }

  // ---------- 전처리 (preprocess.js) ----------
  테스트("파이썬_반올림은 .5를 짝수 쪽으로 반올림한다", () => {
    const { 파이썬_반올림 } = window.전처리;
    같음(파이썬_반올림(12.5), 12, "12.5");
    같음(파이썬_반올림(13.5), 14, "13.5");
    같음(파이썬_반올림(0.5), 0, "0.5");
    같음(파이썬_반올림(2.4), 2, "2.4");
    같음(파이썬_반올림(2.6), 3, "2.6");
  });

  테스트("글씨_영역_찾기는 밝기 30 초과 픽셀의 경계 상자를 돌려준다", () => {
    const 픽셀 = new Uint8ClampedArray(5 * 4);   // 너비 5, 높이 4
    픽셀[0] = 30;                                // 30은 글씨로 보지 않는다
    픽셀[1 * 5 + 1] = 31;
    픽셀[2 * 5 + 3] = 200;
    const 영역 = window.전처리.글씨_영역_찾기(픽셀, 5, 4);
    같음(JSON.stringify(영역), JSON.stringify({ 위: 1, 왼쪽: 1, 아래: 3, 오른쪽: 4 }), "영역");
  });

  테스트("글씨가 없으면 글씨_영역_찾기와 모델_입력_이미지_만들기가 null", () => {
    const 빈_판 = new Uint8ClampedArray(280 * 280).fill(30);
    같음(window.전처리.글씨_영역_찾기(빈_판, 280, 280), null, "영역");
    같음(window.전처리.모델_입력_이미지_만들기(빈_판, 280, 280), null, "모델 입력");
  });

  테스트("Lanczos_축소는 고른 밝기를 그대로 유지한다", () => {
    const 픽셀 = new Uint8ClampedArray(40 * 30).fill(100);
    const 결과 = window.전처리.Lanczos_축소(픽셀, 40, 30, 20, 15);
    근사_배열(결과, new Array(20 * 15).fill(100), 0, "축소 결과");
  });

  테스트("Lanczos_축소는 크기가 같으면 복사본을 돌려준다", () => {
    const 픽셀 = Uint8ClampedArray.from([1, 2, 3, 4]);
    const 결과 = window.전처리.Lanczos_축소(픽셀, 2, 2, 2, 2);
    근사_배열(결과, [1, 2, 3, 4], 0, "결과");
    확인(결과 !== 픽셀, "원본과 다른 배열이어야 함");
  });

  테스트("쌍선형_이동: 정수 이동과 0.5 이동(소수점은 버림)", () => {
    const { 쌍선형_이동 } = window.전처리;
    const 판 = Uint8ClampedArray.from([0, 0, 0, 0, 91, 0, 0, 0, 0]);
    근사_배열(쌍선형_이동(판, 3, 1, 0), [0, 0, 0, 0, 0, 91, 0, 0, 0], 0, "오른쪽 1칸");
    근사_배열(쌍선형_이동(판, 3, 0.5, 0), [0, 0, 0, 0, 45, 45, 0, 0, 0], 0, "오른쪽 0.5칸");
    근사_배열(쌍선형_이동(판, 3, 0, -1), [0, 91, 0, 0, 0, 0, 0, 0, 0], 0, "위로 1칸");
  });

  테스트("정규화된_입력은 (값/255 - 0.1307) / 0.3081", () => {
    const 이미지 = new Uint8ClampedArray(784);
    이미지[0] = 255;
    const 입력 = window.전처리.정규화된_입력(이미지);
    같음(입력.length, 784, "길이");
    근사_배열([입력[0], 입력[1]], [(1 - 0.1307) / 0.3081, -0.1307 / 0.3081], 1e-6, "값");
  });

  for (const 사례 of window.기준_데이터.전처리_사례) {
    테스트(`전처리 대조: ${사례.이름}`, () => {
      const 결과 = window.전처리.모델_입력_이미지_만들기(base64_바이트(사례.입력), 280, 280);
      확인(결과 !== null, "결과가 null");
      return `최대 차이 ${근사_배열(결과, base64_바이트(사례.기대), 2, "28x28 픽셀")}`;
    });
  }

  실행();
})();
