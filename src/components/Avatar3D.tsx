"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { FslSign } from "@/data/fslSigns";
import type { Language } from "@/lib/i18n";

interface Avatar3DProps {
  sign: FslSign;
  lang: Language;
}

interface FingerRig {
  basePivot: THREE.Group;
  midPivot: THREE.Group;
  tipPivot: THREE.Group;
}

interface HandPoseTargets {
  fingerCurl: [number, number, number, number, number]; // thumb, index, middle, ring, pinky (0=open, 1=curled)
  fingerSpread: [number, number, number, number]; // index..pinky splay
  thumbOppose: number; // 0 = out to side, 1 = tucked across palm
  wristRotX: number;
  wristRotY: number;
  wristRotZ: number;
  armLiftX: number;
  armLiftZ: number;
}

function getPoseForSign(sign: FslSign): HandPoseTargets {
  const { profile, slug } = sign;

  // Default curl: extended = 0.05, curled = 1.0
  const mapCurl = (s: "extended" | "curled" | "any") =>
    s === "extended" ? 0.06 : s === "curled" ? 1.0 : 0.45;

  const fingerCurl: [number, number, number, number, number] = [
    profile.thumb === "extended" ? 0.05 : 0.72,
    mapCurl(profile.index),
    mapCurl(profile.middle),
    mapCurl(profile.ring),
    mapCurl(profile.pinky),
  ];

  let thumbOppose = profile.thumb === "extended" ? 0.1 : 0.92;
  let fingerSpread: [number, number, number, number] = [0.06, 0.02, -0.02, -0.06];

  if (profile.spreadIndexMiddle) {
    fingerSpread = [0.24, -0.14, -0.04, -0.08];
  } else if (slug === "alphabet-u" || slug === "alphabet-r") {
    fingerSpread = [-0.03, 0.03, -0.02, -0.05];
  }

  // Special realistic handshape overrides
  if (slug === "alphabet-a") {
    thumbOppose = 0.18;
    fingerCurl[0] = 0.12;
  } else if (slug === "alphabet-c") {
    fingerCurl[0] = 0.38;
    fingerCurl[1] = 0.52;
    fingerCurl[2] = 0.54;
    fingerCurl[3] = 0.56;
    fingerCurl[4] = 0.56;
    thumbOppose = 0.48;
  } else if (slug === "alphabet-o" || slug === "number-0") {
    fingerCurl[0] = 0.52;
    fingerCurl[1] = 0.78;
    fingerCurl[2] = 0.8;
    fingerCurl[3] = 0.82;
    fingerCurl[4] = 0.82;
    thumbOppose = 0.65;
  } else if (slug === "alphabet-f" || slug === "number-9") {
    fingerCurl[0] = 0.58;
    fingerCurl[1] = 0.82;
    thumbOppose = 0.68;
  } else if (slug === "number-6") {
    fingerCurl[0] = 0.68;
    fingerCurl[4] = 0.86;
    thumbOppose = 0.95;
  } else if (slug === "number-7") {
    fingerCurl[0] = 0.65;
    fingerCurl[3] = 0.86;
    thumbOppose = 0.88;
  } else if (slug === "number-8") {
    fingerCurl[0] = 0.62;
    fingerCurl[2] = 0.86;
    thumbOppose = 0.78;
  } else if (slug === "alphabet-x") {
    fingerCurl[1] = 0.58;
  } else if (slug === "alphabet-r") {
    fingerSpread = [-0.14, 0.12, -0.02, -0.06];
  }

  let wristRotX = 0.05;
  let wristRotY = -0.18;
  let wristRotZ = 0.05;

  if (profile.orientation === "side") {
    wristRotZ = 1.25;
    wristRotY = -0.35;
  } else if (profile.orientation === "down") {
    wristRotX = 1.55;
    wristRotZ = 0.25;
  }

  return {
    fingerCurl,
    fingerSpread,
    thumbOppose,
    wristRotX,
    wristRotY,
    wristRotZ,
    armLiftX: -0.55,
    armLiftZ: -0.16,
  };
}

