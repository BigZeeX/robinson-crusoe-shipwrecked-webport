import { GameRenderer } from './renderer';
import { player } from './player';
import { worldMap } from './map';
import { assets } from './assetManager';
import { sound } from './audio';
import { GameState } from './types';

export class Game {
  private renderer: GameRenderer;
  private state: GameState = 'TITLE';

  // Game clock
  private gameTimeMinutes: number = 8 * 60; // 08:00 AM
  private dayCount: number = 1;

  // Dialog State
  private dialogSpeaker: string = 'Robinson';
  private dialogText: string = '';
  private nextStateAfterDialog: GameState = 'PLAYING';

  // Menu State
  private menuSelectedIndex: number = 0;
  private menuItems: { id: number; text: string; sub?: string; action: () => void }[] = [];

  // Interaction detection
  private currentNearObject: { tx: number; ty: number; id: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new GameRenderer(canvas);
  }

  start() {
    this.loadSavedGame();
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      this.update(dt);
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  update(dt: number) {
    if (this.state === 'PLAYING') {
      player.update(dt);
      this.renderer.updateCamera();

      // In-game clock (1 real sec = 2 in-game mins)
      this.gameTimeMinutes += dt * 2;
      if (this.gameTimeMinutes >= 24 * 60) {
        this.gameTimeMinutes -= 24 * 60;
        this.dayCount++;
        player.daysSurvived = this.dayCount;
        this.saveGame();
      }

      // Detect nearby interactive object
      this.currentNearObject = worldMap.getInteractiveObject(player.x, player.y, 22);

      // Check game over
      if (player.health <= 0) {
        this.state = 'GAMEOVER';
      }
    }
  }

  render() {
    this.renderer.clear();

    switch (this.state) {
      case 'TITLE':
        this.renderer.renderTitleScreen();
        break;

      case 'PLAYING':
      case 'DIALOG':
      case 'INVENTORY':
      case 'CRAFTING':
        this.renderer.renderMap();
        this.renderer.renderPlayer();

        const hours = Math.floor(this.gameTimeMinutes / 60).toString().padStart(2, '0');
        const mins = Math.floor(this.gameTimeMinutes % 60).toString().padStart(2, '0');
        this.renderer.renderHUD(this.dayCount, `${hours}:${mins}`);

        if (this.state === 'PLAYING' && this.currentNearObject) {
          const objName = this.getObjectName(this.currentNearObject.id);
          this.renderer.renderPrompt(`[OK] ${objName}`);
        }

        if (this.state === 'DIALOG') {
          this.renderer.renderDialog(this.dialogSpeaker, this.dialogText);
        } else if (this.state === 'INVENTORY') {
          this.renderer.renderMenu(
            'INVENTORY & SUPPLIES',
            this.menuItems.map((m, i) => ({ text: m.text, sub: m.sub, selected: i === this.menuSelectedIndex })),
            '[OK] Use / Eat   [▲/▼] Browse   [C] Close'
          );
        } else if (this.state === 'CRAFTING') {
          this.renderer.renderMenu(
            'SURVIVAL CRAFTING',
            this.menuItems.map((m, i) => ({ text: m.text, sub: m.sub, selected: i === this.menuSelectedIndex })),
            '[OK] Build / Craft   [▲/▼] Browse   [C] Close'
          );
        }
        break;

      case 'GAMEOVER':
        const overImg = assets.getImage('BS14.png');
        if (overImg) {
          this.renderer.drawSprite(14, 0, 0, 0);
        }
        this.renderer.renderPrompt('GAME OVER — Press [OK] to Respawn');
        break;
    }
  }

  // Handle Controls & Inputs
  handleDpad(dx: number, dy: number) {
    if (this.state === 'PLAYING') {
      player.setInput(dx, dy);
    } else if (this.state === 'INVENTORY' || this.state === 'CRAFTING') {
      if (dy < 0) {
        this.menuSelectedIndex = (this.menuSelectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        sound.playSelect();
      } else if (dy > 0) {
        this.menuSelectedIndex = (this.menuSelectedIndex + 1) % this.menuItems.length;
        sound.playSelect();
      }
    }
  }

  handleOk() {
    sound.playSelect();

    if (this.state === 'TITLE') {
      this.startIntro();
    } else if (this.state === 'DIALOG') {
      this.state = this.nextStateAfterDialog;
    } else if (this.state === 'PLAYING') {
      if (this.currentNearObject) {
        this.interactWithObject(this.currentNearObject);
      }
    } else if (this.state === 'INVENTORY' || this.state === 'CRAFTING') {
      const selected = this.menuItems[this.menuSelectedIndex];
      if (selected && selected.action) {
        selected.action();
      }
    } else if (this.state === 'GAMEOVER') {
      player.resetToSpawn();
      this.state = 'PLAYING';
    }
  }

  openInventory() {
    if (this.state === 'PLAYING') {
      this.state = 'INVENTORY';
      this.menuSelectedIndex = 0;
      this.menuItems = [];

      player.inventory.forEach((count, id) => {
        const name = this.getObjectName(id);
        const objDef = assets.objectsDef[id];
        const isEdible = objDef && (objDef.hunger > 0 || objDef.energy > 0);

        this.menuItems.push({
          id,
          text: `${name}`,
          sub: `x${count}${isEdible ? ' [EAT]' : ''}`,
          action: () => {
            if (isEdible) {
              player.eat(id, objDef.hunger, objDef.energy);
              this.showDialog('Robinson', `Consumed ${name}. Restored vitality!`);
            } else {
              this.showDialog('Robinson', `${name}: Useful survival resource.`);
            }
          }
        });
      });

      if (this.menuItems.length === 0) {
        this.menuItems.push({
          id: -1,
          text: 'Empty Supplies...',
          sub: '',
          action: () => { this.state = 'PLAYING'; }
        });
      }
    } else if (this.state === 'INVENTORY') {
      this.state = 'PLAYING';
    }
  }

  openCrafting() {
    if (this.state === 'PLAYING') {
      this.state = 'CRAFTING';
      this.menuSelectedIndex = 0;
      this.menuItems = [];

      // Crafting recipes definitions
      const craftableList = [
        { id: 24, name: 'Wooden Club', req: [{ id: 3, count: 2 }] },
        { id: 25, name: 'Torch', req: [{ id: 3, count: 1 }, { id: 42, count: 1 }] },
        { id: 26, name: 'Stone Knife', req: [{ id: 0, count: 1 }, { id: 42, count: 1 }] },
        { id: 27, name: 'Fishing Net', req: [{ id: 42, count: 3 }, { id: 3, count: 1 }] },
        { id: 28, name: 'Fishing Rod', req: [{ id: 3, count: 2 }, { id: 42, count: 2 }] },
        { id: 29, name: 'Hunting Bow', req: [{ id: 3, count: 3 }, { id: 42, count: 2 }] },
        { id: 40, name: 'Camp Fire', req: [{ id: 3, count: 4 }, { id: 0, count: 2 }] },
        { id: 41, name: 'Tent Shelter', req: [{ id: 3, count: 6 }, { id: 42, count: 4 }] },
      ];

      craftableList.forEach(item => {
        const canCraft = item.req.every(r => (player.inventory.get(r.id) || 0) >= r.count);
        const reqStr = item.req.map(r => `${this.getObjectName(r.id)} x${r.count}`).join(', ');

        this.menuItems.push({
          id: item.id,
          text: item.name,
          sub: canCraft ? 'READY' : reqStr,
          action: () => {
            if (canCraft) {
              item.req.forEach(r => player.removeItem(r.id, r.count));
              player.addItem(item.id, 1);
              sound.playCraft();
              this.showDialog('Crafting Success', `Created ${item.name}! Added to supplies.`);
            } else {
              this.showDialog('Missing Materials', `Requires: ${reqStr}`);
            }
          }
        });
      });
    } else if (this.state === 'CRAFTING') {
      this.state = 'PLAYING';
    }
  }

  private startIntro() {
    this.dialogSpeaker = 'Robinson Crusoe';
    this.dialogText = assets.strings[5] || "Where am I? Where's my boat, the Amber Queen? Fate has washed me up on this strange, godforsaken island... Giving up is not an option. I must survive!";
    this.state = 'DIALOG';
    this.nextStateAfterDialog = 'PLAYING';
  }

  showDialog(speaker: string, text: string) {
    this.dialogSpeaker = speaker;
    this.dialogText = text;
    this.state = 'DIALOG';
    this.nextStateAfterDialog = 'PLAYING';
  }

  private interactWithObject(obj: { tx: number; ty: number; id: number }) {
    if (obj.id === 85) {
      // Amber Queen Camp Flag
      this.showDialog(
        'Amber Queen Flag',
        "The camp of the Amber Queen. Rest here to recover energy and save your survival journal."
      );
      player.energy = Math.min(100, player.energy + 40);
      this.saveGame();
    } else if (obj.id === 76 || obj.id === 77) {
      // Palm Tree with Coconuts
      player.addItem(0, 1); // Coconut
      worldMap.removeObject(obj.tx, obj.ty);
      this.showDialog('Palm Tree', 'Knocked down a fresh Coconut! Delicious milk and flesh.');
    } else if (obj.id === 5 || obj.id === 6 || obj.id === 8) {
      // Driftwood / Wreckage debris
      player.addItem(3, 1); // Wood Stick
      worldMap.removeObject(obj.tx, obj.ty);
      this.showDialog('Ship Wreckage', 'Salvaged sturdy Driftwood and wooden beams.');
    } else if (obj.id === 16 || obj.id === 18) {
      // Natural stones
      player.addItem(0, 1); // Stone
      worldMap.removeObject(obj.tx, obj.ty);
      this.showDialog('Beach Rocks', 'Picked up sharp flint stone for crafting tools.');
    } else {
      // Generic harvestable
      player.addItem(42, 1); // Jungle Vine
      worldMap.removeObject(obj.tx, obj.ty);
      this.showDialog('Island Bush', 'Gathered flexible plant fibers and jungle vines.');
    }
  }

  private getObjectName(id: number): string {
    const names: Record<number, string> = {
      0: 'Flint Stone',
      1: 'Fresh Coconut',
      2: 'Wild Berries',
      3: 'Driftwood Branch',
      4: 'Dry Leaves',
      5: 'Shipwreck Planks',
      6: 'Rope Fragment',
      42: 'Jungle Vine',
      10: 'Fresh Water',
      16: 'Sharp Flint',
      24: 'Wooden Club',
      25: 'Torch',
      26: 'Stone Knife',
      27: 'Fishing Net',
      28: 'Fishing Rod',
      29: 'Hunting Bow',
      40: 'Camp Fire',
      41: 'Tent Shelter',
      76: 'Palm Tree',
      85: 'Amber Queen Flag',
    };
    return names[id] || `Resource #${id}`;
  }

  private saveGame() {
    const saveData = {
      x: player.x,
      y: player.y,
      health: player.health,
      hunger: player.hunger,
      energy: player.energy,
      dayCount: this.dayCount,
      gameTimeMinutes: this.gameTimeMinutes,
      inventory: Array.from(player.inventory.entries()),
    };
    try {
      localStorage.setItem('robinson_save', JSON.stringify(saveData));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }

  private loadSavedGame() {
    try {
      const dataStr = localStorage.getItem('robinson_save');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        player.x = data.x ?? player.x;
        player.y = data.y ?? player.y;
        player.health = data.health ?? 100;
        player.hunger = data.hunger ?? 90;
        player.energy = data.energy ?? 95;
        this.dayCount = data.dayCount ?? 1;
        this.gameTimeMinutes = data.gameTimeMinutes ?? (8 * 60);
        if (data.inventory) {
          player.inventory = new Map(data.inventory);
        }
      }
    } catch (e) {
      console.warn('Could not load from localStorage', e);
    }
  }
}
