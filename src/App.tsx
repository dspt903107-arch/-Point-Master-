import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Plus, Trash2, Settings, User, BookOpen, Hammer, ShoppingCart, Sparkles, History, Target, ChevronRight } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { auth, db } from './firebase';
import { Student, Log, Task, CardTier } from './types';
import { 
  studentsRef, 
  logsRef, 
  tasksRef, 
  addLog, 
  updateStudent, 
  createStudent, 
  deleteStudent, 
  setTask, 
  clearTask,
  testConnection
} from './services/firestoreService';
import { ADMIN_PASSWORD, CARD_MAP, SELL_VALUES, TIER_ORDER, TIER_WEIGHTS, TIERS } from './constants';
import { Modal, ConfirmModal } from './components/Modals';
import { Inventory } from './components/Inventory';
import { AdminTable } from './components/AdminTable';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });
  const [hasAdminAccess, setHasAdminAccess] = useState(() => {
    return localStorage.getItem('hasAdminAccess') === 'true' || localStorage.getItem('isAdmin') === 'true';
  });
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [logsList, setLogsList] = useState<Log[]>([]);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<CardTier | 'ALL'>('ALL');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isPokedexOpen, setIsPokedexOpen] = useState(false);
  const [isBlackMarketOpen, setIsBlackMarketOpen] = useState(false);
  const [isSynthesisOpen, setIsSynthesisOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ title: string; text: string; onConfirm: () => void; icon?: string } | null>(null);

  // Form states
  const [adminPassword, setAdminPassword] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskReward, setNewTaskReward] = useState('');
  const [batchPoints, setBatchPoints] = useState('');
  const [batchDraws, setBatchDraws] = useState('');
  const [batchReason, setBatchReason] = useState('');
  const [detailPts, setDetailPts] = useState('');
  const [detailDrs, setDetailDrs] = useState('');
  const [detailReason, setDetailReason] = useState('');
  const [selectedCardToGive, setSelectedCardToGive] = useState('');
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [synthesisSlots, setSynthesisSlots] = useState<string[]>([]);
  const [targetCard, setTargetCard] = useState<string>('');

  const [currentAdminViewingStudentId, setCurrentAdminViewingStudentId] = useState<string | null>(null);
  const currentStudent = useMemo(() => studentList.find(s => s.id === currentStudentId) || null, [studentList, currentStudentId]);
  const currentAdminStudent = useMemo(() => studentList.find(s => s.id === (currentAdminViewingStudentId || '')) || null, [studentList, currentAdminViewingStudentId]);

  useEffect(() => {
    testConnection();

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.isAnonymous) {
          await signOut(auth);
          setIsAuthReady(false);
        } else {
          setIsAuthReady(true);
        }
      } else {
        setIsAuthReady(false);
      }
    });

    return () => unsubAuth();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Auth error:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdmin(false);
      setHasAdminAccess(false);
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('hasAdminAccess');
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubStudents = onSnapshot(studentsRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      list.sort((a, b) => a.id.localeCompare(b.id));
      setStudentList(list);
    });

    const unsubLogs = onSnapshot(logsRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Log));
      list.sort((a, b) => b.timestamp - a.timestamp);
      setLogsList(list);
    });

    const unsubTasks = onSnapshot(tasksRef, (snap) => {
      const current = snap.docs.find(d => d.id === 'current');
      setCurrentTask(current ? { id: current.id, ...current.data() } as Task : null);
    });

    return () => {
      unsubStudents();
      unsubLogs();
      unsubTasks();
    };
  }, [isAuthReady]);

  const showMessage = (msg: string) => {
    // Simple alert for now, could be a toast
    alert(msg);
  };

  const updateStudentWithReward = async (student: Student, updates: Partial<Student>, silent: boolean = false) => {
    let newPoints = updates.points !== undefined ? updates.points : student.points;
    let newDraws = updates.draws !== undefined ? updates.draws : student.draws;
    let maxPointsReached = student.maxPointsReached !== undefined ? student.maxPointsReached : student.points;

    if (newPoints > maxPointsReached) {
      const previousThresholds = Math.floor(maxPointsReached / 10);
      const newThresholds = Math.floor(newPoints / 10);
      const ticketsGained = newThresholds - previousThresholds;
      
      if (ticketsGained > 0) {
        newDraws += ticketsGained;
        addLog(student.id, '系統獎勵', `點數達到 ${newThresholds * 10}，自動獲得 ${ticketsGained} 張抽獎券！`);
        if (!silent && student.id === currentStudentId) {
          setTimeout(() => showMessage(`恭喜！點數達到 ${newThresholds * 10}，自動獲得 ${ticketsGained} 張抽獎券！`), 100);
        }
      }
      maxPointsReached = newPoints;
    }

    const finalUpdates = {
      ...updates,
      points: newPoints,
      draws: newDraws,
      maxPointsReached
    };

    await updateStudent(student.id, finalUpdates);
  };

  const handleDraw = async () => {
    if (!currentStudent) return showMessage('請先選擇學生！');
    if (currentStudent.draws <= 0) return showMessage('抽獎券不足！');

    const drawsCount = currentStudent.doubleDraw ? 2 : 1;
    const wasDoubleDraw = currentStudent.doubleDraw;
    
    await updateStudentWithReward(currentStudent, { 
      draws: currentStudent.draws - 1, 
      doubleDraw: false 
    });

    const results: string[] = [];
    for (let i = 0; i < drawsCount; i++) {
      let totalWeight = Object.values(TIER_WEIGHTS).reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let selectedTier: CardTier = 'N';
      for (let tier of TIER_ORDER) {
        if (rand < TIER_WEIGHTS[tier]) { selectedTier = tier; break; }
        rand -= TIER_WEIGHTS[tier];
      }
      const cardsInTier = Object.keys(CARD_MAP).filter(k => CARD_MAP[k].tier === selectedTier);
      results.push(cardsInTier[Math.floor(Math.random() * cardsInTier.length)]);
    }

    const newInventory = { ...currentStudent.inventory };
    let msgText = wasDoubleDraw ? "🎉 買一送一發動！\n" : "";
    let pointsToAdd = 0;

    for (let cardName of results) {
      const card = CARD_MAP[cardName];
      const currentCount = (newInventory[cardName] as number | undefined) || 0;
      newInventory[cardName] = currentCount + 1;
      msgText += `${card.icon} 【${card.tier}】${cardName}\n`;

      if (cardName === '財神降臨') {
        pointsToAdd += 5;
        addLog('SYSTEM', '全班增益', `${currentStudent.name} 抽到了【財神降臨】！全班每人加 2 點！`);
        studentList.filter(s => s.id !== currentStudent.id).forEach(s => {
          updateStudentWithReward(s, { points: s.points + 2 }, true);
        });
      } else {
        addLog(currentStudent.id, '抽卡', `抽到了【${cardName}】(${card.tier})`);
      }
    }

    await updateStudentWithReward(currentStudent, { 
      inventory: newInventory, 
      points: currentStudent.points + pointsToAdd 
    });

    setConfirmData({
      title: '🎊 抽卡結果',
      text: msgText.trim(),
      onConfirm: () => setConfirmData(null),
      icon: '🎁'
    });
  };

  const handleUseCard = async (cardName: string) => {
    if (!currentStudent) return;
    const card = CARD_MAP[cardName];
    
    if (cardName === '再來一張') {
      setConfirmData({
        title: '使用卡片',
        text: `確定要消耗 1 張【再來一張】換取 1 張抽獎券嗎？`,
        onConfirm: async () => {
          const newInv = { ...currentStudent.inventory };
          newInv[cardName]--;
          await updateStudentWithReward(currentStudent, { inventory: newInv, draws: currentStudent.draws + 1 });
          addLog(currentStudent.id, '使用卡片', `消耗【再來一張】兌換了 1 張抽獎券`);
          setConfirmData(null);
        }
      });
    } else if (cardName === '買一送一') {
      if (currentStudent.doubleDraw) return showMessage('買一送一效果已經發動中！');
      setConfirmData({
        title: '使用卡片',
        text: `確定要消耗【買一送一】？下次抽卡將獲得兩張卡片！`,
        onConfirm: async () => {
          const newInv = { ...currentStudent.inventory };
          newInv[cardName]--;
          await updateStudentWithReward(currentStudent, { inventory: newInv, doubleDraw: true });
          addLog(currentStudent.id, '使用卡片', `發動了【買一送一】效果`);
          setConfirmData(null);
        }
      });
    } else {
      setConfirmData({
        title: '卡片資訊',
        text: `【${cardName}】\n${card.desc}`,
        onConfirm: () => setConfirmData(null),
        icon: card.icon
      });
    }
  };

  const handleSellCard = async (cardName: string) => {
    if (!currentStudent) return;
    const card = CARD_MAP[cardName];
    const sellValue = SELL_VALUES[card.tier];
    
    setConfirmData({
      title: '確認出售',
      text: `確定要將【${cardName}】賣給黑市商人嗎？\n可獲得 ${sellValue} 黑市金幣。`,
      onConfirm: async () => {
        const newInv = { ...currentStudent.inventory };
        newInv[cardName]--;
        await updateStudentWithReward(currentStudent, { inventory: newInv, coins: (currentStudent.coins || 0) + sellValue });
        addLog(currentStudent.id, '黑市交易', `出售【${cardName}】獲得 ${sellValue} 黑市金幣`);
        setConfirmData(null);
      }
    });
  };

  const handleBuyTickets = async (amount: number, cost: number) => {
    if (!currentStudent) return;
    const currentCoins = currentStudent.coins || 0;
    if (currentCoins < cost) return showMessage('黑市金幣不足！');

    setConfirmData({
      title: '確認購買',
      text: `花費 ${cost} 黑市金幣購買 ${amount} 張抽獎券？`,
      onConfirm: async () => {
        await updateStudentWithReward(currentStudent, { coins: currentCoins - cost, draws: currentStudent.draws + amount });
        addLog(currentStudent.id, '黑市交易', `花費 ${cost} 黑市金幣購買了 ${amount} 張抽獎券`);
        setConfirmData(null);
      }
    });
  };

  const handleSynthesis = async (type: 'random_upgrade' | 'specific_upgrade' | 'random_downgrade' | 'specific_downgrade') => {
    if (!currentStudent || synthesisSlots.length === 0) return;
    
    const count = synthesisSlots.length;
    const isSameTier = synthesisSlots.every(s => CARD_MAP[s].tier === CARD_MAP[synthesisSlots[0]].tier);
    if (!isSameTier) return showMessage('素材不符！');

    const currentTier = CARD_MAP[synthesisSlots[0]].tier;
    const nextTier = TIER_ORDER[TIER_ORDER.indexOf(currentTier) + 1];
    const prevTier = TIER_ORDER[TIER_ORDER.indexOf(currentTier) - 1];

    let resultCard = '';

    if (type === 'random_downgrade') {
      if (count !== 1 || !prevTier) return;
      const possibleCards = Object.keys(CARD_MAP).filter(k => CARD_MAP[k].tier === prevTier);
      resultCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
    } else if (type === 'random_upgrade') {
      if (count !== 2 || !nextTier) return;
      const possibleCards = Object.keys(CARD_MAP).filter(k => CARD_MAP[k].tier === nextTier);
      resultCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
    } else if (type === 'specific_downgrade') {
      if (count !== 2 || !prevTier || !targetCard || CARD_MAP[targetCard].tier !== prevTier) return;
      resultCard = targetCard;
    } else if (type === 'specific_upgrade') {
      if (count !== 3 || !nextTier || !targetCard || CARD_MAP[targetCard].tier !== nextTier) return;
      resultCard = targetCard;
    }

    if (!resultCard) return;

    const newInv = { ...currentStudent.inventory };
    
    for (const slot of synthesisSlots) {
      newInv[slot] = (newInv[slot] as number || 0) - 1;
    }
    
    newInv[resultCard] = (newInv[resultCard] as number || 0) + 1;

    await updateStudentWithReward(currentStudent, { inventory: newInv });
    
    const actionName = type.includes('upgrade') ? '升階' : '降階';
    addLog(currentStudent.id, '合成工坊', `消耗【${synthesisSlots.join('、')}】，${actionName}獲得了【${resultCard}】`);
    
    setSynthesisSlots([]);
    setTargetCard('');
    setConfirmData({
      title: '合成成功！',
      text: `恭喜！你獲得了 ${CARD_MAP[resultCard].icon} 【${resultCard}】`,
      onConfirm: () => setConfirmData(null),
      icon: '✨'
    });
  };

  const handleAiChat = async () => {
    if (!aiChatInput.trim() || isAiLoading) return;
    const userMsg = aiChatInput.trim();
    setAiChatInput('');
    setAiChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `你是一個存在於學校「點數大師」系統中的卡片精靈。你的個性活潑、充滿能量，負責鼓勵學生學習、解讀卡片運勢，或者回答關於系統的問題。
        系統設定：使用點數換抽獎券，抽卡片(N, R, SR, SSR)。
        請用繁體中文回答，語氣友善且簡短（不超過3句話），可以加入適當的 Emoji。
        學生說：「${userMsg}」`,
      });

      const reply = response.text || "精靈累了，稍後再試！💤";
      setAiChatHistory(prev => [...prev, { role: 'bot', text: reply }]);
      setIsAiLoading(false);
    } catch (e) {
      console.error("AI error:", e);
      setAiChatHistory(prev => [...prev, { role: 'bot', text: "(精靈失去連線，請確認網路環境)" }]);
      setIsAiLoading(false);
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setHasAdminAccess(true);
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('hasAdminAccess', 'true');
      setIsLoginModalOpen(false);
      setAdminPassword('');
      showMessage('管理員登入成功');
    } else {
      showMessage('密碼錯誤');
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentName.trim()) return;
    await createStudent(newStudentName.trim());
    setNewStudentName('');
    setIsAddStudentOpen(false);
    showMessage('新增成功');
  };

  const handleBatchUpdate = async () => {
    const pts = parseInt(batchPoints) || 0;
    const drs = parseInt(batchDraws) || 0;
    if (pts === 0 && drs === 0) return showMessage('請輸入調整數值');

    setIsBatchModalOpen(false);
    for (const id of selectedStudents) {
      const s = studentList.find(st => st.id === id);
      if (s) {
        await updateStudentWithReward(s, { points: Math.max(0, s.points + pts), draws: Math.max(0, s.draws + drs) }, true);
        addLog(id, '批量調整', `點數 ${pts > 0 ? '+' : ''}${pts}, 獎券 ${drs > 0 ? '+' : ''}${drs} (${batchReason || '批量調整'})`);
      }
    }
    setSelectedStudents(new Set());
    setIsBatchMode(false);
    showMessage('批量更新完成！');
  };

  const handleDetailUpdate = async () => {
    if (!currentAdminStudent) return;
    const pts = parseInt(detailPts) || 0;
    const drs = parseInt(detailDrs) || 0;
    if (pts === 0 && drs === 0) return showMessage('請輸入調整數值');

    await updateStudentWithReward(currentAdminStudent, { 
      points: Math.max(0, currentAdminStudent.points + pts), 
      draws: Math.max(0, currentAdminStudent.draws + drs) 
    });
    addLog(currentAdminStudent.id, '手動調整', `點數 ${pts > 0 ? '+' : ''}${pts}, 獎券 ${drs > 0 ? '+' : ''}${drs} (${detailReason || '管理員調整'})`);
    setDetailPts('');
    setDetailDrs('');
    setDetailReason('');
    showMessage('更新成功');
  };

  const handleAdminAddCard = async () => {
    if (!currentAdminStudent || !selectedCardToGive) return;
    const newInv = { ...currentAdminStudent.inventory };
    newInv[selectedCardToGive] = (newInv[selectedCardToGive] || 0) + 1;
    await updateStudentWithReward(currentAdminStudent, { inventory: newInv });
    addLog(currentAdminStudent.id, '系統發放', `管理員發放了【${selectedCardToGive}】`);
    setSelectedCardToGive('');
    showMessage('卡片發送成功');
  };

  const handleGenerateTask = async () => {
    const tasks = [
      { t: "全班連續兩天沒有人遲到", r: "全班 +5 點，+1 抽獎券" },
      { t: "本週小考全班平均達 80 分以上", r: "全班 +10 點" },
      { t: "今天打掃時間提早 5 分鐘完美結束", r: "全班 +3 點" },
      { t: "上課時主動發言回答問題累計達 10 次", r: "全班各獲 1 張抽獎券" }
    ];
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    await setTask(task.t, task.r);
    addLog('SYSTEM', '新任務發布', `發布了新班級任務：${task.t}`);
  };

  const handlePublishCustomTask = async () => {
    if (!newTaskContent.trim() || !newTaskReward.trim()) {
      return showMessage('請輸入任務內容與獎勵');
    }
    await setTask(newTaskContent.trim(), newTaskReward.trim());
    addLog('SYSTEM', '新任務發布', `發布了新班級任務：${newTaskContent.trim()}`);
    setNewTaskContent('');
    setNewTaskReward('');
    setIsTaskModalOpen(false);
    showMessage('自訂任務發布成功');
  };

  if (!isAuthReady) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center">
            <h1 className="text-3xl font-black text-teal-600 mb-6 italic tracking-tighter">✨ 點數大師</h1>
            <p className="text-gray-600 mb-8 font-bold">請先登入以繼續使用系統</p>
            <button
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-teal-600 text-white rounded-2xl font-black shadow-lg hover:bg-teal-700 transition-colors"
            >
              使用 Google 登入
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <datalist id="adjustment-reasons">
        <option value="表現優良" />
        <option value="作業優良" />
        <option value="考試滿分" />
        <option value="上課發言" />
        <option value="熱心助人" />
        <option value="作業缺交" />
        <option value="違反班規" />
        <option value="遲到早退" />
        <option value="未帶學用品" />
        <option value="其他" />
      </datalist>
      <div className="bg-gray-50 text-gray-800 min-h-screen pb-24 font-sans">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-40 border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-teal-600 italic tracking-tighter">✨ 點數大師</h1>
              <span className="hidden md:block text-[10px] bg-teal-50 px-3 py-1 rounded-full font-bold text-teal-600 border border-teal-100">
                {isAuthReady ? "系統連線成功" : "系統連線中..."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-[10px] rounded-full font-bold uppercase ${isAdmin ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>
                {isAdmin ? 'Teacher Mode' : 'Student Mode'}
              </span>
              <button 
                onClick={() => {
                  if (isAdmin) {
                    setIsAdmin(false);
                    localStorage.setItem('isAdmin', 'false');
                  } else {
                    if (hasAdminAccess) {
                      setIsAdmin(true);
                      localStorage.setItem('isAdmin', 'true');
                    } else {
                      setIsLoginModalOpen(true);
                    }
                  }
                }}
                className="text-xs px-4 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 shadow-md transition-all"
              >
                {isAdmin ? '學生視角' : '後台管理'}
              </button>
              <button 
                onClick={handleLogout}
                className="text-xs px-4 py-2 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 shadow-sm transition-all ml-2"
              >
                登出
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Status Bar */}
          <div className="bg-white rounded-2xl shadow-sm border p-5 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-teal-50 p-3 rounded-xl"><User className="text-primary" /></div>
              <div className="flex-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">身份切換</label>
                <select 
                  value={currentStudentId || ''} 
                  onChange={(e) => setCurrentStudentId(e.target.value || null)}
                  className="bg-transparent border-b-2 border-gray-100 font-black text-gray-700 focus:border-primary outline-none transition-all w-48 py-1 cursor-pointer"
                >
                  <option value="">請選擇學生</option>
                  {studentList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-4 bg-teal-50 px-6 py-3 rounded-2xl border border-teal-100 items-center">
              <div className="text-center">
                <div className="text-[10px] text-teal-600 font-black uppercase">目前點數</div>
                <div className="text-3xl font-black text-primary">{currentStudent?.points || 0}</div>
              </div>
              <div className="w-px h-10 bg-teal-200 mx-2"></div>
              <div className="text-center">
                <div className="text-[10px] text-teal-600 font-black uppercase">抽獎券</div>
                <div className="text-3xl font-black text-secondary">{currentStudent?.draws || 0}</div>
              </div>
            </div>
          </div>

          {!isAdmin ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-gradient-to-br from-teal-600 to-emerald-700 rounded-[2rem] shadow-xl p-8 text-white text-center relative">
                  <h3 className="text-3xl font-black mb-2">幸運抽卡 🎁</h3>
                  <p className="text-teal-100 text-xs mb-8 opacity-70">每次消耗 1 張抽獎券</p>
                  <button 
                    onClick={handleDraw}
                    className="w-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-black py-5 rounded-2xl shadow-[0_6px_0_0_#d97706] active:translate-y-1 active:shadow-none transition-all text-xl relative"
                  >
                    開啟寶箱
                    {currentStudent?.doubleDraw && (
                      <span className="absolute -top-3 -right-3 bg-rose-500 text-white text-[10px] px-3 py-1.5 rounded-full font-black shadow-lg transform rotate-12 border-2 border-white whitespace-nowrap z-10">
                        🎟️ 買一送一發動中！
                      </span>
                    )}
                  </button>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={() => setIsAiChatOpen(true)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-[10px] border border-white/20">✨ 今日運勢</button>
                    <button onClick={() => setIsPokedexOpen(true)} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-[10px] border border-white/20">📖 查看圖鑑</button>
                  </div>
                </div>
                
                <div className="bg-indigo-50/50 rounded-[2rem] shadow-sm border border-indigo-100 p-6 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 text-6xl opacity-10"><Target /></div>
                  <h4 className="font-black text-indigo-800 mb-4 text-sm flex items-center gap-2">📢 班級挑戰任務</h4>
                  <div className="text-sm text-indigo-900 mb-3 font-bold min-h-[40px] leading-relaxed">
                    {currentTask ? currentTask.content : "目前沒有特殊任務。"}
                  </div>
                  {currentTask && (
                    <div className="inline-block bg-white px-3 py-1.5 rounded-lg text-[10px] text-indigo-600 font-black shadow-sm">
                      🎁 達成獎勵：{currentTask.reward}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="lg:col-span-8">
                <div className="bg-white rounded-[2rem] shadow-sm border p-8 min-h-[500px]">
                  <div className="flex justify-between items-center mb-8 border-b pb-6 flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-black text-gray-800">🎒 我的背包</h3>
                      <button onClick={() => setIsSynthesisOpen(true)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-1 shadow-sm border border-indigo-100"><Hammer size={14} /> 合成工坊</button>
                      <button onClick={() => setIsBlackMarketOpen(true)} className="bg-gray-800 text-yellow-400 hover:bg-gray-900 px-3 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-1 shadow-sm border border-gray-700"><ShoppingCart size={14} /> 地下黑市</button>
                    </div>
                    <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
                      {(['ALL', 'SSR', 'SR', 'R', 'N'] as const).map(f => (
                        <button 
                          key={f}
                          onClick={() => setCurrentFilter(f)}
                          className={`px-4 py-2 text-xs rounded-lg font-bold transition-all ${currentFilter === f ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-800'}`}
                        >
                          {f === 'ALL' ? '全部' : f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Inventory student={currentStudent} filter={currentFilter} onCardClick={handleUseCard} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-[2rem] shadow-sm border p-8">
                <div className="flex flex-col xl:flex-row justify-between items-center mb-8 gap-6 border-b pb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-black text-gray-800">📊 數據中心</h2>
                    {isBatchMode && (
                      <div className="flex items-center gap-3 bg-teal-50 px-4 py-2 rounded-2xl border border-teal-100">
                        <span className="text-[10px] font-black text-teal-600 uppercase">已選 {selectedStudents.size} 人</span>
                        <button onClick={() => setIsBatchModalOpen(true)} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black hover:bg-teal-700 transition-colors">批量發送</button>
                        <button onClick={() => { setIsBatchMode(false); setSelectedStudents(new Set()); }} className="text-gray-400 text-[10px] font-bold hover:text-gray-600">取消</button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsBatchMode(!isBatchMode)} className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-gray-700 transition-colors">
                      {isBatchMode ? '退出批量' : '批量操作'}
                    </button>
                    <button onClick={() => setIsAddStudentOpen(true)} className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-teal-700 transition-colors">+ 新增學生</button>
                  </div>
                </div>
                <AdminTable 
                  students={studentList} 
                  isBatchMode={isBatchMode} 
                  selectedStudents={selectedStudents}
                  onToggleSelect={(id) => {
                    const next = new Set(selectedStudents);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    setSelectedStudents(next);
                  }}
                  onSelectAll={(checked) => {
                    if (checked) setSelectedStudents(new Set(studentList.map(s => s.id)));
                    else setSelectedStudents(new Set());
                  }}
                  onManage={(s) => {
                    setCurrentAdminViewingStudentId(s.id);
                    setIsManageModalOpen(true);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm border p-8">
                  <h3 className="text-lg font-black mb-6 flex items-center gap-2"><History size={20} /> 全班動態軌跡</h3>
                  <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 max-h-80 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4 border-l-2 border-teal-100 ml-2 py-2">
                      {logsList.map(l => (
                        <div key={l.id} className="relative text-xs pl-6">
                          <div className="absolute w-2 h-2 bg-teal-400 rounded-full -left-[5px] top-1.5 border-2 border-white shadow-sm"></div>
                          <div className="font-black text-teal-600 text-[10px] mb-0.5">
                            {new Date(l.timestamp).toLocaleString()} · {studentList.find(s => s.id === l.targetId)?.name || l.targetId} · {l.action}
                          </div>
                          <div className="font-bold text-gray-700">{l.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm border p-8 flex flex-col">
                  <h3 className="text-lg font-black mb-2 flex items-center gap-2"><Sparkles size={20} /> 全班加分任務</h3>
                  <p className="text-[10px] text-gray-400 mb-6">發布後，所有學生都能在首頁看到此任務。</p>
                  <div className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100 flex-grow flex flex-col justify-center items-center relative overflow-hidden">
                    <div className="text-sm font-black text-gray-700 text-center relative z-10">
                      {currentTask ? currentTask.content : "目前無指派任務"}
                    </div>
                    {currentTask && (
                      <div className="text-xs text-primary mt-3 font-bold text-center bg-teal-50 px-3 py-1 rounded-full relative z-10">
                        🎁 獎勵：{currentTask.reward}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mb-3">
                    <button onClick={handleGenerateTask} className="flex-1 py-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-black hover:bg-indigo-100 transition-colors shadow-sm">🎲 隨機發布</button>
                    <button onClick={() => setIsTaskModalOpen(true)} className="flex-1 py-3 bg-teal-50 text-teal-700 border border-teal-100 rounded-xl text-xs font-black hover:bg-teal-100 transition-colors shadow-sm">📝 自訂發布</button>
                  </div>
                  <button onClick={clearTask} className="w-full py-3 text-red-400 hover:bg-red-50 rounded-xl text-[10px] font-bold transition-colors">結束當前任務</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Modals */}
        <Modal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} title="管理員登入">
          <div className="text-center">
            <input 
              type="password" 
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full border-2 border-gray-100 p-5 rounded-2xl mb-8 text-center text-3xl tracking-widest outline-none focus:border-gray-800 transition-colors" 
              placeholder="••••" 
            />
            <div className="flex gap-4">
              <button onClick={() => setIsLoginModalOpen(false)} className="flex-1 font-bold text-gray-400 bg-gray-100 hover:bg-gray-200 transition-colors rounded-xl">取消</button>
              <button onClick={handleAdminLogin} className="flex-1 py-4 bg-gray-900 hover:bg-gray-800 transition-colors text-white rounded-2xl font-black">驗證</button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={isPokedexOpen} onClose={() => setIsPokedexOpen(false)} title="📖 卡片圖鑑" maxWidth="max-w-4xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Object.entries(CARD_MAP).map(([name, card]) => {
              const isCollected = currentStudent?.inventory && currentStudent.inventory[name] > 0;
              return (
                <div key={name} className={`card p-4 flex flex-col items-center text-center ${isCollected ? TIERS[card.tier] : 'bg-gray-100 opacity-40 grayscale border-gray-200'}`}>
                  <div className="text-3xl mb-2 drop-shadow-sm">{card.icon}</div>
                  <div className={`text-[10px] font-black uppercase mb-1 ${isCollected ? '' : 'text-gray-400'}`}>{card.tier}</div>
                  <div className={`text-xs font-black ${isCollected ? '' : 'text-gray-500'}`}>{isCollected ? name : '???'}</div>
                </div>
              );
            })}
          </div>
        </Modal>

        <Modal isOpen={isBlackMarketOpen} onClose={() => setIsBlackMarketOpen(false)} title="🕵️‍♂️ 地下黑市" maxWidth="max-w-4xl">
          <div className="mb-6 bg-gray-900 text-yellow-400 p-4 rounded-2xl flex justify-between items-center shadow-inner">
            <div className="font-black text-sm tracking-widest">持有黑市金幣</div>
            <div className="text-3xl font-black">{currentStudent?.coins || 0} <span className="text-sm">枚</span></div>
          </div>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <h4 className="text-yellow-500 font-black border-b border-gray-200 pb-2">🛒 黑市進貨</h4>
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">🎟️</div>
                    <div>
                      <div className="font-bold text-sm">單張抽獎券</div>
                      <div className="text-yellow-600 font-black text-[10px]">售價：10 金幣</div>
                    </div>
                  </div>
                  <button onClick={() => handleBuyTickets(1, 10)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl font-black text-xs">購買</button>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">🎫</div>
                    <div>
                      <div className="font-bold text-sm">獎券超值包 (x5)</div>
                      <div className="text-yellow-600 font-black text-[10px]">特價：45 金幣</div>
                    </div>
                  </div>
                  <button onClick={() => handleBuyTickets(5, 45)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl font-black text-xs">購買</button>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <h4 className="text-emerald-600 font-black border-b border-gray-200 pb-2">💰 黑市倒貨</h4>
              <div className="grid grid-cols-2 gap-3">
                {currentStudent && Object.entries(currentStudent.inventory).map(([name, count]) => {
                  if ((count as number) <= 0) return null;
                  const card = CARD_MAP[name];
                  return (
                    <div key={name} onClick={() => handleSellCard(name)} className="bg-gray-50 border p-3 rounded-xl flex justify-between items-center hover:border-emerald-500 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{card.icon}</span>
                        <div>
                          <div className="font-bold text-[10px]">{name} x{count}</div>
                          <div className="text-emerald-600 font-black text-[10px]">回收：{SELL_VALUES[card.tier]} 金幣</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>

        <Modal isOpen={isSynthesisOpen} onClose={() => setIsSynthesisOpen(false)} title="🔨 合成工坊">
          <div className="flex flex-col items-center">
            <div className="flex gap-4 mb-8">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  onClick={() => {
                    const next = [...synthesisSlots];
                    next.splice(i, 1);
                    setSynthesisSlots(next);
                    setTargetCard('');
                  }}
                  className={`w-24 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center text-3xl cursor-pointer transition-all ${synthesisSlots[i] ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50 text-gray-300'}`}
                >
                  {synthesisSlots[i] ? (
                    <div className="text-center">
                      <div className="text-4xl mb-1">{CARD_MAP[synthesisSlots[i]].icon}</div>
                      <div className="text-[10px] font-black text-indigo-800 truncate px-1">{synthesisSlots[i]}</div>
                    </div>
                  ) : '+'}
                </div>
              ))}
            </div>
            
            {(() => {
              const count = synthesisSlots.length;
              const isSameTier = count > 0 && synthesisSlots.every(s => CARD_MAP[s].tier === CARD_MAP[synthesisSlots[0]].tier);
              const currentTier = count > 0 ? CARD_MAP[synthesisSlots[0]].tier : null;
              const nextTier = currentTier ? TIER_ORDER[TIER_ORDER.indexOf(currentTier) + 1] : null;
              const prevTier = currentTier ? TIER_ORDER[TIER_ORDER.indexOf(currentTier) - 1] : null;

              if (count > 0 && !isSameTier) return <div className="text-red-500 font-bold mb-8">素材不符！請選擇同階級的卡片</div>;

              return (
                <div className="flex flex-col gap-3 w-full max-w-sm mb-8">
                  {count === 1 && prevTier && (
                    <button onClick={() => handleSynthesis('random_downgrade')} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 px-8 rounded-2xl shadow-lg">執行隨機降階 (1張)</button>
                  )}
                  {count === 2 && nextTier && (
                    <button onClick={() => handleSynthesis('random_upgrade')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-8 rounded-2xl shadow-lg">執行隨機升階 (2張)</button>
                  )}
                  {count === 2 && prevTier && (
                    <div className="w-full flex gap-2">
                      <select value={targetCard} onChange={e => setTargetCard(e.target.value)} className="flex-1 border-2 border-orange-200 rounded-xl px-3 font-bold outline-none focus:border-orange-500">
                        <option value="">選擇降階目標...</option>
                        {Object.keys(CARD_MAP).filter(k => CARD_MAP[k].tier === prevTier).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button onClick={() => handleSynthesis('specific_downgrade')} disabled={!targetCard} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black py-3 px-6 rounded-xl shadow-md whitespace-nowrap">指定降階</button>
                    </div>
                  )}
                  {count === 3 && nextTier && (
                    <div className="w-full flex gap-2">
                      <select value={targetCard} onChange={e => setTargetCard(e.target.value)} className="flex-1 border-2 border-indigo-200 rounded-xl px-3 font-bold outline-none focus:border-indigo-500">
                        <option value="">選擇升階目標...</option>
                        {Object.keys(CARD_MAP).filter(k => CARD_MAP[k].tier === nextTier).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button onClick={() => handleSynthesis('specific_upgrade')} disabled={!targetCard} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-3 px-6 rounded-xl shadow-md whitespace-nowrap">指定升階</button>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="w-full border-t pt-6">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3">選擇素材</h4>
              <div className="grid grid-cols-3 gap-3">
                {currentStudent && Object.entries(currentStudent.inventory).map(([name, count]) => {
                  const usedCount = synthesisSlots.filter(s => s === name).length;
                  if ((count as number) - usedCount <= 0) return null;
                  return (
                    <div key={name} onClick={() => {
                      if (synthesisSlots.length < 3) {
                        setSynthesisSlots([...synthesisSlots, name]);
                        setTargetCard('');
                      }
                    }} className={`card relative ${TIERS[CARD_MAP[name].tier]} p-2 flex flex-col items-center justify-center h-24 cursor-pointer hover:scale-105 transition-transform`}>
                      <div className="absolute top-1.5 right-1.5 bg-black/20 text-white text-[9px] px-1.5 py-0.5 rounded-md font-black">
                        x{(count as number) - usedCount}
                      </div>
                      <span className="text-2xl mb-1">{CARD_MAP[name].icon}</span>
                      <span className="text-[10px] font-black text-center leading-tight">{name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>

        <Modal isOpen={isAddStudentOpen} onClose={() => setIsAddStudentOpen(false)} title="新增學生">
          <input 
            type="text" 
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            className="w-full bg-gray-50 border-0 p-4 rounded-2xl font-black text-center text-lg mb-6 outline-none" 
            placeholder="例如：01號 王小明" 
          />
          <div className="flex gap-4">
            <button onClick={() => setIsAddStudentOpen(false)} className="flex-1 font-bold text-gray-400 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">取消</button>
            <button onClick={handleAddStudent} className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 transition-colors text-white rounded-2xl font-black shadow-lg">確認新增</button>
          </div>
        </Modal>

        <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="發布自訂任務">
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">任務內容</label>
              <input type="text" value={newTaskContent} onChange={(e) => setNewTaskContent(e.target.value)} className="w-full bg-gray-50 border-0 p-4 rounded-2xl font-black text-sm outline-none" placeholder="例如：全班連續兩天沒有人遲到" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">達成獎勵</label>
              <input type="text" value={newTaskReward} onChange={(e) => setNewTaskReward(e.target.value)} className="w-full bg-gray-50 border-0 p-4 rounded-2xl font-black text-sm outline-none" placeholder="例如：全班 +5 點，+1 抽獎券" />
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setIsTaskModalOpen(false)} className="flex-1 font-bold text-gray-400 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">取消</button>
              <button onClick={handlePublishCustomTask} className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 transition-colors text-white rounded-2xl font-black shadow-lg">確認發布</button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="批量調整">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">點數 +/-</label>
                <input type="number" value={batchPoints} onChange={(e) => setBatchPoints(e.target.value)} className="w-full bg-gray-50 border-0 p-4 rounded-2xl font-black text-center text-xl outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">獎券 +/-</label>
                <input type="number" value={batchDraws} onChange={(e) => setBatchDraws(e.target.value)} className="w-full bg-gray-50 border-0 p-4 rounded-2xl font-black text-center text-xl outline-none" placeholder="0" />
              </div>
            </div>
            <input list="adjustment-reasons" type="text" value={batchReason} onChange={(e) => setBatchReason(e.target.value)} className="w-full bg-gray-50 border-0 p-4 rounded-2xl font-bold text-sm outline-none" placeholder="為何調整？（可下拉選擇或自行輸入）" />
            <div className="flex gap-4 mt-6">
              <button onClick={() => setIsBatchModalOpen(false)} className="flex-1 font-bold text-gray-400 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">取消</button>
              <button onClick={handleBatchUpdate} className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 transition-colors text-white rounded-2xl font-black shadow-lg">執行更新</button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title={currentAdminStudent?.name || "學生詳情"} maxWidth="max-w-5xl">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 space-y-6">
              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase text-gray-400">1. 點數/獎券調整</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={detailPts} onChange={(e) => setDetailPts(e.target.value)} className="bg-white border rounded-xl p-3 text-center font-black text-sm outline-none" placeholder="點數 +/-" />
                  <input type="number" value={detailDrs} onChange={(e) => setDetailDrs(e.target.value)} className="bg-white border rounded-xl p-3 text-center font-black text-sm outline-none" placeholder="獎券 +/-" />
                </div>
                <input list="adjustment-reasons" type="text" value={detailReason} onChange={(e) => setDetailReason(e.target.value)} className="w-full bg-white border rounded-xl p-3 font-bold text-xs outline-none" placeholder="調整原因（可下拉選擇或自行輸入）" />
                <button onClick={handleDetailUpdate} className="w-full py-3 bg-gray-800 text-white rounded-xl font-black text-xs shadow-md">更新數值</button>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <label className="block text-[10px] font-black uppercase text-gray-400">2. 快速發送卡片</label>
                <select value={selectedCardToGive} onChange={(e) => setSelectedCardToGive(e.target.value)} className="w-full bg-white border rounded-xl p-3 font-bold text-xs outline-none">
                  <option value="">-- 選擇卡片 --</option>
                  {TIER_ORDER.map(tier => (
                    <optgroup key={tier} label={`--- ${tier} 級卡片 ---`}>
                      {Object.keys(CARD_MAP).filter(k => CARD_MAP[k].tier === tier).map(k => (
                        <option key={k} value={k}>{CARD_MAP[k].icon} {k}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button onClick={handleAdminAddCard} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs shadow-md">確認發送</button>
              </div>
              <button onClick={() => currentAdminStudent && deleteStudent(currentAdminStudent.id)} className="w-full py-4 text-red-400 hover:text-red-600 font-black text-[10px] border border-red-50 hover:bg-red-50 rounded-xl transition-all mt-8">🗑️ 永久刪除此學生</button>
            </div>
            <div className="w-full md:w-1/3 space-y-4">
              <label className="block text-[10px] font-black uppercase text-gray-400">目前背包物品</label>
              <div className="space-y-2">
                {currentAdminStudent && Object.entries(currentAdminStudent.inventory).map(([name, count]) => {
                  if ((count as number) <= 0) return null;
                  return (
                    <div key={name} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <div className="font-bold text-xs flex items-center gap-2"><span>{CARD_MAP[name].icon}</span> {name}</div>
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-black text-gray-600">x{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="w-full md:w-1/3 space-y-4">
              <label className="block text-[10px] font-black uppercase text-gray-400">個人活動歷程</label>
              <div className="space-y-4 border-l-2 border-gray-200 ml-2 py-2">
                {logsList.filter(l => l.targetId === currentAdminViewingStudentId).slice(0, 10).map(l => (
                  <div key={l.id} className="relative text-[10px] pl-6">
                    <div className="absolute w-2 h-2 bg-gray-300 rounded-full -left-[5px] top-1.5 border-2 border-white"></div>
                    <div className="font-black text-gray-400 mb-0.5">{new Date(l.timestamp).toLocaleString()}</div>
                    <div className="font-bold text-gray-700">{l.action}: {l.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>

        <Modal isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} title="✨ 卡片精靈對話">
          <div className="flex flex-col h-full">
            <div className="flex-grow space-y-4 mb-4">
              {aiChatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-2xl max-w-[80%] text-sm font-bold shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiLoading && <div className="text-center text-[10px] text-gray-400 font-bold">精靈施法中...</div>}
            </div>
            <div className="flex gap-3">
              <input 
                type="text" 
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAiChat()}
                className="flex-grow bg-gray-50 border-0 rounded-2xl px-5 py-4 outline-none font-bold" 
                placeholder="詢問運勢..." 
              />
              <button onClick={handleAiChat} className="bg-teal-600 text-white p-4 rounded-2xl"><Send size={20} /></button>
            </div>
          </div>
        </Modal>

        <ConfirmModal 
          isOpen={!!confirmData} 
          onClose={() => setConfirmData(null)} 
          onConfirm={confirmData?.onConfirm || (() => {})} 
          title={confirmData?.title || ''} 
          text={confirmData?.text || ''} 
          icon={confirmData?.icon}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
