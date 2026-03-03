//-----------------------------------------------------------
// IMPORTAÇÃO DOS MÓDULOS THREE.JS
//-----------------------------------------------------------
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Se precisar do BufferGeometryUtils:
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'

//-----------------------------------------------------------
// VARIÁVEIS DE MOVIMENTO E COLISÃO
//-----------------------------------------------------------
const moveSpeed = 0.02;
console.log("MAIN.JS CARREGOU - moveSpeed =", moveSpeed);


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
let selectedItem = "tomada"; // "tomada" | "interruptor"

const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);

// ----------------------------------------------------------
// PORTAS: foco, prompt, abrir/fechar no ESPAÇO e colisão
// ----------------------------------------------------------
const doorPrompt = document.getElementById('doorPrompt');
let focusedDoor = null;

// estado de porta (true = aberta)
const doorOpen = new WeakMap();
// rotação alvo por porta
const doorTargetY = new WeakMap();

// caixas de colisão das portas (recalculadas)
let doorBoxes = [];

function showDoorPrompt(show) {
    if (!doorPrompt) return;
    doorPrompt.style.display = show ? 'block' : 'none';
    if (show) doorPrompt.textContent = 'Pressione ESPAÇO para abrir/fechar';
}

function isDoorOpen(door) {
    return doorOpen.get(door) === true;
}

function setDoorOpen(door, open) {
    doorOpen.set(door, open);
    // alvo: fechada = 0, aberta = -90° (ajuste se sua porta abre pro outro lado)
    doorTargetY.set(door, open ? -Math.PI / 2 : 0);
}

function updateDoorFocus() {
    if (!controls.isLocked) return;

    raycaster.setFromCamera(centerScreen, camera);

    // Raycast em tudo que pode bloquear a visão
    // (paredes + portas)
    const occluders = [...paredeMeshes, ...portas];
    const hits = raycaster.intersectObjects(occluders, true);

    if (!hits.length) {
        focusedDoor = null;
        showDoorPrompt(false);
        return;
    }

    const hit = hits[0]; // <<< o objeto MAIS PRÓXIMO à câmera

    // Descobre se esse hit pertence a uma porta
    let obj = hit.object;
    while (obj && !portas.includes(obj)) obj = obj.parent;

    // Se o primeiro hit NÃO foi numa porta, então tem algo na frente (parede etc.)
    if (!obj) {
        focusedDoor = null;
        showDoorPrompt(false);
        return;
    }

    // Limite de distância pra abrir
    if (hit.distance > 1.0) {
        focusedDoor = null;
        showDoorPrompt(false);
        return;
    }

    focusedDoor = obj;
    showDoorPrompt(true);
}

function animateDoors() {
    // suaviza rotação até o alvo
    portas.forEach((door) => {
        if (!doorTargetY.has(door)) {
            // inicia como fechada
            setDoorOpen(door, false);
        }
        const target = doorTargetY.get(door);
        door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, target, 0.12);
    });
}

function rebuildDoorColliders() {
    // Porta só colide se estiver “quase fechada”
    doorBoxes = portas
        .filter(d => Math.abs(d.rotation.y) < 0.35) // ~20 graus
        .map(d => new THREE.Box3().setFromObject(d));
}


//-----------------------------------------------------------
// CENA, CÂMERA E RENDERER
//-----------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    80
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

// ----------------------------------------------------------
// CONFIRMAR TOMADA COM BOTÃO ESQUERDO DO MOUSE
// ----------------------------------------------------------
document.addEventListener('mousedown', (event) => {
    if (!controls.isLocked) return;

    // botão esquerdo
    if (event.button === 0) {

        // se estiver no modo excluir, remove
        if (deleteMode) {
            deleteHoveredTomada();
            return;
        }

        // senão, se estiver no modo colocar, confirma
        if (placingTomada) {
            confirmPlaceItem();
            return;
        }

    }
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

let interruptorModel = null;

loader.load('light_switch.glb', (gltf) => {
    interruptorModel = gltf.scene;
    interruptorModel.scale.set(0.0003, 0.0003, 0.0003);

    interruptorModel.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;

        // material simples (pode ajustar depois)
        child.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.45
        });
    });

    console.log("Interruptor carregado!");
});

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

        if (nome.includes('quadro') || nome.includes('painel') || nome.includes('tv') || nome.includes('black')) {
            // empurra um pouquinho pra frente (ajuste conforme o eixo do seu modelo)
            child.position.z += 0.002;
        }


        // ---------- PAREDES (VERDE) ----------
        if (nome.includes('parede') || nome.includes('wall')) {
            child.material = new THREE.MeshStandardMaterial({
                color: 0x208057,
                roughness: 0.8,
                side: THREE.DoubleSide
            });

            // adiciona para RAYCAST (tomada) e COLISÃO (player)
            paredeMeshes.push(child);

            // cria caixa de colisão
            const box = new THREE.Box3().setFromObject(child);
            paredeBoxes.push(box);

            return;
        }


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



        // ---------- TELHADO (LARANJA) ----------
        if (nome.includes('telhado') || nome.includes('roof')) {
            child.material = new THREE.MeshStandardMaterial({
                color: 0xff8c00,
                roughness: 0.7
            });
            return;
        }

    });

    scene.add(gltf.scene);
    rebuildWallColliders();

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

