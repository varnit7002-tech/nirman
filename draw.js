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
}

drawRect(0, 0, house.plot.width, house.plot.length, "none");

const s = house.plot.setbacks;

drawRect(s.left, s.rear, house.plot.width - s.left - s.right,house.plot.length - s.front - s.rear, "#e8f5e9");


function drawText(x, y, words) {
    const text = document.createElementNS("http://www.w3.org/2000/svg","text");
text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.setAttribute("font-size", 1);
    text.setAttribute("text-anchor", "middle");
    text.textContent = words;
    svg.appendChild(text);
  }

for (const room of house.rooms) {
const svgY = house.plot.length - room.y - room.length;
drawRect(room.x, svgY, room.width, room.length, "white");
}