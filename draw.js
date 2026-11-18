const svg = document.getElementById("plan");
const roomRows = document.getElementById("roomRows");
const totalRoomArea = document.getElementById("totalRoomArea");

let selectionID = null;
let dragging = null;

const MIN_ROOM_SIZE = 2;
const WALL_TOLERANCE = 0.6;
const EPSILON = 0.001;

function drawRect(x, y, width, height, fill) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    rect.setAttribute("fill", fill);
    rect.setAttribute("stroke", "black");
    rect.setAttribute("stroke-width", 0.1);
    svg.appendChild(rect);
    return rect;
}

function drawText(x, y, words, fontSize = 0.8) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.setAttribute("font-size", fontSize);
    text.setAttribute("text-anchor", "middle");
    text.style.pointerEvents = "none";
    text.textContent = words;
    svg.appendChild(text);
}

function formatNumber(value) {
    return Number(value.toFixed(2)).toString();
}

function getSVGPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
}

function getWallAtPoint(room, point) {
    const y = house.plot.length - room.y - room.length;

    const walls = [
        { name: "left", distance: Math.abs(point.x - room.x), valid: point.y >= y && point.y <= y + room.length },
        { name: "right", distance: Math.abs(point.x - room.x - room.width), valid: point.y >= y && point.y <= y + room.length },
        { name: "top", distance: Math.abs(point.y - y), valid: point.x >= room.x && point.x <= room.x + room.width },
        { name: "bottom", distance: Math.abs(point.y - y - room.length), valid: point.x >= room.x && point.x <= room.x + room.width }
    ];

    const closestWall = walls.filter(wall => wall.valid).sort((a, b) => a.distance - b.distance)[0];
    return closestWall && closestWall.distance <= WALL_TOLERANCE ? closestWall.name : null;
}

function getAdjacentRooms(room, wall) {
    const verticalWall = wall === "left" || wall === "right";

    return house.rooms.filter(other => {
        if (other.id === room.id) return false;

        let touching;
        if (wall === "right") touching = Math.abs(other.x - room.x - room.width) < EPSILON;
        else if (wall === "left") touching = Math.abs(other.x + other.width - room.x) < EPSILON;
        else if (wall === "top") touching = Math.abs(other.y - room.y - room.length) < EPSILON;
        else touching = Math.abs(other.y + other.length - room.y) < EPSILON;

        const overlap = verticalWall
            ? Math.min(room.y + room.length, other.y + other.length) - Math.max(room.y, other.y)
            : Math.min(room.x + room.width, other.x + other.width) - Math.max(room.x, other.x);

        return touching && overlap > EPSILON;
    });
}

function startResize(event, room) {
    const point = getSVGPoint(event);
    const wall = getWallAtPoint(room, point);
    if (!wall) return;

    event.preventDefault();
    selectionID = room.id;

    const adjacentRooms = getAdjacentRooms(room, wall);

    dragging = {
        room,
        wall,
        startX: point.x,
        startY: point.y,
        adjacentRooms,
        original: { x: room.x, y: room.y, width: room.width, length: room.length },
        adjacentOriginals: new Map(adjacentRooms.map(other => [other.id, {
            x: other.x,
            y: other.y,
            width: other.width,
            length: other.length
        }]))
    };

    svg.setPointerCapture(event.pointerId);
    render();
}

function getCandidateLayout(movement) {
    const d = dragging;
    const selected = { ...d.original };
    const changes = new Map();

    if (d.wall === "right") selected.width += movement;
    if (d.wall === "left") {
        selected.x -= movement;
        selected.width += movement;
    }
    if (d.wall === "top") selected.length += movement;
    if (d.wall === "bottom") {
        selected.y -= movement;
        selected.length += movement;
    }

    for (const other of d.adjacentRooms) {
        const updated = { ...d.adjacentOriginals.get(other.id) };

        if (d.wall === "right") {
            updated.x += movement;
            updated.width -= movement;
        }
        if (d.wall === "left") updated.width -= movement;
        if (d.wall === "top") {
            updated.y += movement;
            updated.length -= movement;
        }
        if (d.wall === "bottom") updated.length -= movement;

        changes.set(other.id, updated);
    }

    return { selected, changes };
}

