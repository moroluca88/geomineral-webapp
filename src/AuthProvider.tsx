import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';

interface UserData {
  uid: string;
  email: string | null;
  displayName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let unsubscribeSnap: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeSnap) {
        unsubscribeSnap();
        unsubscribeSnap = null;
      }

      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          
          let existingData: any = {};
          try {
            // Initial sync logic (runs only once per login)
            const userDocSnap = await getDoc(userDocRef);
            existingData = userDocSnap.exists() ? userDocSnap.data() : {};
          } catch (getDocErr) {
            console.warn('Could not fetch user doc (might be offline):', getDocErr);
            // Try to load cached user details from localStorage
            const cached = localStorage.getItem(`user_data_${firebaseUser.uid}`);
            if (cached) {
              try {
                existingData = JSON.parse(cached);
              } catch (_) {}
            }
          }
          
          const displayName = firebaseUser.displayName || 
                            existingData.displayName || 
                            firebaseUser.email?.split('@')[0] || 
                            'Utente';

          const newUserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: displayName,
            role: (existingData.role as string) || 'user'
          };

          // Update local state and cache immediately so the app is responsive/functional
          setUserData(newUserData);
          localStorage.setItem(`user_data_${firebaseUser.uid}`, JSON.stringify(newUserData));

          try {
            await setDoc(userDocRef, newUserData, { merge: true });
          } catch (setDocErr) {
            console.warn('Could not sync user doc with server (might be offline):', setDocErr);
          }

          // Listener for real-time updates
          unsubscribeSnap = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserData;
              setUserData(data);
              localStorage.setItem(`user_data_${firebaseUser.uid}`, JSON.stringify(data));
            }
          }, (snapErr) => {
            console.warn('onSnapshot listener error (might be offline):', snapErr);
          });

          setUser(firebaseUser);
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (err) {
        console.error('Auth sync error:', err);
        if (firebaseUser) setUser(firebaseUser);
      } finally {
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnap) unsubscribeSnap();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
