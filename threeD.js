
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// 1. Get the 3D container from HTML
const container = document.getElementById("threeView");
console.log("3D container:", container);
console.log("Container width:", container.clientWidth);
console.log("Container height:", container.clientHeight);
// 2. Create the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color("#eeeeee");

// 3. Create the camera
const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);

// 4. Create the renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    container.clientWidth,
    container.clientHeight
);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

container.appendChild(renderer.domElement);

// 5. Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(15, 30, 20);
scene.add(directionalLight);

// 6. Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 7. Room colours
const roomColors = {
    living: "#e6c9a8",
    bedroom: "#b5d8f0",
    passage: "#d5d5d5",
    kitchen: "#b8dfb8",
    bathroom: "#a8dce8"
};

// 8. Fetch the house JSON
fetch("nirman_house_model.json")
    .then(response => {
        if (!response.ok) {
            throw new Error("Could not load house JSON");
        }

        return response.json();
    })
    .then(data => {

        const house = data.house;

        const plotWidth = house.plot.width;
        const plotLength = house.plot.length;

        // 9. Create the ground
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

        scene.add(ground);

        // 10. Create room floors
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

            scene.add(roomFloor);
        }

        // 11. Set camera position and target
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

        console.log("House loaded successfully:", house);
    })
    .catch(error => {
        console.error("Error loading house:", error);
    });

// 12. Handle browser resizing
window.addEventListener("resize", () => {

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
});

// 13. Animation loop
function animate() {

    requestAnimationFrame(animate);

    controls.update();

    renderer.render(scene, camera);
}

animate();
