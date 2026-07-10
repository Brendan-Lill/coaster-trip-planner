// Auth0 Setup

let auth0Client = null;

const configureClient = async () => {
  auth0Client = await auth0.createAuth0Client({
    domain: 'dev-141ht5cx5e63t36p.us.auth0.com',
    clientId: 'CQ6a6FHrssEDvF5ogZEXyPGWeNNEn3Sv',
    authorizationParams: { 
      redirect_uri: 'http://127.0.0.1:5500/client/index.html',
      audience: 'https://coaster-planner-api'
    },
  });
};

const displayView = (name) => {
  ['loading', 'error', 'authenticated', 'unauthenticated'].forEach((v) => 
    document.getElementById(`view-${v}`).hidden = v !== name
  );
};

const updateUI = async () => {
  const isAuthenticated = await auth0Client.isAuthenticated();
  if (isAuthenticated) {
    const user = await auth0Client.getUser();
    document.getElementById("user-email").textContent = user.email;
    displayView("authenticated");
  } else {
    displayView("unauthenticated");
  }
};

window.onload = async () => {
  await configureClient();

  if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  document.getElementById("btn-login").addEventListener("click", () => auth0Client.loginWithRedirect());
  document.getElementById("btn-signup").addEventListener("click", () => auth0Client.loginWithRedirect({
    authorizationParams: { screen_hint: 'signup' }
  }));
document.getElementById("btn-logout").addEventListener("click", () => {
  auth0Client.logout({
    logoutParams: { 
      returnTo: window.location.origin + "/client/index.html" 
    }
  });
});

  await updateUI().then(fetchMyTrips());
};

let coorArr = [];
let nameArr = [];
let daysArr = [];
let nearArr = [];
let tripCreated = false;
let saveString;