// ----------------------------------------------------------
// MODO EXCLUIR TOMADAS (TECLA X)
// ----------------------------------------------------------
let deleteMode = false;
let hoveredTomadaGroup = null;

const deleteHud = document.getElementById('deleteHud');

// guarda materiais originais pra restaurar
const originalMaterials = new WeakMap();

function rebuildWallColliders() {
    paredeBoxes = paredeMeshes.map(m => new THREE.Box3().setFromObject(m));
}

function setDeleteHudVisible(visible) {
    if (!deleteHud) return;
    deleteHud.style.display = visible ? 'block' : 'none';
}

function setGroupHighlightRed(group, on) {
    if (!group) return;

    group.traverse((child) => {
        if (!child.isMesh) return;

        if (on) {
            if (!originalMaterials.has(child)) {
                originalMaterials.set(child, child.material);
            }
            const mat = child.material.clone();
            mat.transparent = true;
            mat.opacity = 0.85;
            mat.color.setHex(0xff2a2a);
            // se o material suportar emissive, ajuda bastante
            if ('emissive' in mat) mat.emissive.setHex(0x550000);
            child.material = mat;
        } else {
            const orig = originalMaterials.get(child);
            if (orig) child.material = orig;
        }
    });
}

function enterDeleteMode() {
    deleteMode = true;
    setDeleteHudVisible(true);

    // não pode ficar em dois modos ao mesmo tempo
    if (placingTomada) exitPlacingMode();

    hoveredTomadaGroup = null;
    updateHUD();
}

function exitDeleteMode() {
    deleteMode = false;
    setDeleteHudVisible(false);

    if (hoveredTomadaGroup) {
        setGroupHighlightRed(hoveredTomadaGroup, false);
        hoveredTomadaGroup = null;
    }
    updateHUD();
}

function updateDeleteHover() {
    if (!deleteMode || !controls.isLocked) return;

    raycaster.setFromCamera(centerScreen, camera);

    // raycast nos grupos das tomadas instaladas
    const intersects = raycaster.intersectObjects(tomadasInstaladas, true);

    let newGroup = null;

    if (intersects.length > 0) {
        // subindo até achar o Group que está em tomadasInstaladas
        let obj = intersects[0].object;
        while (obj && !tomadasInstaladas.includes(obj)) obj = obj.parent;
        newGroup = obj || null;
    }

    if (newGroup !== hoveredTomadaGroup) {
        if (hoveredTomadaGroup) setGroupHighlightRed(hoveredTomadaGroup, false);
        hoveredTomadaGroup = newGroup;
        if (hoveredTomadaGroup) setGroupHighlightRed(hoveredTomadaGroup, true);
    }
}

function deleteHoveredTomada() {
    if (!deleteMode) return;
    if (!hoveredTomadaGroup) return;

    // remove da cena
    scene.remove(hoveredTomadaGroup);

    // remove do array
    const idx = tomadasInstaladas.indexOf(hoveredTomadaGroup);
    if (idx >= 0) tomadasInstaladas.splice(idx, 1);

    hoveredTomadaGroup = null;
    updateHUD();

}


// ----------------------------------------------------------
// MODO POSICIONAMENTO DE TOMADA (GHOST + CONFIRMAÇÃO)
// ----------------------------------------------------------
let placingTomada = false;
let ghostGroup = null;
let lastPlacement = null; // { position: Vector3, normal: Vector3 }
let canPlaceHere = false;

const hudMode = document.getElementById('hudMode');
const hudCount = document.getElementById('hudCount');

function updateHUD() {
    if (hudCount) hudCount.textContent = String(tomadasInstaladas.length);

    if (hudMode) {
        if (deleteMode) hudMode.textContent = "Excluir";
        else if (placingTomada) hudMode.textContent = "Colocar";
        else hudMode.textContent = "Normal";
    }

    // opcional: mostrar item selecionado no modo "Colocar"
    if (placingTomada && hudMode) hudMode.textContent = "Colocar (" + selectedItem + ")";

}


function getWorldNormal(hit) {
    // hit.face.normal vem no espaço local da malha; converte para mundo
    const n = hit.face?.normal?.clone() || new THREE.Vector3(0, 0, 1);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    n.applyMatrix3(normalMatrix).normalize();
    return n;
}

function makeGhostFromModel(model) {
    const ghost = model.clone(true);

    ghost.traverse((child) => {
        if (!child.isMesh) return;

        // clona material pra não afetar o original
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.35;
        child.material.depthWrite = false; // ajuda a evitar flicker
    });

    return ghost;
}

function getSelectedModel() {
    if (selectedItem === "tomada") return tomadaModel;
    if (selectedItem === "interruptor") return interruptorModel;
    return null;
}

