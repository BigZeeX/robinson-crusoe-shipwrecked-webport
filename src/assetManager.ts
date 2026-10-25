import { SpriteAtlas, GameObjectDef } from './types';

export class AssetManager {
  public images: Map<string, HTMLImageElement> = new Map();
  public spriteAtlas: SpriteAtlas | null = null;
  public strings: string[] = [];
  public objectsDef: GameObjectDef[] = [];
  
  // 5 map layers: 180x180 tiles each = 32,400 bytes each
  public mapFull: Uint8Array | null = null;
  public mapBorders: Uint8Array | null = null;
  public mapRocks: Uint8Array | null = null;
  public mapDecor: Uint8Array | null = null;
  public mapObjects: Uint8Array | null = null;

  async loadAll(onProgress?: (pct: number, msg: string) => void): Promise<void> {
    const report = (p: number, m: string) => onProgress && onProgress(p, m);

    report(5, 'Loading sprite definitions...');
    const spritesRes = await fetch('/data/sprites.json');
    this.spriteAtlas = await spritesRes.json();

    report(15, 'Loading game dialogue & strings...');
    const stringsRes = await fetch('/data/strings.json');
    const stringsData = await stringsRes.json();
    this.strings = stringsData.strings || [];

    report(25, 'Loading item recipes & objects...');
    const objectsRes = await fetch('/data/objects.json');
    const objectsData = await objectsRes.json();
    this.objectsDef = objectsData.objects || [];

    report(35, 'Loading world tilemap layers...');
    const [fullBuf, bordersBuf, rocksBuf, decorBuf, objectsBuf] = await Promise.all([
      fetch('/maps/BIGislandFULL.byt').then(r => r.arrayBuffer()),
      fetch('/maps/BIGislandBorders.byt').then(r => r.arrayBuffer()),
      fetch('/maps/BIGislandRocks.byt').then(r => r.arrayBuffer()),
      fetch('/maps/BIGislandDecor.byt').then(r => r.arrayBuffer()),
      fetch('/maps/BIGislandObjects.byt').then(r => r.arrayBuffer()),
    ]);

    this.mapFull = new Uint8Array(fullBuf);
    this.mapBorders = new Uint8Array(bordersBuf);
    this.mapRocks = new Uint8Array(rocksBuf);
    this.mapDecor = new Uint8Array(decorBuf);
    this.mapObjects = new Uint8Array(objectsBuf);

    report(60, 'Loading graphics spritesheets...');
    const imageNames = [
      'BS0.png', 'BS1.png', 'BS2.png', 'BS3.png', 'BS4.png',
      'BS5.png', 'BS6.png', 'BS7.png', 'BS8.png', 'BS9.png',
      'BS10.png', 'BS11.png', 'BS12.png', 'BS13.png', 'BS14.png'
    ];

    let loadedCount = 0;
    await Promise.all(
      imageNames.map(name => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.src = `/data/${name}`;
          img.onload = () => {
            this.images.set(name, img);
            loadedCount++;
            report(60 + Math.floor((loadedCount / imageNames.length) * 38), `Loaded ${name}`);
            resolve();
          };
          img.onerror = (e) => {
            console.error(`Failed to load ${name}`, e);
            reject(e);
          };
        });
      })
    );

    report(100, 'All Island Resources Ready!');
  }

  getSprite(sheetIdx: number, spriteIdx: number) {
    if (!this.spriteAtlas || !this.spriteAtlas.sheets[sheetIdx]) return null;
    return this.spriteAtlas.sheets[sheetIdx][spriteIdx] || null;
  }

  getImage(name: string) {
    return this.images.get(name) || null;
  }
}

export const assets = new AssetManager();