export default function Avatar3D({ sign, lang }: Avatar3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const signRef = useRef<FslSign>(sign);

  useEffect(() => {
    signRef.current = sign;
  }, [sign]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 560;
    const height = container.clientHeight || 315;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    camera.position.set(0.05, 1.48, 3.15);
    camera.lookAt(0, 1.28, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    // NVIDIA Signs-style Studio Lighting
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.75);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.85);
    keyLight.position.set(2.2, 3.2, 2.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
    fillLight.position.set(-2.5, 1.5, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 1.4);
    rimLight.position.set(-1.5, 2.5, -2.5);
    scene.add(rimLight);

    // Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd99b72,
      roughness: 0.52,
      metalness: 0.04,
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0x3b49df,
      roughness: 0.65,
      metalness: 0.05,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1e1828,
      roughness: 0.72,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.15,
    });
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0xb06854,
      roughness: 0.55,
    });

    // Root Character Group (allows gentle drag rotation)
    const character = new THREE.Group();
    scene.add(character);

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.3, 0.88, 28),
      shirtMat
    );
    torso.position.set(0, 0.76, 0);
    character.add(torso);

    // Shoulders
    const shoulders = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.58, 12, 20),
      shirtMat
    );
    shoulders.rotation.z = Math.PI / 2;
    shoulders.position.set(0, 1.15, 0);
    character.add(shoulders);

    // Neck
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.22, 20),
      skinMat
    );
    neck.position.set(0, 1.32, 0.02);
    character.add(neck);

    // Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.62, 0.03);
    character.add(headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 28), skinMat);
    head.scale.set(0.92, 1.12, 0.96);
    headGroup.add(head);

    // Hair Cap
    const hairTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.268, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    hairTop.scale.set(0.94, 1.08, 0.99);
    hairTop.position.set(0, 0.035, -0.015);
    hairTop.rotation.x = -0.22;
    headGroup.add(hairTop);

    // Eyes & Eyelids for blinking
    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.088, 0.02, 0.215);
    const rightEyeGroup = new THREE.Group();
    rightEyeGroup.position.set(0.088, 0.02, 0.215);

    [leftEyeGroup, rightEyeGroup].forEach((eg) => {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 16), eyeWhiteMat);
      sclera.scale.set(1.1, 0.8, 0.6);
      eg.add(sclera);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 14), pupilMat);
      pupil.position.z = 0.016;
      eg.add(pupil);

      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.009, 0.052, 6, 10),
        hairMat
      );
      brow.rotation.z = Math.PI / 2;
      brow.position.set(0, 0.048, 0.005);
      eg.add(brow);

      headGroup.add(eg);
    });

    // Nose & Gentle Smile
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.065, 12), skinMat);
    nose.rotation.x = Math.PI * 0.45;
    nose.position.set(0, -0.02, 0.245);
    headGroup.add(nose);

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.048, 0.009, 8, 20, Math.PI * 0.72),
      lipMat
    );
    smile.rotation.z = Math.PI * 1.14;
    smile.position.set(0, -0.085, 0.225);
    headGroup.add(smile);

    // Resting Left Arm (viewer's left)
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.42, 1.14, 0);
    character.add(leftShoulder);

    const leftUpper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.095, 0.36, 10, 16),
      shirtMat
    );
    leftUpper.position.set(-0.04, -0.22, 0);
    leftUpper.rotation.z = -0.14;
    leftShoulder.add(leftUpper);

    const leftForearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.072, 0.38, 10, 16),
      skinMat
    );
    leftForearm.position.set(-0.07, -0.58, 0.08);
    leftForearm.rotation.x = -0.35;
    leftShoulder.add(leftForearm);

    // Articulated Signing Right Arm (viewer's right, prominently posed)
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.42, 1.12, 0.02);
    character.add(rightShoulder);

    const rightUpper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.095, 0.34, 10, 16),
      shirtMat
    );
    rightUpper.position.set(0.05, -0.18, 0.06);
    rightUpper.rotation.z = 0.2;
    rightUpper.rotation.x = -0.25;
    rightShoulder.add(rightUpper);

    const rightElbow = new THREE.Group();
    rightElbow.position.set(0.09, -0.38, 0.14);
    rightShoulder.add(rightElbow);

    const rightForearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.07, 0.36, 10, 16),
      skinMat
    );
    rightForearm.position.set(0, 0.18, 0.14);
    rightForearm.rotation.x = 0.72;
    rightElbow.add(rightForearm);

    // Articulated 3D Wrist & Palm
    const wristPivot = new THREE.Group();
    wristPivot.position.set(-0.04, 0.36, 0.32);
    rightElbow.add(wristPivot);

    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.21, 0.055),
      skinMat
    );
    palm.position.set(0, 0.105, 0);
    wristPivot.add(palm);

    // Round palm edges for nicer 3D look
    const palmBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.075, 0.055, 16),
      skinMat
    );
    palmBase.rotation.x = Math.PI / 2;
    palmBase.position.set(0, 0.02, 0);
    wristPivot.add(palmBase);

    // Build 5 Articulated Jointed 3D Fingers
    const createFinger = (
      x: number,
      y: number,
      z: number,
      len1: number,
      len2: number,
      radius: number
    ): FingerRig => {
      const basePivot = new THREE.Group();
      basePivot.position.set(x, y, z);
      wristPivot.add(basePivot);

      const seg1 = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius, len1, 8, 12),
        skinMat
      );
      seg1.position.set(0, len1 / 2 + radius * 0.4, 0);
      basePivot.add(seg1);

      const midPivot = new THREE.Group();
      midPivot.position.set(0, len1 + radius * 0.7, 0);
      basePivot.add(midPivot);

      const seg2 = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius * 0.88, len2, 8, 12),
        skinMat
      );
      seg2.position.set(0, len2 / 2 + radius * 0.3, 0);
      midPivot.add(seg2);

      const tipPivot = new THREE.Group();
      tipPivot.position.set(0, len2 + radius * 0.5, 0);
      midPivot.add(tipPivot);

      return { basePivot, midPivot, tipPivot };
    };

    const thumb = createFinger(-0.095, 0.06, 0.015, 0.065, 0.052, 0.022);
    const index = createFinger(-0.064, 0.21, 0, 0.085, 0.068, 0.019);
    const middle = createFinger(-0.021, 0.215, 0, 0.096, 0.074, 0.02);
    const ring = createFinger(0.022, 0.21, 0, 0.086, 0.068, 0.019);
    const pinky = createFinger(0.064, 0.195, 0, 0.068, 0.054, 0.017);

    const fingers: FingerRig[] = [thumb, index, middle, ring, pinky];

    // Pointer Drag Orbit on Character
    let isDragging = false;
    let prevX = 0;
    let targetCharRotY = -0.08;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      targetCharRotY = Math.max(-0.75, Math.min(0.75, targetCharRotY + dx * 0.008));
    };
    const onPointerUp = () => {
      isDragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // Resize Handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Smooth Current Animation State
    const currentCurl = [0.2, 0.2, 0.2, 0.2, 0.2];
    const currentSpread = [0.05, 0.02, -0.02, -0.05];
    let currentThumbOppose = 0.2;
    let currentWristX = 0;
    let currentWristY = -0.15;
    let currentWristZ = 0;

    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const activeSign = signRef.current;
      const target = getPoseForSign(activeSign);

      // Smooth lerp toward target pose
      const lerpAmt = 0.12;
      for (let i = 0; i < 5; i++) {
        currentCurl[i] += (target.fingerCurl[i] - currentCurl[i]) * lerpAmt;
      }
      for (let i = 0; i < 4; i++) {
        currentSpread[i] += (target.fingerSpread[i] - currentSpread[i]) * lerpAmt;
      }
      currentThumbOppose += (target.thumbOppose - currentThumbOppose) * lerpAmt;
      currentWristX += (target.wristRotX - currentWristX) * lerpAmt;
      currentWristY += (target.wristRotY - currentWristY) * lerpAmt;
      currentWristZ += (target.wristRotZ - currentWristZ) * lerpAmt;

      // Apply finger joint rotations (4 fingers bend forward around X)
      for (let i = 1; i < 5; i++) {
        const curl = currentCurl[i];
        fingers[i].basePivot.rotation.x = curl * 1.35;
        fingers[i].basePivot.rotation.z = currentSpread[i - 1];
        fingers[i].midPivot.rotation.x = curl * 1.45;
      }

      // Thumb articulation (angles across palm or out to side)
      thumb.basePivot.rotation.z = 0.55 - currentThumbOppose * 1.05;
      thumb.basePivot.rotation.y = currentThumbOppose * 0.85;
      thumb.basePivot.rotation.x = currentCurl[0] * 0.7;
      thumb.midPivot.rotation.x = currentCurl[0] * 0.9;

      // Dynamic sign animations (J, Z, 10, Kumusta, Salamat, Paalam, Oo, Hindi)
      let dynWristX = 0;
      let dynWristZ = 0;
      let dynElbowX = 0;
      let dynElbowY = 0;

      if (activeSign.is_dynamic) {
        if (activeSign.slug === "alphabet-j") {
          dynWristZ = Math.sin(elapsed * 3.2) * 0.35;
          dynWristX = Math.cos(elapsed * 3.2) * 0.2;
        } else if (activeSign.slug === "alphabet-z") {
          dynElbowY = Math.sin(elapsed * 4.5) * 0.14;
          dynElbowX = Math.sin(elapsed * 2.25) * 0.1;
        } else if (activeSign.slug === "greeting-oo") {
          dynWristX = Math.sin(elapsed * 5.2) * 0.35;
        } else if (activeSign.slug === "greeting-salamat") {
          dynElbowX = (Math.sin(elapsed * 2.8) + 1) * 0.14;
        } else {
          // Wave / Shake (Kumusta, Paalam, 10, Hindi)
          dynWristZ = Math.sin(elapsed * 4.8) * 0.28;
        }
      }

      wristPivot.rotation.set(
        currentWristX + dynWristX,
        currentWristY,
        currentWristZ + dynWristZ
      );
      rightElbow.rotation.set(dynElbowX, dynElbowY, 0);

      // Subtle lifelike breathing & blinking
      headGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.04;
      headGroup.rotation.x = Math.sin(elapsed * 1.1) * 0.02;
      torso.position.y = 0.76 + Math.sin(elapsed * 1.5) * 0.006;

      const blinkPhase = elapsed % 4.2;
      const eyeScaleY = blinkPhase > 4.05 ? 0.12 : 1;
      leftEyeGroup.scale.y = eyeScaleY;
      rightEyeGroup.scale.y = eyeScaleY;

      character.rotation.y += (targetCharRotY - character.rotation.y) * 0.1;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      domEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      if (domEl.parentNode === container) {
        container.removeChild(domEl);
      }
    };
  }, []);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-900 via-violet-900 to-slate-950 shadow-inner">
      {/* Studio radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(167,139,250,0.28),transparent_62%)]" />

      {/* 3D WebGL Canvas Mount */}
      <div
        ref={containerRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Top Studio Pills */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-indigo-100 backdrop-blur-md">
          {lang === "en" ? "3D FSL Studio Guide • Drag to rotate" : "3D FSL Gabay • I-drag para ikutin"}
        </span>
      </div>
      <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-indigo-500 px-3.5 py-1 text-xs font-bold text-white shadow">
        {sign.shortLabel}
      </div>

      {/* Frosted-Glass Bottom Caption */}
      <div className="pointer-events-none absolute right-3 bottom-3 left-3 rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2 text-center text-xs text-slate-100 backdrop-blur-md">
        <span className="font-semibold text-amber-300">
          {lang === "en" ? sign.title_en : sign.title_fil}:
        </span>{" "}
        {lang === "en" ? sign.hint_en : sign.hint_fil}
      </div>
    </div>
  );
}