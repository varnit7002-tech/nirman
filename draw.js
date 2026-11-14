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
return rect
}
 
function drawText(x, y, words) {
const text = document.createElementNS("http://www.w3.org/2000/svg","text");
text.setAttribute("x", x);
text.setAttribute("y", y);
text.setAttribute("font-size", 1);
text.setAttribute("text-anchor", "middle");
text.textContent = words;
svg.appendChild(text);
}

let selectionID = null;
function render() {
svg.innerHTML = ""; 

  
drawRect(0, 0, house.plot.width, house.plot.length, "none");
  
const s = house.plot.setbacks;
drawRect(s.left, s.rear, house.plot.width - s.left - s.right,
house.plot.length - s.front - s.rear, "#2f920a");

 
for (const room of house.rooms) {
    const svgY = house.plot.length - room.y - room.length;

    const roomRect = drawRect(
        room.x,
        svgY,
        room.width,
        room.length,
        selectionID ===room.id ? "orange" :room.wet ? "lightblue" : "white"
    );

    roomRect.setAttribute("id", room.id);
    roomRect.style.cursor = "move";
    roomRect.addEventListener("click", function () {
        selectionID = room.id;
        console.log(selectionID)
        render()
    });

    drawText(room.x + room.width / 2, svgY + room.length / 2, room.name);
}

  
for (const fixture of house.fixtures) {
const svgY = house.plot.length - fixture.y - fixture.length;
drawRect(fixture.x, svgY, fixture.width, fixture.length, "gray");
}
}   


fetch("nirman_house_model.json")
    .then(r => r.json())
    .then(data => {
      house = data.house;
      render();
      console.log(getPlayableArea(house));
      console.log(getCoverageLimit(house));
      console.log(getTotalRoomArea(house));
    });
