import { app, analytics, auth } from "./firebaseConfig.js";
import { logEvent } from "firebase/analytics";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

const googleProvider = new GoogleAuthProvider();

/**
 * Firebase API 모듈
 * 파이어베이스와 관련된 모든 호출 함수들을 이곳에서 관리합니다.
 */
const FirebaseApi = {
  // 앱 인스턴스 반환
  getApp: () => app,
  
  // Auth 인스턴스 반환
  getAuth: () => auth,

  // 특정 이벤트 로깅
  logCustomEvent: (eventName, eventParams = {}) => {
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
      console.log(`[Firebase Analytics] Event logged: ${eventName}`, eventParams);
    } else {
      console.warn('[Firebase Analytics] Analytics is not initialized.');
    }
  },

  // 구글 로그인
  signInWithGoogle: () => {
    return signInWithPopup(auth, googleProvider);
  },

  // 로그아웃
  signOut: () => {
    return signOut(auth);
  },

  // 로그인 상태 변경 감지
  onAuthStateChanged: (callback) => {
    return onAuthStateChanged(auth, callback);
  }
};

// 기존 스크립트 기반 코드(Non-module)에서도 사용할 수 있도록 전역 객체에 노출
window.FirebaseApi = FirebaseApi;

export default FirebaseApi;
