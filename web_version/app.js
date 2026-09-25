// 작성: 2026-09-26 02:32 KST
// 웹 버전 화면: 캔버스에 그린 숫자를 preprocess.js로 전처리하고 model.js로 인식해 결과를 보여준다.
// 마우스·터치·펜을 Pointer Events 하나로 처리한다.
(function () {
  "use strict";

  const 캔버스_크기 = 280;
  const 펜_굵기 = 22;             // desktop_version/app.py와 같은 굵기
  const 가중치_오류_문구 = "가중치 파일을 불러오지 못했습니다. desktop_version/export_web.py를 실행하세요.";

  const 캔버스 = document.getElementById("캔버스");
  const 붓 = 캔버스.getContext("2d", { willReadFrequently: true });
  const 미리보기 = document.getElementById("미리보기");
  const 미리보기_붓 = 미리보기.getContext("2d");
  const 결과_숫자 = document.getElementById("결과_숫자");
  const 확신도 = document.getElementById("확신도");
  const 오류 = document.getElementById("오류");
  const 막대_목록 = document.getElementById("막대_목록");
  const 인식_버튼 = document.getElementById("인식_버튼");
  const 지우기_버튼 = document.getElementById("지우기_버튼");

  const 막대들 = [];              // 숫자별 {채움, 퍼센트} 요소
  let 신경망 = null;              // 가중치를 불러오지 못하면 null로 남는다
  let 이전_좌표 = null;           // 그리는 중이 아니면 null

  // ---------- 화면 구성 ----------
  function 막대_만들기() {
    for (let 숫자 = 0; 숫자 < 10; 숫자++) {
      const 줄 = document.createElement("li");
      줄.innerHTML = `<span class="숫자">${숫자}</span><span class="막대"><span class="채움"></span></span><span class="퍼센트">0.0%</span>`;
      막대_목록.appendChild(줄);
      막대들.push({ 채움: 줄.querySelector(".채움"), 퍼센트: 줄.querySelector(".퍼센트") });
    }
  }

  function 막대_그리기(숫자, 비율, 강조) {
    const { 채움, 퍼센트 } = 막대들[숫자];
    채움.style.width = `${비율 * 100}%`;
    채움.classList.toggle("강조", 강조);
    퍼센트.textContent = `${(비율 * 100).toFixed(1)}%`;
  }

  function 결과_초기화() {
    결과_숫자.textContent = "-";
    확신도.textContent = "확신도: -";
    for (let 숫자 = 0; 숫자 < 10; 숫자++) 막대_그리기(숫자, 0, false);
    미리보기_붓.clearRect(0, 0, 미리보기.width, 미리보기.height);
  }

  function 결과_표시(예측_숫자, 확률) {
    결과_숫자.textContent = String(예측_숫자);
    확신도.textContent = `확신도: ${(확률[예측_숫자] * 100).toFixed(1)}%`;
    for (let 숫자 = 0; 숫자 < 10; 숫자++) 막대_그리기(숫자, 확률[숫자], 숫자 === 예측_숫자);
  }

  function 미리보기_표시(이미지) {
    const 데이터 = 미리보기_붓.createImageData(28, 28);
    for (let i = 0; i < 이미지.length; i++) {
      데이터.data[i * 4] = 데이터.data[i * 4 + 1] = 데이터.data[i * 4 + 2] = 이미지[i];
      데이터.data[i * 4 + 3] = 255;
    }
    미리보기_붓.putImageData(데이터, 0, 0);
  }

  // ---------- 그리기 ----------
  function 캔버스_지우기() {
    붓.fillStyle = "#000";
    붓.fillRect(0, 0, 캔버스_크기, 캔버스_크기);
    이전_좌표 = null;
    결과_초기화();
  }

  /** 화면 좌표를 캔버스 내부 좌표(280x280)로 바꾼다. CSS로 크기가 줄어도 맞게 계산한다 */
  function 캔버스_좌표(이벤트) {
    const 상자 = 캔버스.getBoundingClientRect();
    return {
      x: (이벤트.clientX - 상자.left - 캔버스.clientLeft) * (캔버스.width / 캔버스.clientWidth),
      y: (이벤트.clientY - 상자.top - 캔버스.clientTop) * (캔버스.height / 캔버스.clientHeight),
    };
  }

  function 점_찍기(좌표) {
    붓.fillStyle = "#fff";
    붓.beginPath();
    붓.arc(좌표.x, 좌표.y, 펜_굵기 / 2, 0, Math.PI * 2);
    붓.fill();
  }

  function 선_긋기(시작, 끝) {
    붓.strokeStyle = "#fff";
    붓.lineWidth = 펜_굵기;
    붓.lineCap = "round";
    붓.beginPath();
    붓.moveTo(시작.x, 시작.y);
    붓.lineTo(끝.x, 끝.y);
    붓.stroke();
  }

  function 펜_누르기(이벤트) {
    if (!신경망) return;
    이벤트.preventDefault();
    캔버스.setPointerCapture(이벤트.pointerId);
    이전_좌표 = 캔버스_좌표(이벤트);
    점_찍기(이전_좌표);
  }

  function 펜_움직이기(이벤트) {
    if (이전_좌표 === null) return;
    const 지금 = 캔버스_좌표(이벤트);
    선_긋기(이전_좌표, 지금);
    이전_좌표 = 지금;
  }

  function 펜_떼기() {
    if (이전_좌표 === null) return;
    이전_좌표 = null;
    인식하기();
  }

  // ---------- 인식 ----------
  function 인식하기() {
    if (!신경망) return;
    const 화소 = 붓.getImageData(0, 0, 캔버스_크기, 캔버스_크기).data;
    const 흑백 = new Uint8ClampedArray(캔버스_크기 * 캔버스_크기);
    for (let i = 0; i < 흑백.length; i++) 흑백[i] = 화소[i * 4];   // 흰 글씨이므로 R 채널이 곧 밝기

    const 입력_이미지 = window.전처리.모델_입력_이미지_만들기(흑백, 캔버스_크기, 캔버스_크기);
    if (입력_이미지 === null) {
      결과_초기화();
      return;
    }
    const 로짓 = 신경망.로짓_계산(window.전처리.정규화된_입력(입력_이미지));
    const 확률 = window.모델.소프트맥스(로짓);
    let 예측_숫자 = 0;
    for (let 숫자 = 1; 숫자 < 10; 숫자++) if (확률[숫자] > 확률[예측_숫자]) 예측_숫자 = 숫자;
    결과_표시(예측_숫자, 확률);
    미리보기_표시(입력_이미지);
  }

  // ---------- 시작 ----------
  막대_만들기();
  try {
    신경망 = window.모델.모델_만들기(window.MNIST_가중치);
  } catch (e) {
    console.error(e);
    오류.textContent = 가중치_오류_문구;
    오류.hidden = false;
    인식_버튼.disabled = true;
    지우기_버튼.disabled = true;
    캔버스.classList.add("비활성");
  }
  캔버스_지우기();

  캔버스.addEventListener("pointerdown", 펜_누르기);
  캔버스.addEventListener("pointermove", 펜_움직이기);
  캔버스.addEventListener("pointerup", 펜_떼기);
  캔버스.addEventListener("pointercancel", 펜_떼기);
  인식_버튼.addEventListener("click", 인식하기);
  지우기_버튼.addEventListener("click", 캔버스_지우기);
})();
