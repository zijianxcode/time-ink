"use client";

import { useEffect, useRef, useCallback } from "react";

// ========== 类型定义 ==========

/** 笔迹上的一个采样点 */
interface StrokePoint {
  x: number;
  y: number;
  width: number;     // 该点的笔画宽度
  opacity: number;   // 该点的透明度
  time: number;      // 采样时间
}

/** 一条连续的笔迹（从 mousedown/enter 到 mouseup/leave） */
interface Stroke {
  points: StrokePoint[];
  birthTime: number;  // 最后一个点的生成时间，用于计算整条线的消散
  alive: boolean;
}

/** 墨团（点击产生） */
interface InkBlot {
  x: number;
  y: number;
  layers: InkLayer[];
  birthTime: number;
  maxRadius: number;
  spread: number;
}

interface InkLayer {
  offsetX: number;
  offsetY: number;
  radiusScale: number;
  opacity: number;
  wobble: number[];
}

// ========== 常量 ==========

const FADE_DURATION = 3000;
const SPREAD_DURATION = 800;
const DPR = () => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

// 笔迹参数
const TRAIL_WIDTH_MIN = 2;
const TRAIL_WIDTH_MAX = 14;
const TRAIL_OPACITY = 0.55;
// 鼠标移动时自动生成的轨迹
const AUTO_TRAIL_WIDTH_MIN = 1.5;
const AUTO_TRAIL_WIDTH_MAX = 8;
const AUTO_TRAIL_OPACITY = 0.3;

// ========== 工具函数 ==========

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function generateWobble(n: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < n; i++) arr.push(0.7 + Math.random() * 0.6);
  return arr;
}

function createInkBlot(x: number, y: number, size: "small" | "medium" | "large"): InkBlot {
  const sizeMap = { small: [20, 45], medium: [40, 80], large: [70, 140] };
  const [minR, maxR] = sizeMap[size];
  const maxRadius = randomRange(minR, maxR);
  const layerCount = Math.floor(randomRange(3, 6));
  const layers: InkLayer[] = [];
  for (let i = 0; i < layerCount; i++) {
    layers.push({
      offsetX: randomRange(-maxRadius * 0.3, maxRadius * 0.3),
      offsetY: randomRange(-maxRadius * 0.3, maxRadius * 0.3),
      radiusScale: randomRange(0.4, 1.0),
      opacity: randomRange(0.08, 0.35),
      wobble: generateWobble(12),
    });
  }
  return { x, y, layers, birthTime: performance.now(), maxRadius, spread: 0 };
}

/** 绘制不规则墨团层 */
function drawInkLayer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number, opacity: number,
  wobble: number[], globalAlpha: number
) {
  if (radius < 1 || opacity < 0.001 || globalAlpha < 0.001) return;
  ctx.save();
  ctx.globalAlpha = opacity * globalAlpha;
  const n = wobble.length;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const angle = (Math.PI * 2 * (i % n)) / n;
    const w = wobble[i % n];
    const r = radius * w;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) { ctx.moveTo(px, py); continue; }
    const prevAngle = (Math.PI * 2 * ((i - 1) % n)) / n;
    const midAngle = (prevAngle + angle) / 2;
    const midW = (wobble[(i - 1) % n] + w) / 2;
    ctx.quadraticCurveTo(
      cx + Math.cos(midAngle) * radius * midW * 1.05,
      cy + Math.sin(midAngle) * radius * midW * 1.05,
      px, py
    );
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.2);
  g.addColorStop(0, "rgba(30,30,30,1)");
  g.addColorStop(0.3, "rgba(50,50,50,0.8)");
  g.addColorStop(0.6, "rgba(80,80,80,0.4)");
  g.addColorStop(1, "rgba(120,120,120,0)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/**
 * 通过一组点绘制流畅的变宽笔迹
 * 使用二次贝塞尔曲线连接中点 -> 非常平滑
 */
function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  fadeAlpha: number
) {
  if (points.length < 2 || fadeAlpha < 0.001) return;

  // 多层渲染：外层宽+半透明(墨渗透), 中层, 内层窄+不透明(笔芯)
  const passes = [
    { widthMul: 3.0, opacityMul: 0.08 },  // 最外层渗透
    { widthMul: 1.8, opacityMul: 0.15 },  // 中层
    { widthMul: 1.0, opacityMul: 0.6 },   // 笔芯
  ];

  for (const pass of passes) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 对每一对相邻的段，用二次贝塞尔曲线连接中点
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];

      const w = ((p0.width + p1.width) / 2) * pass.widthMul;
      const o = ((p0.opacity + p1.opacity) / 2) * pass.opacityMul * fadeAlpha;

      if (o < 0.002) continue;

      ctx.globalAlpha = o;
      ctx.strokeStyle = "rgba(25, 25, 25, 1)";
      ctx.lineWidth = w;

      ctx.beginPath();

      if (i === 0) {
        // 第一段：直接画
        ctx.moveTo(p0.x, p0.y);
        if (points.length === 2) {
          ctx.lineTo(p1.x, p1.y);
        } else {
          // 到 p0 和 p1 的中点
          ctx.lineTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
        }
      } else if (i === points.length - 2) {
        // 最后一段
        const prevMidX = (points[i - 1].x + p0.x) / 2;
        const prevMidY = (points[i - 1].y + p0.y) / 2;
        ctx.moveTo(prevMidX, prevMidY);
        ctx.quadraticCurveTo(p0.x, p0.y, p1.x, p1.y);
      } else {
        // 中间段：中点 -> 控制点(当前点) -> 下一个中点
        const prevMidX = (points[i - 1].x + p0.x) / 2;
        const prevMidY = (points[i - 1].y + p0.y) / 2;
        const nextMidX = (p0.x + p1.x) / 2;
        const nextMidY = (p0.y + p1.y) / 2;
        ctx.moveTo(prevMidX, prevMidY);
        ctx.quadraticCurveTo(p0.x, p0.y, nextMidX, nextMidY);
      }

      ctx.stroke();
    }

    ctx.restore();
  }
}

