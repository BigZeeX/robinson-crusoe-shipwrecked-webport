import { assets } from './assetManager';
import { WorldMap, worldMap } from './map';
import { player } from './player';
import { Direction, Sprite } from './types';

// ─── Object rendering lookup ────────────────────────────────────────────────
// Each entry = [sheetIdx, spriteIdx] for drawing an object on the map.
// Derived from objects.json:
//   row2 >= 0  → draw from Sheet 7 (BS7, large decor/foliage/rocks)
//   row0 >= 0  → draw from Sheet 13 (BS13, pickable items / inventory icons)
//   both -1    → crafted/abstract object, no ground sprite
// Built once at module level so it is not recomputed every frame.
let _objSpriteCache: Array<[number, number] | null> | null = null;
function getObjSprite(objId: number): [number, number] | null {
  if (!_objSpriteCache) {
    _objSpriteCache = [];
    const defs = assets.objectsDef;
    for (let i = 0; i < defs.length; i++) {
      const o = defs[i];
      if (o.row2 >= 0) {
        _objSpriteCache.push([7, o.row2]);   // BS7 – large placed decor
      } else if (o.row0 >= 0) {
        const sheet13Count = assets.spriteAtlas?.sheets[13]?.length ?? 92;
        _objSpriteCache.push([13, Math.min(o.row0, sheet13Count - 1)]); // BS13 – pickable
      } else {
        _objSpriteCache.push(null);           // no ground sprite
      }
    }
  }
  return _objSpriteCache[objId] ?? null;
}

export class GameRenderer {
  public static readonly SCREEN_WIDTH = 240;
  public static readonly SCREEN_HEIGHT = 320;

  private ctx: CanvasRenderingContext2D;
  public cameraX: number = 0;
  public cameraY: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  updateCamera() {
    // Center camera on player
    const targetX = player.x - GameRenderer.SCREEN_WIDTH / 2;
    const targetY = player.y - GameRenderer.SCREEN_HEIGHT / 2;

    // Clamp camera within world bounds
    this.cameraX = Math.max(0, Math.min(WorldMap.WORLD_WIDTH - GameRenderer.SCREEN_WIDTH, targetX));
    this.cameraY = Math.max(0, Math.min(WorldMap.WORLD_HEIGHT - GameRenderer.SCREEN_HEIGHT, targetY));
  }

  clear() {
    this.ctx.fillStyle = '#104e7a'; // Deep ocean blue
    this.ctx.fillRect(0, 0, GameRenderer.SCREEN_WIDTH, GameRenderer.SCREEN_HEIGHT);
  }

