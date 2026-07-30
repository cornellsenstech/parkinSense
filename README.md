# ParkinSense

ParkinSense is the companion app for a wearable biosensor that measures levodopa plasma concentration in real time. Levodopa is the main treatment for Parkinson's disease, and its effect rises and falls with the amount of drug in the blood — too little and symptoms return ("off"), too much and dyskinesia becomes a risk. Today that curve is invisible: patients and clinicians infer it from symptom diaries written hours after the fact.

The app is built for two people at once. A person living with Parkinson's sees their current level, records how they actually feel, watches the shape of their day, and gets an estimate of when their next off period is likely to start. Their clinician sees the whole roster, opens any patient's history with concentration and reported symptoms on a single chart, keeps notes, and answers messages. Both sides read the same numbers from the same code, so the two portals can never disagree about the data.

It is an Expo app (SDK 54, React Native 0.81, React 19, NativeWind) and runs on the web, iOS and Android from one codebase.

## Quick start

You need Node.js installed. Then:

```bash
npm install
npx expo start
```

Press `w` to open the web app, or scan the QR code with Expo Go on a phone. The web build serves at <http://localhost:8081>.

## The two portals

Launching the app shows a role picker: patient or doctor. Patients then sign in; the doctor portal opens straight away. Either portal can be left again from the **Switch portal** button in its Profile tab.

### Patient

- **Home** — a greeting, a slim device line showing whether the sensor is connected and its battery, and then the current level in ng/mL with an in-range or out-of-range badge. Below that, a symptom check-in for stiffness and tremor on a 0–4 scale; saving it confirms the time it was written and leaves a 20-second **Undo** button, because a mis-tap should not become a permanent record. There is a live trend of the day so far, always divided into 24 segments from midnight to now so the shape of the day looks the same at 9am as it does at 9pm, with the therapeutic window shaded behind the line. Last comes the off-period forecast (see below), with an (i) button explaining where the number came from and a plain warning never to change medication on the strength of it.
- **History** — two days of hourly readings. A toggle switches between concentration and symptoms. The concentration chart shades the therapeutic window, colours each reading by whether it was low, in range or high, scrolls sideways through the full history, and lets you tap any dot to read that exact value. The symptom view plots stiffness and tremor together on the shared 0–4 scale so you can see whether they move together. Both views carry summary figures — average level, percentage of time in range, average and worst symptom scores — and a matching list underneath.
- **Community** — Parkinson's exercise classes, support groups, therapy programmes and care homes near you, on a map and as a list. You can search a different town, filter by category, show only saved items or only step-free venues, and search by name. Each card gives the distance, the day and time, and access facts (no steps, can sit down, bring a partner, join online). Programmes that run entirely online are always listed, since distance is meaningless for them and leaving home is not realistic every day. Where a class start time falls at an hour when your own readings are usually low or usually above range, the card says so — quietly, and only when there is something to flag.
- **Help** — messaging with the care team. A prominent notice at the top says to call 911 in an emergency and that this page is not monitored around the clock; there is deliberately no emergency button, because a message that may not be read for hours must never look like summoned help. You can write your own message and mark it urgent yourself, or send one of four common messages in a single tap. Replies from the doctor appear in the same thread, and while a conversation is open new messages are added to it rather than starting a second one. Once the clinician closes a thread it becomes a read-only record.
- **Profile** — photo, age, weight, height and email address, all editable and saved on the device. Weight and age are there because they affect absorption and clearance, not as decoration. This tab also holds the accessibility settings.

### Doctor

- **Patients** — the roster, each row showing the latest level, the last update time, current symptom scores, and a triage badge: In range, Needs attention, or Sensor offline. The header counts how many need attention.
- **Patient detail** — opened by tapping a row. Summary figures (latest, average, percentage in range, number of readings), device state, current level, and then concentration and reported symptoms drawn on one chart with two y axes: ng/mL on the left, the 0–4 symptom score on the right, symptoms dashed so three series stay distinguishable. That pairing is the clinical point of the device and cannot be read from two charts stacked on top of each other. Below it, a generated observation built from that patient's own numbers — their actual highest and lowest readings and when they happened — kept visually separate from the free-text clinician note, which is editable and saved per patient.
- **Messages** — the shared inbox. Counts for urgent, open and total; an Open/All filter and a per-patient filter that only lists patients who have actually written in; and a badge on the tab itself showing how many conversations are waiting on a reply. Ordering is the triage: waiting first, urgent before the rest, then most recently active. The doctor replies inline and closes the thread when the episode is finished.

