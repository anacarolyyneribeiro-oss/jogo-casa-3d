//-----------------------------------------------------------
// IMPORTAÇÃO DOS MÓDULOS THREE.JS
//-----------------------------------------------------------
import * as THREE from './three.module.js';
import { PointerLockControls } from './PointerLockControls.js';
import { GLTFLoader } from './GLTFLoader.js';

//-----------------------------------------------------------
// VARIÁVEIS DE MOVIMENTO E COLISÃO
//-----------------------------------------------------------
const moveSpeed = 0.03;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const portaDistance = 1.0;
const playerRadius = 0.1;
const playerHeight = 0.8;

let paredeBoxes = [];
let paredeMeshes = [];
let portas = [];

let tomadaModel = null;

const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);

//-----------------------------------------------------------
// CENA, CÂMERA E RENDERER
//-----------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, playerHeight, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

document.body.appendChild(renderer.domElement);

//-----------------------------------------------------------
// CONTROLE FPS (POINTER LOCK)
//-----------------------------------------------------------
const controls = new PointerLockControls(camera, document.body);
scene.add(camera);

document.addEventListener('click', () => {
    controls.lock();
});

// Lanterna
const flashlight = new THREE.PointLight(0xffffff, 2, 20);
camera.add(flashlight);

//-----------------------------------------------------------
// PISO
//-----------------------------------------------------------
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x828281, side: THREE.DoubleSide })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

//-----------------------------------------------------------
// ILUMINAÇÃO
//-----------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 3));

const hemi = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 2);
scene.add(hemi);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(5, 10, 6.5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

//-----------------------------------------------------------
// CARREGAMENTO DOS MODELOS
//-----------------------------------------------------------
const loader = new GLTFLoader();

// CASA
loader.load('casa_01.glb', (gltf) => {
    gltf.scene.scale.set(0.4, 0.4, 0.4);
    gltf.scene.position.set(-2, 0, 3.5);
    gltf.scene.updateWorldMatrix(true, true);

   gltf.scene.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;

    const nome = child.name.toLowerCase();

    // ---------- TV (PRETA) ----------
    if (nome.includes('tv')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.4
        });
        return;
    }

    // ---------- VASO SANITÁRIO (BRANCO) ----------
    if (nome.includes('vaso') || nome.includes('sanitario') || nome.includes('toilet')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2
        });
        return;
    }
     // ---------- JANELA  ----------
      if (nome.includes('janela')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x493838,
            roughness: 0.3
        });
        return;
    }
       if (nome.includes('cama')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x78615C,
            roughness: 0.3
        });
        return;
    }
     if (nome.includes('piso')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0xC1B2B6,
            roughness: 0.2
        });
        return;
    }
    // ---------- TORNEIRA (PRATA) ----------
    if (nome.includes('torneira') || nome.includes('faucet')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.9,
            roughness: 0.3
        });
        return;
    }

    // ---------- SOFÁ (AZUL) ----------
    if (nome.includes('sofá') || nome.includes('couch')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x1e310a,
            roughness: 0.8
        });
        return;
    }

    // ---------- PLANTA (VERDE) ----------
    if (nome.includes('planta') || nome.includes('plant')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x006400,
            roughness: 0.9
        });
        return;
    }
    

    // ---------- MESA DE SINUCA (VERDE) ----------
    if (nome.includes('sinuca') || nome.includes('bilhar') || nome.includes('pool')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x234728,
            roughness: 0.7
        });
        return;
    }

    // ---------- GELADEIRA (PRATA) ----------
    if (nome.includes('geladeira') || nome.includes('fridge')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0xd1d5db,
            metalness: 0.8,
            roughness: 0.25
        });
        return;
    }

    // ---------- PORTAS (MARROM) ----------
    if (nome.includes('porta')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.6
        });
        portas.push(child);
        return;
    }
     // ---------- BANCADA  ----------
    if (nome.includes('bancada')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0xc0c4c0,
            roughness: 0.6
        });
        portas.push(child);
        return;
    }

    // ---------- TELHADO (LARANJA) ----------
    if (nome.includes('telhado') || nome.includes('roof')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0xff8c00,
            roughness: 0.7
        });
        return;
    }

    // ---------- PAREDES (VERDE) ----------
    if (nome.includes('parede') || nome.includes('wall')) {
        child.material = new THREE.MeshStandardMaterial({
            color: 0x2e8b57,
            roughness: 0.8
        });

        const box = new THREE.Box3().setFromObject(child);
        paredeBoxes.push(box);
        paredeMeshes.push(child);
        return;
    }
 });

    scene.add(gltf.scene);
});

