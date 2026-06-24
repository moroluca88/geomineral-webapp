import { Logo } from './components/Logo';
import { AuthProvider, useAuth } from './AuthProvider';
import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  deleteUser
} from 'firebase/auth';
import { auth, googleProvider, db, storage } from './firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  getDocFromServer,
  setDoc,
  getDocs,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { 
  Gem, 
  Plus, 
  Map as MapIcon, 
  Search, 
  LogOut, 
  User as UserIcon, 
  Trash2, 
  Edit2, 
  X,
  Camera,
  Layers,
  QrCode,
  Printer,
  AlertTriangle,
  ChevronDown,
  Share2,
  ArrowUp,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Mineral } from './types';
import { cn, handleFirestoreError, OperationType } from './lib/utils';

const APP_VERSION = "1.9.5";
const APP_NAME = "GeoMineral";

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function PublicCollectionView({ userId }: { userId: string }) {
  const [minerals, setMinerals] = useState<Mineral[]>([]);
  const [ownerName, setOwnerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedMineral, setSelectedMineral] = useState<Mineral | null>(null);

  useEffect(() => {
    if (ownerName) {
      document.title = `${APP_NAME} - Collezione di ${ownerName}`;
    } else {
      document.title = `${APP_NAME} - Collezione Pubblica`;
    }
  }, [ownerName]);

  useEffect(() => {
    // Fetch owner name from public profile
    const fetchOwner = async () => {
      try {
        const cleanId = userId.trim();
        if (!cleanId) return;

        const docRef = doc(db, 'public_profiles', cleanId);
        // Use getDocFromServer to ensure we get the latest data and bypass any local cache issues
        const docSnap = await getDocFromServer(docRef);
        
        if (docSnap.exists()) {
          const name = docSnap.data().displayName;
          if (name) {
            setOwnerName(name);
          } else {
            setOwnerName('');
          }
        }
      } catch (err) {
        console.error('Error fetching owner name:', err);
      }
    };
    fetchOwner();

    const q = query(
      collection(db, 'minerals'),
      where('ownerId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() } as Mineral));
      // Sort client-side to avoid composite index requirement
      const sortedList = list.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setMinerals(sortedList);
      setLoading(false);
    }, (err) => {
      console.error('Public Collection Detailed Error:', {
        code: err.code,
        message: err.message,
        userId: userId,
        stack: err.stack
      });
      setError(`Non è stato possibile caricare la collezione (Errore: ${err.code}). Verifica che il link sia corretto.`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const filteredMinerals = minerals.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.origin.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfbf7]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <header className="bg-white border-b border-stone-100 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />
            <h1 className="text-xl font-display font-bold text-primary">
              {APP_NAME} - Collezione {ownerName ? `di ${ownerName}` : 'Pubblica'}
            </h1>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text" 
              placeholder="Cerca nella collezione..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 h-11 bg-stone-50 rounded-xl border border-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/5"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 py-8">
        {error ? (
          <div className="text-center py-20">
            <p className="text-red-500">{error}</p>
          </div>
        ) : filteredMinerals.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <Gem className="mx-auto text-gray-200 mb-4" size={64} />
            <h3 className="text-xl font-display font-semibold text-gray-400">Nessun minerale trovato</h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {filteredMinerals.map(mineral => (
              <div 
                key={mineral.docId} 
                onClick={() => setSelectedMineral(mineral)}
                className="cursor-pointer"
              >
                <MineralCard 
                  mineral={mineral} 
                  onView={() => setSelectedMineral(mineral)}
                  showShare={false}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedMineral && (
        <MineralDetailModal 
          mineral={selectedMineral} 
          onClose={() => setSelectedMineral(null)} 
        />
      )}
    </div>
  );
}

function PublicMineralView({ docId }: { docId: string }) {
  const [mineral, setMineral] = useState<Mineral | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const paginate = (newDirection: number) => {
    if (!mineral?.photos) return;
    setDirection(newDirection);
    const nextIndex = currentPhotoIndex + newDirection;
    if (nextIndex < 0) {
      setCurrentPhotoIndex(mineral.photos.length - 1);
    } else if (nextIndex >= mineral.photos.length) {
      setCurrentPhotoIndex(0);
    } else {
      setCurrentPhotoIndex(nextIndex);
    }
  };

  const carouselVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  useEffect(() => {
    if (ownerName) {
      document.title = `${APP_NAME} - ${mineral?.name} (Collezione di ${ownerName})`;
    } else if (mineral) {
      document.title = `${APP_NAME} - ${mineral.name}`;
    }
  }, [ownerName, mineral]);

  useEffect(() => {
    async function fetchMineral() {
      try {
        const cleanId = docId.trim();
        if (!cleanId) {
          setError('ID minerale non valido.');
          setLoading(false);
          return;
        }
        const docRef = doc(db, 'minerals', cleanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { docId: docSnap.id, ...docSnap.data() } as Mineral;
          setMineral(data);
          
          // Fetch owner name
          if (data.ownerId) {
            try {
              const profileSnap = await getDocFromServer(doc(db, 'public_profiles', data.ownerId));
              if (profileSnap.exists()) {
                setOwnerName(profileSnap.data().displayName || '');
              }
            } catch (pErr) {
              console.warn('Could not fetch owner profile from server, trying cache:', pErr);
              const profileSnap = await getDoc(doc(db, 'public_profiles', data.ownerId));
              if (profileSnap.exists()) {
                setOwnerName(profileSnap.data().displayName || '');
              }
            }
          }
        } else {
          setError('Minerale non trovato. Il link potrebbe essere scaduto o il minerale è stato rimosso.');
        }
      } catch (err: any) {
        console.error('Public View Detailed Error:', {
          code: err.code,
          message: err.message,
          docId: docId
        });
        if (err.code === 'permission-denied') {
          setError(`Accesso negato. Il server non ha ancora propagato i nuovi permessi pubblici. Riprova tra 60 secondi.`);
        } else {
          setError(`Errore nel caricamento: ${err.message || 'Errore sconosciuto'}`);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchMineral();
  }, [docId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfbf7]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !mineral) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfbf7] p-4 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <X className="text-red-500" size={40} />
        </div>
        <h2 className="text-2xl font-display font-bold text-primary mb-2">Ops! Qualcosa è andato storto</h2>
        <p className="text-stone-500 mb-8">{error || 'Non è stato possibile trovare questo minerale.'}</p>
        <button 
          onClick={() => window.location.href = window.location.origin}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20"
        >
          Torna alla Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <header className="bg-white border-b border-stone-100 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <h1 className="text-xl font-display font-bold text-primary">
            {APP_NAME} {ownerName ? `- Collezione di ${ownerName}` : ''}
          </h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-stone-100"
        >
          <div className="aspect-[3/2] bg-stone-100 relative group/carousel border-b border-stone-100">
            {mineral.photos && mineral.photos.length > 0 ? (
              <div className="w-full h-full relative overflow-hidden touch-pan-y">
                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={currentPhotoIndex}
                    custom={direction}
                    variants={carouselVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 }
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1}
                    onDragEnd={(_, info) => {
                      const threshold = 50;
                      if (info.offset.x < -threshold) {
                        paginate(1);
                      } else if (info.offset.x > threshold) {
                        paginate(-1);
                      }
                    }}
                    className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
                  >
                    <img 
                      src={mineral.photos[currentPhotoIndex] || mineral.photoUrl} 
                      alt={mineral.name} 
                      className="w-full h-full object-cover pointer-events-none select-none" 
                      referrerPolicy="no-referrer" 
                      data-visual-search="false"
                      draggable={false}
                    />
                  </motion.div>
                </AnimatePresence>

                {mineral.photos.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); paginate(-1); }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/carousel:opacity-100 hidden md:flex"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); paginate(1); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/carousel:opacity-100 hidden md:flex"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full shadow-lg">
                      {mineral.photos.map((_, i) => (
                        <div 
                          key={i} 
                          className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", i === currentPhotoIndex ? "bg-white w-3" : "bg-white/40")} 
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : mineral.photoUrl ? (
              <img 
                src={mineral.photoUrl} 
                alt={mineral.name} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                data-visual-search="false"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300">
                <Gem size={80} />
              </div>
            )}
            <div className="absolute top-6 left-6">
              <span className="px-3 py-1 bg-primary text-white text-xs uppercase font-bold tracking-widest rounded-lg shadow-lg">
                {mineral.id}
              </span>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-primary mb-6">{mineral.name}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                    <MapIcon size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Provenienza</p>
                    <p className="text-lg font-medium text-stone-700">{mineral.origin || 'n.d.'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                    <Layers size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Dimensioni</p>
                    <p className="text-lg font-medium text-stone-700">
                      {mineral.dimensions ? `${mineral.dimensions.width} x ${mineral.dimensions.height} x ${mineral.dimensions.depth} cm` : 'N/D'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                    <Search size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Modalità</p>
                    <p className="text-lg font-medium text-stone-700 capitalize">{mineral.acquisitionMode}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Collezione</p>
                    <p className="text-lg font-medium text-stone-700">Privata</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-stone-100">
              {mineral.coordinates && (
                <div className="mb-8">
                  <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-3">Posizione del Ritrovamento</p>
                  <div className="h-64 rounded-2xl overflow-hidden border border-stone-100 shadow-inner">
                    <MapContainer 
                      center={[mineral.coordinates.lat, mineral.coordinates.lng]} 
                      zoom={8} 
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[mineral.coordinates.lat, mineral.coordinates.lng]} />
                    </MapContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function LoginView() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // AuthProvider handles the document syncing
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        // AuthProvider handles the document syncing
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200"
      >
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <Logo className="w-16 h-16 shadow-lg rounded-2xl" />
          </div>
          <h1 className="text-4xl font-display font-bold text-center mb-2 text-primary">{APP_NAME}</h1>
          <p className="text-center text-stone-500 mb-8">Gestisci la tua collezione di minerali</p>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button 
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              {isRegistering ? 'Registrati' : 'Accedi'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-stone-200"></div>
            <span className="text-stone-400 text-sm italic font-display">oppure</span>
            <div className="flex-1 h-px bg-stone-200"></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full mt-6 flex items-center justify-center gap-3 border border-stone-200 py-3 rounded-xl font-bold text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Accedi con Google
          </button>

          <p className="mt-8 text-center text-sm text-stone-500">
            {isRegistering ? 'Hai già un account?' : 'Non hai un account?'}
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-2 text-accent font-bold underline decoration-accent/30 underline-offset-4"
            >
              {isRegistering ? 'Accedi' : 'Registrati'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function MineralDetailModal({ 
  mineral, 
  onClose,
  onEdit,
  onDelete,
  onShowQr
}: { 
  mineral: Mineral, 
  onClose: () => void,
  onEdit?: (m: Mineral) => void,
  onDelete?: (id: string) => void,
  onShowQr?: (m: Mineral) => void
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const paginate = (newDirection: number) => {
    if (!mineral.photos) return;
    setDirection(newDirection);
    const nextIndex = currentPhotoIndex + newDirection;
    if (nextIndex < 0) {
      setCurrentPhotoIndex(mineral.photos.length - 1);
    } else if (nextIndex >= mineral.photos.length) {
      setCurrentPhotoIndex(0);
    } else {
      setCurrentPhotoIndex(nextIndex);
    }
  };

  const carouselVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${mineral.docId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${APP_NAME}: ${mineral.name}`,
          text: `Guarda questo esemplare di ${mineral.name} nella mia collezione!\n\n`,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copiato negli appunti!');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl my-auto relative flex flex-col overflow-hidden"
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-30 p-2 bg-white/80 backdrop-blur rounded-full shadow-md hover:bg-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Top: Photo Carousel */}
        <div className="aspect-[3/2] bg-stone-100 relative shrink-0 group/carousel border-b border-stone-100">
          {mineral.photos && mineral.photos.length > 0 ? (
            <div className="w-full h-full relative overflow-hidden touch-pan-y">
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  key={currentPhotoIndex}
                  custom={direction}
                  variants={carouselVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={1}
                  onDragEnd={(_, info) => {
                    const threshold = 50;
                    if (info.offset.x < -threshold) {
                      paginate(1);
                    } else if (info.offset.x > threshold) {
                      paginate(-1);
                    }
                  }}
                  className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
                >
                  <img 
                    src={mineral.photos[currentPhotoIndex]} 
                    alt={mineral.name} 
                    className="w-full h-full object-cover pointer-events-none select-none" 
                    referrerPolicy="no-referrer" 
                    data-visual-search="false"
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>
              
              {mineral.photos.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); paginate(-1); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/carousel:opacity-100 hidden md:flex"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); paginate(1); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/carousel:opacity-100 hidden md:flex"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full shadow-lg">
                    {mineral.photos.map((_, i) => (
                      <div 
                        key={i} 
                        className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", i === currentPhotoIndex ? "bg-white w-3" : "bg-white/40")} 
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300">
              <Gem size={80} />
            </div>
          )}
          <div className="absolute top-6 left-6">
            <span className="px-3 py-1 bg-primary text-white text-xs uppercase font-bold tracking-widest rounded-lg shadow-lg">
              {mineral.id}
            </span>
          </div>
        </div>

        {/* Bottom: Content */}
        <div className="p-8 md:p-10 max-h-[60vh] overflow-y-auto">
          {/* Action Bar - Only for owner/admin */}
          {(onEdit || onDelete || onShowQr) && (
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-stone-100">
              <button 
                onClick={handleShare}
                className="w-11 h-11 bg-stone-50 rounded-full text-stone-600 hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center shadow-sm"
                title="Condividi"
              >
                <Share2 size={20} />
              </button>
              
              {onShowQr && (
                <button 
                  onClick={() => onShowQr(mineral)}
                  className="w-11 h-11 bg-stone-50 rounded-full text-stone-600 hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center shadow-sm"
                  title="QR Code"
                >
                  <QrCode size={20} />
                </button>
              )}

              {onEdit && (
                <button 
                  onClick={() => onEdit(mineral)}
                  className="w-11 h-11 bg-stone-50 rounded-full text-stone-600 hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center shadow-sm"
                  title="Modifica"
                >
                  <Edit2 size={20} />
                </button>
              )}

              <div className="flex-grow" />

              {onDelete && (
                <button 
                  onClick={() => onDelete(mineral.docId!)}
                  className="w-11 h-11 bg-red-50 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center shadow-sm"
                  title="Elimina"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          )}

          <h2 className="text-3xl md:text-4xl font-display font-bold text-primary mb-6">{mineral.name}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                <MapIcon size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Provenienza</p>
                <p className="text-lg font-medium text-stone-700">{mineral.origin || 'n.d.'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                <Layers size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Dimensioni</p>
                <p className="text-lg font-medium text-stone-700">
                  {mineral.dimensions ? `${mineral.dimensions.width} x ${mineral.dimensions.height} x ${mineral.dimensions.depth} cm` : 'n.d.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                <Search size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Modalità</p>
                <p className="text-lg font-medium text-stone-700 capitalize">{mineral.acquisitionMode}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                <UserIcon size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-1">Collezione</p>
                <p className="text-lg font-medium text-stone-700">Privata</p>
              </div>
            </div>
          </div>

          {mineral.notes && (
            <div className="mt-8 pt-8 border-t border-stone-100">
              <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-3">Note Aggiuntive</p>
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-stone-600 text-sm leading-relaxed italic">
                {mineral.notes}
              </div>
            </div>
          )}

          {mineral.coordinates && (
            <div className="mt-8 pt-8 border-t border-stone-100">
              <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-3">Posizione del Ritrovamento</p>
              <div className="h-64 rounded-2xl overflow-hidden border border-stone-100 shadow-inner">
                <MapContainer 
                  center={[mineral.coordinates.lat, mineral.coordinates.lng]} 
                  zoom={8} 
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[mineral.coordinates.lat, mineral.coordinates.lng]} />
                </MapContainer>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function QrLabelModal({ 
  mineral, 
  onClose 
}: { 
  mineral: Mineral, 
  onClose: () => void 
}) {
  const qrUrl = `${window.location.origin}?id=${mineral.docId}`;
  const [printError, setPrintError] = useState(false);
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handlePrint = () => {
    const labelContent = document.getElementById('printable-label');
    if (!labelContent) return;

    try {
      // Metodo 1: window.print() diretto (funziona se non siamo in iframe)
      if (window.self === window.top) {
        window.print();
        return;
      }

      // Metodo 2: iFrame (già provato, fallback)
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const html = `
        <html>
          <head>
            <title>Stampa Etichetta - ${mineral.name}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Outfit:wght@700&display=swap');
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Inter', sans-serif; }
              .label { border: 1px solid #000; width: 60mm; height: 80mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5mm; text-align: center; box-sizing: border-box; }
              h4 { font-family: 'Outfit', sans-serif; font-size: 18px; margin: 0 0 5px 0; }
              p { font-size: 12px; font-style: italic; color: #666; margin: 0 0 15px 0; }
              .footer { display: flex; justify-content: space-between; width: 100%; font-size: 10px; font-weight: bold; margin-top: 15px; text-transform: uppercase; color: #999; }
            </style>
          </head>
          <body>
            <div class="label">${labelContent.innerHTML}</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { window.frameElement.remove(); }, 500);
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      const doc = (printFrame.contentWindow?.document || printFrame.contentDocument) as Document;
      doc.open();
      doc.write(html);
      doc.close();
    } catch (e) {
      console.error("Errore stampa:", e);
      setPrintError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm print:p-0 print:bg-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl print:shadow-none print:rounded-none"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center print:hidden">
          <h3 className="text-xl font-display font-bold text-primary">Etichetta Minerale</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center print:p-4">
          {/* Label Preview */}
          <div id="printable-label" className="bg-white border-2 border-stone-200 p-6 rounded-xl flex flex-col items-center gap-4 w-full max-w-[250px] print:border-stone-400">
            <div className="text-center">
              <h4 className="font-display font-bold text-lg leading-tight">{mineral.name}</h4>
              <p className="text-xs text-stone-500 italic mt-1">{mineral.origin || 'n.d.'}</p>
            </div>
            
            <div className="bg-white p-2 border border-stone-100 rounded-lg">
              <QRCodeSVG value={qrUrl} size={120} level="H" />
            </div>

            <div className="text-center w-full text-[10px] uppercase font-bold tracking-widest text-stone-400">
              <span>{mineral.id}</span>
            </div>
          </div>

          <div className="mt-6 space-y-2 text-center print:hidden">
            <p className="text-sm text-stone-500">
              Questa etichetta misura circa 6x8cm.
            </p>
            {window.self !== window.top && (
              <p className="text-[10px] text-accent font-bold bg-accent/5 p-2 rounded-lg">
                ⚠️ Nota: Nella preview la stampa potrebbe essere bloccata. <br/>
                Apri l'app in una nuova scheda per stampare correttamente.
              </p>
            )}
          </div>
        </div>

        <div className="p-6 bg-stone-50 flex flex-col gap-3 print:hidden">
          <button 
            onClick={handlePrint}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            <Printer size={18} /> Stampa Etichetta
          </button>
          {printError && (
            <p className="text-[10px] text-red-500 text-center">
              Il browser ha bloccato la stampa. Apri l'app in una nuova scheda.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const MineralCard = React.memo(({ 
  mineral, 
  onEdit, 
  onDelete, 
  onShowQr,
  onView,
  showShare = true
}: { 
  mineral: Mineral, 
  onEdit?: (m: Mineral) => void, 
  onDelete?: (id: string) => void, 
  onShowQr?: (m: Mineral) => void,
  onView: (m: Mineral) => void,
  showShare?: boolean,
  key?: any 
}) => {
  return (
    <motion.div 
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ y: -4 }}
      transition={{ 
        layout: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        y: { duration: 0.2 }
      }}
      onClick={() => onView(mineral)}
      className="bg-white rounded-2xl overflow-hidden border border-stone-200 group cursor-pointer shadow-sm transform-gpu"
      style={{ 
        contentVisibility: 'auto',
        containIntrinsicSize: '0 300px',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden'
      } as React.CSSProperties}
    >
      <div className="aspect-square relative overflow-hidden bg-stone-50">
        {mineral.photoUrl ? (
          <img 
            src={mineral.photoUrl} 
            alt={mineral.name} 
            className="w-full h-full object-cover pointer-events-none"
            referrerPolicy="no-referrer"
            loading="lazy"
            data-visual-search="false"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-200">
            <Gem size={48} />
          </div>
        )}
        
        {mineral.photos && mineral.photos.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-lg">
            <ImageIcon size={12} />
            {mineral.photos.length}
          </div>
        )}

        <div className="absolute top-3 right-3 flex gap-2 opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {showShare && (
            <button 
              onClick={async () => {
                const shareUrl = `${window.location.origin}${window.location.pathname}?id=${mineral.docId}`;
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: `${APP_NAME}: ${mineral.name}`,
                      text: `Guarda questo esemplare di ${mineral.name} nella mia collezione!\n\n`,
                      url: shareUrl,
                    });
                  } catch (err) {
                    console.error('Share failed:', err);
                  }
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                  alert('Link copiato negli appunti!');
                }
              }}
              className="p-2 bg-white rounded-full text-stone-700 hover:text-primary shadow-md border border-stone-100"
              title="Condividi"
            >
              <Share2 size={16} />
            </button>
          )}
          {onShowQr && (
            <button 
              onClick={() => onShowQr(mineral)}
              className="p-2 bg-white rounded-full text-stone-700 hover:text-primary shadow-md border border-stone-100 items-center justify-center"
              title="Genera QR Code"
            >
              <QrCode size={16} />
            </button>
          )}
          {onEdit && (
            <button 
              onClick={() => onEdit(mineral)}
              className="p-2 bg-white rounded-full text-stone-700 hover:text-primary shadow-md border border-stone-100"
              title="Modifica"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onDelete && (
            <button 
              onClick={() => onDelete(mineral.docId!)}
              className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50 shadow-md border border-stone-100"
              title="Elimina"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-base sm:text-lg font-display font-bold text-primary truncate">{mineral.name}</h3>
          <span className="px-2 py-0.5 bg-primary text-white text-[10px] uppercase font-bold tracking-widest rounded-md shrink-0">
            {mineral.id}
          </span>
        </div>
        <p className="text-sm text-stone-500 flex items-center gap-1 mb-2 italic font-display truncate">
          <MapIcon size={12} /> {mineral.origin || 'n.d.'}
        </p>
        <div className="flex justify-start items-end">
          {mineral.dimensions && (
            <span className="text-xs text-stone-400 font-mono">
              {mineral.dimensions.width}x{mineral.dimensions.height}x{mineral.dimensions.depth} cm
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

function MineralForm({ 
  mineral, 
  onClose, 
  onSave,
  error,
  isSaving
}: { 
  mineral?: Mineral, 
  onClose: () => void, 
  onSave: (m: Partial<Mineral>, files: (File | Blob)[], existingPhotos: string[]) => void,
  error?: string | null,
  isSaving?: boolean
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const [formData, setFormData] = useState<Partial<Mineral>>(mineral || {
    id: '',
    name: '',
    origin: '',
    acquisitionMode: 'acquisto',
    dimensions: { width: 0, height: 0, depth: 0 },
    coordinates: null,
    notes: '',
    photos: []
  });
  const [files, setFiles] = useState<{file: File | Blob, preview: string}[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>(mineral?.photos || (mineral?.photoUrl ? [mineral.photoUrl] : []));
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    const newItems = selectedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setFiles(prev => [...prev, ...newItems]);
  };

  const removeNewFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Geocoding logic
  useEffect(() => {
    if (!formData.origin || formData.origin.trim() === '') {
      setFormData(prev => ({ ...prev, coordinates: null }));
      return;
    }

    const timer = setTimeout(async () => {
      if (formData.origin && formData.origin.length > 2) {
        setIsGeocoding(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.origin)}&limit=1`);
          const data = await response.json();
          if (data && data.length > 0) {
            const { lat, lon } = data[0];
            setFormData(prev => ({
              ...prev,
              coordinates: { lat: parseFloat(lat), lng: parseFloat(lon) }
            }));
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        } finally {
          setIsGeocoding(false);
        }
      }
    }, 1000); // Debounce 1s

    return () => clearTimeout(timer);
  }, [formData.origin]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-[1010]">
          <h2 className="text-2xl font-display font-bold">{mineral ? 'Modifica Minerale' : 'Nuovo Minerale'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
        </div>
        
        <div className="p-6 space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium flex items-center gap-2"
            >
              <X size={16} className="shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-stretch">
            {/* 1. Basic Info (ID, Name, Origin) */}
            <div className="space-y-4 order-1 md:order-1">
              <div>
                <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Codice Univoco</label>
                <input 
                  type="text" 
                  value={formData.id}
                  onChange={e => setFormData({...formData, id: e.target.value})}
                  disabled={!!mineral}
                  className={`w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none ${mineral ? 'bg-stone-50 cursor-not-allowed text-stone-400' : ''}`}
                  required
                />
                {mineral && <p className="text-[10px] text-stone-400 mt-1 italic font-display">Il codice univoco non può essere modificato.</p>}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Nome</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600 flex justify-between">
                  Provenienza
                  {isGeocoding && <span className="text-[10px] text-blue-500 animate-pulse">Ricerca posizione...</span>}
                </label>
                <input 
                  type="text" 
                  value={formData.origin}
                  onChange={e => setFormData({...formData, origin: e.target.value})}
                  placeholder="Es: Val di Fassa, Italia"
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            {/* 2. Photos Grid (order-4 on mobile, md:order-2 on desktop) */}
            <div className="flex flex-col order-4 md:order-2">
              <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Fotografie (max 6)</label>
              <div className="grid grid-cols-3 gap-2">
                {/* Existing Photos */}
                {existingPhotos.map((url, i) => (
                  <div key={`existing-${i}`} className="relative aspect-square rounded-xl overflow-hidden group border border-stone-200">
                    <img src={url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                    <button 
                      onClick={() => removeExistingPhoto(i)}
                      className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg z-10"
                    >
                      <X size={14} />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary text-[8px] text-white rounded font-bold uppercase tracking-wider">Cover</span>}
                  </div>
                ))}
                
                {/* New Files */}
                {files.map((item, i) => (
                  <div key={`new-${i}`} className="relative aspect-square rounded-xl overflow-hidden group border border-primary/20 bg-primary/5">
                    <img src={item.preview} className="w-full h-full object-cover" alt="" />
                    <button 
                      onClick={() => removeNewFile(i)}
                      className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg z-10"
                    >
                      <X size={14} />
                    </button>
                    {existingPhotos.length === 0 && i === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary text-[8px] text-white rounded font-bold uppercase tracking-wider">Cover</span>}
                  </div>
                ))}

                {/* Add Button */}
                {(existingPhotos.length + files.length) < 6 && (
                  <button 
                    type="button"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="aspect-square rounded-xl bg-stone-50 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center hover:bg-stone-100 hover:border-primary/30 transition-all group"
                  >
                    <Plus size={20} className="text-stone-400 group-hover:text-primary transition-colors" />
                    <span className="text-[8px] font-bold text-stone-400 uppercase mt-1">Aggiungi</span>
                    <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/*" multiple />
                  </button>
                )}
              </div>
              <p className="text-[9px] text-stone-400 mt-2 italic font-display">La prima foto sarà quella mostrata in anteprima.</p>
            </div>

            {/* 3. Acquisition Mode (order-2 on mobile, md:order-3 on desktop) */}
            <div className="order-2 md:order-3">
              <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Modalità Acquisizione</label>
              <select 
                value={formData.acquisitionMode}
                onChange={e => setFormData({...formData, acquisitionMode: e.target.value as any})}
                className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="acquisto">Acquisto</option>
                <option value="ritrovamento">Ritrovamento</option>
                <option value="scambio">Scambio</option>
                <option value="donazione">Donazione</option>
              </select>
            </div>

            {/* 4. Dimensions (order-3 on mobile, md:order-4 on desktop) */}
            <div className="grid grid-cols-3 gap-2 order-3 md:order-4">
              <div>
                <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Largh (cm)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.1"
                  value={formData.dimensions?.width}
                  onChange={e => setFormData({...formData, dimensions: {...formData.dimensions!, width: Math.max(0, Number(e.target.value))}})}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Alt (cm)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.1"
                  value={formData.dimensions?.height}
                  onChange={e => setFormData({...formData, dimensions: {...formData.dimensions!, height: Math.max(0, Number(e.target.value))}})}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Prof (cm)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.1"
                  value={formData.dimensions?.depth}
                  onChange={e => setFormData({...formData, dimensions: {...formData.dimensions!, depth: Math.max(0, Number(e.target.value))}})}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Note Aggiuntive</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Inserisci dettagli aggiuntivi, storia del ritrovamento o caratteristiche specifiche..."
              className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary/20 outline-none resize-none h-24"
            />
          </div>

          <div className="h-48 rounded-2xl overflow-hidden border border-gray-200 relative">
            <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-600 shadow-sm border border-stone-100">
              Posizione Geologica
            </div>
            <MapContainer center={[formData.coordinates?.lat || 45, formData.coordinates?.lng || 9]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationMarker 
                position={formData.coordinates ? [formData.coordinates.lat, formData.coordinates.lng] : null} 
                setPosition={(pos) => setFormData({...formData, coordinates: { lat: pos[0], lng: pos[1] }})}
              />
              <MapUpdater center={formData.coordinates ? [formData.coordinates.lat, formData.coordinates.lng] : null} />
            </MapContainer>
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white z-[1010]">
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="px-6 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Annulla
          </button>
          <button 
            onClick={() => onSave(formData, files.map(f => f.file), existingPhotos)}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvataggio...
              </>
            ) : (
              'Salva Minerale'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MapUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 10);
    } else {
      map.setView([45, 9], 5);
    }
  }, [center, map]);
  return null;
}


function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  const map = useMap();
  
  useEffect(() => {
    map.on('click', (e) => {
      setPosition([e.latlng.lat, e.latlng.lng]);
    });
  }, [map]);

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

function DeleteConfirmModal({ 
  mineralName, 
  onClose, 
  onConfirm,
  isDeleting
}: { 
  mineralName: string, 
  onClose: () => void, 
  onConfirm: () => void,
  isDeleting: boolean
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="text-red-500" size={32} />
          </div>
          <h3 className="text-xl font-display font-bold mb-2">Conferma Eliminazione</h3>
          <p className="text-gray-500 text-sm">
            Sei sicuro di voler eliminare <strong>{mineralName}</strong>? Questa azione non può essere annullata.
          </p>
        </div>
        <div className="p-6 bg-gray-50 flex gap-3">
          <button 
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-white disabled:opacity-50"
          >
            Annulla
          </button>
          <button 
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Elimina'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

function Dashboard() {
  const { user, userData } = useAuth();
  const [minerals, setMinerals] = useState<Mineral[]>([]);
  const [filteredMinerals, setFilteredMinerals] = useState<Mineral[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMineral, setEditingMineral] = useState<Mineral | undefined>();
  const [mineralToDelete, setMineralToDelete] = useState<Mineral | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'origin' | 'acquisitionMode'>('name');
  const [selectedMineralForQr, setSelectedMineralForQr] = useState<Mineral | null>(null);
  const [selectedMineralForDetail, setSelectedMineralForDetail] = useState<Mineral | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(userData?.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (userData?.displayName) {
      setNewDisplayName(userData.displayName);
    }
  }, [userData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && minerals.length > 0) {
      const mineral = minerals.find(m => m.docId === id);
      if (mineral) {
        setSelectedMineralForDetail(mineral);
        // Clear param without reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [minerals]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'minerals'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const item = doc.data() as Mineral;
        // Normalize legacy data: if photos array is missing but photoUrl exists, create it
        if (!item.photos && item.photoUrl) {
          item.photos = [item.photoUrl];
        }
        return { ...item, docId: doc.id };
      });
      setMinerals(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'minerals'));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const filtered = minerals.filter(m => 
      m.name.toLowerCase().includes(search.toLowerCase()) || 
      m.origin.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'id') return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'origin') return a.origin.localeCompare(b.origin);
      if (sortBy === 'acquisitionMode') return a.acquisitionMode.localeCompare(b.acquisitionMode);
      return 0;
    });
    setFilteredMinerals(filtered);
  }, [search, minerals, sortBy]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newDisplayName.trim()) return;
    setIsUpdatingProfile(true);
    try {
      // Update users doc
      await setDoc(doc(db, 'users', user.uid), {
        displayName: newDisplayName.trim()
      }, { merge: true });

      // Update public profile
      await setDoc(doc(db, 'public_profiles', user.uid), {
        displayName: newDisplayName.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      setIsProfileOpen(false);
      alert('Profilo aggiornato con successo!');
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Errore durante l\'aggiornamento del profilo.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      // 1. Delete all minerals and their photos in storage
      const q = query(collection(db, 'minerals'), where('ownerId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      // Delete Photos from Storage (directory listing)
      const storageFolderRef = ref(storage, `minerals/${user.uid}`);
      try {
        const itemRefs = await listAll(storageFolderRef);
        for (const item of itemRefs.items) {
          await deleteObject(item);
        }
      } catch (storageErr) {
        console.warn('Storage cleanup warning:', storageErr);
      }

      // Delete Firestore collections in batch
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, 'minerals', docSnap.id));
      }

      // 2. Delete Profile docs
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteDoc(doc(db, 'public_profiles', user.uid));

      // 3. Delete Auth User
      await deleteUser(user);
      
      alert('Il tuo account e tutti i dati associati sono stati eliminati correttamente.');
      window.location.reload();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      if (err.code === 'auth/requires-recent-login') {
        alert('Per sicurezza, questa operazione richiede una sessione recente. Effettua il logout, rientra e riprova subito.');
      } else {
        alert('Si è verificato un errore durante l\'eliminazione dell\'account.');
      }
    } finally {
      setIsDeletingAccount(false);
      setShowAccountDeleteConfirm(false);
    }
  };

  const normalizeCode = (code: string) => {
    return code.replace(/\s+/g, '').toUpperCase().replace(/^0+(?!$)/, '');
  };

  const handleSave = async (data: Partial<Mineral>, newFiles: (File | Blob)[], existingPhotos: string[]) => {
    if (!data.id?.trim() || !data.name?.trim()) {
      setFormError("Codice Univoco e Nome sono campi obbligatori.");
      return;
    }
    
    const normalized = normalizeCode(data.id);
    setFormError(null);
    setIsSaving(true);

    try {
      // Check for uniqueness
      const q = query(
        collection(db, 'minerals'), 
        where('ownerId', '==', user?.uid),
        where('normalizedId', '==', normalized)
      );
      const querySnapshot = await getDocs(q);
      
      const isDuplicate = querySnapshot.docs.some(docSnap => docSnap.id !== editingMineral?.docId);
      
      if (isDuplicate) {
        setFormError(`Il codice "${data.id}" risulta già in uso come ${normalized}.`);
        setIsSaving(false);
        return;
      }

      // 1. Determine which photos to delete from storage
      if (editingMineral?.photos) {
        const photosToDelete = editingMineral.photos.filter(url => !existingPhotos.includes(url));
        for (const url of photosToDelete) {
          try {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
          } catch (err) {
            console.warn('Could not delete photo from storage:', err);
          }
        }
      } else if (editingMineral?.photoUrl && !existingPhotos.includes(editingMineral.photoUrl)) {
        // Fallback for old single photoUrl
        try {
          const photoRef = ref(storage, editingMineral.photoUrl);
          await deleteObject(photoRef);
        } catch (err) {
          console.warn('Could not delete old photo:', err);
        }
      }

      // 2. Upload new photos
      const uploadedUrls: string[] = [];
      for (const file of newFiles) {
        const compressedBlob = await compressImage(file as File); // Type cast for simplicity in helper
        const fileName = (file as File).name?.split('.').slice(0, -1).join('.') || 'photo';
        const storageRef = ref(storage, `minerals/${user?.uid}/${Date.now()}_${Math.random().toString(36).substring(7)}_${fileName}.jpg`);
        await uploadBytes(storageRef, compressedBlob);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      }

      const allPhotos = [...existingPhotos, ...uploadedUrls].slice(0, 6);
      const primaryPhotoUrl = allPhotos[0] || '';

      // Clean undefined values and internal keys
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([k, v]) => v !== undefined && k !== 'docId')
      );

      const mineralData = {
        ...cleanData,
        photoUrl: primaryPhotoUrl,
        photos: allPhotos,
        normalizedId: normalized,
        ownerId: user?.uid,
        createdAt: data.createdAt || serverTimestamp(),
      };

      if (editingMineral) {
        await updateDoc(doc(db, 'minerals', editingMineral.docId!), mineralData);
      } else {
        await addDoc(collection(db, 'minerals'), mineralData);
      }
      setIsFormOpen(false);
      setEditingMineral(undefined);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'minerals');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (docId: string) => {
    const mineral = minerals.find(m => m.docId === docId);
    if (mineral) {
      setMineralToDelete(mineral);
    }
  };

  const confirmDelete = async () => {
    if (!mineralToDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete all photos from storage
      const photosToDelete = mineralToDelete.photos || (mineralToDelete.photoUrl ? [mineralToDelete.photoUrl] : []);
      for (const url of photosToDelete) {
        try {
          const photoRef = ref(storage, url);
          await deleteObject(photoRef);
        } catch (err) {
          console.warn('Could not delete photo from storage:', err);
        }
      }
      await deleteDoc(doc(db, 'minerals', mineralToDelete.docId!));
      setMineralToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'minerals');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShareCollection = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?user=${user?.uid}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Collezione Minerali di ${user?.displayName || 'GeoMineral'}`,
          text: `Guarda la mia intera collezione di minerali su ${APP_NAME}!\n\n`,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link della collezione copiato negli appunti!');
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="w-10 h-10 shadow-md rounded-xl" />
            <h1 className="text-xl sm:text-2xl font-display font-bold text-primary">{APP_NAME}</h1>
          </div>

          {/* Desktop Search */}
          <div className="flex-1 max-w-md mx-8 relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Cerca per nome, località o codice..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 h-11 bg-stone-50 rounded-xl border border-stone-100 focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleShareCollection}
              className="p-2 text-stone-400 hover:text-primary transition-colors"
              title="Condividi Collezione"
            >
              <Share2 size={20} />
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
              title="Esci"
            >
              <LogOut size={20} />
            </button>
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden border border-stone-200 hover:ring-2 hover:ring-primary/20 transition-all"
              title="Profilo"
            >
              {user?.photoURL ? <img src={user.photoURL} alt="User" /> : <UserIcon className="text-stone-400" />}
            </button>
          </div>
        </div>

        {/* Mobile Search & Add Row */}
        <div className="md:hidden px-4 pb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Cerca minerali..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 h-11 bg-stone-50 rounded-xl border border-stone-100 focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all text-sm"
            />
          </div>
          <button 
            onClick={() => {
              setEditingMineral(undefined);
              setIsFormOpen(true);
            }}
            className="w-11 h-11 bg-accent text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent/20 shrink-0 active:scale-95 transition-transform"
            title="Aggiungi Minerale"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-primary">La tua Collezione</h2>
              <p className="text-stone-500 italic font-display">{filteredMinerals.length} esemplari trovati</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 h-11 border border-stone-200 shadow-sm flex-1 lg:flex-none">
              <span className="text-[10px] uppercase font-bold text-stone-400 whitespace-nowrap">Ordina per:</span>
              <div className="relative flex-1 flex items-center">
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full text-sm font-bold text-primary bg-transparent focus:outline-none cursor-pointer appearance-none pr-5 text-right"
                >
                  <option value="name">Nome</option>
                  <option value="id">Codice</option>
                  <option value="origin">Origine</option>
                  <option value="acquisitionMode">Acquisizione</option>
                </select>
                <ChevronDown size={14} className="absolute right-0 pointer-events-none text-primary" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-1 h-11 border border-stone-200 flex gap-1 shadow-sm justify-center flex-1 lg:flex-none">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("flex-1 sm:w-10 rounded-lg transition-all flex items-center justify-center", viewMode === 'grid' ? "bg-primary text-white shadow-md" : "text-stone-400 hover:bg-stone-50")}
              >
                <Layers size={20} />
              </button>
              <button 
                onClick={() => setViewMode('map')}
                className={cn("flex-1 sm:w-10 rounded-lg transition-all flex items-center justify-center", viewMode === 'map' ? "bg-primary text-white shadow-md" : "text-stone-400 hover:bg-stone-50")}
              >
                <MapIcon size={20} />
              </button>
            </div>

            <button 
              onClick={() => {
                setEditingMineral(undefined);
                setIsFormOpen(true);
              }}
              className="hidden md:flex col-span-2 sm:flex-1 lg:flex-none h-11 items-center justify-center gap-2 bg-accent text-white px-6 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-accent/20"
            >
              <Plus size={20} /> <span className="whitespace-nowrap">Aggiungi</span>
            </button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredMinerals.map(mineral => (
                <MineralCard 
                  key={mineral.docId} 
                  mineral={mineral} 
                  onEdit={(m) => {
                    setEditingMineral(m);
                    setIsFormOpen(true);
                  }}
                  onDelete={handleDelete}
                  onShowQr={(m) => setSelectedMineralForQr(m)}
                  onView={(m) => setSelectedMineralForDetail(m)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="h-[600px] rounded-3xl overflow-hidden border border-[#1a1a1a1a] shadow-xl relative">
            <MapContainer center={[45, 9]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MarkerClusterGroup
                chunkedLoading
                maxClusterRadius={50}
                showCoverageOnHover={false}
              >
                {filteredMinerals.filter(m => m.coordinates).map(mineral => (
                  <Marker key={mineral.docId} position={[mineral.coordinates!.lat, mineral.coordinates!.lng]}>
                    <Popup>
                      <div 
                        className="p-1 cursor-pointer group" 
                        onClick={() => setSelectedMineralForDetail(mineral)}
                      >
                        <h4 className="font-bold group-hover:text-primary transition-colors">{mineral.name}</h4>
                        <p className="text-xs text-gray-500">{mineral.origin || 'n.d.'}</p>
                        {mineral.photoUrl && (
                          <div className="relative mt-2 overflow-hidden rounded">
                            <img 
                              src={mineral.photoUrl} 
                              className="w-24 h-24 object-cover transition-transform group-hover:scale-110 pointer-events-none" 
                              alt={mineral.name} 
                              data-visual-search="false"
                            />
                          </div>
                        )}
                        <p className="text-[10px] text-primary font-bold mt-2 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                          Vedi dettaglio →
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        )}

        {filteredMinerals.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <Gem className="mx-auto text-gray-200 mb-4" size={64} />
            <h3 className="text-xl font-display font-semibold text-gray-400">Nessun minerale trovato</h3>
            <p className="text-gray-400">Inizia aggiungendo il tuo primo esemplare alla collezione.</p>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 mt-auto">
        <div className="border-t border-stone-200 pt-8 flex flex-col md:flex-row justify-start items-center gap-6">
          <div className="flex items-center gap-2 text-stone-400">
            <Gem size={16} />
            <span className="text-sm font-display font-medium tracking-tight">{APP_NAME}</span>
          </div>
          <div className="hidden md:block w-px h-4 bg-stone-200"></div>
          <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-widest text-stone-400">
            <span>© 2026</span>
            <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
            <span className="bg-stone-100 px-2 py-0.5 rounded text-stone-500">v{APP_VERSION}</span>
          </div>
        </div>
      </footer>

      {isFormOpen && (
        <MineralForm 
          mineral={editingMineral} 
          error={formError}
          isSaving={isSaving}
          onClose={() => {
            setIsFormOpen(false);
            setEditingMineral(undefined);
            setFormError(null);
          }}
          onSave={handleSave}
        />
      )}

      {mineralToDelete && (
        <DeleteConfirmModal 
          mineralName={mineralToDelete.name}
          isDeleting={isDeleting}
          onClose={() => setMineralToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {selectedMineralForQr && (
        <QrLabelModal 
          mineral={selectedMineralForQr}
          onClose={() => setSelectedMineralForQr(null)}
        />
      )}

      {selectedMineralForDetail && (
        <MineralDetailModal 
          mineral={selectedMineralForDetail}
          onClose={() => setSelectedMineralForDetail(null)}
          onEdit={(m) => {
            setSelectedMineralForDetail(null);
            setEditingMineral(m);
            setIsFormOpen(true);
          }}
          onDelete={(id) => {
            setSelectedMineralForDetail(null);
            setMineralToDelete(minerals.find(m => m.docId === id) || null);
          }}
          onShowQr={(m) => {
            setSelectedMineralForDetail(null);
            setSelectedMineralForQr(m);
          }}
        />
      )}

      {/* Profile Modal */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 z-[100] p-4 bg-primary text-white rounded-full shadow-xl shadow-primary/30 hover:scale-110 active:scale-95 transition-all hidden md:flex items-center justify-center group"
            title="Torna in cima"
          >
            <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform" />
          </motion.button>
        )}
        {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-primary">Impostazioni Profilo</h3>
                <button onClick={() => setIsProfileOpen(false)} className="text-stone-400 hover:text-stone-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest font-bold mb-1 text-stone-600">Nome Pubblico</label>
                  <input 
                    type="text" 
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Il tuo nome per la collezione condivisa"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                  <p className="text-[10px] text-stone-400 mt-2 italic">
                    Questo nome apparirà nei titoli delle tue collezioni condivise.
                  </p>
                </div>
                <button 
                  type="submit"
                  disabled={isUpdatingProfile || isDeletingAccount}
                  className="w-full h-12 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>

                <div className="pt-4 border-t border-stone-100 mt-4">
                  {!showAccountDeleteConfirm ? (
                    <button 
                      type="button"
                      onClick={() => setShowAccountDeleteConfirm(true)}
                      className="w-full py-2 text-red-500 text-xs font-bold uppercase tracking-widest hover:text-red-600 transition-colors"
                    >
                      Elimina Account
                    </button>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="text-red-500 shrink-0" size={18} />
                        <p className="text-[11px] text-red-700 leading-relaxed">
                          <strong>Attenzione:</strong> Questa azione è irreversibile. Tutti i tuoi minerali, le foto e i dati del profilo verranno eliminati permanentemente dal database.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setShowAccountDeleteConfirm(false)}
                          disabled={isDeletingAccount}
                          className="flex-1 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-[10px] font-bold uppercase disabled:opacity-50"
                        >
                          Annulla
                        </button>
                        <button 
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={isDeletingAccount}
                          className="flex-1 py-2 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isDeletingAccount ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : 'Conferma'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppContent() {
  const { user, loading, isAuthReady } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const publicId = params.get('id');
  const publicUser = params.get('user');

  if (publicId) {
    return <PublicMineralView docId={publicId} />;
  }

  if (publicUser) {
    return <PublicCollectionView userId={publicUser} />;
  }

  if (!isAuthReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Gem className="text-[#1a1a1a]" size={48} />
        </motion.div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginView />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

