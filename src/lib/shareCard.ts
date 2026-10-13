// Renders your top 5 as a 1080×1350 manga page (Instagram portrait) on a canvas.
import type { Show } from './derive';
import { art, fmtScore, title } from './format';

const W = 1080, H = 1350;
const PAPER = '#f2ede2', INK = '#111', RED = '#d7261e';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Cache-buster: the page already loaded these without CORS, and Chrome would reuse that
    // response, which taints the canvas.
    img.src = `${src}${src.includes('?') ? '&' : '?'}cors=1`;
  });
}

function halftone(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas');
  c.width = c.height = 7;
  const p = c.getContext('2d')!;
  p.fillStyle = 'rgba(0,0,0,.4)';
  p.beginPath();
  p.arc(3.5, 3.5, 1.5, 0, Math.PI * 2);
  p.fill();
  return ctx.createPattern(c, 'repeat');
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
  return text + '…';
}

function panel(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, rank: number, name: string, score: number | null) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(x + 10, y + 10, w, h); // hard drop shadow
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.filter = rank === 1 ? 'contrast(1.1)' : 'grayscale(1) contrast(1.3) brightness(1.05)';
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    ctx.filter = 'none';
    const pat = halftone(ctx);
    if (pat) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = rank === 1 ? 0.35 : 0.8;
      ctx.fillStyle = pat;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.strokeRect(x, y, w, h);

  // Narration box.
  const big = rank === 1;
  ctx.font = `400 ${big ? 40 : 28}px "Dela Gothic One"`;
  const label = fit(ctx, name, w - (big ? 260 : 170));
  const bw = Math.min(w - 36, ctx.measureText(label).width + (big ? 190 : 130));
  const bh = big ? 92 : 70;
  const bx = x + 18, by = y + h - bh - 18;
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx, by, bw, bh);
  ctx.lineWidth = 5;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = RED;
  ctx.font = `400 ${big ? 64 : 46}px "Dela Gothic One"`;
  ctx.fillText(String(rank), bx + 16, by + bh - (big ? 18 : 14));
  ctx.fillStyle = INK;
  ctx.font = `400 ${big ? 40 : 28}px "Dela Gothic One"`;
  ctx.fillText(label, bx + (big ? 80 : 58), by + (big ? 50 : 38));
  ctx.font = `900 ${big ? 22 : 17}px "Zen Kaku Gothic New"`;
  ctx.fillText(score != null ? `MY SCORE ${fmtScore(score)} / 10` : 'UNRATED', bx + (big ? 82 : 60), by + bh - (big ? 14 : 10));
}

export async function makeShareCard(shows: Show[], userName: string | null): Promise<Blob> {
  await Promise.all([
    document.fonts.load('400 40px "Dela Gothic One"'),
    document.fonts.load('900 20px "Zen Kaku Gothic New"'),
    document.fonts.load('700 30px "Kaisei Decol"'),
  ]).catch(() => {});

  const top = shows.slice(0, 5);
  const imgs = await Promise.all(top.map((s, i) => loadImage(i === 0 ? art(s.first) : s.first.coverImage.extraLarge)));

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Masthead
  ctx.fillStyle = INK;
  ctx.font = '400 120px "Dela Gothic One"';
  ctx.fillText('MIRU', 56, 168);
  const tagX = 56 + ctx.measureText('MIRU').width + 16;
  ctx.fillStyle = RED;
  ctx.fillRect(tagX, 54, 44, 124);
  ctx.fillStyle = '#fff';
  ctx.font = '700 26px "Kaisei Decol"';
  ctx.textAlign = 'center';
  ['見', 'る', '記', '録'].forEach((ch, i) => ctx.fillText(ch, tagX + 22, 82 + i * 29));
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.font = '400 46px "Dela Gothic One"';
  ctx.fillText('TOP 5', W - 56, 116);
  ctx.font = '900 24px "Zen Kaku Gothic New"';
  ctx.fillText(userName ? `${userName.toUpperCase()}'S ALL-TIME LIST` : 'MY ALL-TIME LIST', W - 56, 162);
  ctx.textAlign = 'left';
  ctx.fillRect(56, 196, W - 112, 6);
  ctx.fillRect(56, 210, W - 112, 2);

  const L = 56, R = W - 66, G = 30;
  const half = (R - L - G) / 2;
  const slots = [
    [L, 240, R - L, 440],
    [L, 710, half, 270], [L + half + G, 710, half, 270],
    [L, 1010, half, 270], [L + half + G, 1010, half, 270],
  ];
  top.forEach((s, i) => {
    const [x, y, w, h] = slots[i];
    panel(ctx, imgs[i], x, y, w, h, i + 1, title(s.first), s.avg);
  });

  ctx.fillStyle = INK;
  ctx.font = '900 18px "Zen Kaku Gothic New"';
  ctx.fillText('TRACKED WITH MIRU · DATA FROM ANILIST', L, H - 22);

  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'));
}