// TOMADA - Corrigido para garantir que o modelo esteja pronto para clonagem
loader.load('tomada_4_26.glb', (gltf) => {
    tomadaModel = gltf.scene;
    // Ajuste a escala conforme necessário para o tamanho da sua casa
    tomadaModel.scale.set(0.5, 0.5, 0.5); 
    
    tomadaModel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Cor original ou uma padrão para a tomada
            child.material = new THREE.MeshStandardMaterial({
                color: 0xffffff, 
                roughness: 0.5
            });
        }
    });
});

// 1. ADICIONE ISSO NO TOPO DO CÓDIGO (junto com paredeMeshes)
let tomadasInstaladas = [];

function colocarTomada() {
    if (!tomadaModel) return;

    raycaster.setFromCamera(centerScreen, camera);
    const intersects = raycaster.intersectObjects(paredeMeshes, true);

    if (intersects.length > 0) {
        const hit = intersects[0];

        if (hit.distance < 3) {
            const alturaTomada = 0.6;
            const offset = 0.001;
            const pos = new THREE.Vector3().copy(hit.point);
            pos.y = alturaTomada;

            // --- NOVO: VERIFICAÇÃO DE SOBREPOSIÇÃO ---
            // Percorre as tomadas já colocadas para ver se alguma está perto demais
            const muitoPerto = tomadasInstaladas.some(t => {
                return t.position.distanceTo(pos) < 0.05; // 0.01 metros (30cm) de distância mínima
            });

            if (muitoPerto) {
                console.warn("Já existe uma tomada aqui!");
                return; // Interrompe a função e não coloca a tomada
            }
            // ------------------------------------------

            const group = new THREE.Group();
            const normalOffset = hit.face.normal.clone().multiplyScalar(offset);
            pos.add(normalOffset);
            group.position.copy(pos);

            const target = pos.clone().add(hit.face.normal.clone());
            target.y = alturaTomada;
            group.lookAt(target);

            const visualTomada = tomadaModel.clone();

            visualTomada.traverse((child) => {
                if (child.isMesh) {
                    const edges = new THREE.EdgesGeometry(child.geometry, 20);
                    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
                    child.add(line);
                }
            });

            group.add(visualTomada);
            scene.add(group);

            // 2. SALVA A TOMADA NA LISTA PARA A PRÓXIMA VERIFICAÇÃO
            tomadasInstaladas.push(group);
        }
    }
}

//-----------------------------------------------------------
// CONTROLE DE TECLADO (COM CORREÇÃO DA TECLA E)
//-----------------------------------------------------------
document.addEventListener('keydown', (event) => {
    if (!controls.isLocked) return;

    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveLeft = true; break;
        case 'KeyA': moveRight = true; break;
        case 'KeyE':
            event.preventDefault();
            colocarTomada();
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveLeft = false; break;
        case 'KeyA': moveRight = false; break;
    }
});

//-----------------------------------------------------------
// COLISÃO
//-----------------------------------------------------------
function willCollide(nextPosition) {
    const center = new THREE.Vector3(
        nextPosition.x,
        playerHeight,
        nextPosition.z
    );

    const sphere = new THREE.Sphere(center, playerRadius);

    return paredeBoxes.some(box => box.intersectsSphere(sphere));
}

const forward = new THREE.Vector3();
const right = new THREE.Vector3();

//-----------------------------------------------------------
// LOOP DE ANIMAÇÃO
//-----------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {
        camera.position.y = playerHeight;

        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        right.crossVectors(camera.up, forward).normalize();

        if (moveForward) {
            const step = forward.clone().multiplyScalar(moveSpeed);
            const next = camera.position.clone().add(step);
            if (!willCollide(next)) camera.position.copy(next);
        }

        if (moveBackward) {
            const step = forward.clone().multiplyScalar(-moveSpeed);
            const next = camera.position.clone().add(step);
            if (!willCollide(next)) camera.position.copy(next);
        }

        if (moveRight) {
            const step = right.clone().multiplyScalar(moveSpeed);
            const next = camera.position.clone().add(step);
            if (!willCollide(next)) camera.position.copy(next);
        }

        if (moveLeft) {
            const step = right.clone().multiplyScalar(-moveSpeed);
            const next = camera.position.clone().add(step);
            if (!willCollide(next)) camera.position.copy(next);
        }

        portas.forEach(porta => {
            const pos = new THREE.Vector3();
            porta.getWorldPosition(pos);

            const dist = Math.hypot(
                pos.x - camera.position.x,
                pos.z - camera.position.z
            );

            porta.rotation.y = THREE.MathUtils.lerp(
                porta.rotation.y,
                dist < portaDistance ? -Math.PI / 2 : 0,
                0.1
            );
        });
    }

    renderer.render(scene, camera);
}

//-----------------------------------------------------------
// RESIZE
//-----------------------------------------------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