function ensureGhost() {
    const model = getSelectedModel();
    if (!model) return;

    // se já existe ghost, mas mudou o item, recria
    if (ghostGroup && ghostGroup.userData.item === selectedItem) return;

    if (ghostGroup) {
        scene.remove(ghostGroup);
        ghostGroup = null;
    }

    ghostGroup = new THREE.Group();
    ghostGroup.userData.item = selectedItem;

    const ghostObj = makeGhostFromModel(model);
    ghostGroup.add(ghostObj);

    ghostGroup.visible = false;
    scene.add(ghostGroup);
}


function updateGhost() {
    ensureGhost();
    if (!ghostGroup || !controls.isLocked) return;

    raycaster.setFromCamera(centerScreen, camera);
    const intersects = raycaster.intersectObjects(paredeMeshes, true);

    if (intersects.length === 0) {
        ghostGroup.visible = false;
        lastPlacement = null;
        canPlaceHere = false;
        return;
    }

    const hit = intersects[0];

    // limite de distância (ajuste como quiser)
    if (hit.distance > 3) {
        ghostGroup.visible = false;
        lastPlacement = null;
        canPlaceHere = false;
        return;
    }

    const normal = getWorldNormal(hit);

    // posição EXATA do ponto mirado
    const pos = hit.point.clone();

    // pequeno offset pra não "entrar" na parede (z-fighting)
    const offset = 0.01;
    pos.add(normal.clone().multiplyScalar(offset));

    // salva último ponto/normal válidos
    lastPlacement = { position: pos.clone(), normal: normal.clone() };

    // regra anti-sobreposição (mesma ideia que você já tinha)
    const minDist = 0.12; // ajuste: 0.12 = 12 cm no mundo do jogo (depende da escala)
    const muitoPerto = tomadasInstaladas.some(t => t.position.distanceTo(pos) < minDist);
    canPlaceHere = !muitoPerto;

    // posiciona o ghost
    ghostGroup.position.copy(pos);

    // orienta pra "olhar" na direção da normal da parede
    const target = pos.clone().add(normal);
    ghostGroup.lookAt(target);

    // se não puder colocar, deixa o ghost mais "apagado"
    ghostGroup.visible = true;
    ghostGroup.traverse((child) => {
        if (!child.isMesh) return;
        child.material.opacity = canPlaceHere ? 0.35 : 0.12;
    });
}

function enterPlacingMode() {
    // <<< NOVO: se estiver em modo excluir, desliga automaticamente
    if (deleteMode) exitDeleteMode();

    placingTomada = true;
    ensureGhost();
    if (ghostGroup) ghostGroup.visible = true;
    updateHUD();
}


function exitPlacingMode() {
    placingTomada = false;
    lastPlacement = null;
    canPlaceHere = false;
    if (ghostGroup) ghostGroup.visible = false;
    updateHUD();
}

function confirmPlaceItem() {
    const model = getSelectedModel();
    if (!model) return;
    if (!lastPlacement) return;
    if (!canPlaceHere) return;

    const group = new THREE.Group();
    group.position.copy(lastPlacement.position);

    const target = lastPlacement.position.clone().add(lastPlacement.normal);
    group.lookAt(target);

    const visual = model.clone(true);

    // contorno + material sólido
    visual.traverse((child) => {
        if (!child.isMesh) return;

        const edges = new THREE.EdgesGeometry(child.geometry, 20);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
        child.add(line);

        child.material = child.material.clone();
        child.material.transparent = false;
        child.material.opacity = 1;
        child.material.depthWrite = true;
    });

    group.add(visual);
    scene.add(group);

    // entra na lista de "instalados" (pra excluir depois também)
    tomadasInstaladas.push(group);

    exitPlacingMode();
    updateHUD();
}



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
            // E liga/desliga o modo de posicionamento
            if (!placingTomada) enterPlacingMode();
            else exitPlacingMode();
            break;

        case 'Escape':
            if (placingTomada) exitPlacingMode();
            break;

        case 'KeyX':
            event.preventDefault();
            if (!deleteMode) enterDeleteMode();
            else exitDeleteMode();
            break;

        case 'Space':
            event.preventDefault();
            if (focusedDoor) {
                setDoorOpen(focusedDoor, !isDoorOpen(focusedDoor));
            }
            break;

        case 'Digit1':
            selectedItem = "tomada";
            if (placingTomada) { exitPlacingMode(); enterPlacingMode(); }
            updateHUD();
            break;

        case 'Digit2':
            selectedItem = "interruptor";
            if (placingTomada) { exitPlacingMode(); enterPlacingMode(); }
            updateHUD();
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

    return paredeBoxes.some(box => box.intersectsSphere(sphere))
        || doorBoxes.some(box => box.intersectsSphere(sphere));

}

const forward = new THREE.Vector3();
const right = new THREE.Vector3();

//-----------------------------------------------------------
// LOOP DE ANIMAÇÃO
//-----------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {

        updateDoorFocus();
        animateDoors();
        rebuildDoorColliders();


        if (placingTomada) {
            updateGhost();
        }

        if (deleteMode) {
            updateDeleteHover();
        }


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
        ;
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






