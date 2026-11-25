const svg = document.getElementById("plan");
const roomRows = document.getElementById("roomRows");
const totalRoomArea = document.getElementById("totalRoomArea");

let selectionID = null;
let dragging = null;
let windowDragging = null;
let selectedWindow = null;

const MIN_ROOM_SIZE = 2;
const MIN_WINDOW_WIDTH = 1;
const MIN_WINDOW_HEIGHT = 0.3;
const MAX_WALL_HEIGHT = 10;
const WALL_TOLERANCE = 0.6;
const EPSILON = 0.001;

// ==========================================
// AUTO SAVE VARIABLES
// ==========================================

const STORAGE_KEY = "nirman_saved_house";

let originalHouse = null;
let autosaveTimer = null;
let autosaveEnabled = false;

// ==========================================
// AUTO SAVE FUNCTIONS
// ==========================================

function cloneHouse(data) {
    return JSON.parse(JSON.stringify(data));
}

function updateSaveStatus(message, color = "#666") {
    saveStatus.textContent = message;
    saveStatus.style.color = color;
}

function saveHouse() {
    if (!house || !autosaveEnabled) return;

    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(house)
        );

        updateSaveStatus(
            "All changes saved",
            "green"
        );
    } catch (error) {
        console.error("Unable to save house:", error);

        updateSaveStatus(
            "Unable to save changes",
            "red"
        );
    }
}

function scheduleAutoSave() {
    if (!autosaveEnabled) return;

    updateSaveStatus(
        "Saving changes...",
        "#b7791f"
    );

    clearTimeout(autosaveTimer);

    autosaveTimer = setTimeout(() => {
        saveHouse();
    }, 400);
}

function loadSavedHouse(originalData) {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (!savedData) {
            return cloneHouse(originalData);
        }

        const parsedData = JSON.parse(savedData);

        if (
            !parsedData ||
            !parsedData.plot ||
            !Array.isArray(parsedData.rooms)
        ) {
            throw new Error("Invalid saved house data");
        }

        updateSaveStatus(
            "Previous design restored",
            "green"
        );

        return parsedData;

    } catch (error) {
        console.error("Unable to load saved house:", error);

        localStorage.removeItem(STORAGE_KEY);

        updateSaveStatus(
            "Starting with original plan",
            "#666"
        );

        return cloneHouse(originalData);
    }
}

// ==========================================
// RESET BUTTON
// ==========================================

const planControls = document.createElement("div");

planControls.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 12px;
    font-family: Arial, sans-serif;
`;

const saveStatus = document.createElement("span");

saveStatus.textContent = "Loading design...";

saveStatus.style.cssText = `
    font-size: 13px;
    color: #666;
`;

const resetButton = document.createElement("button");

resetButton.textContent = "Reset to Original Plan";

resetButton.style.cssText = `
    padding: 9px 14px;
    border: none;
    border-radius: 6px;
    background: #dc3545;
    color: white;
    font-size: 13px;
    cursor: pointer;
`;

resetButton.addEventListener("click", () => {
    if (!originalHouse) return;

    const confirmed = confirm(
        "Are you sure you want to reset your design? All saved changes will be lost."
    );

    if (!confirmed) return;

    clearTimeout(autosaveTimer);

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error("Unable to clear saved design:", error);
    }

    // Temporarily disable auto-save during reset.
    autosaveEnabled = false;

    house = cloneHouse(originalHouse);

    window.nirmanHouse = house;
    refreshOpeningRoomOptions();

    selectionID = null;
    selectedWindow = null;
    dragging = null;
    windowDragging = null;

    render();

    // Re-enable auto-save for future edits.
    autosaveEnabled = true;

    updateSaveStatus(
        "Original plan restored",
        "green"
    );
});

planControls.append(saveStatus, resetButton);

// ==========================================
// WINDOW EDITOR
// ==========================================

const windowEditor = document.createElement("div");

windowEditor.style.cssText = `
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #cccccc;
    border-radius: 8px;
    font-family: Arial, sans-serif;
