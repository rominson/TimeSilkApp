
// LifeGrid Application - Main Entry Point (Refreshed)
import React, { useState, useMemo, useEffect, useRef, useCallback, Component } from 'react';
import { 
  Calendar, 
  Clock, 
  Hourglass, 
  Plus,
  Trash2,
  Target,
  Check,
  Sparkles,
  Compass,
  Sun,
  Moon,
  Mail,
  User,
  LogOut,
  LogIn,
  Lock,
  Unlock,
  Send,
  Feather,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Award,
  X,
  QrCode,
  ExternalLink,
} from 'lucide-react';
import { format, differenceInDays, differenceInMonths, addYears, differenceInYears } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { domToPng } from 'modern-screenshot';

import { toPng } from 'html-to-image';
import { get as getCache, set as setCache } from 'idb-keyval';
import { AuthModals } from './src/components/AuthModals';

// API Imports
import { api } from './src/lib/api';

const MAX_AGE_YEARS = 100;
const TOTAL_MONTHS = MAX_AGE_YEARS * 12;

interface LifeGoal {
  id: string;
  title: string;
  age: number;
  completed?: boolean;
}

interface FutureLetter {
  id: string;
  content: string;
  unlockAge: number;
  createdAt: string;
}

const WRITING_PROMPTS = {
  general: [
    "你现在最想实现的愿望是什么？",
    "此时此刻，你最想感谢的人是谁？",
    "想象一下，10年后的你正在过着怎样的生活？",
    "给未来的自己一条建议。",
    "记录下今天让你感到快乐的一件小事。",
    "现在你最害怕失去的是什么？",
    "写下一个你希望未来永远不会忘记的瞬间。"
  ],
  century: [
    "你对22世纪的世界有什么样的幻想？",
    "如果2100年的你还能看到这封信，你想对自己说什么？",
    "你希望在接下来的一个世纪里，人类能解决什么问题？",
    "给2100年的后代留一句话。",
    "你认为那时的人们还会使用我们现在的技术吗？",
    "想象一下2100年一个清晨你醒来看到的第一个场景。",
    "如果你能穿越时空，你会给下个世纪的人们带去什么礼物？"
  ]
};

// --- Error Handling & Logging ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const handleApiError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('API Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// --- Calendar Utilities ---
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

const generateGoogleCalendarLink = (title: string, date: Date, description: string) => {
  const start = date.toISOString().replace(/-|:|\.\d+/g, '');
  const end = new Date(date.getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '');
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&sf=true&output=xml`;
};

const generateOutlookCalendarLink = (title: string, date: Date, description: string) => {
  const start = date.toISOString();
  const end = new Date(date.getTime() + 3600000).toISOString();
  return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&startdt=${start}&enddt=${end}&body=${encodeURIComponent(description)}`;
};

