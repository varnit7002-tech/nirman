
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("threeView");

if (!container) {
    throw new Error("3D container not found");
}

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

renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 2));

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

const WALL_HEIGHT = 10;
const WALL_THICKNESS = 0.2;
const DOOR_HEIGHT = 7;
const DOOR_THICKNESS = 0.12;
const EPSILON = 0.001;

function getHouseWalls(rooms) {
    const horizontal = new Map();
    const vertical = new Map();

    function addEdge(map, coordinate, start, end) {
        const key = coordinate.toFixed(3);

        if (!map.has(key)) {
            map.set(key, []);
        }

        map.get(key).push([start, end]);
    }

    for (const room of rooms) {
        const x1 = room.x;
        const x2 = room.x + room.width;
        const z1 = room.y;
        const z2 = room.y + room.length;

        addEdge(horizontal, z1, x1, x2);
        addEdge(horizontal, z2, x1, x2);

        addEdge(vertical, x1, z1, z2);
        addEdge(vertical, x2, z1, z2);
    }

    function mergeEdges(map, isHorizontal) {
        const result = [];

        for (const [coordinate, edges] of map) {
            edges.sort((a, b) => a[0] - b[0]);

            if (!edges.length) continue;

            let [start, end] = edges[0];

            for (let i = 1; i < edges.length; i++) {
                const [nextStart, nextEnd] = edges[i];

                if (nextStart <= end + EPSILON) {
                    end = Math.max(end, nextEnd);
                } else {
                    result.push({
                        coordinate: Number(coordinate),
                        start,
                        end,
                        horizontal: isHorizontal
                    });

                    start = nextStart;
                    end = nextEnd;
                }
            }

            result.push({
                coordinate: Number(coordinate),
                start,
                end,
                horizontal: isHorizontal
            });
        }

        return result;
    }

    return [
        ...mergeEdges(horizontal, true),
        ...mergeEdges(vertical, false)
    ];
}

function getDoorPosition(door, room) {
    if (door.wall === "top") {
        return {
            horizontal: true,
            coordinate: room.y + room.length,
            start: room.x + door.offset,
            end: room.x + door.offset + door.width,
            inward: -1
        };
    }

    if (door.wall === "bottom") {
        return {
            horizontal: true,
            coordinate: room.y,
            start: room.x + door.offset,
            end: room.x + door.offset + door.width,
            inward: 1
        };
    }

    if (door.wall === "left") {
        return {
            horizontal: false,
            coordinate: room.x,
            start: room.y + room.length - door.offset - door.width,
            end: room.y + room.length - door.offset,
            inward: 1
        };
    }

    if (door.wall === "right") {
        return {
            horizontal: false,
            coordinate: room.x + room.width,
            start: room.y + room.length - door.offset - door.width,
            end: room.y + room.length - door.offset,
            inward: -1
        };
    }

    return null;
}

function getDoorsForWall(wall, house) {
    const result = [];

    for (const door of house.doors || []) {
        const room = house.rooms.find(
            room => room.id === door.roomId
        );

        if (!room) continue;

        const position = getDoorPosition(door, room);

        if (!position) continue;

        if (
            position.horizontal !== wall.horizontal ||
            Math.abs(position.coordinate - wall.coordinate) > EPSILON
        ) {
            continue;
        }

        const start = Math.max(wall.start, position.start);
        const end = Math.min(wall.end, position.end);

        if (end - start <= EPSILON) continue;

        result.push({
            door,
            start,
            end,
            inward: position.inward
        });
    }

    return result.sort((a, b) => a.start - b.start);
}

function getWindowsForWall(wall, house) {
    const result = [];

    for (const windowData of house.windows || []) {
        const room = house.rooms.find(
            room => room.id === windowData.roomId
        );

        if (!room) continue;

        const position = getDoorPosition(windowData, room);

        if (!position) continue;

        if (
            position.horizontal !== wall.horizontal ||
            Math.abs(position.coordinate - wall.coordinate) > EPSILON
        ) {
            continue;
        }

        const start = Math.max(wall.start, position.start);
        const end = Math.min(wall.end, position.end);

        if (end - start <= EPSILON) continue;

        result.push({
            windowData,
            start,
            end,
            sillHeight: windowData.sillHeight,
            height: windowData.height
        });
    }

    return result.sort((a, b) => a.start - b.start);
}

function addWallSegment(wall, start, end, bottom, top, material) {
    if (
        end - start <= EPSILON ||
        top - bottom <= EPSILON
    ) {
        return;
    }

    const length = end - start;
    const height = top - bottom;

    const geometry = wall.horizontal
        ? new THREE.BoxGeometry(
            length,
            height,
            WALL_THICKNESS
        )
        : new THREE.BoxGeometry(
            WALL_THICKNESS,
            height,
            length
        );

    const mesh = new THREE.Mesh(geometry, material);

    if (wall.horizontal) {
        mesh.position.set(
            (start + end) / 2,
            (bottom + top) / 2,
            wall.coordinate
        );
    } else {
        mesh.position.set(
            wall.coordinate,
            (bottom + top) / 2,
            (start + end) / 2
        );
    }

    houseGroup.add(mesh);
}