`;

const windowEditorTitle = document.createElement("strong");

windowEditorTitle.textContent = "Window Properties";

const windowEditorDescription = document.createElement("p");

windowEditorDescription.textContent =
    "Select a window in the 2D plan to edit its dimensions.";

windowEditorDescription.style.cssText =
    "font-size: 13px; color: #666; margin: 6px 0 12px;";

const windowEditorFields = document.createElement("div");

windowEditorFields.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
`;

function createWindowInput(labelText) {
    const wrapper = document.createElement("label");

    wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 13px;
    `;

    const label = document.createElement("span");
    label.textContent = labelText;

    const input = document.createElement("input");

    input.type = "number";
    input.step = "0.1";

    input.style.cssText = `
        width: 110px;
        padding: 7px;
        border: 1px solid #aaa;
        border-radius: 5px;
    `;

    input.disabled = true;

    wrapper.append(label, input);

    return input;
}

const windowHeightInput = createWindowInput("Window height (ft)");
const sillHeightInput = createWindowInput("Sill height (ft)");

windowEditorFields.append(
    windowHeightInput.parentElement,
    sillHeightInput.parentElement
);

const windowEditorMessage = document.createElement("p");

windowEditorMessage.style.cssText = `
    font-size: 12px;
    color: #666;
    margin: 10px 0 0;
`;

windowEditor.append(
    windowEditorTitle,
    windowEditorDescription,
    windowEditorFields,
    windowEditorMessage
);


const wallOpeningEditor = document.createElement("div");
wallOpeningEditor.style.cssText = `
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #cccccc;
    border-radius: 8px;
    font-family: Arial, sans-serif;
`;

const wallOpeningTitle = document.createElement("strong");
wallOpeningTitle.textContent = "Open Wall / Create Passage";

const wallOpeningDescription = document.createElement("p");
wallOpeningDescription.textContent =
    "Choose a room wall and define how much wall to open. Opening area is width × height.";
wallOpeningDescription.style.cssText =
    "font-size: 13px; color: #666; margin: 6px 0 12px;";

const wallOpeningFields = document.createElement("div");
wallOpeningFields.style.cssText =
    "display:flex; flex-wrap:wrap; gap:12px; align-items:end;";

function makeOpeningField(labelText, type = "number") {
    const label = document.createElement("label");
    label.style.cssText =
        "display:flex; flex-direction:column; gap:5px; font-size:13px;";
    const caption = document.createElement("span");
    caption.textContent = labelText;
    const input = document.createElement(type === "select" ? "select" : "input");
    if (type !== "select") {
        input.type = "number";
        input.step = "0.1";
        input.min = "0";
    }
    input.style.cssText =
        "width:110px; padding:7px; border:1px solid #aaa; border-radius:5px;";
    label.append(caption, input);
    return input;
}

const openingRoomSelect = makeOpeningField("Room", "select");
const openingWallSelect = makeOpeningField("Wall", "select");
const openingWidthInput = makeOpeningField("Opening width (ft)");
const openingHeightInput = makeOpeningField("Opening height (ft)");
const openingOffsetInput = makeOpeningField("Offset from wall start (ft)");
openingWidthInput.value = "3";
openingHeightInput.value = "7";
openingOffsetInput.value = "0";

for (const [value, label] of [
    ["top", "Top"], ["bottom", "Bottom"],
    ["left", "Left"], ["right", "Right"]
]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    openingWallSelect.appendChild(option);
}

const addOpeningButton = document.createElement("button");
addOpeningButton.textContent = "Add Open Passage";
addOpeningButton.style.cssText =
    "padding:8px 12px; border:0; border-radius:5px; background:#2563eb; color:white; cursor:pointer;";

const openingAreaText = document.createElement("p");
openingAreaText.style.cssText =
    "font-size:13px; margin:10px 0 0; font-weight:600;";
openingAreaText.textContent = "Wall area removed: 0 sq ft";

const openingMessage = document.createElement("p");
openingMessage.style.cssText =
    "font-size:12px; color:#666; margin:6px 0 0;";

wallOpeningFields.append(
    openingRoomSelect,
    openingWallSelect,
    openingWidthInput,
    openingHeightInput,
    openingOffsetInput,
    addOpeningButton
);

wallOpeningEditor.append(
    wallOpeningTitle,
    wallOpeningDescription,
    wallOpeningFields,
    openingAreaText,
    openingMessage
);

function updateOpeningAreaPreview() {
    const width = Number(openingWidthInput.value) || 0;
    const height = Number(openingHeightInput.value) || 0;
    openingAreaText.textContent =
        `Wall area removed: ${formatNumber(width * height)} sq ft`;
}

openingWidthInput.addEventListener("input", updateOpeningAreaPreview);
openingHeightInput.addEventListener("input", updateOpeningAreaPreview);

function refreshOpeningRoomOptions() {
    const previous = openingRoomSelect.value;
    openingRoomSelect.replaceChildren();

    for (const room of house.rooms || []) {
        const option = document.createElement("option");
        option.value = room.id;
        option.textContent = room.name;
        openingRoomSelect.appendChild(option);
    }

    if ([...openingRoomSelect.options].some(option => option.value === previous)) {
        openingRoomSelect.value = previous;
    }
}

function getOpeningWallLength(room, wall) {
    return wall === "top" || wall === "bottom"
        ? room.width
        : room.length;
}

addOpeningButton.addEventListener("click", () => {
    if (!house) return;

    const room = house.rooms.find(
        item => item.id === openingRoomSelect.value
    );

    if (!room) return;

    const wall = openingWallSelect.value;
    const wallLength = getOpeningWallLength(room, wall);
    const width = Number(openingWidthInput.value);
    const height = Number(openingHeightInput.value);
    const offset = Number(openingOffsetInput.value);

    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isFinite(offset) ||
        width <= 0 ||
        height <= 0 ||
        offset < 0 ||
        offset + width > wallLength + EPSILON ||
        height > MAX_WALL_HEIGHT
    ) {
        openingMessage.textContent =
            `Invalid opening. Keep it within the ${formatNumber(wallLength)} ft wall and below ${MAX_WALL_HEIGHT} ft high.`;
        openingMessage.style.color = "#b91c1c";
        return;
    }

    house.wallOpenings = house.wallOpenings || [];

    const newOpening = {
        id: `opening_${Date.now()}`,
        roomId: room.id,
        wall,
        offset,
        width,
        height
    };

    const overlapsExisting = [
        ...(house.wallOpenings || []),
        ...(house.doors || []),
        ...(house.windows || [])
    ].some(existing => {
        if (existing.roomId !== room.id || existing.wall !== wall) return false;
        const a1 = offset;
        const a2 = offset + width;
        const b1 = Number(existing.offset);
        const b2 = b1 + Number(existing.width);
        return a1 < b2 - EPSILON && b1 < a2 - EPSILON;
    });

    if (overlapsExisting) {
        openingMessage.textContent =
            "This opening overlaps an existing door, window, or wall opening.";
        openingMessage.style.color = "#b91c1c";
        return;
    }

    house.wallOpenings.push(newOpening);
    openingMessage.textContent =
        `Added opening in ${room.name}. Removed area: ${formatNumber(width * height)} sq ft. This is a design preview; get structural approval before real construction.`;
    openingMessage.style.color = "#166534";
    render();
});


if (svg.parentElement) {
    svg.insertAdjacentElement("afterend", windowEditor);
    windowEditor.insertAdjacentElement("afterend", wallOpeningEditor);
    wallOpeningEditor.insertAdjacentElement("afterend", planControls);
}

// ==========================================
// WINDOW EDITOR UPDATE
// ==========================================

function updateWindowEditor() {
    if (!selectedWindow) {
        windowEditorDescription.textContent =
            "Select a window in the 2D plan to edit its dimensions.";

        windowHeightInput.disabled = true;
        sillHeightInput.disabled = true;

        windowEditorMessage.textContent = "";

        return;
    }

    const room = house.rooms.find(
        room => room.id === selectedWindow.roomId
    );

    if (!room) return;

    windowEditorDescription.textContent =
        `${room.name} — ${selectedWindow.wall} wall`;

    windowHeightInput.disabled = false;
    sillHeightInput.disabled = false;

    windowHeightInput.value = Number(
        selectedWindow.height
    ).toFixed(2);

    sillHeightInput.value = Number(
        selectedWindow.sillHeight
    ).toFixed(2);

    windowHeightInput.min = MIN_WINDOW_HEIGHT;

    windowHeightInput.max = Math.max(
        MIN_WINDOW_HEIGHT,
        MAX_WALL_HEIGHT - Number(selectedWindow.sillHeight)
    );

    sillHeightInput.min = 0;

    sillHeightInput.max = Math.max(
        0,
        MAX_WALL_HEIGHT - Number(selectedWindow.height)
    );

    windowEditorMessage.textContent =
        `Maximum wall height: ${MAX_WALL_HEIGHT} ft`;
}

// ==========================================
// WINDOW HEIGHT EDITING
// ==========================================

windowHeightInput.addEventListener("change", () => {
    if (!selectedWindow) return;

    const newHeight = Number(windowHeightInput.value);
    const sillHeight = Number(selectedWindow.sillHeight);

    if (
        !Number.isFinite(newHeight) ||
        newHeight < MIN_WINDOW_HEIGHT ||
        newHeight + sillHeight > MAX_WALL_HEIGHT
    ) {
        windowEditorMessage.textContent =
            "Invalid height. The window must fit within the 10 ft wall.";

        updateWindowEditor();
        return;
    }

    selectedWindow.height = newHeight;

    render();
});

// ==========================================
// SILL HEIGHT EDITING
// ==========================================

sillHeightInput.addEventListener("change", () => {
    if (!selectedWindow) return;

    const newSillHeight = Number(sillHeightInput.value);
    const windowHeight = Number(selectedWindow.height);

    if (
        !Number.isFinite(newSillHeight) ||
        newSillHeight < 0 ||
        newSillHeight + windowHeight > MAX_WALL_HEIGHT
    ) {
        windowEditorMessage.textContent =
            "Invalid sill height. The window must fit within the 10 ft wall.";

        updateWindowEditor();
        return;
    }

    selectedWindow.sillHeight = newSillHeight;

    render();
});

// ==========================================
// DRAWING FUNCTIONS
// ==========================================

function drawRect(x, y, width, height, fill) {
    const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
    );

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
    const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
    );

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

    return point.matrixTransform(
        svg.getScreenCTM().inverse()
    );
}

// ==========================================
// ROOM WALL FUNCTIONS
// ==========================================

function getWallAtPoint(room, point) {
    const y = house.plot.length - room.y - room.length;

    const walls = [
        {
            name: "left",
            distance: Math.abs(point.x - room.x),
            valid: point.y >= y && point.y <= y + room.length
        },
        {
            name: "right",
            distance: Math.abs(point.x - room.x - room.width),
            valid: point.y >= y && point.y <= y + room.length
        },
        {
            name: "top",
            distance: Math.abs(point.y - y),
            valid: point.x >= room.x && point.x <= room.x + room.width
        },
        {
            name: "bottom",
            distance: Math.abs(point.y - y - room.length),
            valid: point.x >= room.x && point.x <= room.x + room.width
        }
    ];

    const closestWall = walls
        .filter(wall => wall.valid)
        .sort((a, b) => a.distance - b.distance)[0];

    return closestWall &&
        closestWall.distance <= WALL_TOLERANCE
        ? closestWall.name
        : null;
}

function getAdjacentRooms(room, wall) {
    const verticalWall =
        wall === "left" || wall === "right";

    return house.rooms.filter(other => {
        if (other.id === room.id) return false;

        let touching;

        if (wall === "right") {
            touching = Math.abs(
                other.x - room.x - room.width
            ) < EPSILON;
        } else if (wall === "left") {
            touching = Math.abs(
                other.x + other.width - room.x
            ) < EPSILON;
        } else if (wall === "top") {
            touching = Math.abs(
                other.y - room.y - room.length
            ) < EPSILON;
        } else {
            touching = Math.abs(
                other.y + other.length - room.y
            ) < EPSILON;
        }

        const overlap = verticalWall
            ? Math.min(
                room.y + room.length,
                other.y + other.length
            ) - Math.max(room.y, other.y)
            : Math.min(
                room.x + room.width,
                other.x + other.width
            ) - Math.max(room.x, other.x);

        return touching && overlap > EPSILON;
    });
}

// ==========================================
// ROOM RESIZING
// ==========================================

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

        original: {
            x: room.x,
            y: room.y,
            width: room.width,
            length: room.length
        },

        adjacentOriginals: new Map(
            adjacentRooms.map(other => [
                other.id,
                {
                    x: other.x,
                    y: other.y,
                    width: other.width,
                    length: other.length
                }
            ])
        )
    };

    svg.setPointerCapture(event.pointerId);

    render();
}

function getCandidateLayout(movement) {
    const d = dragging;

    const selected = { ...d.original };
    const changes = new Map();

    if (d.wall === "right") {
        selected.width += movement;
    }

    if (d.wall === "left") {
        selected.x -= movement;
        selected.width += movement;
    }

    if (d.wall === "top") {
        selected.length += movement;
    }

    if (d.wall === "bottom") {
        selected.y -= movement;
        selected.length += movement;
    }

    for (const other of d.adjacentRooms) {
        const updated = {
            ...d.adjacentOriginals.get(other.id)
        };

        if (d.wall === "right") {
            updated.x += movement;
            updated.width -= movement;
        }

        if (d.wall === "left") {
            updated.width -= movement;
        }

        if (d.wall === "top") {
            updated.y += movement;
            updated.length -= movement;
        }

        if (d.wall === "bottom") {
            updated.length -= movement;
        }

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
        if (room.id === dragging.room.id) {
            return { ...room, ...layout.selected };
        }

        const changes = layout.changes.get(room.id);

        return changes
            ? { ...room, ...changes }
            : room;
    });

    for (const room of rooms) {
        if (
            room.x < minX - EPSILON ||
            room.y < minY - EPSILON ||
            room.x + room.width > maxX + EPSILON ||
            room.y + room.length > maxY + EPSILON ||
            room.width < MIN_ROOM_SIZE - EPSILON ||
            room.length < MIN_ROOM_SIZE - EPSILON
        ) {
            return false;
        }
    }

    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const a = rooms[i];
            const b = rooms[j];

            const overlapX =
                Math.min(a.x + a.width, b.x + b.width) -
                Math.max(a.x, b.x);

            const overlapY =
                Math.min(a.y + a.length, b.y + b.length) -
                Math.max(a.y, b.y);

            if (
                overlapX > EPSILON &&
                overlapY > EPSILON
            ) {
                return false;
            }
        }
    }

    return true;
}

function findValidMovement(requestedMovement) {
    let low = 0;
    let high = 1;

    for (let i = 0; i < 30; i++) {
        const middle = (low + high) / 2;

        const layout = getCandidateLayout(
            requestedMovement * middle
        );

        if (isValidCandidate(layout)) {
            low = middle;
        } else {
            high = middle;
        }
    }

    return requestedMovement * low;
}

function resizeRooms(event) {
    if (!dragging) return;

    const point = getSVGPoint(event);
    const d = dragging;

    let movement = 0;

    if (d.wall === "right") {
        movement = point.x - d.startX;
    }

    if (d.wall === "left") {
        movement = d.startX - point.x;
    }

    if (d.wall === "top") {
        movement = d.startY - point.y;
    }

    if (d.wall === "bottom") {
        movement = point.y - d.startY;
    }

    const layout = getCandidateLayout(
        findValidMovement(movement)
    );

    Object.assign(d.room, layout.selected);

    for (const other of d.adjacentRooms) {
        Object.assign(
            other,
            layout.changes.get(other.id)
        );
    }

    render();
}

// ==========================================
// DOOR FUNCTIONS
// ==========================================

function getDoorPosition(door, room) {
    const top = house.plot.length - room.y - room.length;

    let wallLength;
    let startX;
    let startY;
    let inwardX;
    let inwardY;

    if (door.wall === "top") {
        wallLength = room.width;
        startX = room.x;
        startY = top;
        inwardX = 0;
        inwardY = 1;
    } else if (door.wall === "bottom") {
        wallLength = room.width;
        startX = room.x;
        startY = top + room.length;
        inwardX = 0;
        inwardY = -1;
    } else if (door.wall === "left") {
        wallLength = room.length;
        startX = room.x;
        startY = top;
        inwardX = 1;
        inwardY = 0;
    } else if (door.wall === "right") {
        wallLength = room.length;
        startX = room.x + room.width;
        startY = top;
        inwardX = -1;
        inwardY = 0;
    } else {
        return null;
    }

    const doorWidth = Math.min(
        door.width,
        wallLength
    );

    const offset = Math.max(
        0,
        Math.min(
            door.offset,
            wallLength - doorWidth
        )
    );

    if (door.wall === "top" || door.wall === "bottom") {
        startX += offset;
    } else {
        startY += offset;
    }

    return {
        x: startX,
        y: startY,
        width: doorWidth,
        inwardX,
        inwardY
    };
}

function drawDoor(door) {
    const room = house.rooms.find(
        room => room.id === door.roomId
    );

    if (!room) return;

    const position = getDoorPosition(door, room);

    if (!position) return;

    const x1 = position.x;
    const y1 = position.y;

    let x2;
    let y2;

    if (door.wall === "top" || door.wall === "bottom") {
        x2 = x1 + position.width;
        y2 = y1;
    } else {
        x2 = x1;
        y2 = y1 + position.width;
    }

    let hingeX;
    let hingeY;
    let endX;
    let endY;

    if (door.hinge === "end") {
        hingeX = x2;
        hingeY = y2;
    } else {
        hingeX = x1;
        hingeY = y1;
    }

    if (door.isOpen) {
        const direction = door.hinge === "end" ? -1 : 1;

        endX = hingeX +
            position.inwardX * position.width * direction;

        endY = hingeY +
            position.inwardY * position.width * direction;
    } else {
        endX = door.hinge === "end" ? x1 : x2;
        endY = door.hinge === "end" ? y1 : y2;
    }

    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );

    line.setAttribute("x1", hingeX);
    line.setAttribute("y1", hingeY);
    line.setAttribute("x2", endX);
    line.setAttribute("y2", endY);
    line.setAttribute("stroke", door.color || "#D69E36");
    line.setAttribute("stroke-width", 0.3);
    line.setAttribute("stroke-linecap", "round");

    line.style.cursor = "pointer";
    line.style.pointerEvents = "stroke";

    line.addEventListener("pointerdown", event => {
        event.stopPropagation();
    });

    line.addEventListener("click", event => {
        event.stopPropagation();

        door.isOpen = !door.isOpen;

        render();
    });

    svg.appendChild(line);
}

// ==========================================
// WINDOW EDITING
// ==========================================

function startWindowEdit(event, windowData, mode) {
    event.preventDefault();
    event.stopPropagation();

    const room = house.rooms.find(
        room => room.id === windowData.roomId
    );

    if (!room) return;

    selectedWindow = windowData;

    updateWindowEditor();

    const point = getSVGPoint(event);

    const horizontal =
        windowData.wall === "top" ||
        windowData.wall === "bottom";

    windowDragging = {
        windowData,
        room,
        mode,
        startPosition: horizontal ? point.x : point.y,
        originalOffset: windowData.offset,
        originalWidth: windowData.width
    };

    svg.setPointerCapture(event.pointerId);
}

function editWindow(event) {
    if (!windowDragging) return;

    const point = getSVGPoint(event);
    const d = windowDragging;

    const horizontal =
        d.windowData.wall === "top" ||
        d.windowData.wall === "bottom";

    const currentPosition = horizontal ? point.x : point.y;

    const movement = currentPosition - d.startPosition;

    const wallLength = horizontal
        ? d.room.width
        : d.room.length;

    if (d.mode === "move") {
        d.windowData.offset = Math.max(
            0,
            Math.min(
                wallLength - d.originalWidth,
                d.originalOffset + movement
            )
        );
    }

    if (d.mode === "start") {
        const change = Math.max(
            -d.originalOffset,
            Math.min(
                d.originalWidth - MIN_WINDOW_WIDTH,
                movement
            )
        );

        d.windowData.offset = d.originalOffset + change;
        d.windowData.width = d.originalWidth - change;
    }

    if (d.mode === "end") {
        d.windowData.width = Math.max(
            MIN_WINDOW_WIDTH,
            Math.min(
                wallLength - d.originalOffset,
                d.originalWidth + movement
            )
        );
    }

    render();
}

function drawWindow(windowData) {
    const room = house.rooms.find(
        room => room.id === windowData.roomId
    );

    if (!room) return;

    const position = getDoorPosition(windowData, room);

    if (!position) return;

    const isHorizontal =
        windowData.wall === "top" ||
        windowData.wall === "bottom";

    const line1 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );

    const line2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );

    if (isHorizontal) {
        line1.setAttribute("x1", position.x);
        line1.setAttribute("y1", position.y);
        line1.setAttribute("x2", position.x + position.width);
        line1.setAttribute("y2", position.y);

        line2.setAttribute("x1", position.x);
        line2.setAttribute("y1", position.y + position.inwardY * 0.3);
        line2.setAttribute("x2", position.x + position.width);
        line2.setAttribute("y2", position.y + position.inwardY * 0.3);
    } else {
        line1.setAttribute("x1", position.x);
        line1.setAttribute("y1", position.y);
        line1.setAttribute("x2", position.x);
        line1.setAttribute("y2", position.y + position.width);

        line2.setAttribute("x1", position.x + position.inwardX * 0.3);
        line2.setAttribute("y1", position.y);
        line2.setAttribute("x2", position.x + position.inwardX * 0.3);
        line2.setAttribute("y2", position.y + position.width);
    }

    const isSelected = selectedWindow === windowData;

    const windowColor = isSelected
        ? "#0755a5"
        : "#2878D0";

    for (const line of [line1, line2]) {
        line.setAttribute("stroke", windowColor);
        line.setAttribute("stroke-width", isSelected ? 0.35 : 0.25);

        line.style.pointerEvents = "stroke";
        line.style.cursor = "move";

        line.addEventListener("pointerdown", event => {
            startWindowEdit(event, windowData, "move");
        });

        svg.appendChild(line);
    }

    const startHandle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
    );

    const endHandle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
    );

    const handleOffset = isHorizontal
        ? { x: 0, y: position.inwardY * 0.15 }
        : { x: position.inwardX * 0.15, y: 0 };

    const handlePositions = [
        {
            element: startHandle,
            x: position.x + handleOffset.x,
            y: position.y + handleOffset.y,
            mode: "start"
        },
        {
            element: endHandle,
            x: position.x + (isHorizontal ? position.width : 0) + handleOffset.x,
            y: position.y + (isHorizontal ? 0 : position.width) + handleOffset.y,
            mode: "end"
        }
    ];

    for (const handle of handlePositions) {
        handle.element.setAttribute("cx", handle.x);
        handle.element.setAttribute("cy", handle.y);
        handle.element.setAttribute("r", 0.2);
        handle.element.setAttribute("fill", windowColor);
        handle.element.setAttribute("stroke", "white");
        handle.element.setAttribute("stroke-width", 0.08);

        handle.element.style.cursor = "ew-resize";
        handle.element.style.pointerEvents = "all";

        handle.element.addEventListener("pointerdown", event => {
            startWindowEdit(event, windowData, handle.mode);
        });

        svg.appendChild(handle.element);
    }
}

function drawWallOpening(opening) {
    const room = house.rooms.find(
        room => room.id === opening.roomId
    );
    if (!room) return;

    const position = getDoorPosition(opening, room);
    if (!position) return;

    const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );

    const horizontal =
        opening.wall === "top" || opening.wall === "bottom";

    line.setAttribute("x1", position.x);
    line.setAttribute("y1", position.y);
    line.setAttribute("x2", position.x + (horizontal ? position.width : 0));
    line.setAttribute("y2", position.y + (horizontal ? 0 : position.width));
    line.setAttribute("stroke", "white");
    line.setAttribute("stroke-width", 0.55);
    line.setAttribute("stroke-linecap", "butt");
    line.style.pointerEvents = "none";
    svg.appendChild(line);

    const marker = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
    );
    marker.setAttribute("x1", position.x);
    marker.setAttribute("y1", position.y);
    marker.setAttribute("x2", position.x + (horizontal ? position.width : 0));
    marker.setAttribute("y2", position.y + (horizontal ? 0 : position.width));
    marker.setAttribute("stroke", "#2563eb");
    marker.setAttribute("stroke-width", 0.08);
    marker.setAttribute("stroke-dasharray", "0.25 0.2");
    marker.style.pointerEvents = "none";
    svg.appendChild(marker);
}

// ==========================================
// ROOM INFORMATION
// ==========================================

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

    totalRoomArea.textContent = formatNumber(
        getTotalRoomArea(house)
    );
}

// ==========================================
// MAIN RENDER FUNCTION
// ==========================================

function render() {
    svg.replaceChildren();

    drawRect(
        0,
        0,
        house.plot.width,
        house.plot.length,
        "none"
    );

    const s = house.plot.setbacks;

    drawRect(
        s.left,
        s.rear,
        house.plot.width - s.left - s.right,
        house.plot.length - s.front - s.rear,
        "none"
    );

    for (const room of house.rooms) {
        const y =
            house.plot.length - room.y - room.length;

        const fill =
            selectionID === room.id
                ? "orange"
                : room.wet
                    ? "lightblue"
                    : "white";

        const roomRect = drawRect(
            room.x,
            y,
            room.width,
            room.length,
            fill
        );

        roomRect.setAttribute("id", room.id);

        roomRect.style.cursor = "crosshair";
        roomRect.style.touchAction = "none";

        roomRect.addEventListener("pointerdown", event => {
            startResize(event, room);
        });

        const centerX = room.x + room.width / 2;
        const centerY = y + room.length / 2;

        const area = room.width * room.length;

        drawText(centerX, centerY - 0.7, room.name);

        drawText(
            centerX,
            centerY + 0.3,
            `${formatNumber(room.width)} x ${formatNumber(room.length)} ft`,
            0.65
        );

        drawText(
            centerX,
            centerY + 1.1,
            `${formatNumber(area)} sq ft`,
            0.7
        );
    }

    for (const door of house.doors || []) {
        drawDoor(door);
    }

    for (const opening of house.wallOpenings || []) {
        drawWallOpening(opening);
    }

    for (const windowData of house.windows || []) {
        drawWindow(windowData);
    }

    updateRoomInfo();

    updateWindowEditor();

    // Keep the 3D model synchronized.
    if (window.update3DHouse && house) {
        window.update3DHouse(house);
    }

    // Automatically save every completed change.
    scheduleAutoSave();
}

// ==========================================
// POINTER EVENTS
// ==========================================

svg.style.touchAction = "none";

svg.addEventListener("pointermove", event => {
    if (windowDragging) {
        editWindow(event);
    } else {
        resizeRooms(event);
    }
});

svg.addEventListener("pointerup", () => {
    const hadChanges = dragging || windowDragging;

    dragging = null;
    windowDragging = null;

    if (hadChanges) {
        saveHouse();
    }
});

svg.addEventListener("pointercancel", () => {
    const hadChanges = dragging || windowDragging;

    dragging = null;
    windowDragging = null;

    if (hadChanges) {
        saveHouse();
    }
});


fetch("nirman_house_model.json")
    .then(response => {
        if (!response.ok) {
            throw new Error("Unable to load JSON");
        }

        return response.json();
    })
    .then(data => {
        // Preserve the original JSON design.
        originalHouse = cloneHouse(data.house);

        // Restore saved design if one exists.
        house = loadSavedHouse(originalHouse);

        window.nirmanHouse = house;
        refreshOpeningRoomOptions();

        // Enable auto-save after loading is complete.
        autosaveEnabled = true;

        render();

        updateSaveStatus(
            "Design ready",
            "green"
        );
    })
    .catch(error => {
        console.error(error);

        roomRows.textContent =
            "Unable to load the floor plan.";

        updateSaveStatus(
            "Unable to load design",
            "red"
        );
    });