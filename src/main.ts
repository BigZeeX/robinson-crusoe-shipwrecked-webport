import { assets } from './assetManager';
import { Game } from './game';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const loadingOverlay = document.getElementById('loading') as HTMLDivElement;
  const loadingText = document.getElementById('loadingText') as HTMLDivElement;

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  try {
    // Load all extracted assets
    await assets.loadAll((pct, msg) => {
      if (loadingText) {
        loadingText.textContent = `${msg} (${pct}%)`;
      }
    });

    // Hide loader
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }

    const game = new Game(canvas);

    // Keyboard controls
    const keysDown = new Set<string>();

    const updateMovement = () => {
      let dx = 0;
      let dy = 0;
      if (keysDown.has('ArrowUp') || keysDown.has('KeyW') || keysDown.has('2')) dy -= 1;
      if (keysDown.has('ArrowDown') || keysDown.has('KeyS') || keysDown.has('8')) dy += 1;
      if (keysDown.has('ArrowLeft') || keysDown.has('KeyA') || keysDown.has('4')) dx -= 1;
      if (keysDown.has('ArrowRight') || keysDown.has('KeyD') || keysDown.has('6')) dx += 1;

      game.handleDpad(dx, dy);
    };

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      keysDown.add(e.code);
      keysDown.add(e.key);

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) {
        updateMovement();
      }

      if (e.code === 'Enter' || e.code === 'Space' || e.key === '5') {
        game.handleOk();
      } else if (e.code === 'KeyI' || e.code === 'Tab' || e.key === '1') {
        game.openInventory();
      } else if (e.code === 'KeyC' || e.key === '3') {
        game.openCrafting();
      }
    });

    window.addEventListener('keyup', (e) => {
      keysDown.delete(e.code);
      keysDown.delete(e.key);
      updateMovement();
    });

    // On-screen Virtual Keypad
    const bindBtn = (id: string, onDown: () => void, onUp?: () => void) => {
      const el = document.getElementById(id);
      if (!el) return;

      const handlePress = (e: Event) => {
        e.preventDefault();
        el.classList.add('active');
        onDown();
      };
      const handleRelease = (e: Event) => {
        e.preventDefault();
        el.classList.remove('active');
        if (onUp) onUp();
      };

      el.addEventListener('mousedown', handlePress);
      el.addEventListener('mouseup', handleRelease);
      el.addEventListener('mouseleave', handleRelease);
      el.addEventListener('touchstart', handlePress, { passive: false });
      el.addEventListener('touchend', handleRelease, { passive: false });
    };

    bindBtn('btnUp', () => game.handleDpad(0, -1), () => game.handleDpad(0, 0));
    bindBtn('btnDown', () => game.handleDpad(0, 1), () => game.handleDpad(0, 0));
    bindBtn('btnLeft', () => game.handleDpad(-1, 0), () => game.handleDpad(0, 0));
    bindBtn('btnRight', () => game.handleDpad(1, 0), () => game.handleDpad(0, 0));
    bindBtn('btnOk', () => game.handleOk());
    bindBtn('btnMenu', () => game.openInventory());
    bindBtn('btnAction', () => game.openCrafting());

    // Direct Canvas Touch / Stylus Navigation
    let isTouching = false;

    const handleCanvasTouch = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (clientX - rect.left) * scaleX;
      const clickY = (clientY - rect.top) * scaleY;

      // Center offset from player on screen (120, 160)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const diffX = clickX - centerX;
      const diffY = clickY - centerY;

      if (Math.abs(diffX) < 16 && Math.abs(diffY) < 16) {
        // Tap near player = interact / OK
        game.handleOk();
        return;
      }

      let dx = 0;
      let dy = 0;
      if (Math.abs(diffX) > Math.abs(diffY)) {
        dx = diffX > 0 ? 1 : -1;
      } else {
        dy = diffY > 0 ? 1 : -1;
      }
      game.handleDpad(dx, dy);
    };

    canvas.addEventListener('pointerdown', (e) => {
      isTouching = true;
      handleCanvasTouch(e.clientX, e.clientY);
    });

    window.addEventListener('pointermove', (e) => {
      if (isTouching) {
        handleCanvasTouch(e.clientX, e.clientY);
      }
    });

    window.addEventListener('pointerup', () => {
      if (isTouching) {
        isTouching = false;
        game.handleDpad(0, 0);
      }
    });

    // Launch game engine
    game.start();

  } catch (err) {
    console.error('Failed to initialize game engine:', err);
    if (loadingText) {
      loadingText.textContent = `Error loading game: ${err}`;
    }
  }
});