function createWindowFrame(wall, opening) {
    const width = opening.end - opening.start;
    const height = opening.height;
    const center = (opening.start + opening.end) / 2;
    const centerY = opening.sillHeight + height / 2;

    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: "#83c9e8",
        transparent: true,
        opacity: 0.55,
        roughness: 0.15
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
        color: "#f5f5f5",
        roughness: 0.5
    });

    const glassGeometry = wall.horizontal
        ? new THREE.BoxGeometry(
            width - 0.15,
            height - 0.15,
            0.06
        )
        : new THREE.BoxGeometry(
            0.06,
            height - 0.15,
            width - 0.15
        );

    const glass = new THREE.Mesh(
        glassGeometry,
        glassMaterial
    );

    if (wall.horizontal) {
        glass.position.set(
            center,
            centerY,
            wall.coordinate
        );
    } else {
        glass.position.set(
            wall.coordinate,
            centerY,
            center
        );
    }

    houseGroup.add(glass);

    const frameThickness = 0.12;

    addWallSegment(
        wall,
        opening.start,
        opening.start + frameThickness,
        opening.sillHeight,
        opening.sillHeight + height,
        frameMaterial
    );

    addWallSegment(
        wall,
        opening.end - frameThickness,
        opening.end,
        opening.sillHeight,
        opening.sillHeight + height,
        frameMaterial
    );

    addWallSegment(
        wall,
        opening.start,
        opening.end,
        opening.sillHeight,
        opening.sillHeight + frameThickness,
        frameMaterial
    );

    addWallSegment(
        wall,
        opening.start,
        opening.end,
        opening.sillHeight + height - frameThickness,
        opening.sillHeight + height,
        frameMaterial
    );
}

function createWallWithDoors(wall, house, wallMaterial) {
    const doors = getDoorsForWall(wall, house);
    const windows = getWindowsForWall(wall, house);

    const openings = [
        ...doors.map(item => ({
            ...item,
            type: "door"
        })),
        ...windows.map(item => ({
            ...item,
            type: "window"
        }))
    ].sort((a, b) => a.start - b.start);

    let current = wall.start;

    for (const opening of openings) {
        if (opening.start < current - EPSILON) {
            continue;
        }

        if (opening.start > current + EPSILON) {
            addWallSegment(
                wall,
                current,
                opening.start,
                0,
                WALL_HEIGHT,
                wallMaterial
            );
        }

        if (opening.type === "door") {
            addWallSegment(
                wall,
                opening.start,
                opening.end,
                DOOR_HEIGHT,
                WALL_HEIGHT,
                wallMaterial
            );

            createDoorPanel(wall, opening);
        }

        if (opening.type === "window") {
            addWallSegment(
                wall,
                opening.start,
                opening.end,
                0,
                opening.sillHeight,
                wallMaterial
            );

            addWallSegment(
                wall,
                opening.start,
                opening.end,
                opening.sillHeight + opening.height,
                WALL_HEIGHT,
                wallMaterial
            );

            createWindowFrame(wall, opening);
        }

        current = opening.end;
    }

    if (current < wall.end - EPSILON) {
        addWallSegment(
            wall,
            current,
            wall.end,
            0,
            WALL_HEIGHT,
            wallMaterial
        );
    }
}

function createDoorPanel(wall, opening) {
    const door = opening.door;
    const width = opening.end - opening.start;

    const pivot = new THREE.Group();

    const hingeAtEnd = door.hinge === "end";
    const direction = hingeAtEnd ? -1 : 1;

    const hingePosition = hingeAtEnd
        ? opening.end
        : opening.start;

    if (wall.horizontal) {
        pivot.position.set(
            hingePosition,
            0.06,
            wall.coordinate
        );
    } else {
        pivot.position.set(
            wall.coordinate,
            0.06,
            hingePosition
        );
    }

    const doorMaterial = new THREE.MeshStandardMaterial({
        color: door.color || "#9b633e",
        roughness: 0.7
    });

    const geometry = wall.horizontal
        ? new THREE.BoxGeometry(
            width,
            DOOR_HEIGHT,
            DOOR_THICKNESS
        )
        : new THREE.BoxGeometry(
            DOOR_THICKNESS,
            DOOR_HEIGHT,
            width
        );

    const panel = new THREE.Mesh(geometry, doorMaterial);

    if (wall.horizontal) {
        panel.position.set(
            direction * width / 2,
            DOOR_HEIGHT / 2,
            0
        );
    } else {
        panel.position.set(
            0,
            DOOR_HEIGHT / 2,
            direction * width / 2
        );
    }

    pivot.add(panel);

    if (door.isOpen) {
        const rotationDirection = wall.horizontal
            ? -opening.inward * direction
            : opening.inward * direction;

        pivot.rotation.y =
            rotationDirection * Math.PI / 2;
    }

    houseGroup.add(pivot);
}

function update3DHouse(house) {
    if (!house || !house.plot || !house.rooms) return;

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
        const geometry = new THREE.BoxGeometry(
            room.width,
            0.12,
            room.length
        );

        const material = new THREE.MeshStandardMaterial({
            color: roomColors[room.type] || "#ffffff"
        });

        const floor = new THREE.Mesh(geometry, material);

        floor.position.set(
            room.x + room.width / 2,
            0.06,
            room.y + room.length / 2
        );

        houseGroup.add(floor);
    }

    const wallMaterial = new THREE.MeshStandardMaterial({
        color: "#eeeeee",
        roughness: 0.85
    });

    const walls = getHouseWalls(house.rooms);

    for (const wall of walls) {
        createWallWithDoors(wall, house, wallMaterial);
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

    if (!width || !height) return;

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
