export type IslandHighlight = {
  name: string;
  description: string;
  image: string;
  alt: string;
};

export type IslandContent = {
  intro: string;
  heroImages: Array<{ src: string; alt: string }>;
  highlights: IslandHighlight[];
  goodToKnow: Array<{ label: string; text: string }>;
  dockNotes: Record<string, string>;
  photographerCredit: string;
};

const photo = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;

export const islandContent: Record<string, IslandContent> = {
  "coral-cove": {
    intro: "Saint Martin is a compact, easygoing stop for travelers who like calm water, waterfront tables, and short walks between the harbor and town. It is known for sheltered bays, lively ferry connections, and a mix of French-Caribbean food and sea views.",
    heroImages: [
      { src: photo("photo-1507525428034-b723cf961d3"), alt: "Turquoise water meeting a sandy Caribbean beach" },
      { src: photo("photo-1544551763-46a013bb70d5"), alt: "Small boat anchored in clear tropical water" },
      { src: photo("photo-1510414842594-a61c69b5ae57"), alt: "Palm-fringed shoreline under a bright sky" },
    ],
    highlights: [
      { name: "Sheltered bay", description: "Calm water makes the harbor a bright place to start a slow morning.", image: photo("photo-1505881502353-a1986add3762", 900), alt: "Sheltered tropical bay with calm blue water" },
      { name: "Marigot waterfront", description: "A compact waterfront for arriving on foot and finding a table by the water.", image: photo("photo-1493552152660-f915ab47ae9d", 900), alt: "Colorful waterfront buildings beside a tropical bay" },
      { name: "Reef edge", description: "Shallow reefs sit just beyond the launch channel on clear-weather days.", image: photo("photo-1506929562872-bb421503ef21", 900), alt: "Aerial view of a reef and pale blue sea" },
      { name: "Sunrise berths", description: "The eastern side opens early to the first light over the harbor.", image: photo("photo-1469474968028-56623f02e42e", 900), alt: "Sunrise light across a coastal landscape" },
    ],
    goodToKnow: [
      { label: "Best time", text: "December through April brings the clearest mornings and gentlest crossings." },
      { label: "How busy", text: "The ferry waterfront is busiest around late morning arrivals and early evening departures." },
      { label: "Bring", text: "Sun protection, a light layer for the ride, and shoes that can handle a short waterfront walk." },
      { label: "Dock access", text: "Marigot is level and close to town; Philipsburg has more foot traffic near the ferry approach." },
    ],
    dockNotes: { "coral-main": "Nearest the French-side waterfront, cafés, and the sheltered west-facing harbor.", "coral-east": "Nearest Philipsburg’s central waterfront and the east-side ferry connections." },
    photographerCredit: "Tropical coast photography via Unsplash",
  },
  "pelican-key": {
    intro: "Anguilla suits travelers looking for low horizons, long beaches, and uncomplicated days by the water. It is known for clear shallows, steady ferry links, and quiet coves that feel spacious even when the harbor is active.",
    heroImages: [
      { src: photo("photo-1473116763249-2faaef81ccda"), alt: "Long pale beach with gentle turquoise surf" },
      { src: photo("photo-1470770841072-f978cf4d019e"), alt: "Green island hillside beside a quiet sea" },
      { src: photo("photo-1500534623283-312aade485b7"), alt: "Coastal path leading toward a bright blue horizon" },
    ],
    highlights: [
      { name: "Low coral shores", description: "Wide beaches and low horizons make the island easy to read from the water.", image: photo("photo-1494783367193-149034c05e8f", 900), alt: "Wide sandy shoreline with clear water" },
      { name: "Blowing Point", description: "The west-side ferry landing is the quickest connection for short crossings.", image: photo("photo-1433086966358-54859d0ed716", 900), alt: "Water flowing around rocks near a tropical shore" },
      { name: "Road Bay", description: "A working harbor with room for ferries, tenders, and local boat traffic.", image: photo("photo-1506744038136-46273834b3fb", 900), alt: "Harbor water framed by green hills" },
      { name: "Open beach", description: "A long strip of sand keeps the sea breeze moving along the southern shore.", image: photo("photo-1519046904884-2d9a7bb5fa1e", 900), alt: "Palm trees beside a sunlit beach" },
    ],
    goodToKnow: [
      { label: "Best time", text: "January through April is breezy, bright, and comfortable for beach walks." },
      { label: "How busy", text: "Blowing Point sees its busiest period around scheduled ferry arrivals." },
      { label: "Bring", text: "A hat, reef-safe sunscreen, and water for longer stretches between services." },
      { label: "Dock access", text: "Blowing Point has a straightforward ferry approach; Road Bay is quieter but more exposed to weather." },
    ],
    dockNotes: { "pelican-west": "Nearest the west-side ferry route, beach access, and the quickest connection for short crossings.", "pelican-east": "Nearest Road Bay’s working harbor and the island’s northwestern shoreline." },
    photographerCredit: "Tropical coast photography via Unsplash",
  },
  "mango-harbor": {
    intro: "Saint Barthélemy is a polished, walkable island stop gathered around Gustavia’s harbor and hillsides. Travelers come for small coves, good food, and a compact waterfront where a boat arrival can turn into an afternoon on foot.",
    heroImages: [
      { src: photo("photo-1500530855697-b586d89ba3ee"), alt: "Quiet tropical coast with rocky shoreline" },
      { src: photo("photo-1528150177508-7cc0c36cda5c"), alt: "Blue sea viewed from a green coastal overlook" },
      { src: photo("photo-1454496522488-7a8e488e8606"), alt: "Mountain ridge rising behind a coastal town" },
    ],
    highlights: [
      { name: "Gustavia harbor", description: "The compact waterfront keeps restaurants, arrivals, and departures close together.", image: photo("photo-1482192596544-9eb780fc7f66", 900), alt: "Blue harbor beside a small coastal settlement" },
      { name: "Hillside lookout", description: "A short climb above the harbor opens a broad view of the surrounding sea.", image: photo("photo-1464822759023-fed622ff2c3b", 900), alt: "Hilly green landscape overlooking the ocean" },
      { name: "South coast", description: "Protected coves along the south side offer quieter water between crossings.", image: photo("photo-1519817650390-64a93db511aa", 900), alt: "Quiet cove with clear water and rocks" },
      { name: "Harbor market", description: "The waterfront market is an easy stop before a boat leaves the quay.", image: photo("photo-1500534314209-a25ddb2bd429", 900), alt: "Outdoor market beside a sunny coastal street" },
    ],
    goodToKnow: [
      { label: "Best time", text: "November through May offers warm, dry days for walking the harbor and hills." },
      { label: "How busy", text: "Gustavia is most active during midday arrivals and the late-afternoon restaurant hour." },
      { label: "Bring", text: "Comfortable shoes for the slopes, a reusable water bottle, and a light cover-up." },
      { label: "Dock access", text: "Both Gustavia landings are close together and level, with the south quay usually easier for luggage." },
    ],
    dockNotes: { "mango-old": "Nearest Gustavia’s central waterfront, shops, and the shortest walk into town.", "mango-south": "Nearest the south quay, restaurants, and calmer water for smaller arrivals." },
    photographerCredit: "Tropical coast photography via Unsplash",
  },
  "starfish-bay": {
    intro: "Sint Eustatius is a quiet, distinctive stop for travelers who prefer open views, working harbors, and a slower pace. The island is known for Oranjestad’s waterfront, clear shallows, and the strong volcanic silhouette of the Quill.",
    heroImages: [
      { src: photo("photo-1437622368342-7a3d73a2d3c8"), alt: "Clear tropical shallows with a rocky seabed" },
      { src: photo("photo-1520637836862-4d197d17c90a"), alt: "Palm-lined coast beneath a soft blue sky" },
      { src: photo("photo-1518509562904-e7ef99cdcc86"), alt: "Small tropical island surrounded by deep blue water" },
    ],
    highlights: [
      { name: "Oranjestad harbor", description: "A straightforward working harbor with a clear approach from the south.", image: photo("photo-1500534623283-312aade485b7", 900), alt: "Coastal harbor with boats and a bright horizon" },
      { name: "Gallows Bay", description: "The market-side pier keeps local arrivals close to the island's main street.", image: photo("photo-1501785888041-af3ef285b470", 900), alt: "Rocky coast and open water below a high viewpoint" },
      { name: "Quill views", description: "The volcanic slope gives the harbor a strong landmark from every approach.", image: photo("photo-1470252649378-9c29740c9fa8", 900), alt: "Volcanic mountain silhouette at sunset" },
      { name: "Calm shallows", description: "Clear shallows along the west coast are good for a quiet pause between rides.", image: photo("photo-1469474968028-56623f02e42e", 900), alt: "Calm sea beside a green coastal landscape" },
    ],
    goodToKnow: [
      { label: "Best time", text: "February through June is a good window for clear water and comfortable walks." },
      { label: "How busy", text: "The harbor is generally calm, with brief bursts of activity around local arrivals." },
      { label: "Bring", text: "Sturdy walking shoes, water, and a hat for the open stretch between waterfront and viewpoint." },
      { label: "Dock access", text: "Both landings are near the west coast; ask the crew about the easiest approach in rougher swell." },
    ],
    dockNotes: { "starfish-north": "Nearest Oranjestad’s main waterfront and the clearest southbound harbor approach.", "starfish-market": "Nearest the market-side pier and the island’s central street." },
    photographerCredit: "Tropical coast photography via Unsplash",
  },
  "lighthouse-isle": {
    intro: "Saint Kitts combines working waterfronts with a dramatic volcanic backdrop, making it a rewarding arrival for travelers who want both a practical port and room to explore. The island is known for ridgeline views, trade-wind beaches, and a lively capital-side ferry connection.",
    heroImages: [
      { src: photo("photo-1506744038136-46273834b3fb"), alt: "Green island coastline with hills in the distance" },
      { src: photo("photo-1493246507139-91e8fad9978e"), alt: "Palm-lined waterway leading toward the open sea" },
      { src: photo("photo-1473580044384-7ba9967e16a0"), alt: "Tropical coastline viewed from a high green ridge" },
    ],
    highlights: [
      { name: "Port Zante", description: "The deep-water port is the island's main meeting point for visiting boats.", image: photo("photo-1506929562872-bb421503ef21", 900), alt: "Blue water and a long tropical coastline" },
      { name: "Basseterre waterfront", description: "A practical ferry landing close to the city and its daily connections.", image: photo("photo-1493552152660-f915ab47ae9d", 900), alt: "Waterfront promenade beside calm blue water" },
      { name: "Trade-wind coast", description: "The open eastern shore gives arriving captains a clear view of the weather.", image: photo("photo-1469474968028-56623f02e42e", 900), alt: "Wind-shaped coastline under a wide sky" },
      { name: "Ridgeline view", description: "Volcanic ridges frame the island routes and make a useful navigation reference.", image: photo("photo-1454496522488-7a8e488e8606", 900), alt: "Mountain ridge above a tropical coastline" },
    ],
    goodToKnow: [
      { label: "Best time", text: "December through April brings clearer mountain views and drier paths." },
      { label: "How busy", text: "Port Zante is liveliest when larger vessels are in; the ferry terminal is calmer between runs." },
      { label: "Bring", text: "A light rain layer, walking shoes, and extra water if heading uphill from the port." },
      { label: "Dock access", text: "Port Zante is designed for larger arrivals; Basseterre is the simpler step-off for town connections." },
    ],
    dockNotes: { "light-house": "Nearest Port Zante’s deep-water berths, shops, and the clearest open-sea approach.", "light-east": "Nearest Basseterre, local ferry connections, and the capital-side waterfront." },
    photographerCredit: "Tropical coast photography via Unsplash",
  },
  "turtle-point": {
    intro: "Nevis is a calm, green island for travelers who want quiet coves, short crossings, and a clear view of the peak behind the coast. It is known for an easygoing waterfront, small beaches, and a gentle rhythm away from the busiest ferry routes.",
    heroImages: [
      { src: photo("photo-1493552152660-f915ab47ae9d"), alt: "Quiet tropical shoreline with palms and clear water" },
      { src: photo("photo-1484291470158-b8f8d986a9a3"), alt: "Small boat crossing calm water near an island" },
      { src: photo("photo-1510414842594-a61c69b5ae57"), alt: "Bright beach framed by tropical palms" },
    ],
    highlights: [
      { name: "Charlestown", description: "The ferry terminal is a calm, walkable arrival point on the island's west coast.", image: photo("photo-1544551763-46a013bb70d5", 900), alt: "Boat floating in clear water near a coast" },
      { name: "Oualie pier", description: "A smaller north-side landing keeps short water-taxi rides close to shore.", image: photo("photo-1473116763249-2faaef81ccda", 900), alt: "Pale beach and shallow blue water" },
      { name: "Nevis Peak", description: "The mountain rises behind the island and stays visible on clear crossings.", image: photo("photo-1464822759023-fed622ff2c3b", 900), alt: "Mountain landscape beneath a clear sky" },
      { name: "Quiet coves", description: "The eastern coastline has small coves where the water settles out of the trade wind.", image: photo("photo-1437622368342-7a3d73a2d3c8", 900), alt: "Shallow turquoise water over a rocky seabed" },
    ],
    goodToKnow: [
      { label: "Best time", text: "January through May is bright and comfortable for coastal walks." },
      { label: "How busy", text: "Charlestown is busiest around ferry arrivals; Oualie stays more relaxed most days." },
      { label: "Bring", text: "Swimwear, walking shoes, and a small snack for quieter stretches of coast." },
      { label: "Dock access", text: "Charlestown is a level town arrival; Oualie is smaller and best approached with lighter luggage." },
    ],
    dockNotes: { "turtle-north": "Nearest Charlestown’s walkable waterfront, shops, and the island’s main ferry connection.", "turtle-cove": "Nearest Oualie’s quiet north-side beach and shorter local water-taxi hops." },
    photographerCredit: "Tropical coast photography via Unsplash",
  },
  "driftwood-island": {
    intro: "Antigua is made for travelers who like a dependable harbor, open trade-wind passages, and plenty of coastline to explore after stepping ashore. It is known for deep-water arrivals, bright bays, and a practical waterfront that connects quickly to the island’s center.",
    heroImages: [
      { src: photo("photo-1501785888041-af3ef285b470"), alt: "Rocky island coast viewed from above" },
      { src: photo("photo-1528181304800-259b08848526"), alt: "Tropical harbor with palms and blue water" },
      { src: photo("photo-1530789253388-582c481c54b0"), alt: "Sunlit beach and distant island horizon" },
    ],
    highlights: [
      { name: "Deep Water Harbour", description: "The main port gives larger crossings a dependable approach and departure lane.", image: photo("photo-1505881502353-a1986add3762", 900), alt: "Harbor lined with palms and clear water" },
      { name: "Heritage Quay", description: "A compact waterfront landing close to the island's central shops and streets.", image: photo("photo-1500530855697-b586d89ba3ee", 900), alt: "Rocky coast and calm blue water" },
      { name: "Trade-wind passage", description: "Open water around the island rewards a clear view of wind and swell before launch.", image: photo("photo-1507525428034-b723cf961d3", 900), alt: "Open turquoise sea meeting a sandy coast" },
      { name: "Harbor evening", description: "The western waterfront catches warm late light after the day's crossings.", image: photo("photo-1500534314209-a25ddb2bd429", 900), alt: "Warm evening light over a coastal town" },
    ],
    goodToKnow: [
      { label: "Best time", text: "December through April is the clearest and most comfortable season for crossings." },
      { label: "How busy", text: "St. John’s is most active on weekday mornings and when larger vessels are in port." },
      { label: "Bring", "text": "Sun protection, a light layer for the open passage, and shoes for uneven quay surfaces." },
      { label: "Dock access", text: "Both west-side landings are close together; Deep Water Harbour is the easiest for larger bags." },
    ],
    dockNotes: { "driftwood-west": "Nearest St. John’s central streets and the island’s deepest, most dependable harbor approach.", "driftwood-east": "Nearest Heritage Quay shops and the shorter walk into the west-side waterfront." },
    photographerCredit: "Tropical coast photography via Unsplash",
  },
};