import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { storySettings } from "./story.js";
import { skillExamples } from "./skills.js";

// Edit the visual design and choreography here. Coordinates are in scene units.
export const sceneSettings = {
  colors: {
    body: "#fafbff",
    platform: "#f2f4fc",
    navy: "#1c2e4d",
    blue: "#85c0fa",
    lavender: "#ada8f7",
    purple: "#d59aef",
    pink: "#ef99d4",
    peach: "#ffb17d",
  },
  positions: {
    desktop: { creator: [0, 0, -1.8], a: [-2.35, 0, 1.05], b: [2.35, 0, 1.05] },
    mobile: { creator: [0, 0, -1.75], a: [-1.75, 0, 1.15], b: [1.75, 0, 1.15] },
  },
  camera: {
    desktop: [0, 5.8, 12],
    mobile: [0, 6.3, 12],
    target: [0, 0.6, 0.5],
    desktopWidth: 8,
    mobileWidth: 6.2,
  },
  animation: {
    duration: 3.2,
    playbackSpeed: 1,
    assemblyEnd: 0.5,
    firstDeparture: 0.9,
    secondDeparture: 1.06,
    travelDuration: 1.1,
    initialAttemptDuration: 1.6,
  },
  maxPixelRatio: 1.5,
};

// Smoothstep starts and ends with zero speed. It makes alignment feel deliberate.
function smoothstep(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function progressBetween(time, start, end) {
  return smoothstep((time - start) / (end - start));
}

export function createScene(container, options) {
  const settings = sceneSettings;
  const resources = [];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 2, -2, 0.1, 50);
  const world = new THREE.Group();
  scene.add(world);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, settings.maxPixelRatio),
  );
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  // A tiny generated room supplies soft reflections without downloading an HDR image.
  const room = new RoomEnvironment();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environment = environmentGenerator.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  environmentGenerator.dispose();

  const keyLight = new THREE.DirectionalLight(0xfff6ee, 2.1);
  keyLight.position.set(-3, 8, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(512, 512);
  keyLight.shadow.camera.left = -7;
  keyLight.shadow.camera.right = 7;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -6;
  keyLight.shadow.normalBias = 0.04;
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.radius = 3;
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0xdbe7ff, 0xddd6ee, 1.15));
  const fillLight = new THREE.DirectionalLight(0xe5eaff, 0.8);
  fillLight.position.set(5, 4, -3);
  scene.add(fillLight);

  function keepResource(resource) {
    resources.push(resource);
    return resource;
  }
  const geometries = {
    body: keepResource(new RoundedBoxGeometry(0.91, 1.08, 0.73, 5, 0.23)),
    base: keepResource(new RoundedBoxGeometry(0.82, 0.12, 0.63, 3, 0.06)),
    eye: keepResource(new RoundedBoxGeometry(0.047, 0.1, 0.025, 3, 0.022)),
    platform: keepResource(new RoundedBoxGeometry(1.83, 0.17, 1.32, 5, 0.085)),
    platformBase: keepResource(
      new RoundedBoxGeometry(1.77, 0.07, 1.26, 3, 0.034),
    ),
    slot: keepResource(new RoundedBoxGeometry(0.92, 0.022, 0.46, 3, 0.011)),
    block: keepResource(new RoundedBoxGeometry(0.84, 0.84, 0.28, 5, 0.105)),
    fragment: keepResource(new RoundedBoxGeometry(0.38, 0.38, 0.26, 4, 0.06)),
    smallBlock: keepResource(
      new RoundedBoxGeometry(0.36, 0.36, 0.18, 4, 0.065),
    ),
    emblem: keepResource(new THREE.PlaneGeometry(0.46, 0.46)),
    smallEmblem: keepResource(new THREE.PlaneGeometry(0.22, 0.22)),
    contact: keepResource(new THREE.PlaneGeometry(2.4, 2.2)),
  };
  const materials = {
    body: keepResource(
      new THREE.MeshPhysicalMaterial({
        color: settings.colors.body,
        roughness: 0.34,
        metalness: 0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.3,
      }),
    ),
    base: keepResource(
      new THREE.MeshStandardMaterial({ color: "#e8eaf4", roughness: 0.5 }),
    ),
    platform: keepResource(
      new THREE.MeshPhysicalMaterial({
        color: settings.colors.platform,
        roughness: 0.38,
        clearcoat: 0.35,
      }),
    ),
    platformBase: keepResource(
      new THREE.MeshStandardMaterial({ color: "#dfe5f0", roughness: 0.7 }),
    ),
    navy: keepResource(
      new THREE.MeshStandardMaterial({
        color: settings.colors.navy,
        roughness: 0.5,
      }),
    ),
    slot: keepResource(
      new THREE.MeshStandardMaterial({ color: "#e1e3f1", roughness: 0.7 }),
    ),
  };
  for (const colorName of ["blue", "lavender", "purple", "pink", "peach"]) {
    materials[colorName] = keepResource(
      new THREE.MeshPhysicalMaterial({
        color: settings.colors[colorName],
        roughness: 0.25,
        metalness: 0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.24,
        envMapIntensity: 0.6,
      }),
    );
  }

  function createEmblemTexture(skillId) {
    const drawing = document.createElement("canvas");
    drawing.width = 128;
    drawing.height = 128;
    const context = drawing.getContext("2d");
    context.strokeStyle = "#ffffff";
    context.lineWidth = 6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    if (skillId === "wallet") {
      context.roundRect(26, 39, 77, 58, 12);
      context.moveTo(32, 39);
      context.lineTo(32, 30);
      context.lineTo(88, 30);
      context.moveTo(100, 58);
      context.lineTo(81, 58);
      context.quadraticCurveTo(70, 58, 70, 69);
      context.quadraticCurveTo(70, 79, 81, 79);
      context.lineTo(103, 79);
    } else if (skillId === "api") {
      context.moveTo(42, 35);
      context.lineTo(17, 64);
      context.lineTo(42, 93);
      context.moveTo(86, 35);
      context.lineTo(111, 64);
      context.lineTo(86, 93);
      context.moveTo(72, 24);
      context.lineTo(56, 104);
    } else {
      context.roundRect(30, 20, 70, 88, 10);
      context.moveTo(30, 48);
      context.lineTo(100, 48);
      context.moveTo(55, 48);
      context.lineTo(55, 108);
      context.moveTo(66, 78);
      context.lineTo(77, 88);
      context.lineTo(100, 65);
    }
    context.stroke();
    const texture = keepResource(new THREE.CanvasTexture(drawing));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const emblemMaterials = {};
  for (const skillId of ["wallet", "api", "csv"]) {
    emblemMaterials[skillId] = keepResource(
      new THREE.MeshBasicMaterial({
        map: createEmblemTexture(skillId),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
  }

  // Soft contact shadows anchor the objects; the directional shadow adds shape.
  const shadowDrawing = document.createElement("canvas");
  shadowDrawing.width = 128;
  shadowDrawing.height = 128;
  const shadowContext = shadowDrawing.getContext("2d");
  const gradient = shadowContext.createRadialGradient(64, 64, 8, 64, 64, 62);
  gradient.addColorStop(0, "rgba(63, 76, 105, 0.12)");
  gradient.addColorStop(0.5, "rgba(63, 76, 105, 0.04)");
  gradient.addColorStop(1, "rgba(63, 76, 105, 0)");
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const shadowTexture = keepResource(new THREE.CanvasTexture(shadowDrawing));
  const contactMaterial = keepResource(
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    }),
  );
  const groundMaterial = keepResource(
    new THREE.ShadowMaterial({ opacity: 0.035, depthWrite: false }),
  );
  const ground = new THREE.Mesh(
    keepResource(new THREE.PlaneGeometry(30, 30)),
    groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  world.add(ground);

  const selectableMeshes = [];
  const agentMeshes = [];
  const skillBlocks = [];
  const stations = [];
  const mainSkillPosition = new THREE.Vector3(0.03, 0.68, 0.98);
  const labelVector = new THREE.Vector3();

  function createSkillBlock(skillId, colorName, small = false) {
    const block = new THREE.Group();
    const geometry = small ? geometries.smallBlock : geometries.block;
    const tile = new THREE.Mesh(geometry, materials[colorName]);
    tile.castShadow = true;
    tile.receiveShadow = true;
    tile.userData.skillId = skillId;
    tile.userData.block = block;
    block.add(tile);
    selectableMeshes.push(tile);
    const emblemGeometry = small ? geometries.smallEmblem : geometries.emblem;
    const emblem = new THREE.Mesh(emblemGeometry, emblemMaterials[skillId]);
    emblem.position.z = small ? 0.092 : 0.142;
    block.add(emblem);
    block.userData.hoverAmount = 0;
    skillBlocks.push(block);
    return block;
  }

  function createAgent(colorName) {
    const agent = new THREE.Group();
    const body = new THREE.Mesh(geometries.body, materials.body);
    body.position.y = 0.84;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.agent = agent;
    agentMeshes.push(body);
    agent.add(body);
    const accent = new THREE.Mesh(geometries.base, materials[colorName]);
    accent.position.y = 0.24;
    accent.castShadow = true;
    agent.add(accent);
    for (const eyeX of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(geometries.eye, materials.navy);
      eye.position.set(eyeX, 1.06, 0.37);
      agent.add(eye);
    }
    return agent;
  }

  function createStation(id, colorName, index) {
    const group = new THREE.Group();
    const agent = createAgent(colorName);
    group.add(agent);
    const platformMaterial = keepResource(materials.platform.clone());
    platformMaterial.emissive.set(settings.colors[colorName]);
    const platform = new THREE.Mesh(geometries.platform, platformMaterial);
    platform.position.set(0, 0.155, 1.05);
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);
    const platformBase = new THREE.Mesh(
      geometries.platformBase,
      materials.platformBase,
    );
    platformBase.position.set(0, 0.063, 1.05);
    group.add(platformBase);
    const slot = new THREE.Mesh(geometries.slot, materials.slot);
    slot.position.set(0.03, 0.251, 0.98);
    group.add(slot);
    const contact = new THREE.Mesh(geometries.contact, contactMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, 0.001, 0.7);
    group.add(contact);

    const assembly = new THREE.Group();
    assembly.position.copy(mainSkillPosition);
    assembly.rotation.x = -0.15;
    group.add(assembly);
    const fragments = [];
    const joinedPositions = [
      [-0.196, -0.196, 0],
      [0.196, -0.196, 0],
      [-0.196, 0.196, 0],
      [0.196, 0.196, 0],
    ];
    for (let pieceIndex = 0; pieceIndex < 4; pieceIndex += 1) {
      let pieceMaterial = materials[colorName];
      if (pieceIndex === 2) pieceMaterial = materials.purple;
      if (pieceIndex === 3) pieceMaterial = materials.pink;
      const piece = new THREE.Mesh(geometries.fragment, pieceMaterial);
      piece.castShadow = true;
      const joined = new THREE.Vector3(...joinedPositions[pieceIndex]);
      const unfinished = joined.clone();
      if (pieceIndex === 3) {
        unfinished.x += 0.32 + index * 0.07;
        unfinished.y += 0.14 + index * 0.05;
        unfinished.z += 0.04;
      }
      if (index === 1 && pieceIndex === 2) {
        unfinished.x -= 0.35;
        unfinished.y += 0.08;
      }
      piece.position.copy(unfinished);
      piece.userData.skillId = "wallet";
      piece.userData.block = assembly;
      assembly.add(piece);
      selectableMeshes.push(piece);
      fragments.push({ mesh: piece, joined, unfinished });
    }
    assembly.userData.hoverAmount = 0;
    skillBlocks.push(assembly);
    const apiPiece = createSkillBlock("api", "blue", true);
    apiPiece.position.set(-0.63, 0.36, 1.15);
    apiPiece.rotation.set(-0.45, -0.12, -0.18);
    group.add(apiPiece);
    const csvPiece = createSkillBlock("csv", "peach", true);
    csvPiece.position.set(0.65, 0.4, 1.25);
    csvPiece.rotation.set(-0.35, 0.1, 0.14);
    group.add(csvPiece);
    world.add(group);
    const station = {
      id,
      group,
      agent,
      assembly,
      fragments,
      platformMaterial,
      index,
      apiPiece,
      csvPiece,
      label: container.querySelector('[data-agent="' + id + '"]'),
    };
    stations.push(station);
    return station;
  }

  const creator = createStation("creator", "lavender", 0);
  const agentA = createStation("a", "blue", 1);
  const agentB = createStation("b", "peach", 2);
  const original = createSkillBlock("wallet", "lavender");
  const copyA = createSkillBlock("wallet", "lavender");
  const copyB = createSkillBlock("wallet", "lavender");
  world.add(original, copyA, copyB);

  // The exploded package uses three thin rounded layers made from the same palette.
  const layerGeometry = keepResource(
    new RoundedBoxGeometry(1.08, 1.08, 0.13, 5, 0.05),
  );
  const packageLayers = [];
  const layerNames = ["instructions", "script", "examples"];
  const layerColors = ["blue", "lavender", "peach"];
  for (let index = 0; index < layerNames.length; index += 1) {
    const material = keepResource(materials[layerColors[index]].clone());
    material.transparent = true;
    const mesh = new THREE.Mesh(layerGeometry, material);
    mesh.castShadow = true;
    mesh.userData.skillId = "wallet";
    world.add(mesh);
    packageLayers.push({
      mesh,
      label: document.querySelector('[data-layer="' + layerNames[index] + '"]'),
    });
    selectableMeshes.push(mesh);
  }
  const cameraTarget = new THREE.Vector3();
  const tooltip = document.createElement("span");
  tooltip.className = "scene-tooltip";
  tooltip.hidden = true;
  tooltip.setAttribute("aria-hidden", "true");
  container.appendChild(tooltip);

  // A small translucent stripe travels across the finished block once. No bloom pass.
  const highlightDrawing = document.createElement("canvas");
  highlightDrawing.width = 32;
  highlightDrawing.height = 8;
  const highlightContext = highlightDrawing.getContext("2d");
  const highlightGradient = highlightContext.createLinearGradient(0, 0, 32, 0);
  highlightGradient.addColorStop(0, "rgba(255,255,255,0)");
  highlightGradient.addColorStop(0.5, "rgba(255,255,255,0.8)");
  highlightGradient.addColorStop(1, "rgba(255,255,255,0)");
  highlightContext.fillStyle = highlightGradient;
  highlightContext.fillRect(0, 0, 32, 8);
  const highlightTexture = keepResource(
    new THREE.CanvasTexture(highlightDrawing),
  );
  const highlightMaterial = keepResource(
    new THREE.MeshBasicMaterial({
      map: highlightTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const surfaceHighlight = new THREE.Mesh(
    keepResource(new THREE.PlaneGeometry(0.12, 0.55)),
    highlightMaterial,
  );
  surfaceHighlight.position.z = 0.144;
  original.add(surfaceHighlight);
  const originalPosition = new THREE.Vector3();
  const destinationA = new THREE.Vector3();
  const destinationB = new THREE.Vector3();

  function createTransferPath() {
    const material = keepResource(
      new THREE.LineBasicMaterial({
        color: "#b4a9e7",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const geometry = keepResource(new THREE.BufferGeometry());
    const line = new THREE.Line(geometry, material);
    world.add(line);
    return { line, curve: null };
  }
  const pathA = createTransferPath();
  const pathB = createTransferPath();
  const transferPaths = [pathA, pathB];
  const pathPoint = new THREE.Vector3();
  let heroMode = "sell";
  let mode = "hero";
  let cameraBlend = 0;
  let storyProgress = 0;
  let targetStoryProgress = 0;
  let entranceTime = 0;
  let currentViewWidth = settings.camera.desktopWidth;
  let hoveredAgent = null;
  let sceneDirty = true;
  let progress = 0;
  let reducedMotion = options.reducedMotion;
  let mobile = false;
  let disposed = false;
  let contextLost = false;
  let inView = true;
  let animationFrame = 0;
  let lastFrameTime = 0;
  let lastRenderTime = 0;
  let initialAttemptTime = 0;
  let idleTime = 0;
  let hoveredBlock = null;
  let pointerDownPosition = null;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const pointer = new THREE.Vector2();
  const parallaxTarget = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  function rebuildTransferPath(path, destination) {
    const start = originalPosition.clone();
    start.y += 0.2;
    const control = start.clone().lerp(destination, 0.5);
    control.y = 2.05;
    path.curve = new THREE.QuadraticBezierCurve3(
      start,
      control,
      destination.clone(),
    );
    path.line.geometry.setFromPoints(path.curve.getPoints(48));
  }

  function resizeScene() {
    if (disposed) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    mobile = window.innerWidth <= 760;
    const positions = mobile
      ? settings.positions.mobile
      : settings.positions.desktop;
    for (const station of stations)
      station.group.position.set(...positions[station.id]);
    originalPosition.copy(creator.group.position).add(mainSkillPosition);
    destinationA.copy(agentA.group.position).add(mainSkillPosition);
    destinationB.copy(agentB.group.position).add(mainSkillPosition);
    rebuildTransferPath(pathA, destinationA);
    rebuildTransferPath(pathB, destinationB);
    const viewWidth = mobile
      ? settings.camera.mobileWidth
      : settings.camera.desktopWidth;
    const viewHeight = (viewWidth * height) / width;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    const cameraPosition = mobile
      ? settings.camera.mobile
      : settings.camera.desktop;
    camera.position.set(...cameraPosition);
    camera.lookAt(...settings.camera.target);
    camera.updateProjectionMatrix();
    currentViewWidth = viewWidth;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, settings.maxPixelRatio),
    );
    renderer.setSize(width, height, false);
    requestRender();
  }

  function updateAgentPose(station, time) {
    let tiltX = 0;
    let tiltY = 0;
    let tiltZ = 0;
    if (!reducedMotion) {
      tiltZ = Math.sin(idleTime * 0.7 + station.index * 1.8) * 0.006;
      if (station.id === "creator") {
        const attention = Math.sin(Math.PI * progressBetween(time, 0, 0.9));
        tiltX += attention * 0.045;
        tiltY -= attention * 0.11;
      } else {
        const departure =
          station.id === "a"
            ? settings.animation.firstDeparture
            : settings.animation.secondDeparture;
        const attention = Math.sin(
          Math.PI * progressBetween(time, departure - 0.15, departure + 1.35),
        );
        tiltY = attention * (station.id === "a" ? 0.19 : -0.19);
        // One small nod as the copy settles, rather than a repeating bounce.
        tiltX =
          Math.sin(
            Math.PI * progressBetween(time, departure + 1.1, departure + 1.7),
          ) * 0.065;
      }
    }
    station.agent.rotation.set(tiltX, tiltY, tiltZ);
  }

  function updateAssembly(station, time) {
    let alignment = progressBetween(time, 0, settings.animation.assemblyEnd);
    let disappearance = progressBetween(time, 0.38, 0.57);
    if (station.id !== "creator") {
      const departure =
        station.id === "a"
          ? settings.animation.firstDeparture
          : settings.animation.secondDeparture;
      alignment = progressBetween(time, departure + 0.75, departure + 1.1);
      disappearance = progressBetween(time, departure + 0.9, departure + 1.1);
    }
    const attempt = progressBetween(
      initialAttemptTime,
      0,
      settings.animation.initialAttemptDuration,
    );
    for (
      let pieceIndex = 0;
      pieceIndex < station.fragments.length;
      pieceIndex += 1
    ) {
      const fragment = station.fragments[pieceIndex];
      fragment.mesh.position
        .copy(fragment.unfinished)
        .lerp(fragment.joined, alignment);
      if (pieceIndex < 3 && time === 0) {
        fragment.mesh.position.x += (1 - attempt) * (pieceIndex - 1) * 0.07;
        fragment.mesh.rotation.z = (1 - attempt) * (pieceIndex - 1) * 0.1;
      } else fragment.mesh.rotation.z = 0;
      if (!reducedMotion && mode === "hero" && pieceIndex === 3) {
        fragment.mesh.position.y +=
          Math.sin(idleTime * 0.8 + station.index) * 0.013 * (1 - alignment);
      }
    }
    station.assembly.visible = disappearance < 1;
    station.assembly.scale.setScalar(
      Math.max(0.001, 1 - disappearance) *
        (1 + station.assembly.userData.hoverAmount * 0.035),
    );
    station.platformMaterial.emissiveIntensity = disappearance * 0.07;
  }

  function updateTravel(block, path, time, departure) {
    const emergence = progressBetween(time, departure - 0.25, departure);
    block.visible = time > departure - 0.25;
    if (!block.visible) return;
    const travel = progressBetween(
      time,
      departure,
      departure + settings.animation.travelDuration,
    );
    // A quadratic Bézier is a start point, one raised control point, and an end point.
    // Eased progress controls the speed along that fixed arc.
    path.curve.getPoint(travel, block.position);
    block.position.x += (1 - emergence) * (block === copyA ? -0.08 : 0.08);
    const settle = progressBetween(time, departure + 1.1, departure + 1.42);
    block.position.y -= Math.sin(settle * Math.PI) * 0.025;
    block.position.y += block.userData.hoverAmount * 0.025;
    block.rotation.set(
      -0.15,
      Math.sin(travel * Math.PI) * (block === copyA ? -0.14 : 0.14),
      0,
    );
    block.scale.setScalar(emergence * (1 + block.userData.hoverAmount * 0.035));
  }

  function updateLabels() {
    camera.updateMatrixWorld();
    world.updateMatrixWorld(true);
    for (const station of stations) {
      const label = station.label;
      labelVector.set(0, 0.02, 1.99);
      station.group.localToWorld(labelVector);
      labelVector.project(camera);
      const halfWidth = (label.offsetWidth || 84) / 2;
      label.style.left = THREE.MathUtils.clamp(
        ((labelVector.x + 1) / 2) * container.clientWidth,
        halfWidth + 2, container.clientWidth - halfWidth - 2,
      ) + "px";
      // The initial frame precedes scene-ready's display:flex. Reserve the
      // label height then as well, so the entrance never clips a phone label.
      label.style.top = THREE.MathUtils.clamp(
        ((1 - labelVector.y) / 2) * container.clientHeight,
        2, container.clientHeight - (label.offsetHeight || 28) - 2,
      ) + "px";
    }
  }

  function updateAgentNames(story = false) {
    const names = story ? ["Creator", "Agent A", "Agent B"]
      : heroMode === "sell" ? ["Your agent", "Agent A", "Agent B"]
      : ["Skill creator", "Your agent", "Agent B"];
    for (const station of stations) {
      const name = station.label.querySelector(".agent-name");
      if (name.textContent !== names[station.index]) name.textContent = names[station.index];
      station.label.classList.toggle("is-your-agent", names[station.index] === "Your agent");
    }
  }

  function updateHeroScene(delta) {
    if (cameraBlend > 0) updateCamera(0);
    const entrance = progressBetween(entranceTime, 0, 1);
    for (const station of stations) {
      station.group.scale.setScalar(1);
      station.group.visible = true;
      station.group.position.y = -0.12 * (1 - entrance);
      station.assembly.position.y =
        mainSkillPosition.y +
        0.12 * (1 - progressBetween(entranceTime, 0.15, 1));
      station.label.style.visibility = "visible";
      station.label.style.opacity = "1";
      station.apiPiece.visible = station.csvPiece.visible = true;
      station.apiPiece.scale.setScalar(1);
      station.csvPiece.scale.setScalar(1);
    }
    for (const block of [copyA, copyB]) {
      for (const mesh of block.children) mesh.material.opacity = 1;
    }
    for (const layer of packageLayers) layer.mesh.visible = false;
    for (const mesh of original.children) mesh.material.opacity = 1;
    container.dataset.mode = "hero";
    progress = Math.min(settings.animation.duration,
      progress + delta * settings.animation.playbackSpeed);
    initialAttemptTime += delta;
    idleTime += delta;
    for (const block of skillBlocks) {
      const target = block === hoveredBlock && !reducedMotion ? 1 : 0;
      // Exponential easing feels the same at different frame rates.
      block.userData.hoverAmount +=
        (target - block.userData.hoverAmount) * (1 - Math.exp(-delta * 12));
    }
    // Both hero modes ease back into chapter one's shared scroll composition.
    // Hero selection never writes the scroll controller's target or displayed progress.
    const bridgeBlend = smoothstep(cameraBlend);
    const previewProgress = progress * (1 - bridgeBlend);
    const buying = heroMode === "buy";
    for (const station of stations) {
      updateAssembly(station, buying && station.id === "creator"
        ? THREE.MathUtils.lerp(settings.animation.duration, previewProgress, bridgeBlend)
        : previewProgress);
      if (buying && station.id === "a") {
        // The recipient waits for an arriving skill instead of building a duplicate.
        station.assembly.scale.multiplyScalar(bridgeBlend);
        station.assembly.visible = station.assembly.visible && bridgeBlend > 0;
      }
      if (buying && station.id === "b") {
        // Keep the third platform complete and colorful in Buy mode, too.
        station.assembly.visible = true;
        station.assembly.scale.setScalar(1);
        for (const fragment of station.fragments)
          fragment.mesh.position.lerp(fragment.joined, 1 - bridgeBlend);
      }
      updateAgentPose(station, previewProgress);
      station.apiPiece.position.y =
        0.36 + station.apiPiece.userData.hoverAmount * 0.025;
      station.csvPiece.position.y =
        0.4 + station.csvPiece.userData.hoverAmount * 0.025;
    }
    const finish = buying
      ? THREE.MathUtils.lerp(1, progressBetween(previewProgress, 0.38, 0.57), bridgeBlend)
      : progressBetween(previewProgress, 0.38, 0.57);
    const lift =
      progressBetween(previewProgress, 0.5, 0.9) *
      (1 - progressBetween(previewProgress, 2.35, 2.85));
    original.visible = finish > 0;
    original.position.copy(originalPosition);
    original.position.y += lift * 0.2 + original.userData.hoverAmount * 0.025;
    original.rotation.set(-0.15, 0, 0);
    original.scale.setScalar(
      finish * (1 + original.userData.hoverAmount * 0.035),
    );
    const highlight = Math.sin(Math.PI * progressBetween(progress, 0.38, 0.76));
    surfaceHighlight.position.x = THREE.MathUtils.lerp(
      -0.26,
      0.26,
      progressBetween(progress, 0.5, 0.86),
    );
    highlightMaterial.opacity =
      Math.sin(Math.PI * progressBetween(progress, 0.5, 0.86)) * 0.25;
    materials.lavender.emissive.set("#ddd5ff");
    materials.lavender.emissiveIntensity = highlight * 0.09;
    updateTravel(copyA, pathA, previewProgress, settings.animation.firstDeparture);
    if (buying) copyB.visible = false;
    else updateTravel(copyB, pathB, previewProgress, settings.animation.secondDeparture);
    const pathOpacity =
      progressBetween(previewProgress, 0.65, 0.95) *
      (1 - progressBetween(previewProgress, 2.7, 3.2));
    pathA.line.material.opacity = pathOpacity * 0.45;
    pathB.line.material.opacity = pathOpacity * 0.45;
    pathA.line.visible = pathOpacity > 0;
    pathB.line.visible = !buying && pathOpacity > 0;
    const parallaxEase = 1 - Math.exp(-delta * 5);
    world.rotation.y +=
      (parallaxTarget.x * 0.025 - world.rotation.y) * parallaxEase;
    world.rotation.x +=
      (parallaxTarget.y * 0.008 - world.rotation.x) * parallaxEase;
    updateAgentNames();
    updateLabels();
    container.dataset.story = progress === settings.animation.duration
      ? buying ? "received" : "shared"
      : buying ? "receiving" : "packaging";
  }

  function updateCamera(scrollProgress) {
    const blend = smoothstep(cameraBlend);
    const stage = document.querySelector(".story-stage");
    const framing = mobile
      ? storySettings.camera.mobile
      : storySettings.camera.desktop;
    const heroCamera = mobile ? settings.camera.mobile : settings.camera.desktop;
    for (let axis = 0; axis < 3; axis += 1) {
      camera.position.setComponent(axis,
        THREE.MathUtils.lerp(heroCamera[axis], framing.position[axis], blend));
      cameraTarget.setComponent(axis,
        THREE.MathUtils.lerp(settings.camera.target[axis], framing.target[axis], blend));
    }
    camera.lookAt(cameraTarget);
    currentViewWidth = framing.width;
    const compact = mobile ? THREE.MathUtils.clamp(
      (framing.compactThreshold - stage.clientHeight) / framing.compactHeightRange,
      0, 1,
    ) : 0;
    currentViewWidth *= 1 + compact * (mobile ? framing.compactZoom : 0);
    let mobileOffset = 0;
    if (mobile) {
      const stageBounds = stage.getBoundingClientRect();
      const copyBounds = document.querySelector(".story-copy").getBoundingClientRect();
      const copyBottom = copyBounds.bottom - stageBounds.top;
      const labelSpace = 60;
      const start = copyBottom + 20 + labelSpace;
      const end = Math.max(start + 120, stage.clientHeight - 145);
      const availableHeight = end - start;
      const sceneSpan = 4.7;
      const fitWidth = stage.clientWidth * sceneSpan / availableHeight;
      currentViewWidth = Math.max(currentViewWidth, fitWidth);
      mobileOffset = ((start + end) / 2 - stage.clientHeight / 2 - 8) *
        currentViewWidth / stage.clientWidth;
      document.querySelector("#story-layer-labels").style.setProperty(
        "--layer-label-top", copyBottom + 16 + "px",
      );
    }
    currentViewWidth = THREE.MathUtils.lerp(
      mobile ? settings.camera.mobileWidth : settings.camera.desktopWidth,
      currentViewWidth, blend,
    );
    const height =
      (currentViewWidth * container.clientHeight) / container.clientWidth;
    // Interpolate the scene's screen center directly. Interpolating a frustum
    // offset while its DOM container widens creates a sideways dip in the bridge.
    const heroBounds = document.querySelector(".hero-scene-anchor").getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const canvasBounds = container.getBoundingClientRect();
    const center = THREE.MathUtils.lerp(
      heroBounds.left + heroBounds.width / 2,
      stageBounds.left + stageBounds.width * framing.center, blend);
    const offset = ((center - canvasBounds.left) / canvasBounds.width - 0.5) * currentViewWidth;
    camera.left = -currentViewWidth / 2 - offset;
    camera.right = currentViewWidth / 2 - offset;
    const verticalOffset = mobile ? mobileOffset * blend : 0;
    camera.top = height / 2 + verticalOffset;
    camera.bottom = -height / 2 + verticalOffset;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function updateSkillAssembly(scrollProgress) {
    const assembly = storySettings.assembly;
    const arrival = progressBetween(
      scrollProgress,
      assembly.appear,
      assembly.exploded,
    );
    const join = progressBetween(
      scrollProgress,
      assembly.joinStart,
      assembly.joinEnd,
    );
    const fade = progressBetween(scrollProgress, 0.46, assembly.joinEnd);
    const focus = 1 - progressBetween(scrollProgress, 0.49, 0.6);
    const packageOffset = mobile ? assembly.mobileOffset : assembly.desktopOffset;
    const float = packageOffset[1] * focus;
    for (let index = 0; index < packageLayers.length; index += 1) {
      const layer = packageLayers[index];
      layer.mesh.visible =
        scrollProgress >= assembly.appear && scrollProgress < assembly.joinEnd;
      layer.mesh.position.copy(originalPosition);
      layer.mesh.position.x += packageOffset[0] * focus;
      layer.mesh.position.y +=
        float + (1 - join) *
          (assembly.layerLift + assembly.layerSpacing * (1 - index));
      layer.mesh.position.z += packageOffset[2] * focus;
      layer.mesh.position.z += assembly.layerFrontOffset * (1 - join);
      layer.mesh.position.z +=
        (index - 1) * THREE.MathUtils.lerp(0.34, 0.09, join);
      layer.mesh.rotation.set(THREE.MathUtils.lerp(-0.8, -0.15, join), 0, 0);
      layer.mesh.scale.setScalar(Math.max(0.001, arrival));
      layer.mesh.material.opacity = 1 - fade;
      labelVector.copy(layer.mesh.position);
      labelVector.x += mobile ? -1.45 : 0.74;
      labelVector.project(camera);
      layer.label.style.left =
        Math.min(((labelVector.x + 1) / 2) * container.clientWidth,
          container.clientWidth - layer.label.offsetWidth - 24) + "px";
      layer.label.style.top =
        ((1 - labelVector.y) / 2) * container.clientHeight + "px";
    }
    original.visible = scrollProgress > 0.455;
    original.position.copy(originalPosition);
    original.position.x += packageOffset[0] * focus;
    original.position.y += float;
    original.position.z += packageOffset[2] * focus;
    original.rotation.set(-0.15, 0, 0);
    const completedScale = THREE.MathUtils.lerp(
      1.3,
      1,
      progressBetween(scrollProgress, 0.5, 0.62),
    );
    original.scale.setScalar(
      progressBetween(scrollProgress, 0.455, 0.49) * completedScale,
    );
    surfaceHighlight.position.x = THREE.MathUtils.lerp(
      -0.26,
      0.26,
      progressBetween(scrollProgress, 0.48, 0.515),
    );
    highlightMaterial.opacity =
      Math.sin(Math.PI * progressBetween(scrollProgress, 0.48, 0.515)) * 0.28;
    container.dataset.assembly = "separate";
    if (scrollProgress >= 0.27) container.dataset.assembly = "exploded";
    if (scrollProgress >= assembly.joinEnd - 0.001)
      container.dataset.assembly = "packaged";
  }

  function updateStoryCopy(block, path, scrollProgress, departure) {
    const timings = storySettings.transfers;
    const emerge = progressBetween(
      scrollProgress,
      departure - 0.025,
      departure,
    );
    const travel = progressBetween(
      scrollProgress,
      departure,
      departure + timings.duration,
    );
    const settle = progressBetween(
      scrollProgress,
      departure + timings.duration,
      departure + timings.duration + timings.settle,
    );
    block.visible = scrollProgress > departure - 0.025;
    block.scale.setScalar(emerge * (1 + block.userData.hoverAmount * 0.04));
    path.curve.getPoint(travel, block.position);
    block.position.y -= Math.sin(settle * Math.PI) * 0.025;
    block.position.y += block.userData.hoverAmount * 0.03;
    let direction = 1;
    if (block === copyA) direction = -1;
    block.rotation.set(-0.15, direction * Math.sin(travel * Math.PI) * 0.14, 0);
  }

  function updateSkillTransfers(scrollProgress) {
    const timings = storySettings.transfers;
    // Reuse the existing path buffers as the package returns to its platform.
    for (const path of transferPaths) {
      path.curve.v0.copy(original.position);
      path.curve.v0.y += 0.1;
      path.curve.v1.copy(path.curve.v0).lerp(path.curve.v2, 0.5);
      path.curve.v1.y = 2.05;
      const positions = path.line.geometry.attributes.position;
      for (let index = 0; index < positions.count; index += 1) {
        path.curve.getPoint(index / (positions.count - 1), pathPoint);
        positions.setXYZ(index, pathPoint.x, pathPoint.y, pathPoint.z);
      }
      positions.needsUpdate = true;
      path.line.geometry.computeBoundingSphere();
    }
    updateStoryCopy(copyA, pathA, scrollProgress, timings.first);
    updateStoryCopy(copyB, pathB, scrollProgress, timings.second);
    const paths =
      progressBetween(scrollProgress, 0.52, 0.57) *
      (1 - progressBetween(scrollProgress, timings.fadeStart, timings.fadeEnd));
    pathA.line.visible = paths > 0;
    pathB.line.visible = paths > 0;
    pathA.line.material.opacity = paths * 0.45;
    pathB.line.material.opacity = paths * 0.45;
    let copies = 0;
    if (scrollProgress >= timings.first - 0.025) copies += 1;
    if (scrollProgress >= timings.second - 0.025) copies += 1;
    container.dataset.copies = String(copies);
  }

  function updateStoryScene(scrollProgress) {
    updateAgentNames(true);
    world.rotation.set(0, 0, 0);
    updateCamera(scrollProgress);
    const positions = mobile
      ? settings.positions.mobile
      : settings.positions.desktop;
    for (const station of stations) {
      station.group.position.set(...positions[station.id]);
      station.assembly.position.copy(mainSkillPosition);
      let assemblyTime = progressBetween(scrollProgress, 0.21, 0.27) * 0.6;
      if (station.id !== "creator") {
        const departure =
          station.id === "a"
            ? storySettings.transfers.first
            : storySettings.transfers.second;
        const completion = progressBetween(
          scrollProgress,
          departure + 0.12,
          departure + 0.15,
        );
        assemblyTime = completion * (station.id === "a" ? 2 : 2.16);
      }
      station.group.scale.setScalar(1);
      station.group.visible = true;
      station.apiPiece.visible = station.csvPiece.visible = true;
      station.apiPiece.scale.setScalar(1);
      station.csvPiece.scale.setScalar(1);
      station.label.style.visibility =
        (scrollProgress < 0.25 || scrollProgress > 0.54)
          ? "visible"
          : "hidden";
      station.label.style.opacity = "1";
      updateAssembly(station, assemblyTime);
      let tilt =
        Math.sin(
          Math.PI *
            progressBetween(scrollProgress, station.index * 0.035, 0.22),
        ) * 0.07;
      let glance = 0;
      if (station.id !== "creator") {
        const departure =
          station.id === "a"
            ? storySettings.transfers.first
            : storySettings.transfers.second;
        glance =
          Math.sin(
            Math.PI *
              progressBetween(
                scrollProgress,
                departure - 0.025,
                departure + 0.19,
              ),
          ) * 0.22;
        if (station.id === "b") glance *= -1;
        tilt +=
          Math.sin(
            Math.PI *
              progressBetween(
                scrollProgress,
                departure + 0.15,
                departure + 0.2,
              ),
          ) * 0.065;
      }
      station.agent.rotation.set(tilt, glance, 0);
      if (station.assembly.visible) {
        const align =
          progressBetween(
            scrollProgress,
            0.02 + station.index * 0.025,
            0.18 + station.index * 0.025,
          ) * 0.5;
        for (let index = 0; index < station.fragments.length - 1; index += 1) {
          const fragment = station.fragments[index];
          fragment.mesh.position
            .copy(fragment.unfinished)
            .lerp(fragment.joined, align);
        }
      }
    }
    for (const mesh of original.children) {
      if (mesh !== surfaceHighlight) mesh.material.opacity = 1;
    }
    updateSkillAssembly(scrollProgress);
    updateSkillTransfers(scrollProgress);
    original.position.y += original.userData.hoverAmount * 0.035;
    updateLabels();
    container.dataset.mode = "story";
    container.dataset.progress = scrollProgress.toFixed(4);
  }

  function updateAnimation(delta) {
    entranceTime = Math.min(1, entranceTime + delta);
    if (reducedMotion) entranceTime = 1;
    if (mode === "story") {
      const finished = targetStoryProgress >= storySettings.scroll.end;
      const blend = 1 - Math.exp(-storySettings.motion.responseSpeed * delta);
      storyProgress += (targetStoryProgress - storyProgress) * blend;
      if (Math.abs(storyProgress - targetStoryProgress) < storySettings.motion.settleThreshold)
        storyProgress = targetStoryProgress;
      // Copy and labels follow the same pose. The last chapter stays still as
      // the entire sticky stage leaves the viewport through native scrolling.
      options.onStoryFrame(storyProgress, container.classList.contains("scene-ready"));
      for (const block of skillBlocks) {
        const target = !finished && block === hoveredBlock ? 1 : 0;
        if (finished) block.userData.hoverAmount = 0;
        else block.userData.hoverAmount +=
          (target - block.userData.hoverAmount) * (1 - Math.exp(-delta * 12));
      }
      updateStoryScene(storyProgress);
    } else {
      updateHeroScene(delta);
    }
    // Pointer responses are small additions after the authoritative timeline pose.
    if (hoveredAgent && !reducedMotion &&
        (mode !== "story" || targetStoryProgress < storySettings.scroll.end)) {
      hoveredAgent.rotation.y += pointer.x * 0.07;
      hoveredAgent.rotation.x -= pointer.y * 0.025;
    }
  }

  function setStoryProgress(value, state = {}) {
    const previousBlend = cameraBlend;
    cameraBlend = state.bridge ?? (value === null ? 0 : 1);
    if (value === null) {
      if (mode === "hero") {
        if (previousBlend !== cameraBlend) resizeScene();
        requestRender();
        return;
      }
      mode = "hero";
      progress = settings.animation.duration;
      parallaxTarget.set(0, 0);
      resizeScene();
      updateAnimation(0);
    } else {
      const entering = mode !== "story";
      mode = "story";
      targetStoryProgress = THREE.MathUtils.clamp(value, 0, storySettings.scroll.end);
      if (targetStoryProgress >= storySettings.scroll.end) {
        hoveredBlock = null;
        hoveredAgent = null;
        tooltip.hidden = true;
      }
      if (entering || state.immediate || targetStoryProgress >= storySettings.scroll.end) {
        storyProgress = targetStoryProgress;
      }
      container.dataset.targetProgress = targetStoryProgress.toFixed(4);
      let chapter = 0;
      for (let index = 0; index < storySettings.chapters.length; index += 1) {
        if (storyProgress >= storySettings.chapters[index]) chapter = index;
      }
      if (entering) resizeScene();
      container.setAttribute(
        "aria-label",
        document
          .querySelector('.story-chapter[data-chapter="' + chapter + '"] h2')
          .textContent.trim(),
      );
      if (entering || state.immediate) {
        options.onStoryFrame(storyProgress, false);
        updateStoryScene(storyProgress);
      }
    }
    requestRender();
  }

  function renderFrame(timestamp) {
    animationFrame = 0;
    if (disposed || contextLost || !inView || document.hidden) return;
    const frameGap = lastFrameTime === 0 ? 0 : (timestamp - lastFrameTime) / 1000;
    if (mode === "story" && frameGap > storySettings.motion.maxFrameGap) {
      storyProgress = targetStoryProgress;
    }
    const delta =
      lastFrameTime === 0
        ? 0
        : Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;
    updateAnimation(delta);
    const moving =
      (mode === "hero" &&
        (progress < settings.animation.duration ||
          entranceTime < 1)) ||
      (mode === "story" && (
        storyProgress !== targetStoryProgress
      )) || hoveredBlock ||
      hoveredAgent;
    // Render at 30 fps once composed; the transfer renders every animation frame.
    if (
      sceneDirty ||
      moving ||
      timestamp - lastRenderTime >= 32 ||
      reducedMotion
    ) {
      renderer.render(scene, camera);
      lastRenderTime = timestamp;
      container.classList.add("scene-ready");
      container.dataset.scene = "ready";
      if (mode === "story") options.onStoryFrame(storyProgress, true);
      sceneDirty = false;
    }
    let hoverSettling = false;
    for (const block of skillBlocks) {
      if (block.userData.hoverAmount > 0.001 && block !== hoveredBlock)
        hoverSettling = true;
    }
    if ((mode === "hero" && !reducedMotion) || moving || hoverSettling)
      animationFrame = requestAnimationFrame(renderFrame);
    else lastFrameTime = 0;
  }

  function requestRender() {
    sceneDirty = true;
    if (
      !animationFrame &&
      !disposed &&
      !contextLost &&
      inView &&
      !document.hidden
    )
      animationFrame = requestAnimationFrame(renderFrame);
  }

  function pauseRendering() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrameTime = 0;
  }

  function setHeroMode(value) {
    if (value !== "sell" && value !== "buy") return;
    heroMode = value;
    container.dataset.heroMode = heroMode;
    if (mode === "story") return;
    container.setAttribute(
      "aria-label",
      heroMode === "sell"
        ? "Your agent packages a skill and sends copies to Agent A and Agent B, keeping the original."
        : "A skill from the skill creator arrives and settles into your agent’s platform. The creator keeps the original.",
    );
    progress = reducedMotion || contextLost ? settings.animation.duration : 0;
    updateAnimation(0);
    requestRender();
  }

  function setReducedMotion(enabled) {
    reducedMotion = enabled;
    hoveredBlock = null;
    parallaxTarget.set(0, 0);
    if (enabled) {
      progress = settings.animation.duration;
      initialAttemptTime = settings.animation.initialAttemptDuration;
      world.rotation.set(0, 0, 0);
      updateAnimation(0);
    }
    requestRender();
  }

  function pickSkill(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = (-(event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selectableMeshes, false);
    for (const hit of hits) {
      let parent = hit.object;
      let visible = true;
      while (parent) {
        if (!parent.visible) visible = false;
        parent = parent.parent;
      }
      if (visible) return hit.object;
    }
    return null;
  }

  function onPointerMove(event) {
    if (!finePointer.matches || reducedMotion || event.pointerType === "touch")
      return;
    const hit = pickSkill(event);
    const finished = mode === "story" && targetStoryProgress >= storySettings.scroll.end;
    hoveredBlock = !finished && hit ? hit.userData.block : null;
    canvas.style.cursor = hit ? "pointer" : "default";
    const agentHits = raycaster.intersectObjects(agentMeshes, false);
    hoveredAgent = null;
    for (const agentHit of agentHits) {
      if (!finished && agentHit.object.parent.parent.visible) {
        hoveredAgent = agentHit.object.userData.agent;
        break;
      }
    }
    tooltip.hidden = !hit;
    if (hit) {
      tooltip.textContent = skillExamples[hit.userData.skillId].title;
      const bounds = container.getBoundingClientRect();
      tooltip.style.left =
        Math.min(event.clientX - bounds.left + 12, bounds.width - 175) + "px";
      tooltip.style.top = Math.max(10, event.clientY - bounds.top - 34) + "px";
    }
    if (mode === "hero") parallaxTarget.set(pointer.x, pointer.y);
    requestRender();
  }
  function onPointerLeave() {
    hoveredBlock = null;
    hoveredAgent = null;
    tooltip.hidden = true;
    parallaxTarget.set(0, 0);
    canvas.style.cursor = "default";
    requestRender();
  }
  function onPointerDown(event) {
    pointerDownPosition = { x: event.clientX, y: event.clientY };
  }
  function onPointerUp(event) {
    if (!pointerDownPosition) return;
    const distance = Math.hypot(
      event.clientX - pointerDownPosition.x,
      event.clientY - pointerDownPosition.y,
    );
    pointerDownPosition = null;
    // A swipe belongs to page scrolling, not to the package interaction.
    if (distance > 8) return;
    const hit = pickSkill(event);
    if (hit) options.onSelectSkill(hit.userData.skillId);
  }
  function onPointerCancel() {
    pointerDownPosition = null;
  }
  function onVisibilityChange() {
    if (document.hidden) pauseRendering();
    else requestRender();
  }
  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    pauseRendering();
    container.classList.remove("scene-ready");
    container.dataset.scene = "fallback";
    options.onUnavailable();
  }
  function onContextRestored() {
    contextLost = false;
    progress = settings.animation.duration;
    updateAnimation(0);
    if (options.onAvailable) options.onAvailable();
    requestRender();
  }

  const resizeObserver = new ResizeObserver(resizeScene);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      inView = entries[0].isIntersecting;
      if (inView) requestRender();
      else pauseRendering();
    },
    { threshold: 0.01 },
  );
  intersectionObserver.observe(container);
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  document.addEventListener("visibilitychange", onVisibilityChange);

  function disposeScene() {
    if (disposed) return;
    disposed = true;
    pauseRendering();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    for (const resource of resources) resource.dispose();
    environment.dispose();
    keyLight.shadow.dispose();
    renderer.dispose();
    canvas.remove();
    tooltip.remove();
  }

  resizeScene();
  if (reducedMotion)
    initialAttemptTime = settings.animation.initialAttemptDuration;
  updateAnimation(0);
  requestRender();
  return {
    setHeroMode,
    setReducedMotion,
    setStoryProgress,
    resizeScene,
    disposeScene,
  };
}