### Both portals side by side

On the web, `?role=patient` and `?role=doctor` preselect a portal, so you can open one in each browser tab and watch messages pass between them:

```
http://localhost:8081/?role=patient
http://localhost:8081/?role=doctor
```

### Demo logins

Usernames `robert`, `margaret`, `frank`, `helen`. The password for all four is `parkinsense`. Each has a differently scaled concentration curve, so they are not four copies of the same patient: Margaret runs low, Helen runs high, Frank's sensor is offline.

## The therapeutic window

Throughout the app, 500–1500 ng/mL is treated as the therapeutic window, and every chart shades it. Two sources put that range in context:

- [Plasma levodopa concentration and the "on-off" phenomenon](https://pmc.ncbi.nlm.nih.gov/articles/PMC1401168/) — optimum clinical response falls at roughly 300–1600 ng/mL.
- [Levodopa pharmacokinetics and motor fluctuations](https://pmc.ncbi.nlm.nih.gov/articles/PMC9686322/) — effective concentrations are around 400–1200 ng/mL, and as little as 200–400 ng/mL separates the "off" state from the "on" state.

That last figure is why continuous measurement is worth doing at all. The margin between a patient who can move and one who cannot is a couple of hundred nanograms per millilitre — far too narrow to manage by asking someone how their week went.

### The off-period forecast

Levodopa clears roughly exponentially once a dose has peaked, so the natural log of the level falls in a straight line against time. `data/forecast.js` fits that line by least squares over a 90-minute window and solves it for the moment the curve crosses 500 ng/mL.

The window matters. Two consecutive readings a minute apart differ mostly by noise, and dividing a noisy difference by a small interval amplifies it, so a two-point estimate would swing wildly between readings. Fitting over 90 minutes averages the noise out and produces an r² that says honestly when the data is too scattered to speak. The forecast refuses to answer in several cases rather than guessing: when the level is already below the floor (that is a current fact, not a prediction), when the level is rising, when the fit quality is below 0.6, and beyond about four hours, by which point the next dose will have landed. When it does answer it gives a range rather than a point estimate, widening as confidence drops, and the wording never suggests changing a dose.

## Accessibility

The intended users are older adults with a movement disorder, many of whom also have vision changes. Accessibility is therefore a design constraint on the whole patient portal rather than a settings page bolted on at the end.

- **Read aloud is on by default.** Cards on the patient side carry a speaker button that reads that section aloud — and while it is playing, the same button becomes a stop square, so one control both starts and ends the audio. It is on for everyone from first launch because most of these patients benefit from it and should not have to discover it; switching it off in Profile is remembered. Speech goes through `expo-speech`, which uses the platform's own voices on device and the browser's built-in speech synthesis on the web. There is no API key, no network request and no cloud service, which also means no health data ever leaves the machine. A small text-expansion pass first turns things like `ng/mL` into "nanograms per milliliter" and `3/4` into "3 out of 4", so the numbers are actually intelligible when spoken.
- **A text-size setting** with three steps (Normal, Large, Largest) scaling type up to 1.3×, applied through a context rather than hardcoded per screen, and remembered between sessions alongside the read-aloud choice.
- **Status is never carried by colour alone.** Every state badge pairs an icon with a word — a green tick and "In range", an amber alert and "Needs attention", a grey dash and "Sensor offline". Filters and toggles show a checkbox glyph as well as a fill change. The palette is deliberately high contrast; "elegant" is not allowed to mean low contrast here.
- **Tremor-safe touch targets.** Controls that matter most are 64px tall, and nothing tappable is smaller than 44px. Buttons are labelled with words rather than left as bare icons, since a lone star or speaker glyph is easy to misread.
- **Discrete steppers instead of sliders.** Symptom severity is entered by tapping one of five large buttons, not by dragging a slider. A slider demands precise, sustained dragging — exactly the motion a tremor takes away. Similarly, the destructive-mistake path is covered: saving a check-in offers a 20-second undo, a generous window because a moment of hesitation should not cost you the chance to correct a mis-tap.

## Community data

The Community tab combines two different kinds of data, and the split is deliberate.

**Places are fetched live, and keylessly, from OpenStreetMap.** `data/places.js` queries the [Overpass API](https://overpass-api.de/) for care homes, assisted living, social facilities, community centres and sports centres within about five miles of wherever the patient is looking, and uses [Nominatim](https://nominatim.openstreetmap.org/) to turn typed text like "Ithaca NY" into coordinates. Neither service needs an account or an API key. The map itself is Leaflet with OpenStreetMap tiles, via `react-leaflet` on the web; Leaflet is a DOM library, so on iOS and Android `EventMap.native.js` shows the list without a map, and the props are already the shape `react-native-maps` would need. Only a place name or coarse coordinates are ever sent to these services — never any health data.

**Class schedules are curated, in `data/events.js`.** No free API publishes them. Overpass will tell you that a community centre exists at a given address; it will not tell you that Dance for PD runs there on Tuesdays at 10am. So the programmes are seeded by hand across ten metro areas, drawn from the evidence-backed types (boxing, dance, tai chi, cycling, aquatic exercise, LSVT BIG/LOUD, singing for speech) plus support and caregiver groups and a set of online-only programmes. The venue names are invented, so nothing in the app implies a real class at a real address.

The footer of the tab says which is which, and if Overpass is slow or unavailable the list falls back to the curated programmes with a message explaining that nearby places could not be loaded.

## Limitations

These are worth stating plainly rather than discovering later.

- **The login is not security.** Usernames and passwords sit in plaintext in `data/credentials.json` and are compared client-side. Role selection is UI state only — nothing on any server enforces who may see what, because there is no server. This is demo-grade sign-in whose only job is to pick which patient's data to show.
- **All patient data is invented.** The four patients, their readings, their symptoms and their curves are fabricated, and their email addresses are on `example.com`. Nothing here came from a real person.
- **The 500–1500 ng/mL window is global, not personal.** Every patient in the app is judged against the same range. Real therapeutic windows are individual, and they narrow as the disease progresses — the point at which one person goes off is not the point at which another does. A production system would need a per-patient window set by their clinician.
- **The forecast is validated against synthetic data.** The readings it fits come from a generated curve, so a backtest over them shows that the mathematics is implemented correctly and that the refusal cases behave. It does not show that the forecast predicts real patients. That claim would require real sensor data and a proper prospective evaluation.
- **Overpass is a free, rate-limited service.** It can be slow or refuse a request, and requests time out after 12 seconds. When that happens the Community tab shows curated programmes only, with an explanation rather than an empty list.
- **Saved data is local to the device.** Profiles, symptom check-ins, saved events, clinician notes and messages all go through `AsyncStorage` — `localStorage` on the web, the platform store on device. Nothing syncs, and clearing browser data clears it all. It is also why the two portals can talk to each other in one browser: they are reading the same local store, and polling it every three seconds.

## Project structure

```
App.js                      role/session shell, both tab navigators, ?role= handling
screens/                    Home, History, Community, Help, Profile, RoleSelect, PatientLogin
screens/doctor/             DoctorHome (roster), PatientDetail, Messages
components/                 charts (LevelLineChart, SymptomChart, CombinedChart, TodayTrend),
                            EventMap (.web/.native), Card, StatusBadge, SensorStatusCard,
                            SymptomStepper, SpeakButton, shared layout and theme
data/                       history and the therapeutic window, forecast maths, curated events,
                            live OpenStreetMap lookups, messages, notes, profiles, symptom log,
                            saved events, event-timing fit, speech text expansion, credentials
context/                    AccessibilityContext (read aloud, text size), RoleContext (portal, user)
```

Chart components are shared between the two portals on purpose. The doctor renders the same code as the patient, just at normal density instead of the patient portal's enlarged type, so there is no second implementation to drift out of step.