// ========== 组件 ==========

export default function InkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blotsRef = useRef<InkBlot[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const rafRef = useRef<number>(0);

  // 当前正在绘制的笔迹
  const activeStrokeRef = useRef<Stroke | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTimeRef = useRef<number>(0);
  // 是否正在按住鼠标（左键或右键）
  const isMouseDownRef = useRef(false);
  // 鼠标是否在区域内
  const isInsideRef = useRef(false);

  const getCanvasPos = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = DPR();
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  }, []);

  /** 结束当前笔迹 */
  const finishStroke = useCallback(() => {
    const stroke = activeStrokeRef.current;
    if (stroke && stroke.points.length >= 2) {
      stroke.birthTime = performance.now();
      stroke.alive = true;
      strokesRef.current.push(stroke);
    }
    activeStrokeRef.current = null;
    lastPosRef.current = null;
  }, []);

  /** 开始一条新笔迹 */
  const beginStroke = useCallback((x: number, y: number, pressed: boolean) => {
    // 先结束上一条
    finishStroke();

    const widthMin = pressed ? TRAIL_WIDTH_MIN : AUTO_TRAIL_WIDTH_MIN;
    const widthMax = pressed ? TRAIL_WIDTH_MAX : AUTO_TRAIL_WIDTH_MAX;
    const opacity = pressed ? TRAIL_OPACITY : AUTO_TRAIL_OPACITY;
    const dpr = DPR();

    activeStrokeRef.current = {
      points: [{
        x, y,
        width: ((widthMin + widthMax) / 2) * dpr,
        opacity,
        time: performance.now(),
      }],
      birthTime: performance.now(),
      alive: true,
    };
    lastPosRef.current = { x, y };
    lastTimeRef.current = performance.now();
  }, [finishStroke]);

  /** 向当前笔迹添加采样点 */
  const addPoint = useCallback((x: number, y: number, pressed: boolean) => {
    const stroke = activeStrokeRef.current;
    if (!stroke) {
      beginStroke(x, y, pressed);
      return;
    }

    const last = lastPosRef.current;
    if (!last) { lastPosRef.current = { x, y }; return; }

    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 最小采样距离（太密会不平滑，太稀会有折线感）
    const minDist = pressed ? 2 : 3;
    if (dist < minDist) return;

    const dpr = DPR();
    const widthMin = pressed ? TRAIL_WIDTH_MIN : AUTO_TRAIL_WIDTH_MIN;
    const widthMax = pressed ? TRAIL_WIDTH_MAX : AUTO_TRAIL_WIDTH_MAX;
    const opacity = pressed ? TRAIL_OPACITY : AUTO_TRAIL_OPACITY;

    // 速度 -> 笔宽：速度越快越细，速度越慢越粗
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    const speed = dt > 0 ? dist / dt : 0; // px/ms
    // speed 大概范围 0~2+
    const speedFactor = Math.max(0, Math.min(1, 1 - speed / 1.5));
    const width = (widthMin + speedFactor * (widthMax - widthMin)) * dpr;

    stroke.points.push({ x, y, width, opacity, time: now });

    // 限制单条笔迹的点数，避免内存膨胀
    if (stroke.points.length > 500) {
      // 存档前半段，开始新笔迹
      const saved: Stroke = {
        points: stroke.points.slice(0, 400),
        birthTime: now,
        alive: true,
      };
      strokesRef.current.push(saved);
      // 保留后半段作为当前笔迹（有重叠保证连续性）
      stroke.points = stroke.points.slice(395);
    }

    lastPosRef.current = { x, y };
    lastTimeRef.current = now;
  }, [beginStroke]);

  // ---- 主渲染循环 ----
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ---- 绘制墨团 ----
    const aliveBlots: InkBlot[] = [];
    for (const blot of blotsRef.current) {
      const age = now - blot.birthTime;
      if (age > SPREAD_DURATION + FADE_DURATION) continue;

      const spreadT = Math.min(age / SPREAD_DURATION, 1);
      blot.spread = 1 - Math.pow(1 - spreadT, 3);

      let fadeAlpha = 1;
      if (age > SPREAD_DURATION) {
        fadeAlpha = Math.max(0, 1 - (age - SPREAD_DURATION) / FADE_DURATION);
      }

      for (const layer of blot.layers) {
        const r = blot.maxRadius * layer.radiusScale * blot.spread;
        drawInkLayer(
          ctx,
          blot.x + layer.offsetX * blot.spread,
          blot.y + layer.offsetY * blot.spread,
          r, layer.opacity, layer.wobble, fadeAlpha
        );
      }
      aliveBlots.push(blot);
    }
    blotsRef.current = aliveBlots;

    // ---- 绘制已完成的笔迹 ----
    const aliveStrokes: Stroke[] = [];
    for (const stroke of strokesRef.current) {
      const age = now - stroke.birthTime;
      if (age > FADE_DURATION) continue;

      const fadeAlpha = Math.max(0, 1 - age / FADE_DURATION);
      drawSmoothStroke(ctx, stroke.points, fadeAlpha);
      aliveStrokes.push(stroke);
    }
    strokesRef.current = aliveStrokes;

    // ---- 绘制当前活跃笔迹 ----
    const active = activeStrokeRef.current;
    if (active && active.points.length >= 2) {
      drawSmoothStroke(ctx, active.points, 1);
    }

    // 判断是否需要继续渲染
    const hasContent =
      blotsRef.current.length > 0 ||
      strokesRef.current.length > 0 ||
      (activeStrokeRef.current && activeStrokeRef.current.points.length > 0);

    if (hasContent) {
      rafRef.current = requestAnimationFrame(render);
    } else {
      rafRef.current = 0;
    }
  }, []);

  const ensureRendering = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(render);
    }
  }, [render]);

  // Canvas 尺寸调整
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = DPR();
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = parent.clientWidth + "px";
      canvas.style.height = parent.clientHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // 鼠标事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const isInteractive = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (["button", "select", "option", "input", "a", "label"].includes(tag)) return true;
      if (target.closest("button, select, a, .startBtn, .durationSelect")) return true;
      return false;
    };

    // ---- 鼠标移动（始终追踪，留下轨迹） ----
    const handleMouseMove = (e: MouseEvent) => {
      const pos = getCanvasPos(e);
      const pressed = isMouseDownRef.current;

      if (!isInsideRef.current) {
        isInsideRef.current = true;
        beginStroke(pos.x, pos.y, pressed);
        ensureRendering();
        return;
      }

      addPoint(pos.x, pos.y, pressed);
      ensureRendering();
    };

    // ---- 鼠标进入 ----
    const handleMouseEnter = (e: MouseEvent) => {
      isInsideRef.current = true;
      const pos = getCanvasPos(e);
      beginStroke(pos.x, pos.y, isMouseDownRef.current);
      ensureRendering();
    };

    // ---- 鼠标离开 ----
    const handleMouseLeave = () => {
      isInsideRef.current = false;
      finishStroke();
      ensureRendering();
    };

    // ---- 鼠标按下 ----
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        if (e.button === 2) e.preventDefault();
        isMouseDownRef.current = true;
        // 结束当前轨迹，开始一条新的（按压状态的，更粗）
        const pos = getCanvasPos(e);
        beginStroke(pos.x, pos.y, true);
        ensureRendering();
      }
    };

    // ---- 鼠标抬起 ----
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isMouseDownRef.current = false;
        // 结束粗笔迹，开始新的轻轨迹
        const pos = getCanvasPos(e);
        finishStroke();
        if (isInsideRef.current) {
          beginStroke(pos.x, pos.y, false);
        }
        ensureRendering();
      }
    };

    // ---- 左键点击空白处 => 墨团 ----
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (isInteractive(e.target)) return;

      const pos = getCanvasPos(e);
      const sizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
      blotsRef.current.push(createInkBlot(pos.x, pos.y, sizes[Math.floor(Math.random() * 3)]));

      const splashCount = Math.floor(randomRange(1, 4));
      const dpr = DPR();
      for (let i = 0; i < splashCount; i++) {
        const dist = randomRange(30, 100) * dpr;
        const angle = Math.random() * Math.PI * 2;
        blotsRef.current.push(
          createInkBlot(pos.x + Math.cos(angle) * dist, pos.y + Math.sin(angle) * dist, "small")
        );
      }
      ensureRendering();
    };

    const handleContextMenu = (e: Event) => e.preventDefault();

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("click", handleClick);
    container.addEventListener("contextmenu", handleContextMenu);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [getCanvasPos, ensureRendering, beginStroke, finishStroke, addPoint]);

  // 清理
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="inkCanvas" />;
}
