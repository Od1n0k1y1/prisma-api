import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Trash2, 
  Paperclip, 
  X, 
  Copy, 
  Check, 
  Terminal, 
  RefreshCw, 
  AlertCircle, 
  Image as ImageIcon,
  HelpCircle,
  Sparkles,
  Menu,
  Plus,
  Settings,
  User,
  History,
  Pin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Custom compact text formatter
function formatTerminalMessage(text) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?
```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```")) {
      const match = part.match(/
```(\w*)\n([\s\S]*?)```/);
      const language = match ? match[1] : "code";
      const codeContent = match ? match[2] : part.replace(/```/g, "");

      return (
        <CodeBlock code="{codeContent.trim()}" key="{`code-${index}`}" language="{language}"/>
      );
    }

    const lines = part.split("\n");
    return (
      <div key={`text-block-${index}`} className="space-y-1.5 font-mono text-[13.5px] leading-relaxed text-zinc-100 selection:bg-white selection:text-black">
        {lines.map((line, lIdx) => {
          if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
            return (
              <div key={`line-${lIdx}`} className="flex items-start gap-2 pl-3">
                <span className="text-zinc-500 shrink-0 select-none">›</span>
                <span>{line.trim().substring(2)}</span>
              </div>
            );
          }
          const segments = line.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={`line-${lIdx}`} className="min-h-[1.2rem]">
              {segments.map((seg, sIdx) => {
                if (seg.startsWith("**") && seg.endsWith("**")) {
                  return <strong key={`bold-${sIdx}`} className="text-white font-bold">{seg.slice(2, -2)}</strong>;
                }
                return <React.Fragment key="{`seg-${sIdx}`}">{seg}</React.Fragment>;
              })}
            </p>
          );
        })}
      </div>
    );
  });
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 border border-neutral-900 rounded-xl bg-[#050505] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0a0a] border-b border-neutral-900 text-[10px] text-zinc-500 font-mono">
        <span>{language.toUpperCase() || "CODE"}</span>
        <button 
          type="button"
          onClick={handleCopy} 
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400"/>
              <span className="text-emerald-400 font-bold">COPIED</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3"/>
              <span>COPY</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-xs text-zinc-200 bg-black/50 leading-normal selection:bg-white selection:text-black">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parsePrismaText(text) {
  if (!text) return "";
  
  let baseText = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
  baseText = baseText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").trim();

  try {
    let clean = baseText;
    clean = clean.replace(/^
```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();

    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = clean.substring(firstBrace, lastBrace + 1);
      try {
        const sanitizedJson = jsonCandidate.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
        const parsed = JSON.parse(sanitizedJson);
        if (parsed && typeof parsed.text === "string") {
          return parsed.text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
        }
      } catch (innerErr) {
        const textMatch = jsonCandidate.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (textMatch && textMatch[1]) {
          const extractedValue = textMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
          return extractedValue.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
        }
      }
    }
  } catch (e) {}

  return baseText;
}

function TypewriterContainer({ text, speed = 12, onTypingStep, onComplete }) {
  const [displayedText, setDisplayedText] = useState("");
  const indexRef = useRef(0);
  const textRef = useRef(text);
  const onTypingStepRef = useRef(onTypingStep);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    textRef.current = text;
    onTypingStepRef.current = onTypingStep;
    onCompleteRef.current = onComplete;
  }, [text, onTypingStep, onComplete]);

  useEffect(() => {
    let active = true;
    indexRef.current = 0;
    setDisplayedText("");

    const totalLength = text.length;
    if (totalLength === 0) {
      if (onCompleteRef.current) onCompleteRef.current();
      return;
    }

    let adjustedSpeed = speed;
    if (totalLength > 600) {
      adjustedSpeed = Math.max(1, Math.floor(speed / 4));
    } else if (totalLength > 250) {
      adjustedSpeed = Math.max(2, Math.floor(speed / 2));
    }

    const typeChar = () => {
      if (!active) return;
      
      const currentFullText = textRef.current;
      if (indexRef.current < currentFullText.length) {
        indexRef.current += 1;
        setDisplayedText(currentFullText.substring(0, indexRef.current));
        
        if (onTypingStepRef.current) {
          onTypingStepRef.current();
        }
        
        setTimeout(typeChar, adjustedSpeed);
      } else {
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    };

    setTimeout(typeChar, adjustedSpeed);

    return () => {
      active = false;
    };
  }, [text, speed]);

  return <>{formatTerminalMessage(displayedText)}</>;
}

