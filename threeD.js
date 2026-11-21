
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("threeView");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#eeeeee");

const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    container.clientWidth,
    container.clientHeight
);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(15, 30, 20);
scene.add(directionalLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const roomColors = {
    living: "#e6c9a8",
    bedroom: "#b5d8f0",
    passage: "#d5d5d5",
    kitchen: "#b8dfb8",
    bathroom: "#a8dce8"
};

const houseGroup = new THREE.Group();
scene.add(houseGroup);

let cameraInitialized = false;

function update3DHouse(house) {

    if (!house) return;

    houseGroup.clear();

    const plotWidth = house.plot.width;
    const plotLength = house.plot.length;

    const groundGeometry = new THREE.BoxGeometry(
        plotWidth,
        0.2,
        plotLength
    );

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: "#bdbdbd"
    });

    const ground = new THREE.Mesh(
        groundGeometry,
        groundMaterial
    );

    ground.position.set(
        plotWidth / 2,
        -0.1,
        plotLength / 2
    );

    houseGroup.add(ground);

    for (const room of house.rooms) {

        const roomGeometry = new THREE.BoxGeometry(
            room.width,
            0.12,
            room.length
        );

        const roomMaterial = new THREE.MeshStandardMaterial({
            color: roomColors[room.type] || "#ffffff"
        });

        const roomFloor = new THREE.Mesh(
            roomGeometry,
            roomMaterial
        );

        roomFloor.position.set(
            room.x + room.width / 2,
            0.06,
            room.y + room.length / 2
        );

        houseGroup.add(roomFloor);
    }

    if (!cameraInitialized) {

        camera.position.set(
            plotWidth * 1.25,
            plotLength * 0.8,
            plotLength * 1.25
        );

        controls.target.set(
            plotWidth / 2,
            0,
            plotLength / 2
        );

        controls.update();

        cameraInitialized = true;
    }

    console.log("3D house updated:", house);
}

window.update3DHouse = update3DHouse;

window.addEventListener("resize", () => {

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
});

function animate() {

    requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
}

animate();

if (window.nirmanHouse) {
    update3DHouse(window.nirmanHouse);
}
