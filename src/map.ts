import { assets } from './assetManager';

export class WorldMap {
  public static readonly MAP_WIDTH = 180;
  public static readonly MAP_HEIGHT = 180;
  public static readonly TILE_SIZE = 16;
  public static readonly WORLD_WIDTH = 180 * 16;
  public static readonly WORLD_HEIGHT = 180 * 16;

  // Player spawn coordinates
  public spawnTileX = 94;
  public spawnTileY = 94;

  get full(): Uint8Array | null { return assets.mapFull; }
  get borders(): Uint8Array | null { return assets.mapBorders; }
  get rocks(): Uint8Array | null { return assets.mapRocks; }
  get decor(): Uint8Array | null { return assets.mapDecor; }
  get objects(): Uint8Array | null { return assets.mapObjects; }

  getTileIndex(tx: number, ty: number): number {
    return ty * WorldMap.MAP_WIDTH + tx;
  }

  isPassable(worldX: number, worldY: number): boolean {
    const tx = Math.floor(worldX / WorldMap.TILE_SIZE);
    const ty = Math.floor(worldY / WorldMap.TILE_SIZE);

    if (tx < 1 || tx >= WorldMap.MAP_WIDTH - 1 || ty < 1 || ty >= WorldMap.MAP_HEIGHT - 1) {
      return false;
    }

    const idx = this.getTileIndex(tx, ty);

    // Check rocks / cliffs (solid barriers)
    if (this.rocks && this.rocks[idx] > 0) {
      return false;
    }

    // Check base terrain (only deep ocean tile 6 is impassable)
    if (this.full) {
      const tile = this.full[idx];
      // Tile 6 is deep ocean perimeter
      if (tile === 6) {
        return false;
      }
    }

    // Check solid objects (e.g. large trees / wreckage rocks)
    if (this.objects) {
      const objId = this.objects[idx];
      // Object 85 is the flag/camp, passable; high obstacle objects can block
      if (objId > 0 && objId !== 85 && (objId >= 51 && objId <= 60)) {
        return false;
      }
    }

    return true;
  }

  getInteractiveObject(worldX: number, worldY: number, radius: number = 24): { tx: number; ty: number; id: number } | null {
    if (!this.objects) return null;

    const centerTx = Math.floor(worldX / WorldMap.TILE_SIZE);
    const centerTy = Math.floor(worldY / WorldMap.TILE_SIZE);
    const tileRadius = Math.ceil(radius / WorldMap.TILE_SIZE);

    for (let dy = -tileRadius; dy <= tileRadius; dy++) {
      for (let dx = -tileRadius; dx <= tileRadius; dx++) {
        const tx = centerTx + dx;
        const ty = centerTy + dy;
        if (tx < 0 || tx >= WorldMap.MAP_WIDTH || ty < 0 || ty >= WorldMap.MAP_HEIGHT) continue;

        const idx = this.getTileIndex(tx, ty);
        const objId = this.objects[idx];
        if (objId > 0) {
          const objWorldX = tx * WorldMap.TILE_SIZE + 8;
          const objWorldY = ty * WorldMap.TILE_SIZE + 8;
          const distSq = (worldX - objWorldX) ** 2 + (worldY - objWorldY) ** 2;
          if (distSq <= radius * radius) {
            return { tx, ty, id: objId };
          }
        }
      }
    }
    return null;
  }

  removeObject(tx: number, ty: number) {
    if (!this.objects) return;
    const idx = this.getTileIndex(tx, ty);
    this.objects[idx] = 0;
  }
}

export const worldMap = new WorldMap();