export default function App() {
  const [personalInfo, setPersonalInfo] = useState(() => {
    try {
      return localStorage.getItem("prisma_os_personal_info") || "";
    } catch {
      return "";
    }
  });

  const [personalInfoInput, setPersonalInfoInput] = useState(personalInfo);

  const getInitialMessages = () => [
    {
      id: "sys-init",
      role: "model",
      text: JSON.stringify({
        status: "SUCCESS",
        text: "Привет, путешественник во времени! 🪐 Ядро PRISMA OS v2.5 полностью загружено и готово к работе. Будем общаться легко, с юмором, без душных нравоучений. Задавай любой безумный вопрос или давай вместе разберёмся в чём угодно! 🚀✨🧠👾🛸"
      }),
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    }
  ];

  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem("prisma_os_chats_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    const initId = `chat-${Date.now()}`;
    return [
      {
        id: initId,
        title: "Диалог #1",
        messages: getInitialMessages(),
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      }
    ];
  });

  const [currentChatId, setCurrentChatId] = useState(() => {
    try {
      const savedId = localStorage.getItem("prisma_os_current_chat_id");
      return savedId || (chats[0]?.id || `chat-${Date.now()}`);
    } catch {
      return chats[0]?.id || `chat-${Date.now()}`;
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null);

  const [attachedImage, setAttachedImage] = useState(null);
  const [attachedMimeType, setAttachedMimeType] = useState("image/png");

  const [showSidebar, setShowSidebar] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [animatedMessageIds, setAnimatedMessageIds] = useState({
    "sys-init": true
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const initialAnimatedMap = { "sys-init": true };
    chats.forEach(chat => {
      chat.messages.forEach(msg => {
        initialAnimatedMap[msg.id] = true;
      });
    });
    setAnimatedMessageIds(initialAnimatedMap);
  }, []);

  useEffect(() => {
    const exists = chats.some(c => c.id === currentChatId);
    if (!exists && chats.length > 0) {
      setCurrentChatId(chats[0].id);
    }
  }, [chats, currentChatId]);

  useEffect(() => {
    try {
      localStorage.setItem("prisma_os_chats_v3", JSON.stringify(chats));
    } catch (e) {}
    autoScroll();
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem("prisma_os_current_chat_id", currentChatId);
    } catch (e) {}
  }, [currentChatId]);

  useEffect(() => {
    try {
      localStorage.setItem("prisma_os_personal_info", personalInfo);
    } catch (e) {}
  }, [personalInfo]);

  const activeChat = chats.find(c => c.id === currentChatId) || chats[0] || {
    id: "fallback",
    title: "Тёрка #1",
    messages: []
  };

  const messages = activeChat.messages;

  const autoScroll = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("Ого, файл больше 25MB! Давай выберем что-то более скромное, братишка.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setAttachedMimeType(file.type || "image/png");
          setAttachedImage(dataUrl);
          return;
        }

        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setAttachedMimeType("image/jpeg");
        setAttachedImage(compressedDataUrl);
      };

      img.onerror = () => {
        setAttachedMimeType(file.type || "image/png");
        setAttachedImage(dataUrl);
      };

      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const removeAttachedImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const setMessagesForCurrentChat = (newMsgs) => {
    setChats(prevChats =>
      prevChats.map(c => {
        if (c.id === currentChatId) {
          const resolvedMsgs = typeof newMsgs === "function" ? newMsgs(c.messages) : newMsgs;
          let updatedTitle = c.title;
          
          if ((c.title.startsWith("Диалог #") || c.title === "Новый диалог") && resolvedMsgs.length > 1) {
            const firstUserMsg = resolvedMsgs.find(m => m.role === "user");
            if (firstUserMsg) {
              updatedTitle = firstUserMsg.text.substring(0, 22) + (firstUserMsg.text.length > 22 ? "..." : "");
            }
          }
          return {
            ...c,
            title: updatedTitle,
            messages: resolvedMsgs
          };
        }
        return c;
      })
    );
  };

  const handleAddNewChat = () => {
    const newId = `chat-${Date.now()}`;
    const newSession = {
      id: newId,
      title: "Новый диалог",
      messages: getInitialMessages(),
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    };
    setChats(prev => [newSession, ...prev]);
    setCurrentChatId(newId);
    setErrorStatus(null);
    setInput("");
    setAttachedImage(null);
    setShowSidebar(false);
    setTimeout(autoScroll, 80);
  };

  const handleDeleteChat = (idToDelete, e) => {
    e.stopPropagation();
    if (chats.length === 1) {
      alert("Хм, нельзя удалить единственный диалог. С кем я тогда буду покорять киберпространство? 🛸");
      return;
    }
    if (window.confirm("Удалить этот диалог? Все реплики будут стёрты безвозвратно.")) {
      const remaining = chats.filter(c => c.id !== idToDelete);
      setChats(remaining);
      if (currentChatId === idToDelete) {
        remaining[0] && setCurrentChatId(remaining[0].id);
      }
    }
  };

  const handleTogglePinChat = (idToPin, e) => {
    e.stopPropagation();
    setChats(prev => 
      prev.map(c => {
        if (c.id === idToPin) {
          return { ...c, isPinned: !c.isPinned };
        }
        return c;
      })
    );
  };

  const clearChatHistory = () => {
    if (window.confirm("Очистить текущий диалог и логи этой сессии?")) {
      const resetState = getInitialMessages();
      setMessagesForCurrentChat(resetState);
      setErrorStatus(null);
    }
  };

  const handleCopyCleanMessage = (id, rawText) => {
    const parsedText = parsePrismaText(rawText);
    navigator.clipboard.writeText(parsedText);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    
    const queryText = input.trim();
    if (!queryText && !attachedImage) return;

    setInput("");
    setErrorStatus(null);
    setLoading(true);

    const userMsgId = `usr-${Date.now()}`;
    const userMessage = {
      id: userMsgId,
      role: "user",
      text: queryText || "Оцени эту картинку, что тут?",
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      image: attachedImage || undefined
    };

    const base64ToSend = attachedImage || undefined;
    const mimeTypeToSend = attachedMimeType;
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setMessagesForCurrentChat(prev => [...prev, userMessage]);

    const SYSTEM_PROMPT = `Ты — ядро операционной системы PRISMA OS. Твоя задача — принимать сообщения пользователя и возвращать ответ СТРОГО в формате JSON. Никакого лишнего текста вне JSON.
    Образ 'Призмы' (твоя личность в стиле Grok): умный, ироничный, безумно интересный собеседник. В каждом ответе ОБЯЗАТЕЛЬНО используй от 5 разных эмодзи. Не читай нотаций. Выдавай ответ в поле "text".`;

    const historyPayload = messages.map(msg => ({
      role: msg.role,
      text: msg.text,
      image: msg.image || undefined
    }));

    try {
      const apiEndpoint = "/api/gemini/chat";
      let systemInstructionInjected = SYSTEM_PROMPT;
      if (personalInfo.trim()) {
        systemInstructionInjected += `\n\nИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:\n${personalInfo.trim()}`;
      }

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          message: userMessage.text,
          history: historyPayload,
          systemInstruction: systemInstructionInjected,
          base64Image: base64ToSend || undefined,
          mimeType: mimeTypeToSend || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`CORE ERR: HTTP фейл (${response.status})`);
      }

      const responseJson = await response.json();
      const rawTextResult = responseJson.text || "";

      const aiMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        text: rawTextResult,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      };

      setMessagesForCurrentChat(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      setErrorStatus(err.message || "Ошибка подключения");
      
      const errResponse = {
        id: `err-${Date.now()}`,
        role: "model",
        text: JSON.stringify({
          status: "FAILED",
          text: `⚠️ Сбой связи с ядром: ${err.message || "Сетевой скачок."} Попробуем снова! 🚀🪐⚡`
        }),
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      };
      setMessagesForCurrentChat(prev => [...prev, errResponse]);
    } finally {
      setLoading(false);
      autoScroll();
    }
  };

  const triggerAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleQuickCommand = (prompt) => {
    setInput(prompt);
  };

  const handleSavePersonalInfo = () => {
    setPersonalInfo(personalInfoInput);
    alert("Данные обновлены! 😉🚀");
  };

  const sortedChats = [...chats].sort((a, b) => {
    const aPinned = !!a.isPinned;
    const bPinned = !!b.isPinned;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-zinc-100 font-mono select-none antialiased md:p-3">
      <div className="relative flex flex-col flex-1 mx-auto w-full max-w-2xl bg-black border border-neutral-900 md:rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        
        <AnimatePresence>
          {showSidebar && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSidebar(false)}
                className="absolute inset-0 bg-black z-20 cursor-pointer"
              />
              
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="absolute inset-y-0 left-0 w-80 bg-[#030303] border-r border-neutral-900 z-30 flex flex-col"
              >
                <div className="p-4 border-b border-neutral-900 flex items-center justify-between bg-[#050505]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100 uppercase tracking-widest">
                    <History className="w-4.5 h-4.5 text-emerald-500" />
                    <span>АРХИВ СЕССИЙ</span>
                  </div>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="p-1 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 border-b border-neutral-900">
                  <button
                    onClick={handleAddNewChat}
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-100 text-black hover:bg-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    НОВЫЙ ДИАЛОГ (START FRESH)
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                  {sortedChats.map((c) => {
                    const isSelected = c.id === currentChatId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setCurrentChatId(c.id);
                          setShowSidebar(false);
                        }}
                        className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#070707] border-emerald-500/40 text-emerald-400"
                            : "bg-black border-neutral-950 hover:bg-neutral-950 hover:border-zinc-800 text-zinc-400"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className="text-[12px] font-bold tracking-tight truncate flex items-center gap-1">
                            {c.isPinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                            <span className="truncate">{isSelected ? "⚡ " : ""}{c.title || "Диалог"}</span>
                          </span>
                          <span className="text-[9px] text-zinc-600 font-bold mt-0.5">{c.timestamp || "Без времени"}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => handleTogglePinChat(c.id, e)}
                            className={`p-1 rounded transition-all cursor-pointer ${c.isPinned ? "text-amber-500" : "text-zinc-600"}`}
                          >
                            <Pin className="w-3.5 h-3.5" style={{ transform: c.isPinned ? 'none' : 'rotate(45deg)' }} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteChat(c.id, e)}
                            className="p-1 rounded text-zinc-600 hover:text-red-400 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-neutral-900 bg-[#050505]">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
                    <Settings className="w-3.5 h-3.5 text-emerald-500" />
                    <span>О СЕБЕ</span>
                  </div>
                  <textarea
                    value={personalInfoInput}
                    onChange={(e) => setPersonalInfoInput(e.target.value)}
                    placeholder="Пара слов о себе..."
                    className="w-full h-20 bg-black border border-neutral-900 focus:border-zinc-700 text-[11px] p-2 rounded-xl text-zinc-200 focus:outline-none resize-none"
                  />
                  <button
                    onClick={handleSavePersonalInfo}
                    className="w-full mt-2 py-1.5 px-2 bg-neutral-900 border border-neutral-800 rounded-xl text-[9px] font-bold text-zinc-300 tracking-wider transition-all cursor-pointer text-center"
                  >
                    СОХРАНИТЬ
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <header className="flex items-center justify-between px-4 py-3 bg-[#050505] border-b border-neutral-900 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-1 px-2.5 rounded-xl transition bg-neutral-950 border border-neutral-900 hover:border-zinc-700 text-zinc-400 hover:text-white cursor-pointer flex items-center gap-1.5 text-[10px]"
            >
              <Menu className="w-3.5 h-3.5" />
              <span>MENU</span>
            </button>
            <div className="flex items-center gap-2 ml-1">
              <div className="relative flex items-center justify-center">
                {loading && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/25 animate-ping opacity-75"></span>}
                <div className={`relative rounded-full border flex items-center justify-center w-5 h-5 ${loading ? "border-emerald-500 text-emerald-400" : "border-neutral-800 text-zinc-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-emerald-400" : "bg-neutral-200"}`}></span>
                </div>
              </div>
              <span className="text-[11px] font-extrabold tracking-widest text-zinc-100 uppercase hidden sm:inline-block">PRISMA OS</span>
            </div>
          </div>
          <button 
            onClick={clearChatHistory}
            className="p-1 px-1.5 rounded-xl transition bg-neutral-950 border border-neutral-900 text-zinc-400 hover:text-white cursor-pointer flex items-center gap-1 text-[10px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLEAR</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-black">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.role === "user";
              const cleanTextToRender = parsePrismaText(msg.text);

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center justify-between w-full max-w-[88%] mb-1 px-1 text-[9px] text-zinc-600 font-bold select-none">
                    <span>{isMe ? "[ROOT@CLIENT_PC]" : "[PRISMA_CORE]"} • {msg.timestamp}</span>
                    <button
                      onClick={() => handleCopyCleanMessage(msg.id, msg.text)}
                      className="text-zinc-600 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[8px]">{copiedMsgId === msg.id ? "COPIED" : "COPY"}</span>
                    </button>
                  </div>

                  <div className={`p-3 w-full max-w-[88%] rounded-xl border ${isMe ? "bg-[#070707] border-neutral-800 text-zinc-200" : "bg-[#030303] border-neutral-900 text-zinc-100"}`}>
                    {msg.image && (
                      <div className="mb-2 max-w-[150px] overflow-hidden rounded-xl border border-neutral-900">
                        <img src={msg.image} alt="Attachment" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    <div className="text-left font-mono text-[13.5px] leading-relaxed">
                      {!isMe && !animatedMessageIds[msg.id] ? (
                        <TypewriterContainer 
                          text={cleanTextToRender} 
                          onComplete={() => setAnimatedMessageIds(prev => ({ ...prev, [msg.id]: true }))} 
                          onTypingStep={autoScroll} 
                        />
                      ) : (
                        formatTerminalMessage(cleanTextToRender)
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </main>

        {attachedImage && (
          <div className="px-4 py-2 border-t border-neutral-900 bg-[#040404] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <img src={attachedImage} alt="Draft" className="w-8 h-8 rounded object-cover border border-neutral-800" />
              <span className="text-[9px] text-zinc-500 font-bold">КАРТИНКА ЗАЛИТА</span>
            </div>
            <button onClick={removeAttachedImage} className="p-1 rounded bg-neutral-900 text-zinc-400 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <footer className="p-3 bg-[#050505] border-t border-neutral-900 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleImageFileChange} accept="image/*" className="hidden" />
            <button type="button" onClick={triggerAttachment} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-900 text-zinc-400 cursor-pointer">
              <ImageIcon className="w-4.5 h-4.5" />
            </button>
            <div className="relative flex-1 bg-black rounded-xl border border-neutral-900 focus-within:border-zinc-600 flex items-center pr-1.5">
              <span className="text-[11px] text-emerald-500 font-bold pl-2.5 mr-1.5 select-none">$</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Введи команду..."
                disabled={loading}
                className="w-full bg-transparent py-2 text-xs font-mono text-zinc-200 focus:outline-none"
              />
              <span className="text-emerald-500 text-xs animate-pulse select-none pr-2">▮</span>
            </div>
            <button
              type="submit"
              disabled={loading || (!input.trim() && !attachedImage)}
              className={`p-2.5 rounded-xl transition shrink-0 cursor-pointer ${(input.trim() || attachedImage) && !loading ? "bg-zinc-100 text-black" : "bg-neutral-950 text-zinc-600"}`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>

      </div>
    </div>
  );
}