function isValidCandidate(layout) {
    const setbacks = house.plot.setbacks;
    const minX = setbacks.left;
    const maxX = house.plot.width - setbacks.right;
    const minY = setbacks.front;
    const maxY = house.plot.length - setbacks.rear;

    const rooms = house.rooms.map(room => {
        if (room.id === dragging.room.id) return { ...room, ...layout.selected };
        const changes = layout.changes.get(room.id);
        return changes ? { ...room, ...changes } : room;
    });

    for (const room of rooms) {
        if (room.x < minX - EPSILON || room.y < minY - EPSILON ||
            room.x + room.width > maxX + EPSILON || room.y + room.length > maxY + EPSILON ||
            room.width < MIN_ROOM_SIZE - EPSILON || room.length < MIN_ROOM_SIZE - EPSILON) {
            return false;
        }
    }

    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const a = rooms[i];
            const b = rooms[j];
            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.length, b.y + b.length) - Math.max(a.y, b.y);

            if (overlapX > EPSILON && overlapY > EPSILON) return false;
        }
    }

    return true;
}

function findValidMovement(requestedMovement) {
    let low = 0;
    let high = 1;

    for (let i = 0; i < 30; i++) {
        const middle = (low + high) / 2;
        const layout = getCandidateLayout(requestedMovement * middle);

        if (isValidCandidate(layout)) low = middle;
        else high = middle;
    }

    return requestedMovement * low;
}

function resizeRooms(event) {
    if (!dragging) return;

    const point = getSVGPoint(event);
    const d = dragging;
    let movement = 0;

    if (d.wall === "right") movement = point.x - d.startX;
    if (d.wall === "left") movement = d.startX - point.x;
    if (d.wall === "top") movement = d.startY - point.y;
    if (d.wall === "bottom") movement = point.y - d.startY;

    const layout = getCandidateLayout(findValidMovement(movement));
    Object.assign(d.room, layout.selected);

    for (const other of d.adjacentRooms) {
        Object.assign(other, layout.changes.get(other.id));
    }

    render();
}

function updateRoomInfo() {
    roomRows.replaceChildren();

    for (const room of house.rooms) {
        const row = document.createElement("tr");
        const values = [
            room.name,
            `${formatNumber(room.width)} ft`,
            `${formatNumber(room.length)} ft`,
            `${formatNumber(room.width * room.length)} sq ft`
        ];

        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        roomRows.appendChild(row);
    }

    totalRoomArea.textContent = formatNumber(getTotalRoomArea(house));
}

function render() {
    svg.replaceChildren();
    drawRect(0, 0, house.plot.width, house.plot.length, "none");

    const s = house.plot.setbacks;
    drawRect(s.left, s.rear, house.plot.width - s.left - s.right,
        house.plot.length - s.front - s.rear, "none");

    for (const room of house.rooms) {
        const y = house.plot.length - room.y - room.length;
        const fill = selectionID === room.id ? "orange" : room.wet ? "lightblue" : "white";
        const roomRect = drawRect(room.x, y, room.width, room.length, fill);

        roomRect.setAttribute("id", room.id);
        roomRect.style.cursor = "crosshair";
        roomRect.style.touchAction = "none";
        roomRect.addEventListener("pointerdown", event => startResize(event, room));

        const centerX = room.x + room.width / 2;
        const centerY = y + room.length / 2;
        const area = room.width * room.length;

        drawText(centerX, centerY - 0.7, room.name);
        drawText(centerX, centerY + 0.3,
            `${formatNumber(room.width)} x ${formatNumber(room.length)} ft`, 0.65);
        drawText(centerX, centerY + 1.1, `${formatNumber(area)} sq ft`, 0.7);
    }

    updateRoomInfo();
}

svg.style.touchAction = "none";
svg.addEventListener("pointermove", resizeRooms);
svg.addEventListener("pointerup", () => dragging = null);
svg.addEventListener("pointercancel", () => dragging = null);

fetch("nirman_house_model.json")
    .then(response => response.json())
    .then(data => {
        house = data.house;
        render();
    })
    .catch(() => roomRows.textContent = "Unable to load the floor plan.");