const map = L.map('map').setView([40, -95], 4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let daySelect = document.getElementById("daySelect");
let parkSearch = document.getElementById("parkSearch");
let steps = document.getElementById("steps");
let suggest = document.getElementById("suggest");
let creatBtn = document.getElementById("createBtn");
let addBtn = document.getElementById("addBtn");
let resetBtn = document.getElementById("resetBtn");

// Fetches all of the users saved trips and puts them in the dropdown
const fetchMyTrips = async () => {
  try {
    const token = await auth0Client.getTokenSilently();
    const response = await fetch("https://roller-coaster-trip-planner-server.onrender.com/api/trips", {
        headers: { "Authorization": `Bearer ${token}` }
      });

    const trips = await response.json();
    const dropdown = document.getElementById("savedDrop");
        
    dropdown.innerHTML = '<option value="">-- Select a Saved Trip --</option>';

    trips.forEach((trip, index) => {
      const option = document.createElement("option");
      option.value = trip.trip_data;
      option.textContent = `Saved Trip ${index + 1}`;
      dropdown.appendChild(option);
    });

    } catch (error) {
      alert(`Fetch failed: ${error}`);
    }
};

// Replaces the steps with the steps of a saved trip
document.getElementById("savedDrop").addEventListener("change", (event) => {
  const selectedHTML = event.target.value;
    
  if (selectedHTML) {
    steps.innerHTML = selectedHTML;
  } else {
      steps.innerHTML = ""; 
  }
});

// Adds park pins to the map and fills in all information into arrays to be used later
addBtn.addEventListener("click", () => {
  let park = parkSearch.value;
  park = park.replace(/\s/g, '');
  park = park.replace(/[^a-zA-Z0-9 ]/g, "");
  park = park.toLowerCase();
  getData(park).then((data) => {
  parkSearch.value = "";
  const name = String(data.name);
  const days = Number(data.days);
  const lat = Number(data.lat);
  const long = Number(data.long);
  const nearby = data.nearby;
  nearArr.push(...nearby);
  coorArr.push(lat);
  coorArr.push(long);
  nameArr.push(name);
  daysArr.push(days);
  L.marker([lat, long]).addTo(map).bindPopup(name).openPopup();
    })
  .catch((error) => {
    console.error("An error occurred:", error);
  });
});

// Takes in the name of a park and returns the corresponding JSON
async function getData(info) {
  try {
    const response = await fetch(
      `https://roller-coaster-trip-planner-server.onrender.com/api/data/${info}`
    );

    if (!response.ok) {
      window.alert("Park not found");
        return;
      }

    const data = await response.json();
    return data;

  } catch (err) {
    window.alert("Network error: " + err.message);
  }
}

resetBtn.addEventListener("click", () => {
  location.reload();
});


createBtn.addEventListener("click", async () => {
  steps.innerHTML = "";
  suggest.innerHTML = "";
  if(nameArr.length < 2){
    window.alert("Please Include at Least 2 Parks");
    return;
  }
const maxDays = daySelect.value;
let dayCount = 0;

for(let n = 0; n < daysArr.length; n++){
  dayCount += daysArr[n];
}

if(maxDays < dayCount){
  window.alert("Not Enough Days to visit each Park");
  return;
}

if(tripCreated){
  window.alert("Trip already created. Press the reset button to create a new trip");
  return;
}

tripCreated = true;
// Estimates 16 active hours per day
let maxHours = maxDays * 16;
let totalHours = dayCount * 16

let currentLat = coorArr[0];
let currentLong = coorArr[1];
steps.insertAdjacentHTML("beforeend", `<h4>${nameArr[0]}: ${String(daysArr[0])} Day(s)</h4>`);

// Creates a route by repeatedly finding the nearest park
const visited = new Array(coorArr.length / 2).fill(false);
visited[0] = true;

for (let step = 1; step < coorArr.length / 2; step++) {

  let minDist = Infinity;
  let minIndex = -1;

  for (let n = 0; n < coorArr.length; n += 2) {

    const pointIndex = n / 2;

    if (visited[pointIndex]) continue;

      const dist = map.distance([currentLat, currentLong], [coorArr[n], coorArr[n + 1]]);
      if (dist < minDist) {
        minDist = dist;
        minIndex = n;
      }
  }

  const nextLat = coorArr[minIndex];
  const nextLong = coorArr[minIndex + 1];
  const currentPark = nameArr[minIndex / 2];
  const currentDays = daysArr[minIndex / 2];


await new Promise((resolve) => {

  let routingControl = L.Routing.control({
    waypoints: [
      L.latLng(currentLat, currentLong),
      L.latLng(nextLat, nextLong)
      ],
      show: false,
      addWaypoints: false,
      draggableWaypoints: false,
      routeWhileDragging: false,
      createMarker: () => null
  }).addTo(map);

  routingControl.on("routesfound", function(e) {

  let routes = e.routes;
  let summary = routes[0].summary;

  let totalSeconds = summary.totalTime;
  let drivingMinutes = Math.round(totalSeconds / 60);

  totalHours += drivingMinutes / 60;

  steps.insertAdjacentHTML("beforeend", `
    <h4>Drive ${Math.floor(drivingMinutes/60)} Hours ${Math.floor(drivingMinutes%60)} Minutes</h4>
    <h4>Visit ${currentPark} for ${currentDays} Day(s)</h4>
  `);
  resolve();
  });
});
  visited[minIndex / 2] = true;

  currentLat = nextLat;
  currentLong = nextLong;

}
  if (totalHours > maxHours){
    steps.insertAdjacentHTML("beforeend", "<h4 style = 'color: red;'>Warning: Total Hours Exceed 16 per day.</h4><h4 style = 'color: red;'>Consider Removing Parks or Adding Days</h4>");
  }
  else{
    steps.insertAdjacentHTML("beforeend", `<h4>${Math.floor((maxHours - totalHours) / 16)} Day(s) Remaining</h4>`);
  }

  // Uses a map to find the most frequent nearby parks and suggests them
  let parkMap = new Map();

  for(let n = 0; n < nearArr.length; n++){
    if(parkMap.has(nearArr[n])){
      parkMap.set(nearArr[n], parkMap.get(nearArr[n]) + 1);
    }
    else if (!nameArr.includes(nearArr[n])){
       parkMap.set(nearArr[n], 1);
    }
  }
  const sortedEntries = [...parkMap.entries()].sort((a, b) => b[1] - a[1]);
  const topThree = sortedEntries.slice(0, 3);

  suggest.insertAdjacentHTML("beforeend", `<h4>Suggested Parks Nearby</h4><h4>${topThree[0][0]}</h4><h4>${topThree[1][0]}</h4><h4>${topThree[2][0]}</h4>`);
  
  saveString = steps.innerHTML;
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.style.visibility = "visible";
});

// Gives the saveString from the trip to the backend using Auth0
saveBtn.addEventListener('click', async() => {
  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch("https://roller-coaster-trip-planner-server.onrender.com/api/trips", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
      tripHTML: saveString
      })
    });

    if (response.ok) {
      alert("Trip saved!");
      saveBtn.style.display = 'none'; 
    } else {
      alert(`Save failed: ${await response.text()}`);
    }

  } catch (error) {
    alert(`Error saving trip: ${error}`);
  }
  });