  // Draw a sliced sprite from the sprite atlas
  drawSprite(sheetIdx: number, spriteIdx: number, destX: number, destY: number, flipX: boolean = false) {
    const sprite = assets.getSprite(sheetIdx, spriteIdx);
    if (!sprite) return;

    const img = assets.getImage(sprite.image);
    if (!img) return;

    const dx = Math.round(destX - sprite.ox);
    const dy = Math.round(destY - sprite.oy);

    if (flipX) {
      this.ctx.save();
      this.ctx.translate(dx + sprite.w, dy);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(img, sprite.sx, sprite.sy, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(img, sprite.sx, sprite.sy, sprite.w, sprite.h, dx, dy, sprite.w, sprite.h);
    }
  }

  // Render the visible 180x180 tilemap layers within viewport
  renderMap() {
    const startTx = Math.max(0, Math.floor(this.cameraX / WorldMap.TILE_SIZE));
    const endTx = Math.min(WorldMap.MAP_WIDTH - 1, Math.ceil((this.cameraX + GameRenderer.SCREEN_WIDTH) / WorldMap.TILE_SIZE));
    const startTy = Math.max(0, Math.floor(this.cameraY / WorldMap.TILE_SIZE));
    const endTy = Math.min(WorldMap.MAP_HEIGHT - 1, Math.ceil((this.cameraY + GameRenderer.SCREEN_HEIGHT) / WorldMap.TILE_SIZE));

    const full    = worldMap.full;
    const borders = worldMap.borders;
    const rocks   = worldMap.rocks;
    const decor   = worldMap.decor;
    const objects = worldMap.objects;

    // ── Verified sheet assignments (from sprites.json + .byt analysis) ──────
    // Sheet 1  (BS1)  16 sprites  → FULL terrain   (tile values 0–15)
    // Sheet 4  (BS4)  48 sprites  → BORDERS layer  (values 0–22, max=22 ✓)
    // Sheet 7  (BS7)  86 sprites  → DECOR layer    (values 0–69 ✓)
    //                             → ROCKS layer    (values 0–62 ✓, sheet4 only has 48!)
    // Sheet 11 (BS11) 9 sprites   → Water ripple overlay on tile 6
    // OBJECTS layer: sprite determined per-object from objects.json:
    //   row2 >= 0  → Sheet 7  (large placed decor/tree/rock sprite)
    //   row0 >= 0  → Sheet 13 (pickable item icon)
    //   both -1    → no ground sprite (crafted/abstract)
    const sheet1  = assets.spriteAtlas?.sheets[1]  ?? [];
    const sheet4  = assets.spriteAtlas?.sheets[4]  ?? [];
    const sheet7  = assets.spriteAtlas?.sheets[7]  ?? [];
    const sheet11 = assets.spriteAtlas?.sheets[11] ?? [];

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const idx = ty * WorldMap.MAP_WIDTH + tx;
        const screenX = tx * WorldMap.TILE_SIZE - this.cameraX;
        const screenY = ty * WorldMap.TILE_SIZE - this.cameraY;

        // ── 1. Base Terrain (BS1) ─────────────────────────────────────────
        if (full) {
          const tile = full[idx];
          if (tile < sheet1.length) {
            this.drawSprite(1, tile, screenX, screenY);
          }
          // Water ripple animation only on deep-ocean tile (value 6) — BS11
          if (tile === 6 && (tx + ty * 3) % 4 === 0) {
            const waveAnim = Math.floor(performance.now() / 350) % 3;
            const waveType = (tx ^ ty) % 3;
            const waveSprite = waveType * 3 + waveAnim;
            if (waveSprite < sheet11.length) {
              this.drawSprite(11, waveSprite, screenX, screenY);
            }
          }
        }

        // ── 2. Borders / Shoreline (BS4, 48 sprites, values 0–22) ────────
        if (borders) {
          const borderTile = borders[idx];
          if (borderTile > 0 && borderTile < sheet4.length) {
            this.drawSprite(4, borderTile, screenX, screenY);
          }
        }

        // ── 3. Decor / Trees (BS7, 86 sprites, values 0–69) ──────────────
        if (decor) {
          const decorTile = decor[idx];
          if (decorTile > 0 && decorTile < sheet7.length) {
            this.drawSprite(7, decorTile, screenX, screenY);
          }
        }

        // ── 4. Rocks / Obstacles (BS7, 86 sprites, values 0–62) ──────────
        //    NOTE: previously used BS4 (only 48 sprites) — indices 48–62 were missing!
        if (rocks) {
          const rockTile = rocks[idx];
          if (rockTile > 0 && rockTile < sheet7.length) {
            this.drawSprite(7, rockTile, screenX, screenY);
          }
        }

        // ── 5. Interactive Objects / Pickables ───────────────────────────
        // Sprite is NOT the object ID directly — looked up via objects.json:
        //   obj.row2 >= 0 → placed large decoration (BS7)
        //   obj.row0 >= 0 → pickable item on ground (BS13)
        if (objects) {
          const objId = objects[idx];
          if (objId > 0) {
            const entry = getObjSprite(objId);
            if (entry) {
              this.drawSprite(entry[0], entry[1], screenX, screenY);
            }
          }
        }
      }
    }
  }

  // Render Robinson character with direction and walking animation
  renderPlayer() {
    const screenX = player.x - this.cameraX;
    const screenY = player.y - this.cameraY;

    // Soft drop shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.beginPath();
    this.ctx.ellipse(screenX, screenY + 6, 6, 3, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Sprite frames for Robinson — BS3.png (sheet index 3) is the character spritesheet.
    // 20 total sprites: 4 directions × 5 frames each (idle + 4 walk steps)
    // [0–4]  = DOWN   (facing camera)
    // [5–9]  = UP     (facing away)
    // [10–14] = RIGHT  (side profile)
    // [15–19] = LEFT   (side profile, or reuse RIGHT + flipX)
    let spriteIdx = 0;
    let flipX = false;

    if (player.dir === 'DOWN') {
      const frames = [0, 1, 2, 3, 4];
      spriteIdx = frames[player.animFrame % frames.length];
    } else if (player.dir === 'UP') {
      const frames = [5, 6, 7, 8, 9];
      spriteIdx = frames[player.animFrame % frames.length];
    } else if (player.dir === 'RIGHT') {
      const frames = [15, 16, 17, 18, 19];
      spriteIdx = frames[player.animFrame % frames.length];
      flipX = false;
    } else if (player.dir === 'LEFT') {
      const frames = [10, 11, 12, 13, 14];
      spriteIdx = frames[player.animFrame % frames.length];
      flipX = false;
    }

    this.drawSprite(3, spriteIdx, screenX, screenY, flipX);
  }

  // Render top HUD survival meters & time
  renderHUD(dayCount: number, timeStr: string) {
    // Semi-transparent HUD header background
    this.ctx.fillStyle = 'rgba(16, 20, 26, 0.85)';
    this.ctx.fillRect(0, 0, GameRenderer.SCREEN_WIDTH, 24);
    this.ctx.strokeStyle = '#2d3846';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 24);
    this.ctx.lineTo(GameRenderer.SCREEN_WIDTH, 24);
    this.ctx.stroke();

    // Bars
    this.drawMeter(8, 6, 50, 5, player.health / 100, '#e63946', 'HP');
    this.drawMeter(68, 6, 50, 5, player.hunger / 100, '#f4a261', 'FOOD');
    this.drawMeter(128, 6, 50, 5, player.energy / 100, '#2a9d8f', 'ENG');

    // Time & Day label
    this.ctx.fillStyle = '#ffd166';
    this.ctx.font = 'bold 9px monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`D:${dayCount} ${timeStr}`, GameRenderer.SCREEN_WIDTH - 6, 15);
  }

  private drawMeter(x: number, y: number, w: number, h: number, pct: number, color: string, label: string) {
    this.ctx.fillStyle = '#0f1216';
    this.ctx.fillRect(x, y + 4, w, h);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y + 4, Math.max(0, Math.min(w, w * pct)), h);
    this.ctx.strokeStyle = '#394657';
    this.ctx.strokeRect(x, y + 4, w, h);

    this.ctx.fillStyle = '#b0c4de';
    this.ctx.font = '7px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(label, x, y + 2);
  }

  // Render interaction prompt at bottom
  renderPrompt(text: string) {
    this.ctx.fillStyle = 'rgba(12, 16, 22, 0.9)';
    this.ctx.fillRect(16, GameRenderer.SCREEN_HEIGHT - 38, GameRenderer.SCREEN_WIDTH - 32, 26);
    this.ctx.strokeStyle = '#ffd166';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(16, GameRenderer.SCREEN_HEIGHT - 38, GameRenderer.SCREEN_WIDTH - 32, 26);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, GameRenderer.SCREEN_WIDTH / 2, GameRenderer.SCREEN_HEIGHT - 22);
  }

  // Render Retro Dialog box
  renderDialog(speaker: string, text: string) {
    const boxX = 10;
    const boxY = GameRenderer.SCREEN_HEIGHT - 100;
    const boxW = GameRenderer.SCREEN_WIDTH - 20;
    const boxH = 88;

    // Box background
    this.ctx.fillStyle = 'rgba(15, 20, 28, 0.95)';
    this.ctx.fillRect(boxX, boxY, boxW, boxH);
    this.ctx.strokeStyle = '#ffd166';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Speaker Title
    this.ctx.fillStyle = '#ffd166';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(speaker, boxX + 8, boxY + 14);

    // Dialog text with simple word wrap
    this.ctx.fillStyle = '#e2eafc';
    this.ctx.font = '9px sans-serif';
    this.wrapText(text, boxX + 8, boxY + 28, boxW - 16, 12, 4);

    // Continue indicator
    this.ctx.fillStyle = '#f39c12';
    this.ctx.font = 'bold 8px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('[OK] Continue ▶', boxX + boxW - 8, boxY + boxH - 6);
  }

  // Render Menu Modal (Inventory / Crafting)
  renderMenu(title: string, items: { text: string; sub?: string; selected: boolean }[], hint: string) {
    const mx = 12;
    const my = 28;
    const mw = GameRenderer.SCREEN_WIDTH - 24;
    const mh = GameRenderer.SCREEN_HEIGHT - 44;

    this.ctx.fillStyle = 'rgba(12, 16, 24, 0.96)';
    this.ctx.fillRect(mx, my, mw, mh);
    this.ctx.strokeStyle = '#3d4d63';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(mx, my, mw, mh);

    // Header
    this.ctx.fillStyle = '#ffd166';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(title, mx + mw / 2, my + 16);

    this.ctx.strokeStyle = '#2b3647';
    this.ctx.beginPath();
    this.ctx.moveTo(mx + 6, my + 22);
    this.ctx.lineTo(mx + mw - 6, my + 22);
    this.ctx.stroke();

    // Items list
    const startY = my + 36;
    items.forEach((item, idx) => {
      const iy = startY + idx * 24;
      if (iy + 20 > my + mh - 20) return;

      if (item.selected) {
        this.ctx.fillStyle = 'rgba(230, 126, 34, 0.35)';
        this.ctx.fillRect(mx + 4, iy - 10, mw - 8, 22);
        this.ctx.strokeStyle = '#e67e22';
        this.ctx.strokeRect(mx + 4, iy - 10, mw - 8, 22);
      }

      this.ctx.fillStyle = item.selected ? '#ffffff' : '#b0c4de';
      this.ctx.font = item.selected ? 'bold 9px sans-serif' : '9px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(item.text, mx + 10, iy + 4);

      if (item.sub) {
        this.ctx.fillStyle = item.selected ? '#ffd166' : '#7f93aa';
        this.ctx.font = '8px sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(item.sub, mx + mw - 10, iy + 4);
      }
    });

    // Bottom Hint
    this.ctx.fillStyle = '#8ca3ba';
    this.ctx.font = '8px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(hint, mx + mw / 2, my + mh - 8);
  }

  // Draw Title Screen
  renderTitleScreen() {
    const splash = assets.getImage('BS0.png');
    if (splash) {
      this.ctx.drawImage(splash, 0, 0, GameRenderer.SCREEN_WIDTH, GameRenderer.SCREEN_HEIGHT);
    } else {
      this.clear();
    }

    // Title text banner
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    this.ctx.fillRect(0, GameRenderer.SCREEN_HEIGHT - 64, GameRenderer.SCREEN_WIDTH, 48);

    this.ctx.fillStyle = '#ffd166';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PRESS [OK] OR TOUCH TO PLAY', GameRenderer.SCREEN_WIDTH / 2, GameRenderer.SCREEN_HEIGHT - 38);

    this.ctx.fillStyle = '#a0aec0';
    this.ctx.font = '8px sans-serif';
    this.ctx.fillText('Exkee / Mobile Distillery © 2009', GameRenderer.SCREEN_WIDTH / 2, GameRenderer.SCREEN_HEIGHT - 24);
  }

  private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    let linesDrawn = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = this.ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        this.ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
        linesDrawn++;
        if (linesDrawn >= maxLines - 1) {
          line += '...';
          break;
        }
      } else {
        line = testLine;
      }
    }
    if (linesDrawn < maxLines) {
      this.ctx.fillText(line, x, curY);
    }
  }
}
