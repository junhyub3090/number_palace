import { app, analytics, auth } from "./firebaseConfig.js";
import { logEvent } from "firebase/analytics";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  signInAnonymously, 
  linkWithPopup, 
  signInWithCredential,
  deleteUser
} from "firebase/auth";

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

  // 1. 게스트 로그인
  signInAsGuest: async () => {
    try {
      const result = await signInAnonymously(auth);
      // 웹 스토리지에 게스트 상태 저장
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('guestUid', result.user.uid);
      console.log(`[Firebase Auth] 게스트 계정 생성 및 로그인 완료: ${result.user.uid}`);
      return result.user;
    } catch (error) {
      console.error('[Firebase Auth] 게스트 로그인 실패:', error);
      throw error;
    }
  },

  // 2. 구글 로그인 (게스트 상태일 때 연동 처리 포함)
  signInWithGoogle: async () => {
    const isGuest = localStorage.getItem('isGuest') === 'true';
    const guestUid = localStorage.getItem('guestUid');
    const currentUser = auth.currentUser;

    if (isGuest && currentUser && currentUser.isAnonymous) {
      try {
        // 기존 게스트 계정에 구글 인증(Credential) 연결 (UID 유지)
        const result = await linkWithPopup(currentUser, googleProvider);
        localStorage.removeItem('isGuest');
        localStorage.removeItem('guestUid');
        return result.user;
      } catch (error) {
        // 에러: 해당 구글 계정으로 이미 파이어베이스에 가입된 실제 계정이 존재하는 경우
        if (error.code === 'auth/credential-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(error);
          
          // 사용되지 않고 버려질 기존 게스트 계정(Auth) 삭제
          try {
            await deleteUser(currentUser);
            console.log(`[Firebase Auth] 버려지는 게스트 계정(${guestUid}) 삭제 완료`);
          } catch (deleteError) {
            console.warn('[Firebase Auth] 게스트 계정 삭제 실패:', deleteError);
          }

          const result = await signInWithCredential(auth, credential);
          
          // 게스트 데이터를 실제 계정으로 병합
          await FirebaseApi.mergeGuestDataToRealAccount(guestUid, result.user);
          return result.user;
        }
        throw error;
      }
    } else {
      // 일반 구글 로그인
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  },

  // 3. 게스트 데이터 병합 로직 (TODO)
  mergeGuestDataToRealAccount: async (guestUid, realUser) => {
    // TODO: 아직 구현된 상황(DB 등)이 없으므로, 향후 게스트 계정의 상황(점수, 아이템 등)을 실제 계정과 합치는 로직을 여기에 구현하세요.
    console.warn(`[TODO] 게스트 계정(${guestUid})의 데이터를 실제 계정(${realUser.uid})으로 병합해야 합니다.`);
    
    // 데이터 병합 처리가 끝나면 로컬 스토리지의 게스트 정보 제거
    localStorage.removeItem('isGuest');
    localStorage.removeItem('guestUid');
  },

  // 로그아웃
  signOut: () => {
    localStorage.removeItem('isGuest');
    localStorage.removeItem('guestUid');
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
