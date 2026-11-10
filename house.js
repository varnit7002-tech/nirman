let house = null;


// Function 1
function getPlayableArea(house) {
    const playableWidth = house.plot.width - house.plot.setbacks.left -house.plot.setbacks.right;
    const playableLength = house.plot.length - house.plot.setbacks.front -house.plot.setbacks.rear;
    const area = playableWidth * playableLength;
    return area;
}

// Function 2
function getCoverageLimit(house) {
    const plotArea = house.plot.width * house.plot.length;
    const limit = plotArea * house.plot.coveragePercent / 100;
    return limit

}

// Function 3
function getTotalRoomArea(house) {
    let total = 0;
    for (const room of house.rooms) {
      total = total + room.width * room.length;
    }
    return total;
}

