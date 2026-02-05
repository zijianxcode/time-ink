"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DURATIONS = [3, 15, 30, 45] as const;

const QUOTES = [
  { text: "写作是思考的最佳方式。", author: "Stephen King" },
  { text: "第一稿的唯一目的是存在。", author: "Anne Lamott" },
  { text: "不要想，只管写。", author: "Ray Bradbury" },
  { text: "完美是优秀的敌人。", author: "Voltaire" },
  { text: "开始写，答案会自己浮现。", author: "E.L. Doctorow" },
];

function formatSec(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type Phase = "setup" | "writing" | "success" | "failed";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [durationMin, setDurationMin] = useState<number>(15);
  const [remainingSec, setRemainingSec] = useState<number>(15 * 60);
  const [text, setText] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  
  // 追踪停止输入后的秒数
  const [idleSec, setIdleSec] = useState(0);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const lastInputRef = useRef<number>(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false); // 追踪中文输入法组合状态
  const lastConfirmedTextRef = useRef(""); // 记录上次确认的文本

  const totalSec = durationMin * 60;

  // 计算模糊程度：5秒后开始，9秒时约50%模糊（最大6px）
  const blurAmount = hasStartedTyping && idleSec > 5 ? Math.min((idleSec - 5) * 1.5, 6) : 0;

  // 写作计时器
  useEffect(() => {
    if (phase !== "writing") return;

    const timer = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          setPhase("success");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  // 空闲检测计时器（只有开始输入后才触发）
  useEffect(() => {
    if (phase !== "writing" || !hasStartedTyping) return;

    const idleTimer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastInputRef.current) / 1000);
      setIdleSec(elapsed);

      // 9秒未输入 -> 失败
      if (elapsed >= 9) {
        setPhase("failed");
        setText("");
      }
    }, 100);

    return () => clearInterval(idleTimer);
  }, [phase, hasStartedTyping]);

  // 开始写作时自动聚焦
  useEffect(() => {
    if (phase === "writing" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // 如果正在使用中文输入法组合输入，允许所有变化
    if (isComposingRef.current) {
      setText(value);
      lastInputRef.current = Date.now();
      setIdleSec(0);
      return;
    }
    
    // 禁止删除：新内容长度必须 >= 上次确认的文本长度
    if (value.length < lastConfirmedTextRef.current.length) {
      // 恢复到上次确认的文本
      setText(lastConfirmedTextRef.current);
      return;
    }
    
    setText(value);
    lastConfirmedTextRef.current = value; // 更新确认的文本
    lastInputRef.current = Date.now();
    setIdleSec(0);
    
    // 开始输入后才触发失败机制
    if (value.length > 0 && !hasStartedTyping) {
      setHasStartedTyping(true);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    const value = e.currentTarget.value;
    
    // 组合结束后，检查是否是有效输入（长度增加或相等）
    if (value.length >= lastConfirmedTextRef.current.length) {
      lastConfirmedTextRef.current = value;
      setText(value);
      
      if (value.length > 0 && !hasStartedTyping) {
        setHasStartedTyping(true);
      }
    } else {
      // 如果组合结果导致长度减少（不应该发生），恢复
      setText(lastConfirmedTextRef.current);
    }
    
    lastInputRef.current = Date.now();
    setIdleSec(0);
  };

  const startWriting = () => {
    setRemainingSec(durationMin * 60);
    setText("");
    lastConfirmedTextRef.current = ""; // 重置确认的文本
    setIdleSec(0);
    setHasStartedTyping(false);
    lastInputRef.current = Date.now();
    setPhase("writing");
  };

  const restart = () => {
    setPhase("setup");
    setText("");
    setIdleSec(0);
    setHasStartedTyping(false);
  };

  const copyText = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  // 随机名言（在中断时固定一条）- 必须放在所有条件返回之前
  const randomQuote = useMemo(() => {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }, [phase]);

  // 是否显示边缘跳动
  const showPulse = hasStartedTyping && idleSec >= 5;

  // ========== 设置页面 ==========
  if (phase === "setup") {
    return (
      <main className="setupPage">
        <h1 className="setupTitle">Time Ink</h1>
        <p className="setupSubtitle">让时间带着你写下去</p>

        <div className="setupControls">
          <p className="durationPrompt">这次写作，你想用多久？</p>
          <select 
            className="durationSelect"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} 分钟</option>
            ))}
          </select>

          <button className="startBtn" onClick={startWriting} title="开始写作">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </button>
        </div>
      </main>
    );
  }

  // ========== 写作中断页面 ==========
  if (phase === "failed") {
    return (
      <main className="resultPage paused">
        <div className="resultContent">
          <div className="pauseIcon">○</div>
          <h1>写作中断了</h1>
          <div className="quoteBox">
            <p className="quoteText">"{randomQuote.text}"</p>
            <p className="quoteAuthor">— {randomQuote.author}</p>
          </div>
          <button className="restartBtn" onClick={restart}>
            重新开始
          </button>
        </div>
      </main>
    );
  }

  // ========== 写作成功页面 ==========
  if (phase === "success") {
    return (
      <main className="resultPage success">
        <div className="resultContent">
          <div className="successIcon">✓</div>
          <h1>写作完成！</h1>
          <p>你写了 {text.length} 个字符</p>
          
          <div className="savedTextBox">
            {text || "（无内容）"}
          </div>

          <div className="resultActions">
            <button className="copyBtn" onClick={copyText}>
              复制内容
            </button>
            <button className="restartBtn" onClick={restart}>
              再来一次
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ========== 沉浸式写作页面 ==========
  return (
    <main className={`writingPage ${darkMode ? "dark" : "light"}`}>
      {/* 顶部工具栏 */}
      <div className="writingHeader">
        <button 
          className="modeToggle"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? "切换到白天模式" : "切换到夜间模式"}
        >
          {darkMode ? "☀" : "☾"}
        </button>
        <div className="timerCorner">
          {formatSec(remainingSec)}
        </div>
      </div>

      {/* 写作区域 */}
      <div 
        className="writingArea"
        style={{ 
          filter: blurAmount > 0 ? `blur(${blurAmount}px)` : "none",
          transition: "filter 0.5s ease"
        }}
      >
        {/* 边缘提示条（在写作区域内，会一起被模糊） */}
        {showPulse && <div className="edgePulseLeft" />}
        {showPulse && <div className="edgePulseRight" />}
        
        <textarea
          ref={textareaRef}
          className="immersiveEditor"
          placeholder="开始写作..."
          value={text}
          onChange={handleTextChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          autoFocus
        />
      </div>

      {/* 温和的倒计时数字 */}
      {showPulse && (
        <div className="gentleOverlay">
          <div className="gentleText">
            {9 - idleSec}
          </div>
        </div>
      )}
    </main>
  );
}
