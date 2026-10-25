import { Direction, Player } from './types';
import { worldMap } from './map';
import { sound } from './audio';

export class PlayerController implements Player {
  public x: number = 94 * 16 + 8; // Start at wreckage flag (94, 94)
  public y: number = 94 * 16 + 8;
  public speed: number = 64; // Pixels per second
  public dir: Direction = 'DOWN';
  public isMoving: boolean = false;
  public animTimer: number = 0;
  public animFrame: number = 0;

  // Survival stats
  public health: number = 100;
  public hunger: number = 90;
  public energy: number = 95;
  public daysSurvived: number = 1;

  // Inventory: itemId -> count
  public inventory: Map<number, number> = new Map([
    [0, 2],  // A couple coconuts / wood
    [3, 1],  // Basic stick
    [42, 1],  // Jungle Vine
  ]);

  // Input states
  private inputX: number = 0;
  private inputY: number = 0;
  private stepTimer: number = 0;

  resetToSpawn() {
    this.x = worldMap.spawnTileX * 16 + 8;
    this.y = worldMap.spawnTileY * 16 + 8;
    this.dir = 'DOWN';
    this.health = 100;
    this.hunger = 90;
    this.energy = 95;
  }

  setInput(dx: number, dy: number) {
    this.inputX = dx;
    this.inputY = dy;

    if (dx < 0) this.dir = 'LEFT';
    else if (dx > 0) this.dir = 'RIGHT';
    else if (dy < 0) this.dir = 'UP';
    else if (dy > 0) this.dir = 'DOWN';

    this.isMoving = dx !== 0 || dy !== 0;
  }

  update(dt: number) {
    if (this.isMoving) {
      const moveDist = this.speed * dt;
      const targetX = this.x + this.inputX * moveDist;
      const targetY = this.y + this.inputY * moveDist;

      // Try movement with simple sliding collision
      if (worldMap.isPassable(targetX, this.y)) {
        this.x = targetX;
      }
      if (worldMap.isPassable(this.x, targetY)) {
        this.y = targetY;
      }

      // Animation cycle
      this.animTimer += dt;
      if (this.animTimer >= 0.18) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 5;
      }

      // Footstep sound
      this.stepTimer += dt;
      if (this.stepTimer >= 0.35) {
        this.stepTimer = 0;
        sound.playStep();
      }

      // Slowly drain energy while moving
      this.energy = Math.max(0, this.energy - 0.2 * dt);
    } else {
      this.animFrame = 0;
      this.animTimer = 0;
      this.stepTimer = 0;
    }

    // Passive hunger drain (1% every 20 seconds)
    this.hunger = Math.max(0, this.hunger - 0.05 * dt);
    if (this.hunger === 0) {
      this.health = Math.max(0, this.health - 1 * dt);
    }
  }

  addItem(itemId: number, count: number = 1) {
    const cur = this.inventory.get(itemId) || 0;
    this.inventory.set(itemId, cur + count);
    sound.playPickup();
  }

  removeItem(itemId: number, count: number = 1): boolean {
    const cur = this.inventory.get(itemId) || 0;
    if (cur < count) return false;
    if (cur === count) {
      this.inventory.delete(itemId);
    } else {
      this.inventory.set(itemId, cur - count);
    }
    return true;
  }

  eat(itemId: number, hungerRestore: number, energyRestore: number): boolean {
    if (this.removeItem(itemId, 1)) {
      this.hunger = Math.min(100, this.hunger + hungerRestore);
      this.energy = Math.min(100, this.energy + energyRestore);
      this.health = Math.min(100, this.health + 5);
      sound.playCraft();
      return true;
    }
    return false;
  }
}

export const player = new PlayerController();
