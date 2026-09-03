"use client";

import React from "react";

/**
 * InkAtmosphere
 * Environmental background atmosphere providing:
 * - Upper-right elegant ink bamboo branch silhouettes
 * - Upper-center distant flying cranes in the mist
 * - Lower mountain silhouettes and mist
 * Fully pointer-events-none, aria-hidden, extremely low contrast to preserve 100% legibility.
 */
export function InkAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none fixed inset-0 overflow-hidden z-[var(--z-canvas)]"
    >
      {/* Top Right: Ink Bamboo Branch (东方淡墨翠竹) */}
      <svg
        viewBox="0 0 500 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute top-0 right-0 w-[320px] sm:w-[420px] lg:w-[500px] h-auto opacity-[0.22] text-[#334139] mix-blend-multiply"
      >
        <g stroke="currentColor" strokeLinecap="round">
          {/* Main Bamboo Stems */}
          <path d="M480,-20 Q440,120 420,280 Q400,420 370,580" strokeWidth="6" strokeDasharray="38 4" fill="none" opacity="0.8" />
          <path d="M510,40 Q470,180 445,340 Q420,480 395,620" strokeWidth="4.5" strokeDasharray="32 3" fill="none" opacity="0.6" />
          <path d="M430,-30 Q390,90 360,240 Q330,380 300,520" strokeWidth="3.5" strokeDasharray="28 3" fill="none" opacity="0.5" />
        </g>

        {/* Bamboo Nodes / Joints */}
        <g fill="currentColor" opacity="0.85">
          <ellipse cx="452" cy="78" rx="7" ry="2" transform="rotate(-15 452 78)" />
          <ellipse cx="435" cy="162" rx="7" ry="2" transform="rotate(-18 435 162)" />
          <ellipse cx="420" cy="254" rx="7" ry="2" transform="rotate(-20 420 254)" />
          <ellipse cx="403" cy="355" rx="7" ry="2" transform="rotate(-22 403 355)" />
          <ellipse cx="384" cy="460" rx="7" ry="2" transform="rotate(-25 384 460)" />
        </g>

        {/* Bamboo Leaves Clusters (墨竹枝叶) */}
        <g fill="currentColor" opacity="0.75">
          {/* Top Cluster */}
          <path d="M435,160 Q380,180 330,195 Q380,170 435,160 Z" />
          <path d="M435,160 Q390,200 350,225 Q395,190 435,160 Z" />
          <path d="M435,160 Q400,215 375,250 Q410,205 435,160 Z" />
          <path d="M440,158 Q465,210 470,255 Q455,200 440,158 Z" />

          {/* Mid Cluster 1 */}
          <path d="M420,250 Q360,265 305,275 Q360,255 420,250 Z" />
          <path d="M420,250 Q370,285 320,310 Q375,275 420,250 Z" />
          <path d="M420,250 Q380,305 345,340 Q390,295 420,250 Z" />
          <path d="M425,252 Q445,295 460,335 Q440,285 425,252 Z" />

          {/* Mid Cluster 2 */}
          <path d="M403,355 Q340,365 280,370 Q340,355 403,355 Z" />
          <path d="M403,355 Q350,385 300,405 Q355,375 403,355 Z" />
          <path d="M403,355 Q360,405 320,435 Q370,395 403,355 Z" />
          <path d="M405,355 Q425,400 440,440 Q420,390 405,355 Z" />

          {/* Lower Cluster */}
          <path d="M384,460 Q320,465 260,465 Q320,455 384,460 Z" />
          <path d="M384,460 Q330,485 285,505 Q335,475 384,460 Z" />
          <path d="M384,460 Q345,505 310,535 Q355,495 384,460 Z" />

          {/* Small Spray Leaves */}
          <path d="M360,240 Q310,245 270,250 Q315,238 360,240 Z" />
          <path d="M360,240 Q320,260 285,280 Q325,252 360,240 Z" />
          <path d="M300,520 Q250,525 210,520 Q255,515 300,520 Z" />
          <path d="M300,520 Q260,540 230,555 Q265,532 300,520 Z" />
        </g>
      </svg>

      {/* Upper Center: Distant Flying Cranes / Birds (天际淡墨飞鸟) */}
      <svg
        viewBox="0 0 400 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute top-12 left-[48%] -translate-x-1/2 w-[240px] sm:w-[320px] h-auto opacity-[0.28] text-[#2c3539]"
      >
        <g fill="currentColor">
          {/* Bird 1 */}
          <path d="M120,60 Q132,48 148,54 Q136,58 128,66 Q124,62 120,60 Z" />
          <path d="M128,66 Q138,58 152,64 Q140,68 130,72 Q126,69 128,66 Z" />
          {/* Bird 2 */}
          <path d="M165,75 Q174,65 186,70 Q177,74 170,80 Q167,77 165,75 Z" />
          <path d="M170,80 Q178,74 190,79 Q180,82 172,85 Q169,82 170,80 Z" />
          {/* Bird 3 (Small distant) */}
          <path d="M210,50 Q216,42 225,45 Q218,48 213,53 Q211,51 210,50 Z" />
          <path d="M213,53 Q219,48 228,52 Q220,55 215,57 Q213,55 213,53 Z" />
          {/* Bird 4 */}
          <path d="M240,68 Q247,59 258,63 Q250,67 244,73 Q242,70 240,68 Z" />
        </g>
      </svg>
    </div>
  );
}
