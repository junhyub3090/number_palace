import { app, analytics, auth, db } from "./firebaseConfig.js";
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
import { doc, setDoc, getDoc, deleteDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const googleProvider = new GoogleAuthProvider();

/**
 * Firebase API 모듈
 * 파이어베이스와 관련된 모든 호출 함수들을 이곳에서 관리합니다.
 */
const FirebaseApi = {
  // 인스턴스 반환
  getApp: () => app,
  getAuth: () => auth,
  getDb: () => db,

  // 특정 이벤트 로깅
  logCustomEvent: (eventName, eventParams = {}) => {
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
      console.log(`[Firebase Analytics] Event logged: ${eventName}`, eventParams);
    } else {
      console.warn('[Firebase Analytics] Analytics is not initialized.');
    }
  },

  // 1. 사용자 데이터 저장 (부분 업데이트 지원)
  saveUserData: async (key, value) => {
    const user = auth.currentUser;
    if (!user) {
      console.warn('[Firebase Firestore] 로그인된 사용자가 없어 데이터를 저장할 수 없습니다.');
      return;
    }
    
    try {
      const docRef = doc(db, "users", user.uid);
      // { merge: true } 옵션은 문서가 없으면 생성하고, 있으면 지정된 키(key)만 업데이트(병합)합니다.
      await setDoc(docRef, { [key]: value }, { merge: true });
      console.log(`[Firebase Firestore] 데이터 저장 완료: ${key} =`, value);
    } catch (error) {
      console.error(`[Firebase Firestore] 데이터 저장 실패 (${key}):`, error);
      throw error;
    }
  },

  // 2. 사용자 데이터 읽기
  getUserData: async (key = null) => {
    const user = auth.currentUser;
    if (!user) {
      console.warn('[Firebase Firestore] 로그인된 사용자가 없어 데이터를 읽을 수 없습니다.');
      return null;
    }
    
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return key ? data[key] : data; // key가 지정되어 있으면 해당 값만, 아니면 전체 데이터 반환
      } else {
        return null;
      }
    } catch (error) {
      console.error(`[Firebase Firestore] 데이터 읽기 실패 (${key}):`, error);
      throw error;
    }
  },

  // 3. 게스트 로그인
  signInAsGuest: async () => {
    try {
      const result = await signInAnonymously(auth);
      localStorage.setItem('isGuest', 'true');
      localStorage.setItem('guestUid', result.user.uid);
      console.log(`[Firebase Auth] 게스트 계정 생성 및 로그인 완료: ${result.user.uid}`);
      return result.user;
    } catch (error) {
      console.error('[Firebase Auth] 게스트 로그인 실패:', error);
      throw error;
    }
  },

  // 4. 구글 로그인 (게스트 상태일 때 연동 처리 포함)
  signInWithGoogle: async () => {
    const isGuest = localStorage.getItem('isGuest') === 'true';
    const guestUid = localStorage.getItem('guestUid');
    const currentUser = auth.currentUser;

    if (isGuest && currentUser && currentUser.isAnonymous) {
      try {
        const result = await linkWithPopup(currentUser, googleProvider);
        localStorage.removeItem('isGuest');
        localStorage.removeItem('guestUid');
        return result.user;
      } catch (error) {
        if (error.code === 'auth/credential-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(error);
          
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
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  },

  // 5. 게스트 데이터 병합 로직 (Firestore 데이터 이전)
  mergeGuestDataToRealAccount: async (guestUid, realUser) => {
    try {
      const guestDocRef = doc(db, "users", guestUid);
      const guestDocSnap = await getDoc(guestDocRef);
      
      if (guestDocSnap.exists()) {
        const guestData = guestDocSnap.data();
        const realDocRef = doc(db, "users", realUser.uid);
        
        // 게스트 데이터를 병합할 때 displayName도 실제 유저 정보로 갱신
        guestData.displayName = realUser.displayName || realUser.email?.split('@')[0] || "플레이어";
        
        // 기존 실제 계정 데이터에 게스트 데이터를 덮어씌움 (병합)
        await setDoc(realDocRef, guestData, { merge: true });
        
        // 병합이 끝난 후 기존 게스트의 파이어스토어 데이터 삭제
        await deleteDoc(guestDocRef);
        console.log(`[Firebase Firestore] 게스트 데이터(${guestUid})가 실제 계정(${realUser.uid})으로 병합되었습니다.`);
      } else {
        console.log(`[Firebase Firestore] 이전할 게스트 데이터(${guestUid})가 존재하지 않습니다.`);
      }
    } catch (err) {
      console.error('[Firebase Firestore] 데이터 병합 중 에러 발생:', err);
    }
    
    localStorage.removeItem('isGuest');
    localStorage.removeItem('guestUid');
  },

  // 6. 로그아웃
  signOut: () => {
    localStorage.removeItem('isGuest');
    localStorage.removeItem('guestUid');
    return signOut(auth);
  },

  // 7. 로그인 상태 변경 감지
  onAuthStateChanged: (callback) => {
    return onAuthStateChanged(auth, callback);
  },

  // 8. 최단 클리어 시간 업데이트
  updateBestClearTime: async (timeMs) => {
    try {
      const user = auth.currentUser;
      if (!user) return false;
      const displayName = user.isAnonymous ? "게스트" : (user.displayName || user.email?.split('@')[0] || "플레이어");

      const currentData = await FirebaseApi.getUserData();
      const currentBest = currentData?.bestClearTime;
      if (!currentBest || timeMs < currentBest) {
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, { bestClearTime: timeMs, displayName: displayName }, { merge: true });
        console.log(`[Firebase Firestore] 최단 클리어 시간 갱신: ${timeMs}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Firebase Firestore] 최단 클리어 시간 저장 실패:', error);
      return false;
    }
  },

  // 9. 리더보드 데이터 가져오기
  getLeaderboard: async (limitCount = 10) => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("bestClearTime", "asc"), limit(limitCount));
      const querySnapshot = await getDocs(q);
      
      const leaderboard = [];
      querySnapshot.forEach((doc) => {
        leaderboard.push({
          uid: doc.id,
          ...doc.data()
        });
      });
      return leaderboard;
    } catch (error) {
      console.error('[Firebase Firestore] 리더보드 데이터 가져오기 실패:', error);
      return [];
    }
  }
};

window.FirebaseApi = FirebaseApi;
export default FirebaseApi;
