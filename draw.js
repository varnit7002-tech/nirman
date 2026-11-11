const svg = document.getElementById("plan");

function drawRect(x, y, width, height, fill) {
const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
rect.setAttribute("x", x);
rect.setAttribute("y", y);
rect.setAttribute("width", width);
rect.setAttribute("height", height);
rect.setAttribute("fill", fill);
rect.setAttribute("stroke", "black");
rect.setAttribute("stroke-width", 0.1);
svg.appendChild(rect);
return
}
let selectionID = null;
function render() {
svg.innerHTML = ""; 
function drawText(x, y, words) {
const text = document.createElementNS("http://www.w3.org/2000/svg","text");
text.setAttribute("x", x);
text.setAttribute("y", y);
text.setAttribute("font-size", 1);
text.setAttribute("text-anchor", "middle");
text.textContent = words;
svg.appendChild(text);
}


const hallMove = document.getElementById("hall");
let isDragging = false;

hallMove.addEventListener("mousedown", function(e) {
    isDragging = true;
});

document.addEventListener("mousemove", function(e) {
    if (isDragging === true) {
        let newX = e.clientX;
        let newY = e.clientY;

        console.log(newX, newY);
    }
});

document.addEventListener("mouseup", function(e) {
    isDragging = false;
});
  
drawRect(0, 0, house.plot.width, house.plot.length, "none");
  
const s = house.plot.setbacks;
drawRect(s.left, s.rear, house.plot.width - s.left - s.right,
house.plot.length - s.front - s.rear, "#e8f5e9");

 
for (const room of house.rooms) {
    const svgY = house.plot.length - room.y - room.length;

    const roomRect = drawRect(
        room.x,
        svgY,
        room.width,
        room.length,
        room.wet ? "lightblue" : "white"
    );

    roomRect.setAttribute("id", room.id);
    roomRect.style.cursor = "move";

    drawText(room.x + room.width / 2, svgY + room.length / 2, room.name);
}

  
for (const fixture of house.fixtures) {
const svgY = house.plot.length - fixture.y - fixture.length;
drawRect(fixture.x, svgY, fixture.width, fixture.length, "gray");
}
}   
let isDragging = false;
let selectedRoom = null;

let offsetX = 0;
let offsetY = 0;

for (const room of house.rooms) {
    const roomRect = document.getElementById(room.id);

    roomRect.addEventListener("mousedown", function(e) {
        isDragging = true;
        selectedRoom = roomRect;

        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;

        const mouse = point.matrixTransform(svg.getScreenCTM().inverse());

        offsetX = mouse.x - Number(roomRect.getAttribute("x"));
        offsetY = mouse.y - Number(roomRect.getAttribute("y"));
    });
}

document.addEventListener("mousemove", function(e) {
    if (!isDragging) return;

    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;

    const mouse = point.matrixTransform(svg.getScreenCTM().inverse());

    selectedRoom.setAttribute("x", mouse.x - offsetX);
    selectedRoom.setAttribute("y", mouse.y - offsetY);
});

document.addEventListener("mouseup", function() {
    isDragging = false;
    selectedRoom = null;
});


fetch("nirman_house_model.json")
    .then(r => r.json())
    .then(data => {
      house = data.house;
      render();
      console.log(getPlayableArea(house));
      console.log(getCoverageLimit(house));
      console.log(getTotalRoomArea(house));
    });