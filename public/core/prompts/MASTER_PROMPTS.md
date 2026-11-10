# Kantor-Rama-AI 3D Isometric Asset Generation Bundle
**Target Project:** `kantor-rama-ai.my.id`
**Visual Reference Calibration:** Dark-mode cyberpunk/modern corporate 2.5D/3D isometric pixel-voxel hybrid (`floor.png` aesthetic), cyan LED door sensors, extruded dark slate walls, warm interior wood/tile contrast, RimWorld & Habbo Hotel character proportions.

---

## 1. Floor 1: Core Office Diorama Layout (`floor_1_base.png`)
**Prompt:**
> 3D isometric cutaway office floor layout labeled "Floor 1", dark slate architectural cross-section with extruded dark grey walls, glowing cyan floor trim and automatic door sensors, RimWorld and Habbo Hotel aesthetic. Includes 7 distinct zones around a central heavy-duty metallic elevator shaft with sliding doors and green/red indicator lights:
> 1. **Boss Room (Top-Left):** Warm wood-paneled walls, mahogany executive desk, leather chair, stock market trend monitor, gold trophy/shield emblem.
> 2. **Washroom/Toilet (Top-Center):** Clean white tiled floor, two stalls, sink, mirror, glowing "TOILET" sign.
> 3. **Audio/Podcast Studio (Top-Right):** Acoustic foam walls, dual-monitor audio workstation, condenser microphone on boom arm, studio speakers, dark rug.
> 4. **Meeting Room (Mid-Left):** Glass partition, oval conference table, 6 ergonomic chairs, presentation wall screen with pie chart and analytics.
> 5. **IT & Dev Room (Bottom-Left):** Multi-monitor coding desks, glowing terminal screens, ergonomic gaming chairs, potted plants.
> 6. **Pantry & Cafe (Bottom-Right):** Checkered/tiled floor, commercial espresso machine, sink, refrigerator, wooden counter, "PANTRY" sign.
> 7. **Employee Lounge (Mid-Right):** Retro arcade cabinet with glowing screen, brown leather sofa, wooden coffee table, indoor plants, framed wall art.
> Crisp isometric pixel-voxel hybrid, high contrast dark background `#0f1419`, volumetric soft interior lighting, orthographic 45-degree isometric angle, clean grid alignment --ar 16:9 --style raw

---

## 2. Floor 2 / Elevator Transition: R&D Lab & Server Core (`floor_2_expansion.png`)
*(Inspired by the elevator floor-shift transition at 00:07–00:09 in the reference video)*
**Prompt:**
> 3D isometric cutaway tech lab and server floor layout, dark slate walls with cyan LED floor trim, matching RimWorld and Habbo Hotel hybrid style. Central elevator shaft surrounded by:
> 1. **Central Server Room:** Dark server racks with blinking cyan and green LEDs, glass containment doors.
> 2. **Innovation Lab (Mid-Left):** Glowing holographic blue DNA double-helix projector, chemistry/hardware workbenches, diagnostic screens, "Innovation Lab" sign.
> 3. **AI Robotics & Hologram Bay (Bottom-Left):** Glowing cyan molecular/network hologram table, developer workstations, server terminals.
> 4. **Expanded Arcade Lounge (Right):** Dual retro arcade cabinets ("HIGH SCORE" marquee), lounge sofas, coffee tables, warm lamps.
> High-detail isometric game background, dark `#0f1419` exterior void, clean grid --ar 16:9 --style raw

---

## 3. AI Agent Persona Sprite Sheets & Avatars (`agents_spritesheet.png`)
**Prompt:**
> Game character sprite sheet for a 2.5D/3D isometric virtual office simulator (`kantor-rama-ai.my.id`), RimWorld and Habbo Hotel chibi-voxel proportions with expressive pixel-art shading. Includes 6 distinct AI agent personas:
> 1. **Executive Boss:** Neat brown hair, glasses, brown suit jacket, tie.
> 2. **Female Tech Lead / Boss:** Teal/cyan bob hair, headset, dark blazer.
> 3. **IT Developer:** Green hoodie, headphones, dark-rimmed glasses.
> 4. **Audio/Creative Producer:** Purple hair, studio headphones, dark streetwear jacket.
> 5. **Barista / Ops Specialist:** Brown hair, apron over casual shirt.
> 6. **R&D Scientist:** Spiky blonde hair, white lab coat, safety glasses, plus a pink-haired cybernetic analyst.
> Each character shown in 8-frame poses: idle front/back, walking 4-direction isometric, sitting typing at keyboard, holding coffee cup, and celebrating with confetti. Isolated on solid dark `#0f1419` background, uniform sprite grid --ar 16:9 --style raw

---

## 4. Animated Doors, Elevator & Interactive Props (`props_animations.png`)
**Prompt:**
> Modular isometric game prop and animation sprite sheet, dark `#0f1419` background, matching cyberpunk-modern office aesthetic:
> - **Central Elevator Shaft:** 4-frame door sequence (closed with red indicator, 30% open, 70% open, fully open with green indicator and illuminated interior cabin).
> - **Automatic Sliding Glass/Metal Doors:** 4-frame opening sequence with glowing cyan floor threshold sensors.
> - **Interactive Workstations:** Dual-monitor PC desks (idle screen, active code scrolling, "work progress" floating cyan status bubble).
> - **Holographic & Lab Props:** Rotating blue DNA hologram pedestal, floating cyan molecular node projection, blinking server rack frames (2-frame LED cycle), espresso machine with steam particles, retro arcade machine ("HIGH SCORE" animated screen).
> Crisp pixel-voxel isometric sprites, clean separation for texture atlas slicing --ar 16:9 --style raw

---

## 5. Pipeline & 3D Conversion Tips (`Three.js` / `Meshy` / `Tripo3D`)
- **2.5D Layered Approach (Recommended for Web Performance):** Slice `floor_1_base.png` into background floor + foreground wall occlusion masks so characters walk *behind* front walls cleanly in HTML5 Canvas / PixiJS / Three.js orthographic view.
- **True 3D `.glb` Conversion:** Crop individual props (elevator, arcade cabinet, DNA projector, server rack) on neutral backgrounds and pass into **Meshy.ai** or **Tripo3D** with *Style: Voxel / Low-Poly* and *Target Polycount: 1,500–3,000 tris*.