const downloadIcsFile = (title: string, date: Date, description: string) => {
  const start = date.toISOString().replace(/-|:|\.\d+/g, '');
  const end = new Date(date.getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '');
  const now = new Date().toISOString().replace(/-|:|\.\d+/g, '');
  
  // 优化 ICS 内容，增加标准字段以提高 iOS 兼容性
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeGrid//Future Letter//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@lifegrid.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n'); // 使用标准换行符
  
  // 使用 Data URI 方式触发，这在 iOS 上更容易弹出“添加到日历”的系统对话框
  const encodedIcs = encodeURIComponent(icsContent);
  window.location.href = `data:text/calendar;charset=utf8,${encodedIcs}`;
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message || String(error) };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] p-6 text-center">
          <div className="max-w-md">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-stone-800 mb-4">糟糕，出错了</h2>
            <p className="text-stone-500 text-sm mb-8">
              系统遇到了一些问题。请尝试刷新页面或联系我们。
            </p>
            {this.state.errorInfo && (
              <pre className="text-[10px] bg-stone-100 p-4 rounded-xl text-left overflow-auto max-h-40 mb-8">
                {this.state.errorInfo}
              </pre>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-stone-800 text-white rounded-full text-sm font-bold shadow-lg"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const [birthDate, setBirthDate] = useState<string>(() => localStorage.getItem('birthDate') || '');
  const [goals, setGoals] = useState<LifeGoal[]>(() => {
    const saved = localStorage.getItem('goals');
    return saved ? JSON.parse(saved) : [];
  });
  const [letters, setLetters] = useState<FutureLetter[]>(() => {
    const saved = localStorage.getItem('letters');
    return saved ? JSON.parse(saved) : [];
  });

  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalAge, setNewGoalAge] = useState<number | ''>('');
  
  const [newLetterContent, setNewLetterContent] = useState('');
  const [newLetterAge, setNewLetterAge] = useState<number | ''>('');
  const [newCenturyLetterContent, setNewCenturyLetterContent] = useState('');
  const [writingLetterType, setWritingLetterType] = useState<'general' | 'century'>('general');
  const [currentInspiration, setCurrentInspiration] = useState<string | null>(null);
  const [isWritingLetter, setIsWritingLetter] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [currentCertificateIndex, setCurrentCertificateIndex] = useState(0);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingName, setOnboardingName] = useState('');
  const [isEditingCertificateName, setIsEditingCertificateName] = useState(false);
  const [certificateData, setCertificateData] = useState<{
    id: string;
    sender: string;
    departureYear: number;
    arrivalYear: number;
    arrivalAge: number;
    isCenturyTraveler?: boolean;
  } | null>(null);
  const [pendingLetter, setPendingLetter] = useState<{ content: string; age: number } | null>(null);
  const [showAppleModal, setShowAppleModal] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; phone?: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'google'>('email');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [letterToDeleteId, setLetterToDeleteId] = useState<string | null>(null);
  const [goalToDeleteId, setGoalToDeleteId] = useState<string | null>(null);
  const [letterError, setLetterError] = useState('');
  const [goalError, setGoalError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedImage, setDownloadedImage] = useState<string | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [autoGeneratedCertImage, setAutoGeneratedCertImage] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<{
    daysLived: number;
    monthsLived: number;
    yearsLived: number;
    percentLived: number;
    remainingDays: number;
  } | null>(null);

  const canReachNextCentury = useMemo(() => {
    if (!birthDate) return false;
    const birthYear = new Date(birthDate).getFullYear();
    return (birthYear + MAX_AGE_YEARS) >= 2100;
  }, [birthDate]);

  const ageIn2100 = useMemo(() => {
    if (!birthDate) return 0;
    const birthYear = new Date(birthDate).getFullYear();
    return 2100 - birthYear;
  }, [birthDate]);

  const handleQuickLetterTo2100 = () => {
    setWritingLetterType('century');
    setCurrentInspiration(null);
    setIsWritingLetter(true);
  };

  useEffect(() => {
    localStorage.setItem('birthDate', birthDate);
    localStorage.setItem('goals', JSON.stringify(goals));
    localStorage.setItem('letters', JSON.stringify(letters));
  }, [birthDate, goals, letters]);

  const calculateStats = (date: string) => {
    if (!date) return;
    const birth = new Date(date);
    const now = new Date();
    const end = addYears(birth, MAX_AGE_YEARS);

    const days = differenceInDays(now, birth);
    const months = differenceInMonths(now, birth);
    const years = differenceInYears(now, birth);
    const totalDaysPotential = differenceInDays(end, birth);
    const percent = Math.min((days / totalDaysPotential) * 100, 100);
    const remaining = Math.max(differenceInDays(end, now), 0);

    setStats({
      daysLived: Math.max(days, 0),
      monthsLived: Math.max(months, 0),
      yearsLived: Math.max(years, 0),
      percentLived: percent,
      remainingDays: remaining,
    });
  };

  const allCertificates = useMemo(() => {
    if (!birthDate || !user || letters.length === 0) return [];
    const birth = new Date(birthDate);
    return letters.map(letter => {
      const unlockDate = addYears(birth, letter.unlockAge);
      // Handle both camelCase and snake_case from API
      const dateStr = letter.createdAt || (letter as any).created_at || new Date().toISOString();
      const createdAt = new Date(dateStr);
      
      return {
        id: letter.id.slice(-8).toUpperCase(),
        sender: user.name || '时空旅者',
        departureYear: createdAt.getFullYear(),
        arrivalYear: unlockDate.getFullYear(),
        arrivalAge: letter.unlockAge,
        isCenturyTraveler: unlockDate.getFullYear() >= 2100,
        date: createdAt,
        unlockDate: unlockDate
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first
  }, [letters, birthDate, user]);

  useEffect(() => {
    if (isCertificateModalOpen && allCertificates.length > 0) {
      const currentCert = allCertificates[currentCertificateIndex];
      const cacheKey = `cert-image-${currentCert.id}-${currentCert.sender}-${currentCert.arrivalYear}`;

      const generateImage = async () => {
        setIsAutoGenerating(true);
        setAutoGeneratedCertImage(null);

        try {
          // 1. Check IndexedDB Cache first
          const cachedImage = await getCache(cacheKey);
          if (cachedImage) {
            setAutoGeneratedCertImage(cachedImage);
            setIsAutoGenerating(false);
            return;
          }

          // 2. If not cached, generate it
          // Wait for animations and fonts
          await Promise.all([
            new Promise(resolve => setTimeout(resolve, 1200)),
            document.fonts.ready
          ]);
          
          if (captureRef.current) {
            // Use html-to-image for the off-screen capture which is more stable for this pattern
            const dataUrl = await toPng(captureRef.current, {
              pixelRatio: 3,
              backgroundColor: currentCert.isCenturyTraveler ? '#020617' : '#F5F2ED',
              cacheBust: true,
            });
            
            // 3. Save to cache
            await setCache(cacheKey, dataUrl);
            setAutoGeneratedCertImage(dataUrl);
          }
        } catch (error) {
          console.error('Auto-generation or caching failed:', error);
        } finally {
          setIsAutoGenerating(false);
        }
      };
      
      generateImage();
    } else {
      setAutoGeneratedCertImage(null);
    }
  }, [isCertificateModalOpen, currentCertificateIndex, allCertificates.length, allCertificates[currentCertificateIndex]?.sender]);

  useEffect(() => {
    const initAuth = async () => {
      const userId = localStorage.getItem('user_id');
      if (userId) {
        try {
          const userData = await api.getMe();
          setUser({
            id: userData.id,
            name: userData.name || `旅者 ${userData.phone || '未知'}`,
            phone: userData.phone
          });
          if (userData.birthDate) setBirthDate(userData.birthDate);
          
          const [goalsData, lettersData] = await Promise.all([
            api.getGoals(),
            api.getLetters()
          ]);
          setGoals(goalsData);
          setLetters(lettersData);
        } catch (err) {
          console.error('Auth check failed:', err);
          setUser(null);
        }
      }
      setIsAuthReady(true);
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (birthDate) {
      calculateStats(birthDate);
    }
    
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [birthDate]);

  useEffect(() => {
    if (allCertificates.length > 0 && currentCertificateIndex >= allCertificates.length) {
      setCurrentCertificateIndex(allCertificates.length - 1);
    }
  }, [allCertificates.length, currentCertificateIndex]);

  // Helper to convert any color to RGBA using canvas
  const convertToRgba = (color: string): string => {
    if (!color || color === 'transparent' || color === 'none') return color;
    
    // Fallback for oklch/oklab which html2canvas cannot parse
    if (color.includes('oklch') || color.includes('oklab') || color.includes('color-mix')) {
      if (color.includes('white') || color.includes('100%')) return 'rgba(255,255,255,1)';
      if (color.includes('black') || color.includes(' 0%')) return 'rgba(0,0,0,1)';
      
      // Try to use a temporary element to let the browser resolve it to rgb
      try {
        const temp = document.createElement('div');
        temp.style.color = color;
        document.body.appendChild(temp);
        const resolved = window.getComputedStyle(temp).color;
        document.body.removeChild(temp);
        if (resolved && !resolved.includes('oklch') && !resolved.includes('oklab')) {
          return resolved;
        }
      } catch (e) {
        // Fallback to gray if resolution fails
        return 'rgba(128,128,128,1)';
      }
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return color;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    } catch (e) {
      return color;
    }
  };

  const handleDownloadCertificate = async () => {
    if (isDownloading) return;
    
    // If we already have the auto-generated image, use it directly
    if (autoGeneratedCertImage) {
      setDownloadedImage(autoGeneratedCertImage);
      if (isMobile) {
        // On mobile, try to use Web Share API first for a native experience
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [] })) {
          try {
            const response = await fetch(autoGeneratedCertImage);
            const blob = await response.blob();
            const file = new File([blob], `时光守护者证书-${allCertificates[currentCertificateIndex].id}.png`, { type: 'image/png' });
            
            await navigator.share({
              files: [file],
              title: '时光守护者证书',
              text: '这是我的时光守护者证书'
            });
            return;
          } catch (error) {
            console.error('Share failed:', error);
            // Fallback to preview if share fails or is cancelled
            setIsImagePreviewOpen(true);
          }
        } else {
          // If share API not available, show preview for long-press
          setIsImagePreviewOpen(true);
        }
      } else {
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = autoGeneratedCertImage;
        link.download = `时光守护者证书-${allCertificates[currentCertificateIndex].id}.png`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
        }, 100);
      }
      return;
    }

    const el = certificateRef.current;
    if (!el) {
      alert('保存失败：未找到证书元素');
      return;
    }
    
    setIsDownloading(true);
    
    try {
      // 1. Wait for everything to settle and fonts to be ready
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 2000)),
        document.fonts.ready
      ]);
      
      // 2. Ensure all images are loaded
      const images = el.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        const image = img as HTMLImageElement;
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      }));
      
      // 3. Capture with high precision
      const dataUrl = await domToPng(el, {
        scale: 3,
        backgroundColor: allCertificates[currentCertificateIndex].isCenturyTraveler ? '#020617' : '#F5F2ED',
        features: {
          copyScrollbar: true,
        }
      });

      setDownloadedImage(dataUrl);
      
      if (isMobile) {
        // On mobile, try to use Web Share API
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [] })) {
          try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `时光守护者证书-${allCertificates[currentCertificateIndex].id}.png`, { type: 'image/png' });
            
            await navigator.share({
              files: [file],
              title: '时光守护者证书',
              text: '这是我的时光守护者证书'
            });
          } catch (error) {
            console.error('Share failed:', error);
            setIsImagePreviewOpen(true);
          }
        } else {
          setIsImagePreviewOpen(true);
        }
      } else {
        // On desktop, trigger direct download
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = dataUrl;
        link.download = `时光守护者证书-${allCertificates[currentCertificateIndex].id}.png`;
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 100);
      }
      
      console.log('Capture successful');
    } catch (error) {
      console.error('证书生成失败：', error);
      alert('保存证书失败。请重试或直接截图。');
    } finally {
      setIsDownloading(false);
    }
  };
  const addGoal = async () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    if (!newGoalTitle.trim()) {
      setGoalError('请输入目标内容');
      return;
    }
    if (newGoalAge === '') {
      setGoalError('请输入目标年龄');
      return;
    }
    if (typeof newGoalAge === 'number' && (newGoalAge < 0 || newGoalAge > MAX_AGE_YEARS)) {
      setGoalError(`年龄必须在 0 到 ${MAX_AGE_YEARS} 之间`);
      return;
    }

    setGoalError('');
    const goalData = { title: newGoalTitle, age: newGoalAge, completed: false, uid: user.id };
    
    try {
      const newGoal = await api.addGoal({ title: newGoalTitle, age: newGoalAge });
      setGoals(prev => [...prev, newGoal]);
      setNewGoalTitle('');
      setNewGoalAge('');
    } catch (err) {
      handleApiError(err, OperationType.CREATE, `goals`);
    }
  };

  const removeGoal = (id: string) => {
    setGoalToDeleteId(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteGoal = async () => {
    if (goalToDeleteId) {
      try {
        await api.deleteGoal(goalToDeleteId);
        setGoals(prev => prev.filter(g => g.id !== goalToDeleteId));
      } catch (err) {
        handleApiError(err, OperationType.DELETE, `goals/${goalToDeleteId}`);
      }
      setGoalToDeleteId(null);
      setIsDeleteConfirmOpen(false);
    }
  };

  const toggleGoalCompletion = async (id: string) => {
    if (!user) return;
    try {
      await api.toggleGoal(id);
      setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
    } catch (err) {
      handleApiError(err, OperationType.UPDATE, `goals/${id}`);
    }
  };

  const addLetter = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    if (writingLetterType === 'general') {
      if (!newLetterContent.trim()) {
        setLetterError('请先写下你想说的话');
        return;
      }
      if (newLetterAge === '') {
        setLetterError('请输入开启年龄');
        return;
      }
      if (typeof newLetterAge === 'number' && newLetterAge <= (stats?.yearsLived || 0)) {
        setLetterError(`开启年龄必须大于当前年龄 (${Math.floor(stats?.yearsLived || 0)})`);
        return;
      }
      if (typeof newLetterAge === 'number' && newLetterAge > MAX_AGE_YEARS) {
        setLetterError(`开启年龄不能超过 ${MAX_AGE_YEARS} 岁`);
        return;
      }
      setPendingLetter({ content: newLetterContent, age: newLetterAge });
    } else {
      if (!newCenturyLetterContent.trim()) {
        setLetterError('请先写下你想说的话');
        return;
      }
      setPendingLetter({ content: newCenturyLetterContent, age: ageIn2100 });
    }

    setLetterError('');
    setOnboardingName(user?.name || '');
    setIsReminderModalOpen(true);
  };

  const confirmLetter = async () => {
    if (!pendingLetter || !user || !birthDate) return;

    setIsSubmittingReminder(true);
    const letterId = Date.now().toString();

    try {
      // Update name if changed
      if (onboardingName.trim() && onboardingName.trim() !== user.name) {
        await updateUserName(onboardingName.trim());
      }

      // Add a bit of artificial delay for the time tunnel effect
      await new Promise(resolve => setTimeout(resolve, 1300));

      // Calculate unlock date
      const birth = new Date(birthDate);
      const unlockDate = addYears(birth, pendingLetter.age);
      
      // Save to API
      const newLetter = await api.addLetter({
        content: pendingLetter.content,
        unlockAge: pendingLetter.age
      });
      setLetters(prev => [...prev, newLetter]);

      // Prepare certificate data
      setCertificateData({
        id: letterId.slice(-8).toUpperCase(),
        sender: user.name || '时空旅者',
        departureYear: new Date().getFullYear(),
        arrivalYear: unlockDate.getFullYear(),
        arrivalAge: pendingLetter.age,
        isCenturyTraveler: writingLetterType === 'century' || unlockDate.getFullYear() >= 2100
      });

      // Clear input
      if (writingLetterType === 'general') {
        setNewLetterContent('');
        setNewLetterAge('');
      } else {
        setNewCenturyLetterContent('');
      }
      setCurrentInspiration(null);

      setIsCertificateModalOpen(true);
      setIsWritingLetter(false);
      setIsReminderModalOpen(false);
      setPendingLetter(null);
    } catch (error) {
      console.error('Failed to send:', error);
      handleApiError(error, OperationType.CREATE, `letters`);
      alert('发送失败，请稍后重试');
    } finally {
      setIsSubmittingReminder(false);
    }
  };

  const removeLetter = async (id: string) => {
    console.log('Initiating letter removal:', id);
    setLetterToDeleteId(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteLetter = async () => {
    if (letterToDeleteId) {
      try {
        await api.deleteLetter(letterToDeleteId);
        setLetters(prev => prev.filter(l => l.id !== letterToDeleteId));
      } catch (err) {
        handleApiError(err, OperationType.DELETE, `letters/${letterToDeleteId}`);
      }
      setLetterToDeleteId(null);
      setIsDeleteConfirmOpen(false);
    }
  };

  const updateUserName = async (newName: string) => {
    if (!user || !newName.trim()) return;
    
    setIsUpdatingName(true);
    try {
      await api.updateName(newName.trim());
      
      setUser({ ...user, name: newName.trim() });
      // If certificate is open, sync the name on the certificate
      if (certificateData) {
        setCertificateData({ ...certificateData, sender: newName.trim() });
      }
      setIsOnboardingModalOpen(false);
      setIsEditingCertificateName(false);
    } catch (error) {
      console.error('Failed to update name:', error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone || !loginPassword) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await api.login({ phone: loginPhone, password: loginPassword });
      setUser(result);
      
      const [goalsData, lettersData] = await Promise.all([
        api.getGoals(),
        api.getLetters()
      ]);
      setGoals(goalsData);
      setLetters(lettersData);
      
      setIsLoginModalOpen(false);
      setLoginPhone('');
      setLoginPassword('');
    } catch (err: any) {
      console.error('Login failed:', err);
      setLoginError('登录失败，请检查手机号和密码');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePhoneSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone || !loginPassword) return;
    if (loginPassword.length < 6) {
      setLoginError('密码至少需要 6 位');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await api.signup({ phone: loginPhone, password: loginPassword, name: onboardingName });
      setUser(result);
      setIsLoginModalOpen(false);
      setLoginPhone('');
      setLoginPassword('');
      if (!onboardingName) {
        setIsOnboardingModalOpen(true);
      }
    } catch (err: any) {
      console.error('Sign up failed:', err);
      setLoginError('注册失败，请稍后重试');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    console.log('isLoginModalOpen changed:', isLoginModalOpen);
  }, [isLoginModalOpen]);

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setGoals([]);
    setLetters([]);
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    // If logged in, periodically sync birthDate to backend
    if (user && birthDate) {
      const syncData = async () => {
        try {
          await api.updateBirthDate(birthDate);
        } catch (err) {
          handleApiError(err, OperationType.UPDATE, `users/${user.id}`);
        }
      };
      const timer = setTimeout(syncData, 2000); // Debounce
      return () => clearTimeout(timer);
    }
  }, [user, birthDate]);

  const goalMap = useMemo(() => {
    const map = new Map<number, LifeGoal[]>();
    goals.forEach(goal => {
      const monthIdx = goal.age * 12;
      if (!map.has(monthIdx)) map.set(monthIdx, []);
      map.get(monthIdx)?.push(goal);
    });
    return map;
  }, [goals]);

  const gridItems = useMemo(() => {
    if (!birthDate) return [];
    const items = [];
    for (let i = 0; i < TOTAL_MONTHS; i++) {
      items.push(i < (stats?.monthsLived || 0));
    }
    return items;
  }, [stats?.monthsLived, birthDate]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
          <p className="text-stone-400 text-sm font-serif italic">正在连接时空隧道...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FDFCFB] text-[#4A443F] flex flex-col overflow-hidden font-sans">
      {/* Header - Poetic & Minimal */}
      <header className="bg-transparent shrink-0 z-20 pt-12 pb-4 md:pt-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 w-full"
        >
          {/* Title - Top on Mobile, Left on Desktop */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-serif font-light italic text-[#2D2A26] tracking-tight">
              时光织锦
            </h1>
            <p className="text-xs md:text-sm uppercase tracking-[0.2em] text-[#A8A29E] mt-1.5 font-medium">
              可视化你生命的每一个篇章
            </p>
          </div>
          
          {/* Controls Group - Spread on Mobile, Right-aligned on Desktop */}
          <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-4">
            {/* Date Picker */}
            <div className="relative flex items-center bg-white/50 backdrop-blur-sm px-3 rounded-2xl border border-[#E7E5E4] shadow-sm h-[38px] min-w-[140px] group hover:bg-white/80 transition-all cursor-pointer active:scale-95">
              <Calendar size={14} className="text-[#A8A29E] mr-2 shrink-0 pointer-events-none" />
              <div className="flex-1 text-sm font-medium text-[#57534E] whitespace-nowrap pointer-events-none">
                {birthDate && !isNaN(new Date(birthDate).getTime()) ? format(new Date(birthDate), 'MM / dd / yyyy') : 'M / D / Y'}
              </div>
              <input 
                type="date" 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20 appearance-none full-clickable-date-input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as any).showPicker();
                  } catch (err) {
                    // Fallback for browsers that don't support showPicker()
                  }
                }}
                title="Select Birth Date"
              />
            </div>

            {/* User Menu */}
            <div className="flex items-center">
              {user ? (
                <div className="relative">
                  <div 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 bg-white/50 backdrop-blur-sm px-4 rounded-2xl border border-[#E7E5E4] shadow-sm cursor-pointer hover:bg-white/80 transition-all h-[38px]"
                  >
                    <span className="text-xs font-bold text-[#57534E]">{user.name}</span>
                    <ChevronDown size={14} className={`text-stone-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {isUserMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl border border-[#E7E5E4] shadow-lg py-1 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {allCertificates.length > 0 && (
                          <button 
                            onClick={() => {
                              setCurrentCertificateIndex(0); // Show newest
                              setIsCertificateModalOpen(true);
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-all border-b border-stone-50"
                          >
                            <Award size={14} />
                            我的证书 ({allCertificates.length})
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            handleLogout();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-all"
                        >
                          <LogOut size={14} />
                          退出登录
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => {
                    console.log('Opening login modal...');
                    setIsLoginModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 h-[38px] bg-[#2D2A26] text-white rounded-2xl hover:bg-[#45403B] transition-all shadow-md active:scale-95 text-xs font-bold"
                >
                  <LogIn size={14} />
                  登录
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8 flex flex-col max-w-7xl mx-auto w-full">
        {!birthDate ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="max-w-lg"
            >
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-[#F59E0B]/10 blur-3xl rounded-full"></div>
                <Hourglass size={64} className="relative text-[#D97706] mx-auto opacity-80" />
              </div>
              <h2 className="text-5xl font-serif font-light text-[#2D2A26] mb-6">
                每一个瞬间都是礼物
              </h2>
              <p className="text-lg text-[#78716C] font-light leading-relaxed mb-8">
                你的生命是由月份书写的独特故事。<br/>
                输入你的出生日期，查看你已填满的画布，以及等待你创造的未来空间。
              </p>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#A8A29E] border-t border-[#E7E5E4] pt-6">
                <span>请在上方选择你的起点</span>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col gap-8 h-full">
            {/* Stats Dashboard - Elegant Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
              <MiniStatCard 
                title="已度过天数" 
                value={stats?.daysLived.toLocaleString()} 
                icon={<Sun size={14} />}
                color="text-[#57534E]" 
              />
              <MiniStatCard 
                title="已度过岁数" 
                value={stats?.yearsLived} 
                icon={<Compass size={14} />}
                color="text-[#57534E]" 
              />
              <MiniStatCard 
                title="生命进度" 
                value={`${stats?.percentLived.toFixed(1)}%`} 
                icon={<Sparkles size={14} />}
                color="text-[#57534E]" 
              />
              <MiniStatCard 
                title="未来季节" 
                value={(TOTAL_MONTHS - (stats?.monthsLived || 0)).toLocaleString()} 
                icon={<Moon size={14} />}
                color="text-[#57534E]" 
              />
            </div>

            {/* The Grid Card - Organic & Soft */}
            <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#F5F5F4] flex-[3] flex flex-col min-h-0 relative overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#F59E0B]/5 rounded-full blur-3xl"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 shrink-0 gap-4">
                  <div>
                    <h3 className="text-2xl font-serif font-semibold text-[#2D2A26]">生命画布</h3>
                    <p className="text-xs text-[#A8A29E] uppercase tracking-widest mt-1 font-bold">百岁人生 (1,200 个月)</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-wider">
                    <LegendItem color="bg-[#57534E]" label="过去" />
                    <LegendItem color="bg-[#F43F5E]" label="目标" />
                    <LegendItem color="bg-[#10B981]" label="已实现" />
                    <LegendItem color="bg-[#F5F5F4] border border-[#E7E5E4]" label="未来" />
                  </div>
                </div>

                {/* Grid Container - Flex-Grow to fill space */}
                <div className="flex-1 flex items-center justify-center py-0.5 md:py-6 px-0.5 md:px-4">
                  <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] sm:grid-cols-[repeat(30,minmax(0,1fr))] md:grid-cols-[repeat(40,minmax(0,1fr))] gap-[3px] sm:gap-[5px] w-full max-w-4xl mx-auto content-center p-0.5 md:p-4">
                    {gridItems.map((lived, idx) => {
                      const monthGoals = goalMap.get(idx);
                      const isGoal = monthGoals && monthGoals.length > 0;
                      const isCompleted = isGoal && monthGoals.some(g => g.completed);
                      
                      return (
                        <motion.div 
                          key={idx}
                          initial={false}
                          animate={{
                            scale: isGoal ? 1.4 : 1,
                            backgroundColor: isGoal 
                              ? isCompleted ? '#10B981' : '#F43F5E'
                              : lived ? '#57534E' : '#F5F5F4'
                          }}
                          className={`
                            aspect-square rounded-full transition-all duration-700
                            ${isGoal 
                              ? 'z-10 shadow-[0_0_10px_rgba(0,0,0,0.1)]' 
                              : lived 
                                ? 'opacity-90' 
                                : 'border-[0.5px] border-[#E7E5E4]'
                            }
                          `}
                          title={isGoal 
                            ? `目标: ${monthGoals.map(g => g.title).join(', ')} (${Math.floor(idx/12)} 岁)${isCompleted ? ' - 已实现' : ''}`
                            : `第 ${idx + 1} 个月 (${Math.floor(idx/12)} 岁)`
                          }
                        />
                      );
                    })}
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-[#F5F5F4] flex justify-between text-[11px] uppercase tracking-[0.2em] font-bold text-[#A8A29E] shrink-0">
                  <span>黎明: {format(new Date(birthDate), 'yyyy年MM月')}</span>
                  <span>落日: {format(addYears(new Date(birthDate), 100), 'yyyy年')}</span>
                </div>
              </motion.div>

              {/* Goals Management Sidebar - Soft & Inviting */}
              <div className="flex-[1.5] flex flex-col gap-8 min-h-0 w-full lg:min-w-[400px]">
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#F5F5F4] flex flex-col min-h-[420px] w-full"
                >
                  <div className="flex items-center gap-3 mb-8 shrink-0">
                    <div className="p-2 bg-[#FEF2F2] rounded-xl text-[#F43F5E]">
                      <Target size={20} />
                    </div>
                    <h3 className="text-xl font-serif font-bold text-[#2D2A26]">人生心愿单</h3>
                  </div>

                  <div className="flex flex-col gap-4 mb-8 shrink-0">
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        placeholder="你的下一个梦想是什么？"
                        className="w-full px-4 py-3 bg-[#FAFAF9] border border-[#E7E5E4] rounded-2xl text-sm focus:ring-2 focus:ring-[#F43F5E]/20 focus:border-[#F43F5E] outline-none transition-all placeholder-[#A8A29E] font-medium"
                        value={newGoalTitle}
                        onChange={(e) => {
                          setNewGoalTitle(e.target.value);
                          if (goalError) setGoalError('');
                        }}
                      />
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="number" 
                          placeholder="目标年龄"
                          className="w-full sm:flex-1 px-4 py-3 bg-[#FAFAF9] border border-[#E7E5E4] rounded-2xl text-sm focus:ring-2 focus:ring-[#F43F5E]/20 focus:border-[#F43F5E] outline-none transition-all placeholder-[#A8A29E] font-medium"
                          value={newGoalAge}
                          onChange={(e) => {
                            setNewGoalAge(e.target.value === '' ? '' : parseInt(e.target.value));
                            if (goalError) setGoalError('');
                          }}
                        />
                        <button 
                          onClick={addGoal}
                          className="w-full sm:w-auto px-6 py-3 bg-[#2D2A26] text-white rounded-2xl hover:bg-[#45403B] transition-all shadow-md active:scale-95 flex items-center justify-center"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      {goalError && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[#F43F5E] text-[10px] font-bold mt-1 ml-1"
                        >
                          {goalError}
                        </motion.p>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                    <AnimatePresence initial={false}>
                      <div className="flex flex-col gap-4">
                        {[...goals].sort((a, b) => a.age - b.age).map(goal => (
                          <motion.div 
                            key={goal.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center justify-between p-4 bg-[#FAFAF9] rounded-[1.5rem] border border-[#F5F5F4] group hover:border-[#E7E5E4] transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => toggleGoalCompletion(goal.id)}
                                className={`
                                  w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                                  ${goal.completed 
                                    ? 'bg-[#10B981] border-[#10B981] text-white' 
                                    : 'bg-white border-[#E7E5E4] text-transparent hover:border-[#10B981]'
                                  }
                                `}
                              >
                                <Check size={14} strokeWidth={3} />
                              </button>
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold transition-all ${goal.completed ? 'text-[#A8A29E] line-through' : 'text-[#44403C]'}`}>
                                  {goal.title}
                                </span>
                                <span className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mt-0.5">{goal.age} 岁</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => removeGoal(goal.id)}
                              className="p-2 text-[#D6D3D1] hover:text-[#F43F5E] transition-colors opacity-40 md:opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </motion.div>
                        ))}
                        {goals.length === 0 && (
                          <div className="text-center py-12">
                            <p className="text-[#A8A29E] text-sm font-serif italic">未来是一张白纸...</p>
                          </div>
                        )}
                      </div>
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Future Letter Section */}
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#F5F5F4] flex flex-col min-h-[380px] w-full"
                >
                  <div className="flex items-center justify-between mb-8 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                        <Mail size={20} />
                      </div>
                      <h3 className="text-xl font-serif font-bold text-[#2D2A26]">时光胶囊</h3>
                    </div>
                    <button 
                      onClick={() => {
                        if (!isWritingLetter) {
                          setWritingLetterType('general');
                          setCurrentInspiration(null);
                        }
                        setIsWritingLetter(!isWritingLetter);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-widest hover:text-amber-700 transition-colors"
                    >
                      {!isWritingLetter && <Feather size={12} />}
                      {isWritingLetter ? '取消' : '写一封信'}
                    </button>
                  </div>

                  <div className="min-h-[220px] flex flex-col">
                    <AnimatePresence mode="wait">
                    {isWritingLetter ? (
                      <motion.div 
                        key="writing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4 w-full"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">
                            {writingLetterType === 'general' ? '写给未来的信' : '世纪胶囊'}
                          </p>
                          <button 
                            onClick={() => {
                              const prompts = writingLetterType === 'general' ? WRITING_PROMPTS.general : WRITING_PROMPTS.century;
                              let randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
                              // Ensure we get a different one if possible
                              if (randomPrompt === currentInspiration && prompts.length > 1) {
                                randomPrompt = prompts.find(p => p !== currentInspiration) || randomPrompt;
                              }
                              setCurrentInspiration(randomPrompt);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-stone-400 hover:text-amber-600 transition-colors uppercase tracking-widest"
                          >
                            <Sparkles size={10} />
                            {currentInspiration ? '换一个' : '获取灵感'}
                          </button>
                        </div>
                        <textarea 
                          placeholder={currentInspiration || (writingLetterType === 'general' ? "写给未来的自己..." : "写给新世纪的自己...")}
                          className="w-full h-32 px-4 py-3 bg-[#FAFAF9] border border-[#E7E5E4] rounded-2xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder-[#A8A29E] font-medium resize-none"
                          value={writingLetterType === 'general' ? newLetterContent : newCenturyLetterContent}
                          onChange={(e) => {
                            if (writingLetterType === 'general') {
                              setNewLetterContent(e.target.value);
                            } else {
                              setNewCenturyLetterContent(e.target.value);
                            }
                            if (letterError) setLetterError('');
                          }}
                        />
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input 
                            type="number" 
                            placeholder="开启年龄 (如: 40)"
                            className={`w-full sm:flex-1 px-4 py-3 bg-[#FAFAF9] border border-[#E7E5E4] rounded-2xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder-[#A8A29E] font-medium ${writingLetterType === 'century' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={writingLetterType === 'general' ? newLetterAge : ageIn2100}
                            disabled={writingLetterType === 'century'}
                            onChange={(e) => {
                              if (writingLetterType === 'general') {
                                setNewLetterAge(e.target.value === '' ? '' : parseInt(e.target.value));
                                if (letterError) setLetterError('');
                              }
                            }}
                          />
                          <button 
                            onClick={addLetter}
                            className="w-full sm:w-auto px-6 py-3 bg-amber-600 text-white rounded-2xl hover:bg-amber-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Send size={18} />
                            <span className="text-sm font-bold">封存胶囊</span>
                          </button>
                        </div>
                        {letterError && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-rose-500 text-[10px] font-bold mt-1 ml-1"
                          >
                            {letterError}
                          </motion.p>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[300px] w-full"
                      >
                        <div className="flex flex-col gap-4">
                          {letters.length === 0 ? (
                            <div className="text-center py-10 px-1">
                              {canReachNextCentury ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={handleQuickLetterTo2100}
                                  className="space-y-3 cursor-pointer p-6 rounded-[2rem] bg-amber-50/40 border border-amber-100/50 hover:bg-amber-50/60 transition-all group shadow-sm"
                                >
                                  <div className="flex justify-center text-amber-500 mb-1 group-hover:scale-110 transition-transform">
                                    <Sparkles size={24} />
                                  </div>
                                  <p className="text-amber-800/90 text-[13px] font-medium italic leading-relaxed tracking-wide">
                                    你可能会见证 22 世纪的曙光。给 2100 年的自己写封信吧。
                                  </p>
                                </motion.div>
                              ) : (
                                <p className="text-[#A8A29E] text-sm font-serif italic">还没有写给未来的信...</p>
                              )}
                            </div>
                          ) : (
                            [...letters].sort((a, b) => a.unlockAge - b.unlockAge).map(letter => {
                              const isUnlocked = (stats?.yearsLived || 0) >= letter.unlockAge;
                              return (
                                <div key={letter.id} className="p-4 bg-[#FAFAF9] rounded-[1.5rem] border border-[#F5F5F4] group hover:border-[#E7E5E4] transition-all">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      {isUnlocked ? <Unlock size={14} className="text-emerald-500" /> : <Lock size={14} className="text-amber-500" />}
                                      <span className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">
                                        {letter.unlockAge} 岁开启
                                      </span>
                                    </div>
                                    <button 
                                      onClick={() => removeLetter(letter.id)}
                                      className="p-1 text-[#D6D3D1] hover:text-[#F43F5E] transition-colors opacity-40 md:opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  {isUnlocked ? (
                                    <p className="text-sm text-[#44403C] leading-relaxed italic">"{letter.content}"</p>
                                  ) : (
                                    <div className="h-12 flex items-center justify-center bg-stone-100/50 rounded-xl border border-dashed border-stone-200">
                                      <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">内容已封存</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </main>
      
      {/* Simple Footer - Poetic */}
      <footer className="py-6 text-center bg-transparent shrink-0">
        <p className="text-[13px] font-serif italic text-[#A8A29E] tracking-wide">
          "你的生命是唯一值得书写的故事。请用心书写。"
        </p>
      </footer>

      {/* Reminder Confirmation Modal */}
      <AnimatePresence>
        {isReminderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmittingReminder && setIsReminderModalOpen(false)}
              className={`absolute inset-0 bg-stone-900/${isMobile ? '80' : '60'} ${isMobile ? '' : 'backdrop-blur-md'}`}
            />

            {isSubmittingReminder && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-0"
              >
                <TimeTunnel isFrozen={isSubmittingReminder} />
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={isSubmittingReminder ? { 
                opacity: [1, 1, 0], 
                scale: [1, 0.1, 0],
                rotateZ: [0, 5, 15],
                filter: isMobile ? ["none", "none", "none"] : ["blur(0px)", "blur(2px)", "blur(10px)"]
              } : { opacity: 1, scale: 1, y: 0 }}
              transition={isSubmittingReminder ? { duration: 1.3, ease: "easeIn" } : {}}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative z-10 bg-white w-full max-w-[85%] sm:max-w-md max-h-[80vh] flex flex-col rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden"
            >
              {/* Close Button */}
              {!isSubmittingReminder && (
                <button 
                  onClick={() => setIsReminderModalOpen(false)}
                  className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 transition-colors z-30 bg-white/60 backdrop-blur-sm rounded-full"
                >
                  <X size={20} />
                </button>
              )}

              <div className={`flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col items-center text-center transition-all duration-700 ${isSubmittingReminder ? `opacity-0 scale-75 ${isMobile ? '' : 'blur-sm'}` : 'opacity-100'}`}>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-800 mb-2 sm:mb-3">开启未来提醒</h3>
                <p className="text-stone-500 text-[11px] sm:text-sm leading-relaxed mb-4 sm:mb-6">
                  时光荏苒，我们担心您会忘记这封信。请您手动将提醒添加到您的日历中。
                </p>

                {/* Calendar Reminder Section - Redesigned */}
                <div className="w-full mb-4 p-4 bg-stone-50 rounded-3xl border border-stone-100 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">日历提醒文案</span>
                    <button 
                      onClick={() => {
                        const unlockDate = pendingLetter && birthDate ? addYears(new Date(birthDate), pendingLetter.age) : null;
                        const unlockDateStr = unlockDate ? format(unlockDate, 'yyyy年MM月dd日') : '';
                        const copyContent = `【时光织锦】我的未来信件已解锁！\n提醒时间：${unlockDateStr}\n查看链接：${APP_URL}`;
                        navigator.clipboard.writeText(copyContent);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      <Copy size={14} />
                      <span className="text-xs font-bold">{isCopied ? '已复制' : '复制文案'}</span>
                    </button>
                  </div>
                  <div className="space-y-2 text-sm text-stone-700 font-medium">
                    <p>【时光织锦】我的未来信件已解锁！</p>
                    <p>提醒时间：<span className="font-bold">{pendingLetter && birthDate ? format(addYears(new Date(birthDate), pendingLetter.age), 'yyyy年MM月dd日') : ''}</span></p>
                    <p className="flex items-start gap-1">
                      <span>查看链接：</span>
                      <span className="text-emerald-600 break-all underline underline-offset-4 decoration-emerald-200">{APP_URL}</span>
                    </p>
                  </div>
                </div>

                {/* Name Editing Section */}
                <div className="w-full mb-3 py-2 px-3 bg-stone-50 rounded-2xl border border-stone-100">
                  <label className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-0.5 text-left">
                    寄信人姓名
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={onboardingName}
                      onChange={(e) => setOnboardingName(e.target.value)}
                      placeholder="你的名字..."
                      className="w-full bg-white border-2 border-transparent focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-xl px-4 py-1.5 text-stone-700 font-bold text-lg transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300">
                      <Feather size={16} />
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-stone-400 text-left">
                    这个名字将永久刻在你的时光证书上。
                  </p>
                </div>

                <div className="w-full space-y-3 sm:space-y-4">
                  <div className="flex flex-col gap-2 sm:gap-3 pt-1 sm:pt-2">
                    <button 
                      disabled={isSubmittingReminder}
                      onClick={confirmLetter}
                      className="w-full py-3 sm:py-4 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {isSubmittingReminder ? '正在寄出...' : '确认寄出'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Time Guardian Certificate Modal */}
      <AnimatePresence mode="wait">
        {isCertificateModalOpen && allCertificates.length > 0 && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCertificateModalOpen(false)}
              className={`absolute inset-0 bg-white/${isMobile ? '80' : '40'} ${isMobile ? '' : 'backdrop-blur-xl'}`}
            />

            <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
              {allCertificates[currentCertificateIndex] && (
                <>
                  {/* Navigation Arrows (Desktop) */}
              {!isMobile && allCertificates.length > 1 && (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentCertificateIndex(prev => (prev > 0 ? prev - 1 : allCertificates.length - 1));
                    }}
                    className="absolute -left-16 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-white transition-all shadow-lg z-20"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentCertificateIndex(prev => (prev < allCertificates.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute -right-16 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md border border-stone-200 flex items-center justify-center text-stone-600 hover:bg-white transition-all shadow-lg z-20"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              <AnimatePresence mode="wait">
                <motion.div 
                  key={allCertificates[currentCertificateIndex].id}
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 100) {
                      setCurrentCertificateIndex(prev => (prev > 0 ? prev - 1 : allCertificates.length - 1));
                    } else if (info.offset.x < -100) {
                      setCurrentCertificateIndex(prev => (prev < allCertificates.length - 1 ? prev + 1 : 0));
                    }
                  }}
                  className="w-full flex justify-center"
                >
                  <div className="w-full flex justify-center relative pt-2 pb-2">
                    {/* The Certificate Card (HTML version, hidden once image is ready) */}
                    <div 
                      className={`w-full flex justify-center ${autoGeneratedCertImage ? 'hidden' : 'block'}`}
                      style={{ 
                        transform: isMobile ? `scale(${Math.min(0.9, (window.innerWidth - 40) / 800)})` : 'scale(0.64)',
                        transformOrigin: 'top center',
                        marginBottom: isMobile ? `-${1150 * (1 - Math.min(0.9, (window.innerWidth - 40) / 800))}px` : '-414px'
                      }}
                    >
                      <div 
                        ref={certificateRef}
                        style={{ 
                          width: '800px',
                          transform: 'none',
                        }}
                        className={`
                        p-5 rounded-sm shadow-xl border-[20px] relative overflow-hidden transition-all duration-1000
                        mx-auto box-border shrink-0
                        ${allCertificates[currentCertificateIndex].isCenturyTraveler 
                          ? 'bg-[#020617] border-[#1e293b]' 
                          : 'bg-[#F5F2ED] border-white'
                        }
                      `}>
                      {/* Inner Border/Glow for Century Traveler - Using a div instead of ring for more consistent capture */}
                      {allCertificates[currentCertificateIndex].isCenturyTraveler && (
                        <div className="absolute inset-[12px] border border-[rgba(96,165,250,0.2)] pointer-events-none z-10" />
                      )}
                      {/* Decorative Inner Border */}
                      <div className={`
                        border pt-[140px] pb-[110px] px-10 flex flex-col items-center text-center relative transition-colors duration-1000 w-full h-full box-border
                        ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'border-[rgba(59,130,246,0.2)]' : 'border-stone-300'}
                      `}>
                          
                          {/* Background Watermark */}
                          <div className={`
                            absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-1000
                            ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'opacity-[0.07] text-[#93c5fd]' : 'opacity-[0.03] text-[#292524]'}
                          `}>
                            <Hourglass size={560} />
                          </div>

                          {/* Century Traveler Special Effects */}
                          {allCertificates[currentCertificateIndex].isCenturyTraveler && (
                            <>
                              {/* Refined Top Glow - Simplified for better capture */}
                              <div 
                                className="absolute top-0 left-0 w-full h-full pointer-events-none" 
                                style={{
                                  background: 'radial-gradient(circle at 50% 0%, rgba(30, 64, 175, 0.3) 0%, transparent 70%)'
                                }}
                              />
                              
                              {/* Corner Decorative Elements - Using fixed pixel offsets for absolute stability */}
                              <div className="absolute top-[10px] left-[10px] w-12 h-12 border-t border-l border-blue-400/30 rounded-tl-sm pointer-events-none z-30" />
                              <div className="absolute top-[10px] right-[10px] w-12 h-12 border-t border-r border-blue-400/30 rounded-tr-sm pointer-events-none z-30" />
                              <div className="absolute bottom-[10px] left-[10px] w-12 h-12 border-b border-l border-blue-400/30 rounded-bl-sm pointer-events-none z-30" />
                              <div className="absolute bottom-[10px] right-[10px] w-12 h-12 border-b border-r border-blue-400/30 rounded-br-sm pointer-events-none z-30" />

                              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full flex justify-center">
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="bg-gradient-to-r from-[rgba(37,99,235,0.2)] to-[rgba(79,70,229,0.2)] border border-[rgba(96,165,250,0.4)] px-5 py-2 rounded-full flex items-center gap-3 whitespace-nowrap"
                                >
                                  <Sparkles size={20} className="text-[#93c5fd] shrink-0" />
                                  <span className="text-[16px] font-bold text-[#bfdbfe] uppercase tracking-[0.2em] whitespace-nowrap">22 世纪见证者</span>
                                </motion.div>
                              </div>
                            </>
                          )}

                          {/* Header */}
                          <div className="mb-12 w-full overflow-hidden">
                            <div className={`flex justify-center mb-6 transition-colors duration-1000 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#60a5fa]' : 'text-[#292524]'}`}>
                              <Award size={72} strokeWidth={1} />
                            </div>
                            <h2 className={`
                              text-[32px] font-serif font-light tracking-[0.2em] uppercase mb-4 transition-colors duration-1000 w-full mx-auto leading-tight max-w-none
                              ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#eff6ff]' : 'text-[#292524]'}
                            `}>
                              {allCertificates[currentCertificateIndex].isCenturyTraveler ? '世纪旅者 · 时光守护者证书' : '时光守护者证书'}
                            </h2>
                            <div className={`h-[1px] w-40 mx-auto mb-2 transition-colors duration-1000 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'bg-[rgba(59,130,246,0.5)]' : 'bg-[#a8a29e]'}`}></div>
                            <p className={`
                              text-[16px] tracking-[0.3em] uppercase font-bold transition-colors duration-1000
                              ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(96,165,250,0.7)]' : 'text-[#78716c]'}
                            `}>
                              {allCertificates[currentCertificateIndex].isCenturyTraveler ? 'Century Traveler Certificate' : 'Time Guardian Certificate'}
                            </p>
                          </div>

                          {/* Content */}
                          <div className="space-y-6 mb-12 relative z-10">
                            <div>
                              {isEditingCertificateName ? (
                                <div className="flex flex-col items-center gap-3">
                                  <input 
                                    autoFocus
                                    type="text"
                                    className={`
                                      text-[40px] font-bold border-b outline-none text-center px-4 py-2 w-80 transition-all
                                      ${allCertificates[currentCertificateIndex].isCenturyTraveler 
                                        ? 'text-white bg-[rgba(30,58,138,0.2)] border-[rgba(59,130,246,0.5)]' 
                                        : 'text-stone-800 bg-white/50 border-stone-400'
                                      }
                                    `}
                                    value={onboardingName}
                                    onChange={(e) => setOnboardingName(e.target.value)}
                                    onBlur={() => {
                                      if (onboardingName.trim() && onboardingName !== allCertificates[currentCertificateIndex].sender) {
                                        updateUserName(onboardingName);
                                      } else {
                                        setIsEditingCertificateName(false);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateUserName(onboardingName);
                                      }
                                    }}
                                  />
                                  <p className="text-[14px] text-stone-400 uppercase tracking-widest font-bold">按回车键确认</p>
                                </div>
                              ) : (
                                <div 
                                  className="relative inline-block"
                                >
                                  <h3 className={`
                                    text-[40px] font-bold mb-2 transition-colors duration-1000 whitespace-nowrap tracking-normal
                                    ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#dbeafe]' : 'text-[#292524]'}
                                  `}>
                                    {allCertificates[currentCertificateIndex].sender}
                                  </h3>
                                  <div className={`h-[1px] w-48 mx-auto transition-colors duration-1000 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'bg-[rgba(59,130,246,0.3)]' : 'bg-[#d6d3d1]'}`}></div>
                                </div>
                              )}
                            </div>

                            <p className={`leading-relaxed max-w-none mx-auto text-[22px] transition-colors duration-1000 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(219,234,254,0.8)]' : 'text-[#57534e]'}`}>
                              在 <span className={`font-bold ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#60a5fa]' : 'text-[#1c1917]'}`}>{allCertificates[currentCertificateIndex].departureYear}</span> 寄出了一份跨越时空的承诺。
                              {allCertificates[currentCertificateIndex].isCenturyTraveler ? (
                                <>此胶囊已进入 <span className="text-[#60a5fa] font-bold">世纪航线</span>，将于 <span className="text-[#60a5fa] font-bold">{allCertificates[currentCertificateIndex].arrivalYear}</span> 年准时开启。</>
                              ) : (
                                <>此胶囊已进入永恒轨道，将于 <span className="text-[#1c1917] font-bold">{allCertificates[currentCertificateIndex].arrivalYear}</span> 年准时开启。</>
                              )}
                            </p>

                            <p className={`italic text-[18px] transition-colors duration-1000 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(96,165,250,0.6)]' : 'text-[#78716c]'}`}>
                              {allCertificates[currentCertificateIndex].isCenturyTraveler ? '“跨越世纪的曙光，只为遇见未来的你。”' : '“时光流转，唯有承诺的温度永恒。”'}
                            </p>
                          </div>

                          {/* Footer / Seal & QR Code */}
                          <div className="w-full relative flex justify-between items-center mt-4 min-h-[120px]">
                            <div className="text-left relative flex items-center">
                              {/* QR Code for sharing */}
                              <div className={`
                                p-2 rounded-lg bg-white transition-all duration-1000
                              `}>
                                <QRCodeSVG 
                                  value={window.location.href} 
                                  size={100}
                                  level="M"
                                  includeMargin={true}
                                  marginSize={1}
                                  fgColor={allCertificates[currentCertificateIndex].isCenturyTraveler ? "#0F172A" : "#2D2A26"}
                                />
                              </div>
                            </div>

                            {/* Absolutely Centered Wax Seal */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group/seal">
                              {/* Realistic Wax Seal */}
                              <div className="w-32 h-32 relative">
                                {/* The outer irregular wax pool - organic shape */}
                                <div className={`
                                  absolute inset-0 rounded-[45%_55%_50%_50%/50%_45%_55%_50%] transition-colors duration-1000
                                  ${allCertificates[currentCertificateIndex].isCenturyTraveler 
                                    ? 'bg-[#2E1065]' 
                                    : 'bg-[#8B1A1A]'
                                  }
                                `}></div>
                                
                                {/* The inner stamped area - depressed into the wax */}
                                <div className={`
                                  absolute inset-[10%] rounded-full flex items-center justify-center overflow-hidden border transition-colors duration-1000
                                  ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'bg-[#4C1D95] border-violet-400/30' : 'bg-[#991B1B] border-red-900/30'}
                                `}>
                                  
                                  {/* Exquisite Pattern SVG with Gold Foil Effect - Scheme C: Tree of Rings */}
                                  <svg viewBox="0 0 100 100" className="w-[85%] h-[85%]">
                                    <defs>
                                      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#D4AF37" />
                                        <stop offset="50%" stopColor="#FFD700" />
                                        <stop offset="100%" stopColor="#AA8A2E" />
                                      </linearGradient>
                                    </defs>
                                    <g fill="none" stroke="url(#goldGradient)">
                                      {/* Scheme C: Tree Rings (Concentric, slightly irregular) */}
                                      <circle cx="50" cy="50" r="42" strokeWidth="0.5" opacity="0.6" />
                                      <path d="M50 8 A42 42 0 0 1 92 50" strokeWidth="1.2" strokeLinecap="round" />
                                      <circle cx="50" cy="50" r="34" strokeWidth="0.8" />
                                      <circle cx="50" cy="50" r="26" strokeWidth="1" />
                                      <circle cx="50" cy="50" r="18" strokeWidth="1.2" />
                                      
                                      {/* Clock Hands at the center of the rings */}
                                      <path d="M50 50 L50 25" strokeWidth="2.5" strokeLinecap="round" />
                                      <path d="M50 50 L70 50" strokeWidth="2" strokeLinecap="round" />
                                      <circle cx="50" cy="50" r="3" fill="url(#goldGradient)" stroke="none" />
                                      
                                      {/* Falling Leaves details */}
                                      <path d="M75 25 Q80 20 85 25 T75 35 Z" fill="url(#goldGradient)" stroke="none" transform="rotate(15 75 25)" />
                                      <path d="M25 70 Q20 75 25 80 T35 70 Z" fill="url(#goldGradient)" stroke="none" transform="rotate(-20 25 70)" />
                                      
                                      {/* Fine wood grain texture lines */}
                                      <path d="M40 15 Q45 12 50 15" strokeWidth="0.3" opacity="0.5" />
                                      <path d="M60 85 Q55 88 50 85" strokeWidth="0.3" opacity="0.5" />
                                    </g>
                                  </svg>
                                  
                                  {/* Wax texture overlay */}
                                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                                </div>
                                
                                {/* Realistic Surface Highlight */}
                                <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-gradient-to-br from-[rgba(255,255,255,0.2)] to-transparent rounded-full pointer-events-none"></div>
                              </div>
                              <p className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[16px] font-bold tracking-[0.2em] uppercase transition-colors duration-1000 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(96,165,250,0.7)]' : 'text-[#a8a29e]'}`}>
                                时光邮局 · 岁轮
                              </p>
                            </div>

                            <div className="text-right flex flex-col gap-4 min-w-[120px]">
                              <div>
                                <p className="text-[14px] text-[#a8a29e] uppercase tracking-widest font-bold mb-1 whitespace-nowrap">证书编号</p>
                                <p className={`text-[18px] font-mono transition-colors duration-1000 whitespace-nowrap ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(147,197,253,0.7)]' : 'text-[#57534e]'}`}>{allCertificates[currentCertificateIndex].id}</p>
                              </div>
                              <div>
                                <p className="text-[14px] text-[#a8a29e] uppercase tracking-widest font-bold mb-1 whitespace-nowrap">签发日期</p>
                                <p className={`text-[18px] font-medium italic transition-colors duration-1000 whitespace-nowrap ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(147,197,253,0.7)]' : 'text-[#57534e]'}`}>{format(allCertificates[currentCertificateIndex].date, 'yyyy.MM.dd')}</p>
                              </div>
                            </div>
                          </div>
                      </div>
                    </div>
                  </div>

                    {/* Static Image Version (Visible once ready, allows direct long-press) */}
                    {autoGeneratedCertImage && (
                      <div className="w-full flex justify-center pt-2 pb-2">
                        <img 
                          src={autoGeneratedCertImage} 
                          alt="证书" 
                          className="w-full shadow-xl rounded-sm mx-auto"
                          style={{ 
                            pointerEvents: 'auto',
                            display: 'block',
                            maxWidth: isMobile ? `${window.innerWidth - 40}px` : '512px'
                          }}
                        />
                      </div>
                    )}

                    {/* Hidden Capture Mirror - Fixed 800px, no transforms, off-screen */}
                    <div className="fixed left-[-9999px] top-0 pointer-events-none">
                      <div 
                        ref={captureRef}
                        style={{ width: '800px' }}
                        className={`
                          p-5 rounded-sm border-[20px] relative overflow-hidden
                          ${allCertificates[currentCertificateIndex].isCenturyTraveler 
                            ? 'bg-[#020617] border-[#1e293b]' 
                            : 'bg-[#F5F2ED] border-white'
                          }
                        `}
                      >
                        {/* Inner Border/Glow for Century Traveler */}
                        {allCertificates[currentCertificateIndex].isCenturyTraveler && (
                          <div className="absolute inset-[12px] border border-[rgba(96,165,250,0.2)] pointer-events-none z-10" />
                        )}
                        {/* Decorative Inner Border */}
                        <div className={`
                          border pt-[140px] pb-[110px] px-10 flex flex-col items-center text-center relative w-full h-full box-border
                          ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'border-[rgba(59,130,246,0.2)]' : 'border-stone-300'}
                        `}>
                            {/* Background Watermark */}
                            <div className={`
                              absolute inset-0 flex items-center justify-center pointer-events-none
                              ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'opacity-[0.07] text-[#93c5fd]' : 'opacity-[0.03] text-[#292524]'}
                            `}>
                              <Hourglass size={560} />
                            </div>

                            {/* Century Traveler Special Effects */}
                            {allCertificates[currentCertificateIndex].isCenturyTraveler && (
                              <>
                                <div 
                                  className="absolute top-0 left-0 w-full h-full pointer-events-none" 
                                  style={{
                                    background: 'radial-gradient(circle at 50% 0%, rgba(30, 64, 175, 0.3) 0%, transparent 70%)'
                                  }}
                                />
                                <div className="absolute top-[10px] left-[10px] w-12 h-12 border-t border-l border-blue-400/30 rounded-tl-sm pointer-events-none z-30" />
                                <div className="absolute top-[10px] right-[10px] w-12 h-12 border-t border-r border-blue-400/30 rounded-tr-sm pointer-events-none z-30" />
                                <div className="absolute bottom-[10px] left-[10px] w-12 h-12 border-b border-l border-blue-400/30 rounded-bl-sm pointer-events-none z-30" />
                                <div className="absolute bottom-[10px] right-[10px] w-12 h-12 border-b border-r border-blue-400/30 rounded-br-sm pointer-events-none z-30" />
                                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full flex justify-center">
                                  <div className="bg-gradient-to-r from-[rgba(37,99,235,0.2)] to-[rgba(79,70,229,0.2)] border border-[rgba(96,165,250,0.4)] px-5 py-2 rounded-full flex items-center gap-3 whitespace-nowrap">
                                    <Sparkles size={20} className="text-[#93c5fd] shrink-0" />
                                    <span className="text-[16px] font-bold text-[#bfdbfe] uppercase tracking-[0.2em] whitespace-nowrap">22 世纪见证者</span>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Header */}
                            <div className="mb-12 w-full overflow-hidden">
                              <div className={`flex justify-center mb-6 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#60a5fa]' : 'text-[#292524]'}`}>
                                <Award size={72} strokeWidth={1} />
                              </div>
                              <h2 className={`
                                text-[32px] font-serif font-light tracking-[0.2em] uppercase mb-4 w-full mx-auto leading-tight max-w-none
                                ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#eff6ff]' : 'text-[#292524]'}
                              `}>
                                {allCertificates[currentCertificateIndex].isCenturyTraveler ? '世纪旅者 · 时光守护者证书' : '时光守护者证书'}
                              </h2>
                              <div className={`h-[1px] w-40 mx-auto mb-2 ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'bg-[rgba(59,130,246,0.5)]' : 'bg-[#a8a29e]'}`}></div>
                              <p className={`
                                text-[16px] tracking-[0.3em] uppercase font-bold
                                ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(96,165,250,0.7)]' : 'text-[#78716c]'}
                              `}>
                                {allCertificates[currentCertificateIndex].isCenturyTraveler ? 'Century Traveler Certificate' : 'Time Guardian Certificate'}
                              </p>
                            </div>

                            {/* Content */}
                            <div className="space-y-6 mb-12 relative z-10">
                              <div>
                                <h3 className={`
                                  text-[40px] font-bold mb-2 whitespace-nowrap tracking-normal
                                  ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#dbeafe]' : 'text-[#292524]'}
                                `}>
                                  {allCertificates[currentCertificateIndex].sender}
                                </h3>
                                <div className={`h-[1px] w-48 mx-auto ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'bg-[rgba(59,130,246,0.3)]' : 'bg-[#d6d3d1]'}`}></div>
                              </div>

                              <p className={`leading-relaxed max-w-none mx-auto text-[22px] ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(219,234,254,0.8)]' : 'text-[#57534e]'}`}>
                                在 <span className={`font-bold ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[#60a5fa]' : 'text-[#1c1917]'}`}>{allCertificates[currentCertificateIndex].departureYear}</span> 寄出了一份跨越时空的承诺。
                                {allCertificates[currentCertificateIndex].isCenturyTraveler ? (
                                  <>此胶囊已进入 <span className="text-[#60a5fa] font-bold">世纪航线</span>，将于 <span className="text-[#60a5fa] font-bold">{allCertificates[currentCertificateIndex].arrivalYear}</span> 年准时开启。</>
                                ) : (
                                  <>此胶囊已进入永恒轨道，将于 <span className="text-[#1c1917] font-bold">{allCertificates[currentCertificateIndex].arrivalYear}</span> 年准时开启。</>
                                )}
                              </p>

                              <p className={`italic text-[18px] ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(96,165,250,0.6)]' : 'text-[#78716c]'}`}>
                                {allCertificates[currentCertificateIndex].isCenturyTraveler ? '“跨越世纪的曙光，只为遇见未来的你。”' : '“时光流转，唯有承诺的温度永恒。”'}
                              </p>
                            </div>

                            {/* Footer / Seal & QR Code */}
                            <div className="w-full relative flex justify-between items-center mt-4 min-h-[120px]">
                              <div className="text-left relative flex items-center">
                              <div className={`
                                p-2 rounded-lg bg-white transition-all duration-1000
                              `}>
                                  <QRCodeSVG 
                                    value={window.location.href} 
                                    size={100}
                                    level="M"
                                    includeMargin={true}
                                    marginSize={1}
                                    fgColor={allCertificates[currentCertificateIndex].isCenturyTraveler ? "#0F172A" : "#2D2A26"}
                                  />
                                </div>
                              </div>

                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                <div className="w-32 h-32 relative">
                                  <div className={`
                                    absolute inset-0 rounded-[45%_55%_50%_50%/50%_45%_55%_50%]
                                    ${allCertificates[currentCertificateIndex].isCenturyTraveler 
                                      ? 'bg-[#2E1065]' 
                                      : 'bg-[#8B1A1A]'
                                    }
                                  `}></div>
                                  
                                  <div className={`
                                    absolute inset-[10%] rounded-full flex items-center justify-center overflow-hidden border
                                    ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'bg-[#4C1D95] border-violet-400/30' : 'bg-[#991B1B] border-red-900/30'}
                                  `}>
                                    <svg viewBox="0 0 100 100" className="w-[85%] h-[85%]">
                                      <defs>
                                        <linearGradient id="goldGradientCapture" x1="0%" y1="0%" x2="100%" y2="100%">
                                          <stop offset="0%" stopColor="#D4AF37" />
                                          <stop offset="50%" stopColor="#FFD700" />
                                          <stop offset="100%" stopColor="#AA8A2E" />
                                        </linearGradient>
                                      </defs>
                                      <g fill="none" stroke="url(#goldGradientCapture)">
                                        <circle cx="50" cy="50" r="42" strokeWidth="0.5" opacity="0.6" />
                                        <path d="M50 8 A42 42 0 0 1 92 50" strokeWidth="1.2" strokeLinecap="round" />
                                        <circle cx="50" cy="50" r="34" strokeWidth="0.8" />
                                        <circle cx="50" cy="50" r="26" strokeWidth="1" />
                                        <circle cx="50" cy="50" r="18" strokeWidth="1.2" />
                                        <path d="M50 50 L50 25" strokeWidth="2.5" strokeLinecap="round" />
                                        <path d="M50 50 L70 50" strokeWidth="2" strokeLinecap="round" />
                                        <circle cx="50" cy="50" r="3" fill="url(#goldGradientCapture)" stroke="none" />
                                        <path d="M75 25 Q80 20 85 25 T75 35 Z" fill="url(#goldGradientCapture)" stroke="none" transform="rotate(15 75 25)" />
                                        <path d="M25 70 Q20 75 25 80 T35 70 Z" fill="url(#goldGradientCapture)" stroke="none" transform="rotate(-20 25 70)" />
                                      </g>
                                    </svg>
                                  </div>
                                </div>
                                <p className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[16px] font-bold tracking-[0.2em] uppercase ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(96,165,250,0.7)]' : 'text-[#a8a29e]'}`}>
                                  时光邮局 · 岁轮
                                </p>
                              </div>

                              <div className="text-right flex flex-col gap-4 min-w-[120px]">
                                <div>
                                  <p className="text-[14px] text-[#a8a29e] uppercase tracking-widest font-bold mb-1 whitespace-nowrap">证书编号</p>
                                  <p className={`text-[18px] font-mono whitespace-nowrap ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(147,197,253,0.7)]' : 'text-[#57534e]'}`}>{allCertificates[currentCertificateIndex].id}</p>
                                </div>
                                <div>
                                  <p className="text-[14px] text-[#a8a29e] uppercase tracking-widest font-bold mb-1 whitespace-nowrap">签发日期</p>
                                  <p className={`text-[18px] font-medium italic whitespace-nowrap ${allCertificates[currentCertificateIndex].isCenturyTraveler ? 'text-[rgba(147,197,253,0.7)]' : 'text-[#57534e]'}`}>{format(allCertificates[currentCertificateIndex].date, 'yyyy.MM.dd')}</p>
                                </div>
                              </div>
                            </div>
                        </div>
                      </div>
                    </div>

                    {/* Loading State for Auto-generation */}
                    {isAutoGenerating && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/5 backdrop-blur-[1px] z-40 rounded-sm">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                          <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">正在生成高清证书...</p>
                        </div>
                      </div>
                    )}
                  </div>

                </motion.div>
              </AnimatePresence>

              {/* Pagination Indicator */}
              {allCertificates.length > 1 && (
                <div className="mt-4 flex items-center gap-2 bg-[rgba(255,255,255,0.5)] backdrop-blur-md px-4 py-1.5 rounded-full border border-[rgba(231,229,228,0.5)] shadow-sm">
                  {allCertificates.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentCertificateIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentCertificateIndex ? 'bg-[#292524] w-4' : 'bg-[#d6d3d1] hover:bg-[#a8a29e]'}`}
                    />
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 md:mt-6 flex justify-center gap-4">
                <button 
                  onClick={() => setIsCertificateModalOpen(false)}
                  className="px-8 py-3 bg-[rgba(245,245,244,0.8)] hover:bg-[rgba(231,229,228,0.8)] backdrop-blur-md text-stone-500 rounded-full text-sm font-bold transition-all border border-[rgba(231,229,228,0.5)] flex items-center gap-2"
                >
                  <X size={16} />
                  关闭
                </button>
                <button 
                  onClick={handleDownloadCertificate}
                  disabled={isDownloading}
                  className="px-8 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-full text-sm font-bold transition-all shadow-xl flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <div className="w-4 h-4 border-2 border-[rgba(255,255,255,0.2)] border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Download size={16} />
                  )}
                  <span className="whitespace-nowrap">
                    {isDownloading ? '正在保存...' : '保存证书'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  </AnimatePresence>

  <AuthModals 
    isLoginModalOpen={isLoginModalOpen}
    setIsLoginModalOpen={setIsLoginModalOpen}
    isOnboardingModalOpen={isOnboardingModalOpen}
    setIsOnboardingModalOpen={setIsOnboardingModalOpen}
    loginPhone={loginPhone}
    setLoginPhone={setLoginPhone}
    loginPassword={loginPassword}
    setLoginPassword={setLoginPassword}
    loginError={loginError}
    isLoggingIn={isLoggingIn}
    handlePhoneLogin={handlePhoneLogin}
    handlePhoneSignUp={handlePhoneSignUp}
    onboardingName={onboardingName}
    setOnboardingName={setOnboardingName}
    updateUserName={updateUserName}
    isUpdatingName={isUpdatingName}
  />
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className={`absolute inset-0 bg-stone-900/${isMobile ? '70' : '40'} ${isMobile ? '' : 'backdrop-blur-sm'}`}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-bold text-stone-800 mb-2">确定要删除吗？</h3>
                <p className="text-stone-500 text-sm leading-relaxed mb-8">
                  {letterToDeleteId 
                    ? "这封信承载着你对未来的期待。一旦删除，这段记忆将永远消失。"
                    : "这个目标代表了你对生活的愿景。一旦删除，它将从你的生命网格中移除。"}
                </p>
                
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={letterToDeleteId ? confirmDeleteLetter : confirmDeleteGoal}
                    className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all shadow-lg active:scale-[0.98]"
                  >
                    确认删除
                  </button>
                  <button 
                    onClick={() => {
                      setIsDeleteConfirmOpen(false);
                      setLetterToDeleteId(null);
                      setGoalToDeleteId(null);
                    }}
                    className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                  >
                    保留{letterToDeleteId ? '信件' : '目标'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Certificate Button (Quick Access) */}
      <AnimatePresence>
        {allCertificates.length > 0 && !isCertificateModalOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            whileHover={{ scale: 1.1, y: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setCurrentCertificateIndex(0);
              setIsCertificateModalOpen(true);
            }}
            className={`
              fixed bottom-6 right-6 z-40 w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl flex items-center justify-center transition-colors
              ${allCertificates[0].isCenturyTraveler 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-stone-800 text-white hover:bg-stone-900'}
            `}
            title="查看我的时光证书"
          >
            <Award size={24} className="md:w-7 md:h-7" />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border-2 border-current"
            />
          </motion.button>
        )}
        {/* Image Preview Modal Fallback */}
        <AnimatePresence>
          {isImagePreviewOpen && downloadedImage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
                onClick={() => setIsImagePreviewOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[2rem] overflow-hidden max-w-2xl w-full relative z-10 shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-stone-800">证书预览</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {isMobile ? "长按图片“保存到相册”" : "点击下方按钮下载"}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsImagePreviewOpen(false)}
                    className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-stone-50 flex items-center justify-center">
                  <img 
                    src={downloadedImage} 
                    alt="证书预览" 
                    className="max-w-full h-auto shadow-lg rounded-lg"
                  />
                </div>
                
                <div className="p-6 bg-white border-t border-stone-100 flex flex-col sm:flex-row gap-4">
                  {isMobile ? (
                    <div className="flex-1 text-center py-2 px-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium">
                      💡 提示：长按上方图片并选择<b>“保存到相册”</b>或<b>“添加到照片”</b>。
                    </div>
                  ) : (
                    <a 
                      href={downloadedImage} 
                      download={`life-grid-certificate-${allCertificates[currentCertificateIndex].id}.png`}
                      className="flex-1 px-8 py-4 bg-stone-900 text-white rounded-full text-sm font-bold transition-all shadow-xl flex items-center justify-center gap-2 hover:bg-stone-800"
                    >
                      <Download size={18} />
                      确认下载
                    </a>
                  )}
                  <button 
                    onClick={() => setIsImagePreviewOpen(false)}
                    className={`px-8 py-4 rounded-full text-sm font-bold transition-all ${isMobile ? 'bg-stone-900 text-white w-full' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    {isMobile ? '知道了' : '取消'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </AnimatePresence>

      {/* Apple Calendar Mobile Modal */}
      {showAppleModal && pendingLetter && birthDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-emerald-100"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-emerald-50 p-2 rounded-xl">
                <Calendar className="text-emerald-600" size={24} />
              </div>
              <button 
                onClick={() => setShowAppleModal(false)}
                className="p-1 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X size={20} className="text-stone-400" />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-stone-800 mb-2">添加到苹果日历</h3>
            <p className="text-sm text-stone-500 mb-4 leading-relaxed">
              iOS Safari 可能会限制自动导入日历。请手动将以下详情复制到您的日历中：
            </p>
            
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block mb-1">提醒日期</label>
                <div className="text-stone-700 font-mono text-sm">
                  {format(addYears(new Date(birthDate), pendingLetter.age), 'yyyy-MM-dd')} ({pendingLetter.age} 岁)
                </div>
              </div>
              
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold block mb-1">复制内容</label>
                <div className="text-stone-700 text-xs leading-relaxed break-words select-all">
                  你在 {new Date().getFullYear()} 年写给自己的信已解锁。点击链接查看：{APP_URL}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowAppleModal(false)}
              className="w-full mt-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
            >
              知道了
            </button>
          </motion.div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

const TUNNEL_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#60a5fa', // Light Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#10b981', // Emerald
  '#facc15', // Yellow
  '#ffffff', // White
];

const TimeTunnel = ({ isFrozen }: { isFrozen?: boolean }) => {
  const [streakCount, setStreakCount] = useState(window.innerWidth < 768 ? 150 : 320);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const stars = useMemo(() => Array.from({ length: 100 }).map(() => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    opacity: 0.2 + Math.random() * 0.7,
    duration: 1.5 + Math.random() * 2.5
  })), []);

  useEffect(() => {
    const updateCount = () => {
      const mobile = window.innerWidth < 768;
      setStreakCount(mobile ? 150 : 320);
      setIsMobile(mobile);
    };
    updateCount();
    window.addEventListener('resize', updateCount);
    return () => window.removeEventListener('resize', updateCount);
  }, []);

  const streakData = useMemo(() => {
    return Array.from({ length: streakCount }).map((_, i) => ({
      id: i,
      angle: (i * 360) / streakCount + (Math.random() * 2 - 1),
      delay: Math.random() * -10,
      duration: 0.8 + Math.random() * 1.2,
      color: TUNNEL_COLORS[i % TUNNEL_COLORS.length],
      width: isMobile 
        ? 1 + Math.random() * 4
        : 0.5 + Math.random() * 6,
      blur: isMobile ? 0 : (Math.random() > 0.8 ? 2 : 0.5),
    }));
  }, [streakCount, isMobile]);
  
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 bg-[#020617] transition-opacity duration-500 opacity-100`}>
      {/* Deep Space Nebula Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.25),transparent_70%)]" />
      
      {/* Starfield - Hidden on mobile per request */}
      {!isMobile && stars.map((star, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute w-[1.5px] h-[1.5px] bg-white rounded-full shadow-[0_0_2px_#fff]"
          style={{ 
            top: star.top, 
            left: star.left,
            opacity: star.opacity
          }}
          animate={isFrozen ? { opacity: star.opacity, scale: 1 } : { opacity: [0.2, 1, 0.2], scale: [1, 1.2, 1] }}
          transition={{ duration: star.duration, repeat: Infinity }}
        />
      ))}

      {/* Radial Streaks */}
      {streakData.map((streak) => (
        <motion.div
          key={`streak-${streak.id}`}
          initial={{ 
            top: '50%',
            left: '50%',
            width: `${streak.width}px`,
            height: '0px',
            opacity: 0,
            rotate: streak.angle,
            originY: 0,
            originX: '50%'
          }}
          animate={isFrozen && isMobile ? { 
            height: '1500px', 
            opacity: 0.8,
            scaleX: 1
          } : { 
            height: ['0px', '4500px'], 
            opacity: [0, 1, 0.5, 0],
            scaleX: [1, 1.2, 1],
          }}
          transition={{
            duration: streak.duration,
            repeat: Infinity,
            delay: streak.delay,
            ease: "circIn",
          }}
          className="absolute will-change-[height,opacity]"
          style={{
            background: `linear-gradient(to bottom, ${streak.color}, ${streak.color}88, transparent)`,
            boxShadow: streak.width > 3 ? `0 0 15px ${streak.color}66` : `0 0 5px ${streak.color}33`,
            filter: `blur(${streak.blur}px)`,
          }}
        />
      ))}

      {/* Central Vanishing Point */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {!isMobile && (
          <>
            <div className="w-32 h-32 bg-blue-400/20 rounded-full blur-[80px] animate-pulse" />
            <motion.div 
              animate={{ scale: [1, 2, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-blue-200/30 rounded-full blur-3xl" 
            />
          </>
        )}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${isMobile ? 'w-[4.8px] h-[4.8px]' : 'w-8 h-8'} bg-white rounded-full ${isMobile ? 'blur-[2px]' : 'blur-sm'} shadow-[0_0_60px_#fff]`} />
      </div>

      {/* Speed Lines Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(2,6,23,0.4)_100%)] pointer-events-none" />
    </div>
  );
};

const MiniStatCard: React.FC<{ title: string; value: string | number | undefined; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-5 rounded-[2rem] border border-[#F5F5F4] shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col items-center text-center"
  >
    <div className="flex items-center gap-2 mb-2">
      <div className="text-[#A8A29E]">{icon}</div>
      <span className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.2em]">{title}</span>
    </div>
    <span className={`text-2xl font-sans font-bold ${color}`}>{value}</span>
  </motion.div>
);

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
    <span className="text-[#78716C] font-bold">{label}</span>
  </div>
);

export default App;
