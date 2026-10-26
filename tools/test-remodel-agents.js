const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true } });
  
  const testScript = `
    const T = 32;
    let clock = 120;
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function renderAgentSprite(agent, X, Y, frame, facing) {
      const p = (x, y, w, h, col) => {
        if (!col) return;
        ctx.fillStyle = col;
        ctx.fillRect(X + x, Y + y, w, h);
      };

      const idleBob = (Math.sin(clock * 0.08 + X * 0.04) > 0.7) ? -1 : 0;
      const isMoving = frame !== 0;
      const step = isMoving ? (frame === 1 ? -1 : (frame === 3 ? 1 : 0)) : 0;
      const armSwing = isMoving ? (frame === 1 ? 2 : (frame === 3 ? -2 : 0)) : 0;
      const blink = Math.floor(clock / 80) % 7 === 0 && (clock % 80 < 5);
      const isWorking = agent.state === 'working' || (agent.status && (agent.status.includes('coding') || agent.status.includes('monitoring') || agent.status.includes('Scanning')));

      // 1. DYNAMIC CONTACT SHADOW
      ctx.save();
      ctx.fillStyle = 'rgba(7, 11, 20, 0.38)';
      ctx.beginPath();
      ctx.ellipse(X + 16, Y + 30, 8.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(2, 4, 8, 0.6)';
      ctx.fillRect(X + 12, Y + 29, 8, 2);
      if (agent.accent) {
        ctx.fillStyle = agent.accent;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(X + 11, Y + 30, 10, 1);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      const pal = agent.palette;

      // 2. LEGS & FOOTWEAR
      if (facing === 'up') {
        // BACK LEGS
        p(11, 22 + idleBob, 4, 6, pal.pants);
        p(17, 22 + idleBob, 4, 6, pal.pants);
        p(14, 22 + idleBob, 1, 6, pal.pantsDark);
        p(17, 22 + idleBob, 1, 6, pal.pantsDark);
        // Back of shoes
        p(11, 28 + idleBob + step, 4, 3, pal.shoes);
        p(17, 28 + idleBob - step, 4, 3, pal.shoes);
        p(11, 30 + idleBob + step, 4, 1, pal.shoesDark);
        p(17, 30 + idleBob - step, 4, 1, pal.shoesDark);
      } else if (facing === 'left' || facing === 'right') {
        // PROFILE LEGS (Foreground leg & background leg)
        const isLeft = facing === 'left';
        const lx = isLeft ? 13 : 15;
        // Background leg (in shadow)
        p(isLeft ? lx + 2 : lx - 4, 22 + idleBob - step, 4, 6, pal.pantsDark);
        p(isLeft ? lx + 2 : lx - 4, 28 + idleBob - step, 4, 3, pal.shoesDark);
        // Foreground leg
        p(lx - 1, 21 + idleBob + step, 5, 7, pal.pants);
        p(lx, 21 + idleBob + step, 1, 6, pal.pantsLight);
        // Foreground shoe
        p(isLeft ? lx - 3 : lx, 28 + idleBob + step, 6, 3, pal.shoes);
        p(isLeft ? lx - 4 : lx + 5, 29 + idleBob + step, 2, 2, pal.shoesLight || pal.shoes);
        p(isLeft ? lx - 3 : lx, 30 + idleBob + step, 6, 1, pal.shoesDark);
      } else {
        // FRONT LEGS
        const lyL = 21 + idleBob + step;
        const lyR = 21 + idleBob - step;
        p(11, lyL, 4, 7, pal.pants);
        p(17, lyR, 4, 7, pal.pants);
        // Crease highlights
        p(12, lyL, 1, 6, pal.pantsLight);
        p(18, lyR, 1, 6, pal.pantsLight);
        // Inner thigh shadow
        p(14, 21 + idleBob, 1, 6, pal.pantsDark);
        p(17, lyR, 1, 6, pal.pantsDark);

        // Shoes
        p(10, 28 + lyL - 21, 5, 3, pal.shoes);
        p(17, 28 + lyR - 21, 5, 3, pal.shoes);
        if (pal.shoesAccent) {
          p(11, 28 + lyL - 21, 2, 1, pal.shoesAccent);
          p(18, 28 + lyR - 21, 2, 1, pal.shoesAccent);
        }
        p(10, 30 + lyL - 21, 5, 1, pal.shoesDark);
        p(17, 30 + lyR - 21, 5, 1, pal.shoesDark);
      }

      // 3. TORSO & ATTIRE
      const ty = 12 + idleBob;
      if (facing === 'up') {
        p(10, ty, 12, 9, pal.coat);
        p(10, ty, 12, 1, pal.coatLight);
        p(9, ty + 1, 1, 7, pal.coatDark);
        p(22, ty + 1, 1, 7, pal.coatDark);
        p(11, ty + 8, 10, 1, pal.pantsDark);
      } else if (facing === 'left' || facing === 'right') {
        const isLeft = facing === 'left';
        const sx = isLeft ? 12 : 13;
        p(sx, ty, 8, 9, pal.coat);
        p(sx + 1, ty, 6, 1, pal.coatLight);
        p(isLeft ? sx : sx + 6, ty + 1, 2, 8, pal.coatDark);
        if (agent.id === 'rama') p(isLeft ? sx + 1 : sx + 5, ty + 3, 2, 4, '#F59E0B');
      } else {
        // Front Torso
        p(10, ty, 12, 9, pal.coat);
        p(10, ty, 12, 1, pal.coatLight);
        p(9, ty + 1, 1, 7, pal.coatDark);
        p(22, ty + 1, 1, 7, pal.coatDark);

        if (agent.id === 'rama') {
          // Bespoke 3-Piece Navy Suit
          p(13, ty + 1, 6, 4, '#FFFFFF'); // white shirt V
          p(14, ty + 1, 4, 1, '#E2E8F0'); // collar crease
          p(15, ty + 2, 2, 5, '#F59E0B'); // gold silk tie
          p(15, ty + 2, 2, 1, '#FCD34D'); // tie knot
          p(15, ty + 4, 2, 1, '#FFFFFF'); // tie clip glint
          p(12, ty + 2, 2, 6, '#18243C'); // notched lapel L
          p(18, ty + 2, 2, 6, '#18243C'); // notched lapel R
          p(11, ty + 8, 10, 1, '#0F1626'); // belt
          p(15, ty + 8, 2, 1, '#F59E0B'); // gold buckle
        } else if (agent.id === 'jarvis') {
          // Tech Hoodie + Cyan Neon Zipper + Cyber ID
          p(13, ty + 1, 6, 7, '#1E40AF');
          p(15, ty + 1, 2, 7, '#00F5D4'); // cyan zipper
          p(15, ty + 2, 2, 1, '#FFFFFF');
          p(13, ty + 3, 1, 3, '#3B82F6'); // lanyard
          p(18, ty + 3, 1, 3, '#3B82F6');
          p(14, ty + 5, 4, 3, '#0F172A'); // cyber card
          p(15, ty + 6, 2, 1, '#00F5D4');
        } else if (agent.id === 'creator') {
          // Budi: Petrol Denim Overshirt + Heather Tee + Brass Rivets + Tool Belt
          p(13, ty + 1, 6, 6, '#E2E8F0');
          p(14, ty + 2, 4, 2, '#94A3B8');
          p(11, ty + 1, 2, 7, '#0D9488'); // placket L
          p(19, ty + 1, 2, 7, '#0D9488'); // placket R
          p(12, ty + 3, 1, 1, '#FACC15'); // rivet
          p(19, ty + 3, 1, 1, '#FACC15');
          p(11, ty + 8, 10, 1, '#78350F'); // leather belt
          p(15, ty + 8, 2, 1, '#FACC15');
        } else if (agent.id === 'modifier') {
          // Maya: Crimson Bomber Jacket + Cream Rib Collar + Black Turtleneck
          p(13, ty, 6, 2, '#FFF1F2');     // knit collar
          p(14, ty + 2, 4, 5, '#18181B'); // black turtleneck
          p(10, ty + 1, 3, 7, '#DC2626');
          p(19, ty + 1, 3, 7, '#DC2626');
          p(11, ty + 1, 1, 7, '#EF4444'); // satin highlight
          p(11, ty + 8, 10, 1, '#FFF1F2'); // rib hem
        } else if (agent.id === 'auditor') {
          // Dimas: Deep Violet Longcoat + Lavender Shirt + Plum Tie + Gold Pin
          p(13, ty + 1, 6, 4, '#E9D5FF');
          p(15, ty + 2, 2, 5, '#581C87');
          p(12, ty + 2, 2, 6, '#3B0764');
          p(18, ty + 2, 2, 6, '#3B0764');
          p(12, ty + 3, 1, 1, '#F59E0B'); // gold auditor pin
          p(11, ty + 8, 10, 1, '#1E1035');
        } else if (agent.id === 'ops') {
          // Siti: Saffron Knit Cardigan + Navy Blouse + Keycard Lanyard
          p(14, ty + 1, 4, 3, '#1E3A8A');
          p(11, ty + 1, 3, 7, '#D97706');
          p(18, ty + 1, 3, 7, '#D97706');
          p(15, ty + 3, 2, 1, '#F59E0B'); // button
          p(15, ty + 6, 2, 1, '#F59E0B');
          p(13, ty + 2, 1, 4, '#0284C7'); // lanyard
          p(14, ty + 5, 3, 2, '#00F5D4'); // card
        }
      }

      // 4. ARMS & HANDS
      const ay = ty + 1;
      if (facing === 'down') {
        if (isWorking) {
          const jitter = (clock % 4 < 2) ? 1 : 0;
          p(7, ay, 3, 5, pal.coatDark);
          p(22, ay, 3, 5, pal.coatDark);
          p(9, ay + 4 + jitter, 3, 3, pal.skin);
          p(20, ay + 4 - jitter, 3, 3, pal.skin);
          p(9, ay + 4 + jitter, 3, 1, 'rgba(56, 189, 248, 0.45)');
          p(20, ay + 4 - jitter, 3, 1, 'rgba(56, 189, 248, 0.45)');
        } else {
          p(7, ay + armSwing, 3, 6, pal.coat);
          p(7, ay + armSwing, 1, 6, pal.coatLight);
          p(22, ay - armSwing, 3, 6, pal.coat);
          p(24, ay - armSwing, 1, 6, pal.coatDark);
          p(7, ay + 6 + armSwing, 3, 2, pal.skin);
          p(22, ay + 6 - armSwing, 3, 2, pal.skin);
          if (agent.id === 'rama') p(7, ay + 5 + armSwing, 3, 1, '#F59E0B'); // gold watch
        }
      } else if (facing === 'up') {
        p(7, ay - armSwing, 3, 6, pal.coatDark);
        p(22, ay + armSwing, 3, 6, pal.coatDark);
        p(7, ay + 6 - armSwing, 3, 2, pal.skin);
        p(22, ay + 6 + armSwing, 3, 2, pal.skin);
      } else {
        const isLeft = facing === 'left';
        const pax = isLeft ? 14 : 15;
        p(pax, ay + armSwing, 3, 6, pal.coat);
        p(pax, ay + 6 + armSwing, 3, 2, pal.skin);
      }

      // 5. NECK & HEAD
      const hy = 2 + idleBob;
      p(14, hy + 8, 4, 2, pal.skinDark); // neck

      if (facing === 'up') {
        // Back of head
        p(11, hy + 1, 10, 7, pal.hair);
        p(12, hy, 8, 2, pal.hairLight);
        p(11, hy + 5, 10, 3, pal.hairDark);
      } else if (facing === 'left' || facing === 'right') {
        // Profile Head
        const isLeft = facing === 'left';
        const fx = isLeft ? 12 : 14;
        p(fx, hy + 2, 7, 6, pal.skin);
        p(isLeft ? fx - 1 : fx + 7, hy + 4, 2, 2, pal.skin); // nose
        p(isLeft ? fx + 2 : fx + 3, hy + 3, 2, 2, pal.hairDark); // eye
        p(12, hy, 8, 3, pal.hair);
        p(isLeft ? 16 : 10, hy + 2, 5, 6, pal.hair);
      } else {
        // Front Face (refined humanistic proportions)
        p(12, hy + 2, 8, 6, pal.skin);
        p(13, hy + 7, 6, 2, pal.skin); // chin
        p(13, hy + 8, 6, 1, pal.skinDark); // jawline shadow
        // Ears
        p(11, hy + 4, 1, 3, pal.skin);
        p(20, hy + 4, 1, 3, pal.skin);

        // Eyes
        if (blink) {
          p(13, hy + 5, 2, 1, pal.skinDark);
          p(17, hy + 5, 2, 1, pal.skinDark);
        } else {
          // Brows
          p(13, hy + 3, 2, 1, pal.hairDark);
          p(17, hy + 3, 2, 1, pal.hairDark);
          // Sclera + Iris
          p(13, hy + 5, 2, 2, '#FFFFFF');
          p(17, hy + 5, 2, 2, '#FFFFFF');
          const eyeCol = pal.eye || '#1E1510';
          p(14, hy + 5, 1, 2, eyeCol);
          p(17, hy + 5, 1, 2, eyeCol);
        }
        // Nose & Mouth
        p(15, hy + 6, 2, 1, pal.skinDark);
        p(15, hy + 8, 2, 1, pal.skinDark);

        // Accessories
        if (agent.id === 'jarvis') {
          // Cyber Glasses + Glowing Blue Screen Glow
          p(12, hy + 4, 3, 2, 'rgba(56, 189, 248, 0.45)');
          p(17, hy + 4, 3, 2, 'rgba(56, 189, 248, 0.45)');
          p(12, hy + 4, 8, 1, '#38BDF8');
          // Cyber Headphones
          p(10, hy + 3, 2, 4, '#0F172A');
          p(20, hy + 3, 2, 4, '#0F172A');
          p(10, hy + 4, 1, 2, '#00F5D4');
          p(21, hy + 4, 1, 2, '#00F5D4');
          p(12, hy - 1, 8, 1, '#00F5D4');
        } else if (agent.id === 'modifier') {
          // Maya Round Designer Glasses
          p(12, hy + 4, 3, 2, 'rgba(255, 255, 255, 0.25)');
          p(17, hy + 4, 3, 2, 'rgba(255, 255, 255, 0.25)');
          p(13, hy + 4, 6, 1, '#451A03');
        } else if (agent.id === 'auditor') {
          // Dimas AR Forensic Monocle
          ctx.save();
          ctx.fillStyle = 'rgba(255, 0, 127, 0.55)';
          ctx.fillRect(X + 16, Y + hy + 4, 4, 3);
          ctx.fillStyle = '#FF007F';
          ctx.fillRect(X + 17, Y + hy + 4, 2, 1);
          ctx.fillStyle = '#FFD166';
          ctx.fillRect(X + 18, Y + hy + 5, 1, 1);
          ctx.restore();
        }
      }

      // 6. HAIRSTYLE (Front/Top)
      if (facing !== 'up') {
        if (agent.id === 'rama') {
          // Sharp Executive Pompadour
          p(11, hy, 10, 3, pal.hair);
          p(12, hy - 1, 8, 2, pal.hair);
          p(13, hy - 1, 5, 1, pal.hairLight);
          p(10, hy + 2, 2, 3, pal.hair);
          p(20, hy + 2, 2, 3, pal.hair);
        } else if (agent.id === 'jarvis') {
          p(11, hy, 10, 3, pal.hair);
          p(12, hy - 1, 8, 2, pal.hairLight);
        } else if (agent.id === 'creator') {
          // Budi Watchman Beanie
          p(11, hy - 1, 10, 3, '#1E293B');
          p(12, hy - 2, 8, 2, '#334155');
          p(10, hy + 1, 12, 2, '#0F172A');
          p(11, hy + 1, 10, 1, '#475569');
          p(10, hy + 3, 2, 2, pal.hair);
          p(20, hy + 3, 2, 2, pal.hair);
        } else if (agent.id === 'modifier') {
          // Maya Chic Bob
          p(11, hy, 10, 3, pal.hair);
          p(12, hy - 1, 8, 2, pal.hair);
          p(13, hy, 6, 1, pal.hairLight);
          p(10, hy + 2, 2, 6, pal.hair);
          p(20, hy + 2, 2, 6, pal.hair);
        } else if (agent.id === 'auditor') {
          // Dimas Layered Sweep
          p(11, hy, 10, 3, pal.hair);
          p(11, hy - 1, 9, 2, pal.hair);
          p(12, hy - 1, 5, 1, pal.hairLight);
          p(10, hy + 2, 2, 4, pal.hair);
          p(20, hy + 2, 2, 3, pal.hair);
        } else if (agent.id === 'ops') {
          // Siti Updo Bun + Gold Pin
          p(11, hy, 10, 3, pal.hair);
          p(13, hy - 2, 6, 3, pal.hair);
          p(14, hy - 2, 4, 1, pal.hairLight);
          p(10, hy + 2, 2, 4, pal.hair);
          p(20, hy + 2, 2, 4, pal.hair);
          p(18, hy - 3, 3, 2, '#F59E0B');
          p(19, hy - 3, 1, 1, '#FFFFFF');
        }
      }
    }

    // TEST AGENTS CONFIG
    const testAgents = [
      {
        id: 'rama', name: 'RAMA', accent: '#F4D35E',
        palette: {
          skin: '#F2C79B', skinDark: '#CE9A6F', skinLight: '#FCE5D0',
          hair: '#1A1715', hairLight: '#3D342C', hairDark: '#0D0B0A',
          coat: '#151D30', coatLight: '#243356', coatDark: '#0B101C',
          pants: '#181F32', pantsLight: '#24304D', pantsDark: '#0C111E',
          shoes: '#111116', shoesLight: '#3F3F4E', shoesDark: '#050508', shoesAccent: '#3F3F4E',
          eye: '#1A120B'
        }
      },
      {
        id: 'jarvis', name: 'JARVIS', accent: '#00F5D4',
        palette: {
          skin: '#E5B887', skinDark: '#C4925F', skinLight: '#F5D2AC',
          hair: '#5A3B22', hairLight: '#7B5232', hairDark: '#3B2412',
          coat: '#2563EB', coatLight: '#3B82F6', coatDark: '#1D4ED8',
          pants: '#0F172A', pantsLight: '#1E293B', pantsDark: '#020617',
          shoes: '#0F172A', shoesLight: '#1E293B', shoesDark: '#020617', shoesAccent: '#00F5D4',
          eye: '#0284C7'
        }
      },
      {
        id: 'creator', name: 'BUDI', accent: '#4ECDC4',
        palette: {
          skin: '#E8B98A', skinDark: '#C48F5C', skinLight: '#F8D8B6',
          hair: '#452816', hairLight: '#653C22', hairDark: '#29160A',
          coat: '#0D9488', coatLight: '#14B8A6', coatDark: '#0F766E',
          pants: '#854D0E', pantsLight: '#A16207', pantsDark: '#593208',
          shoes: '#D97706', shoesLight: '#F59E0B', shoesDark: '#451A03', shoesAccent: '#FBBF24',
          eye: '#2D1B0F'
        }
      },
      {
        id: 'modifier', name: 'MAYA', accent: '#FF6B6B',
        palette: {
          skin: '#C88B62', skinDark: '#A56942', skinLight: '#DFAC88',
          hair: '#1C1014', hairLight: '#5B1C2E', hairDark: '#0E0709',
          coat: '#DC2626', coatLight: '#EF4444', coatDark: '#991B1B',
          pants: '#DCD0BF', pantsLight: '#EFE8DC', pantsDark: '#B5A591',
          shoes: '#FFFFFF', shoesLight: '#FFFFFF', shoesDark: '#D4D4D8', shoesAccent: '#DC2626',
          eye: '#45101A'
        }
      },
      {
        id: 'auditor', name: 'DIMAS', accent: '#FF007F',
        palette: {
          skin: '#F0D0A8', skinDark: '#CBA47B', skinLight: '#FBF0DE',
          hair: '#4A3525', hairLight: '#6C4F37', hairDark: '#2B1D12',
          coat: '#3B0764', coatLight: '#581C87', coatDark: '#2E0854',
          pants: '#1E1035', pantsLight: '#2C164D', pantsDark: '#0F061C',
          shoes: '#18181B', shoesLight: '#3F3F46', shoesDark: '#09090B', shoesAccent: '#CBD5E1',
          eye: '#2E1065'
        }
      },
      {
        id: 'ops', name: 'SITI', accent: '#FFD93D',
        palette: {
          skin: '#E8B98A', skinDark: '#C28E5E', skinLight: '#F7D8B9',
          hair: '#241E1C', hairLight: '#3D332F', hairDark: '#120F0E',
          coat: '#D97706', coatLight: '#F59E0B', coatDark: '#92400E',
          pants: '#334155', pantsLight: '#475569', pantsDark: '#1E293B',
          shoes: '#450A0A', shoesLight: '#7F1D1D', shoesDark: '#240505', shoesAccent: '#F59E0B',
          eye: '#1C1917'
        }
      }
    ];

    // Render 6 agents in 4 directions & animated states
    testAgents.forEach((a, i) => {
      renderAgentSprite(a, i * 64 + 16, 12, 0, 'down');
    });
    testAgents.forEach((a, i) => {
      renderAgentSprite(a, i * 64 + 16, 60, 1, 'down');
    });
    testAgents.forEach((a, i) => {
      renderAgentSprite(a, i * 64 + 16, 108, 1, i % 2 === 0 ? 'left' : 'right');
    });
    testAgents.forEach((a, i) => {
      renderAgentSprite(a, i * 64 + 16, 156, 0, 'up');
    });
  `;

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { margin: 0; background: #0E131F; display: flex; align-items: center; justify-content: center; height: 100vh; }
      canvas { image-rendering: pixelated; }
    </style>
  </head>
  <body>
    <canvas id="c" width="400" height="200"></canvas>
    <script>
      ${testScript}
    </script>
  </body>
  </html>
  `;
  
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(r => setTimeout(r, 600));

  const dataUrl = await win.webContents.executeJavaScript(`
    (function() {
      const src = document.getElementById('c');
      const out = document.createElement('canvas');
      out.width = src.width * 3;
      out.height = src.height * 3;
      const c = out.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(src, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    })()
  `);

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const outPath = path.join(__dirname, 'agents_preview_v2.png');
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
  console.log('Saved preview:', outPath);
  app.quit();
});
