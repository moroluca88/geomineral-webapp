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
          
          // Initial sync logic (runs only once per login)
          const userDocSnap = await getDoc(userDocRef);
          const existingData = userDocSnap.exists() ? userDocSnap.data() : {};
          
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

          await setDoc(userDocRef, newUserData, { merge: true });

          // Listener for real-time updates
          unsubscribeSnap = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              setUserData(snap.data() as UserData);
            }
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
