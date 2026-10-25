export interface Sprite {
  id: number;
  sheet: number;
  image: string;
  sx: number;
  sy: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export interface SpriteAtlas {
  counts: number[];
  sheets: Sprite[][];
}

export interface ItemRecipe {
  id: number;
  count: number;
}

export interface GameObjectDef {
  id: number;
  row0: number;  // BS13 sprite index for pickable-item icon (inventory). -1 = none
  row1: number;
  row2: number;  // BS7 sprite index for large placed-decor on map. -1 = none
  hunger: number;
  energy: number;
  row5: number;
  health: number;
  isCraftable: boolean;
  recipe: ItemRecipe[];
  tool: ItemRecipe[];
  row10?: number;
  row11?: number;
  row12?: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameState = 
  | 'TITLE' 
  | 'INTRO' 
  | 'PLAYING' 
  | 'DIALOG' 
  | 'INVENTORY' 
  | 'CRAFTING' 
  | 'GAMEOVER';

export interface Player {
  x: number;       // world pixel X
  y: number;       // world pixel Y
  speed: number;   // pixels per second
  dir: Direction;
  isMoving: boolean;
  animTimer: number;
  animFrame: number;
  health: number;  // 0 - 100
  hunger: number;  // 0 - 100
  energy: number;  // 0 - 100
  inventory: Map<number, number>;
  daysSurvived: number;
}
