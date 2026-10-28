# Excalidraw research 05 — Collaboration

Area: collaboration (sessions, links, encryption, presence, sync, conflicts, reconnection, undo in collab, permissions).
Source pinned: excalidraw/excalidraw shallow clone, commit 14bb42e (2026-10-27), read from the session scratchpad. Nothing was executed.
Layer labels: **[package]** = `packages/excalidraw` (MIT editor, embeddable); **[hosted]** = `excalidraw-app` (what excalidraw.com runs); **[Firebase]** = Firestore/Storage used by the hosted app; **[socket server]** = `VITE_APP_WS_SERVER_URL`, not in this repo.

## Sources inspected

Repo files (all under the clone root):
- `excalidraw-app/collab/Collab.tsx` (1106 lines, read in targeted ranges), `excalidraw-app/collab/Portal.tsx`, `excalidraw-app/collab/CollabError.tsx` (listed)
- `excalidraw-app/app_constants.ts`
- `excalidraw-app/data/index.ts` (link format, export link, syncable filter), `excalidraw-app/data/firebase.ts` (save transaction, scene doc), `excalidraw-app/data/FileManager.ts` (grep), `excalidraw-app/data/fileStatusStore.ts` (grep)
- `excalidraw-app/share/ShareDialog.tsx`, `excalidraw-app/App.tsx` (offline banner, collab availability)
- `excalidraw-app/components/ExportToExcalidrawPlus.tsx`, `ExcalidrawPlusPromoBanner.tsx` (names/grep only)
- `packages/excalidraw/data/reconcile.ts` (full file)
- `packages/excalidraw/history.ts` (record, undo/redo, HistoryDelta.applyTo, applyLatestChanges call site)
- `packages/element/src/store.ts` (CaptureUpdateAction docs, HistoryDelta.applyLatestChanges), `packages/element/src/delta.ts` (satisfies* invariants, applyLatestChanges, deleted-element handling)
- `packages/excalidraw/clients.ts` (getClientColor, idle opacity), `packages/excalidraw/renderer/interactiveScene.ts` (remote cursors, remote selection colours), `packages/excalidraw/laserTrails.ts`, `packages/excalidraw/components/UserList.tsx` (grep/structure)
- `packages/excalidraw/components/App.tsx` (requestUnfollow, CaptureUpdateAction usage, collaborators/onPointerUpdate props)
- `packages/common/src/constants.ts` (IDLE/ACTIVE thresholds, UserIdleState, ENCRYPTION_KEY_BITS), `packages/excalidraw/data/encryption.ts` (grep)
- `dev-docs/docs/@excalidraw/excalidraw/faq.mdx`, `.../api/props/props.mdx` (grep), `.../api/children-components/live-collaboration-trigger.mdx`
- `public/screenshots/collaboration.png` (viewed; a marketing mock of the share dialog, not a live capture)

drawArc context (read, not modified): `context/security-model.md` (Liveblocks room access, KICK/ROLE_CHANGED, grep), `features/README.md`, `features/11-presence-and-cursors/01-requirements.md`, `features/12-sharing-and-access-control/01-requirements.md`, `features/20-public-share-links/00-overview.md`, `context/domain-model.md` (grep).

Web: not used (the repo was clear enough; no WebFetch of docs.excalidraw.com or GitHub issues).

---

## A. Session lifecycle, room link, encryption, share dialog

### A1. Start / stop a live session and the room link
- **Observed:** A session is started from the Share dialog ("Start session"). The hosted app generates a random room id (10 bytes, hex) and a 128-bit AES-GCM key, and puts both in the URL fragment as `#room=<roomId>,<roomKey>`. The regex `^#room=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$` parses it back. "Stop session" disconnects this client only; other participants keep their copy. Stopping asks a confirm ("Stopping the session will overwrite your previous, locally stored drawing") and then reloads without the hash.
- **Evidence:** `excalidraw-app/data/index.ts` lines ~131-163 (`RE_COLLAB_LINK`, `generateRoomId`, `generateCollaborationLinkData`, `getCollaborationLink`); `excalidraw-app/collab/Collab.tsx` `startCollaboration` ~492-560, `stopCollaboration` ~376-425; `packages/common/src/constants.ts:417` (`ENCRYPTION_KEY_BITS = 128`); `en.json` `collabStopOverridePrompt`, `roomDialog.desc_exitSession`.
- **drawArc mapping:** upgrade **F12** (sharing) and **F20** (public links). drawArc's model is project membership, not a bearer link, so do not copy the link-as-credential model. Keep Excalidraw's "fragment holds a secret the server never sees" only if a link ever needs to carry a key.
- **React Flow fit:** app UI / server (not React Flow).
- **Priority:** P4 (copy nothing; contrast only).
- **Risks:** Anyone holding the link joins with full edit rights (see G1). Stop-session confirm wording is a useful UX reference.
- **Layer:** [hosted] (UI and link handling); [socket server] for join semantics.

### A2. End-to-end encryption and what the server can see
- **Observed:** Every socket payload (scene update, pointer, idle, follow) is JSON, UTF-8 encoded, then AES-GCM encrypted with the room key before `emit`. The key lives only in the fragment, so the browser never sends it. Firestore stores the scene as one document: `{ sceneVersion (plain number), ciphertext, iv }`. Files go to Firebase Storage under `files/rooms/<roomId>/<fileId>`, encrypted. Visible to the server/Firebase: room id (it is in the emit args and the doc path), socket ids, timing, payload sizes, `volatile` flag, and the plain `sceneVersion`.
- **Evidence:** `excalidraw-app/collab/Portal.tsx` `_broadcastSocketData` ~84-100; `excalidraw-app/data/firebase.ts` `createFirebaseSceneDocument` ~176-188, `saveToFirebase` ~190-250; `firebase.ts` `uploadBytes` path ~154-170; `excalidraw-app/app_constants.ts` (`collabFiles: /files/rooms`); `ShareDialog`/screenshot copy: "not even our server can see what you draw."
- **drawArc mapping:** skip. drawArc already relies on Liveblocks auth with server-side role checks (security-model "Collaboration room access"). E2EE would break server-side authorization and the server-side webhook/KICK model, which drawArc needs. Record as a deliberate non-goal in any spec that mentions it.
- **React Flow fit:** server (not applicable).
- **Priority:** P4.
- **Risks:** Keeping E2EE means the server cannot run server-side validation, search, or AI over canvas content (drawArc M2 AI sidebar would need plaintext). Decision needed only if the owner wants E2EE; not recommended.
- **Layer:** [hosted] + [Firebase] + [socket server].

### A3. Share dialog UI
- **Observed:** Two states. Before a session: "Live collaboration" card with "Start session", privacy text, and an export-as-read-only-link card. Active: "Live-collaboration session is now in progress", the link with Share (native `navigator.share` when available) and Copy buttons, a "Your name" field, privacy text, and a red "Stop session" button. The screenshot matches this.
- **Evidence:** `excalidraw-app/share/ShareDialog.tsx` (`ActiveRoomDialog`, `ShareDialogPicker`, lines ~57-245); `public/screenshots/collaboration.png` (viewed).
- **drawArc mapping:** upgrade **F12** FR-001..003 (Share dialog, invite form). The layout of "link + copy + stop" is useful for the "Copy link" affordance F12 already has for editor/viewer. Visual details are a reference, not a requirement.
- **React Flow fit:** app UI.
- **Priority:** P3 (reference only; F12 already specifies the dialog).
- **Risks:** None beyond UX copy. Note the dialog's "Stop session" is a leave action, not an owner revocation.
- **Layer:** [hosted].

### A4. Export as read-only link (static snapshot, not live)
- **Observed:** A separate "Export as a read-only link" action (`exportDialog.link_details`) uploads the scene encrypted with a random key to a backend (`BACKEND_V2_POST`), then returns `…#json=<id>,<key>`. Viewers load a frozen copy; it does not stay in sync. Import uses `BACKEND_V2_GET`.
- **Evidence:** `excalidraw-app/data/index.ts` `exportToBackend` ~248-290, `importFromBackend` ~202-240; `en.json` `exportDialog.link_details`.
- **drawArc mapping:** upgrade **F20** (public share links, Future) as a model: a snapshot share is simpler than a live public room and fits "Blob snapshot" already in the product decisions. drawArc's F20 requires a live read-only view; this is an alternative to note in F20 overview.
- **React Flow fit:** server route + app UI (serialize React Flow nodes/edges to JSON; store in Vercel Blob; render read-only with `nodesDraggable={false}`).
- **Priority:** P3.
- **Risks:** Snapshot links go stale; the key-in-fragment trick is only needed if the server must not read content (drawArc does not need that).
- **Layer:** [hosted] + a hosted backend (not in repo).

---

## B. Presence

### B1. Remote cursors (colour, name, button state, scene coordinates)
- **Observed:** Each remote cursor is drawn in scene coordinates (so it moves with pan and zoom). Colour is a hue from `hash(collaborator.id || socketId) % 37 * 10`, with fixed saturation 100 and lightness 83. The username is drawn beside the cursor. When the pointer button is `down`, a ring of radius 15 is drawn. Pointer updates are throttled to 33 ms (~30 fps) and sent as volatile socket events, so they can be dropped under load. The payload carries `socketId, pointer{x,y,tool}, button, selectedElementIds, username`. No user id or avatar is sent in the open-source payload.
- **Evidence:** `packages/excalidraw/clients.ts` `getClientColor` lines 29-41, idle/out-of-bounds alpha lines ~92-110; `packages/excalidraw/renderer/interactiveScene.ts` `renderRemoteCursors` call ~2109; `excalidraw-app/app_constants.ts` `CURSOR_SYNC_TIMEOUT = 33`; `excalidraw-app/collab/Collab.tsx` `onPointerUpdate` ~943-958; `excalidraw-app/collab/Portal.tsx` `broadcastMouseLocation` ~202-222.
- **drawArc mapping:** upgrade **F11** FR-002..004 (cursor component, colour, name badge). Add: button-down indicator (click feedback) and a stable colour from the Clerk user id rather than socket id. F11 already has `presence.cursor` and `thinking`.
- **React Flow fit:** native via Liveblocks presence + `@liveblocks/react-flow` `<Cursors>` (F11 FR-002). Button-down is a custom presence field (extra interaction logic).
- **Priority:** P2.
- **Risks:** Throttle and volatility are already covered by Liveblocks presence (fine). Do not copy the socket-id colour hash: it changes on reconnect.
- **Layer:** [package] (rendering, colour) + [hosted] (throttle, payload).

### B2. Idle, away and inactive states
- **Observed:** The local client sends `IDLE_STATUS` changes: `ACTIVE` on movement, `AWAY` when the tab is hidden or the window loses focus, `IDLE` after 60 s without pointer or key activity (`IDLE_THRESHOLD = 60_000`), with a 3 s `ACTIVE_THRESHOLD` throttle on re-activation. Remote cursors of idle/away users are drawn at 30% alpha; cursors outside the visible bounds are also dimmed.
- **Evidence:** `packages/common/src/constants.ts` lines 374-377 (`IDLE_THRESHOLD`, `ACTIVE_THRESHOLD`), `UserIdleState` enum ~603-607; `excalidraw-app/collab/Collab.tsx` idle timer ~830-880, `initializeIdleDetector` ~881-884; `packages/excalidraw/clients.ts` ~98-106.
- **drawArc mapping:** upgrade **F11** (presence: add `status: 'active' | 'away' | 'idle'`, F11 FR-004 already covers visibility/blur for cursor clearing).
- **React Flow fit:** native presence field; app UI dimming (CSS on the Cursor component).
- **Priority:** P3.
- **Risks:** A 60 s idle timer per client adds presence writes; throttle it. Liveblocks presence is already per-connection, so reconnect state is less of an issue.
- **Layer:** [package] (rendering) + [hosted] (timers, broadcasts).

### B3. User list and avatar stack
- **Observed:** A compact user list shows collaborator avatars (initials or `avatarUrl`), collapsing to fit width (`DEFAULT_MAX_AVATARS = 4`); a search box appears once there are 8 or more collaborators (`SHOW_COLLABORATORS_FILTER_AT = 8`). Clicking a collaborator runs the `goToCollaborator` action (scroll to them / follow). The current user is listed first. Names come from the local username field.
- **Evidence:** `packages/excalidraw/components/UserList.tsx` lines 28-37, 104-160, 208-265 (search and avatar slots); `renderCollaborator` ~54-80.
- **drawArc mapping:** upgrade **F11** FR-005 (presence stack: max 5 + "+N" exists). Add: search above 8 people and "go to collaborator" (wires into viewport and follow, see B6).
- **React Flow fit:** app UI (React component) + viewport API (`setCenter`/`fitView` on the chosen user's cursor position).
- **Priority:** P2.
- **Risks:** Search and go-to need the user's last cursor position stored in presence; that position can be stale.
- **Layer:** [package].

### B4. Selection highlighting of other users
- **Observed:** Each pointer update includes `selectedElementIds`. Remote selections are drawn as coloured outlines on the elements, one colour per remote user, stacked when several users select the same element. Locally selected elements are excluded from the remote list.
- **Evidence:** `packages/excalidraw/renderer/interactiveScene.ts` ~1895-1915 (`selectionColors.push(...remoteClients.map(getClientColor))`); `excalidraw-app/collab/Portal.tsx` `broadcastMouseLocation` (sends `selectedElementIds`); `Collab.tsx` ~632-645 (receive).
- **drawArc mapping:** new capability inside **F11** (presence). Needs a presence field `selectedNodeIds`. It is useful for "who is editing this node" (pairs with D1 soft lock).
- **React Flow fit:** native presence + React Flow `selected` state; custom node decoration for remote selection (custom node, extra logic).
- **Priority:** P2.
- **Risks:** Bandwidth: sending selection on every cursor tick. In Liveblocks send selection on change only, not on pointer frames.
- **Layer:** [package] (rendering) + [hosted] (payload).

### B5. Laser pointer (presentation pointer)
- **Observed:** A local tool `laser` sets `pointer.tool = "laser"`; remote clients draw a fading trail from the collaborator's pointer while the button is down, coloured by `laserColor` or the cursor colour. The trail is shown only to viewers; it is not stored in the scene. Implemented with `@excalidraw/laser-pointer` (animated trail class `LaserTrails`).
- **Evidence:** `packages/excalidraw/laserTrails.ts` ~88-108 (collab trails), `packages/excalidraw/types.ts` `CollaboratorPointer` (`tool`, `laserColor`, `renderCursor`), `packages/laser-pointer/` (listed); `App.tsx` ~1031-1066 (laser tool handling).
- **drawArc mapping:** new feature, not in the current list. Low value for system-design diagrams; the closest drawArc need is a live "presenter" mode (see B6). Skip for now.
- **React Flow fit:** app UI (SVG/canvas overlay on the pane; not a node).
- **Priority:** P4.
- **Risks:** Adds pointer-tool state to presence for little gain.
- **Layer:** [package] (rendering) + [hosted] (broadcast of tool).

### B6. Follow mode (follow a user's viewport)
- **Observed:** A user chooses "follow" for another collaborator. The client sends `USER_FOLLOW_CHANGE` (FOLLOW / UNFOLLOW) through the socket. The followed client throttles (via RAF) and broadcasts its visible scene bounds to the follower channel `follow@<socketId>`. The follower calls `zoomToFitBounds(..., fit: "contain")`, so the view is fitted, not copied pixel-for-pixel. The follower's own pan or zoom calls `requestUnfollow`. Cross-follow (A follows B and B follows A) is ignored to prevent a loop. A `followedBy` list drives the "being followed" badge in the user list.
- **Evidence:** `excalidraw-app/collab/Collab.tsx` `setUserToFollow` ~696-720, `relayVisibleSceneBounds` ~1025-1040 (`follow@` room), USER_VISIBLE_SCENE_BOUNDS handler ~650-681, FOLLOW_ROOM_CHANGE ~709-715; `packages/excalidraw/components/App.tsx` `requestUnfollow` ~4874-4884 and `onUserFollow` prop; `packages/excalidraw/components/UserList.tsx` `isBeingFollowed`.
- **drawArc mapping:** new feature (propose as an extension of **F11** or a new numbered feature after F11). Useful for guided walkthroughs during reviews. Not required for M1.
- **React Flow fit:** app UI + viewport API (`useReactFlow().setViewport`/`fitBounds`); publish the viewport in presence (throttled). Liveblocks fit: presence field `viewport`; follower listens with `useOthers`.
- **Priority:** P2 (after F11; not M1-blocking).
- **Risks:** `contain` fit means the follower's view differs in aspect ratio from the leader's; document this. Cross-follow and self-follow must be prevented in the spec. Viewport in presence updates on every pan frame, so throttle it.
- **Layer:** [package] (viewport fit and UI) + [hosted] (room routing).

---

## C. Real-time sync

### C1. Incremental broadcast with periodic full resync
- **Observed:** The sender keeps `broadcastedElementVersions` (id to version). Only elements whose `version` has increased are sent (`UPDATE`). `broadcastElements` runs only when the scene version (sum of versions) increases. After each send, `queueBroadcastAllElements` (throttled to 20 s) sends the full scene with `syncAll`, so a dropped message is repaired within 20 s. A joining client gets `INIT` (full scene) from existing clients when the server sends `new-user`. Joiners wait up to 5 s (`INITIAL_SCENE_UPDATE_TIMEOUT`) for the first scene.
- **Evidence:** `excalidraw-app/collab/Portal.tsx` `broadcastScene` ~136-168, `new-user` handler ~49-54; `excalidraw-app/collab/Collab.tsx` `broadcastElements` ~968-978, `queueBroadcastAllElements` ~987-999, `syncElements` ~980-983; `excalidraw-app/app_constants.ts` (`SYNC_FULL_SCENE_INTERVAL_MS = 20000`, `INITIAL_SCENE_UPDATE_TIMEOUT = 5000`).
- **drawArc mapping:** skip the mechanism (Liveblocks storage syncs per key). Keep the idea as a reconnection check in **F05** (real-time room infrastructure): after reconnect, compare a version or hash and resend if they differ.
- **React Flow fit:** native (Liveblocks storage) with a custom reconnect check if needed.
- **Priority:** P2 (as a design note for E1/E2).
- **Risks:** Full-scene resync costs bandwidth proportional to canvas size; it is throttled for that reason.
- **Layer:** [hosted].

### C2. `reconcileElements`: remote-vs-local decision rules
- **Observed:** For each id, the remote element replaces the local one unless: (a) the local element is being text-edited, resized, or newly created (`editingTextElement`, `resizingElement`, `newElement`); (b) `local.version > remote.version`; or (c) versions are equal and `local.versionNonce <= remote.versionNonce`. Equal versions are settled by the lower `versionNonce`, which is a random integer, so the winner is deterministic but arbitrary. Elements missing on one side are kept. Result is ordered by fractional index and de-duplicated. After reconcile, versions are bumped (`bumpElementVersions`) so local changes outrank the merged result.
- **Evidence:** `packages/excalidraw/data/reconcile.ts` `shouldDiscardRemoteElement` lines 23-45, `reconcileElements` 73-118; `excalidraw-app/collab/Collab.tsx` `_reconcileElements` ~772-800; `packages/element/src/delta.ts` `satisfiesCommmonInvariants` ~1120-1131 (versions are integers, not equal).
- **drawArc mapping:** upgrade **F06** (base canvas sync) and **F08** (node editing): define drawArc's conflict policy explicitly in the spec. Liveblocks gives last-writer-wins per key, not version and nonce, so drawArc needs an equivalent rule for "local drag in progress wins".
- **React Flow fit:** native storage for records; the "local interaction wins" rule is extra interaction logic (skip applying remote position while `dragging` is true for that node).
- **Priority:** P1 (the conflict policy has to be decided before the canvas spec is approved).
- **Risks:** Decision needed (architectural): per-key LWW (Liveblocks default) vs version/nonce per element vs CRDT. Recommend per-key LWW in Liveblocks plus the local-interaction guard in C2 (a); no custom version fields.
- **Layer:** [package] (reconcile rules) + [hosted] (wiring).

### C3. Fractional-index ordering for z-order
- **Observed:** Element order is a fractional index string (`orderByFractionalIndex`). Two users inserting at the same place get distinct indices, and `syncInvalidIndices` repairs duplicates after reconcile. Dev/test validation runs throttled (once per minute) to catch bad indices.
- **Evidence:** `packages/excalidraw/data/reconcile.ts` lines 1-20, `validateIndicesThrottled` ~47-70, `syncInvalidIndices` ~111-116; `packages/fractional-indexing/` (listed).
- **drawArc mapping:** upgrade **F07** (shapes) only if z-order is multi-user editable. React Flow uses `zIndex` and array order; a fractional string per node would avoid overwrites when two users reorder.
- **React Flow fit:** custom data field on nodes; React Flow sorts by `zIndex` (native) so the app computes the string.
- **Priority:** P3.
- **Risks:** Adds a field to every node record and a repair step. Only worth it if concurrent reordering is in scope.
- **Layer:** [package].

### C4. Deleted elements: tombstones with a 24-hour window
- **Observed:** Deleted elements are kept with `isDeleted: true` and a bumped `version`. They are included in sync only while `element.updated` is within `DELETED_ELEMENT_TIMEOUT = 24h`; after that they are dropped from the sync payload and the stored scene. Delete is recorded as a delta with `isDeleted: true` (not removal), so undo can restore it.
- **Evidence:** `excalidraw-app/app_constants.ts:9` (`DELETED_ELEMENT_TIMEOUT`); `excalidraw-app/data/index.ts` `isSyncableElement` ~46-56; `packages/element/src/delta.ts` `satisfiesRemoval` ~1108-1110 and the removal path ~1183-1200 ("when `isDeleted` elements get removed", bumps `version`); `getSyncableElements` ~58-62.
- **drawArc mapping:** upgrade **F13** (persistence and recovery) and **F08** (delete semantics). A soft delete with a timestamp gives a "recently deleted" recovery window, and avoids resurrecting nodes that a stale client still has.
- **React Flow fit:** app logic on node records (a `deletedAt` field, filtered in the render selector). Liveblocks `LiveMap.delete` is a hard delete, so drawArc would need soft delete if recovery is wanted.
- **Priority:** P2.
- **Risks:** Tombstone GC after 24 h means a client offline longer than a day can resurrect a deleted element (not verified in practice). Choose the window in the spec.
- **Layer:** [package] + [hosted].

### C5. Image and file sync (encrypted blobs in Firebase Storage)
- **Observed:** An image element has a `status` (`pending` / `saved` / `error`). The uploader saves encrypted files to Firebase Storage under `files/rooms/<roomId>/<fileId>` (4 MiB limit per file, `FILE_UPLOAD_MAX_BYTES`). After upload it flips the element to `saved` (a scene update) so peers fetch the blob. Peers fetch with `loadFilesFromFirebase`, decrypt with the room key, and mark stale statuses as `error` if the fetch fails. Upload is throttled (300 ms).
- **Evidence:** `excalidraw-app/collab/Portal.tsx` `queueFileUpload` ~104-143; `excalidraw-app/collab/Collab.tsx` `loadImageFiles` ~806-820, file manager wiring ~160-185; `excalidraw-app/data/firebase.ts` `saveFilesToFirebase`/`loadFilesFromFirebase` ~144-300; `excalidraw-app/data/FileManager.ts` (`maxBytes` ~230, grep); `app_constants.ts` (`FILE_UPLOAD_TIMEOUT = 300`, `FILE_UPLOAD_MAX_BYTES`).
- **drawArc mapping:** no current feature covers image nodes. The pattern (status flag, blob store, peer fetch on status change) matches drawArc's Vercel Blob plan. Record as a new future feature if images are added (not in F00–F21 today).
- **React Flow fit:** custom node type (image) + server route for blob access; status in node data.
- **Priority:** P3.
- **Risks:** Blob access is decided by room key here; drawArc would authorize per project role instead. Do not copy the key model.
- **Layer:** [hosted] + [Firebase].

### C6. Single-document scene size limit
- **Observed:** The whole syncable scene is stored as one encrypted Firestore document. A size failure surfaces as "Couldn't save… (sizeExceeded)" based on the Firestore error text ("is longer than … bytes").
- **Evidence:** `excalidraw-app/collab/Collab.tsx` error mapping ~349-371 (`/is longer than.*?bytes/`); `en.json` `collabSaveFailed_sizeExceeded`; `excalidraw-app/data/firebase.ts` `saveToFirebase` (single doc).
- **drawArc mapping:** risk for **F05**/**F13**: confirm Liveblocks storage limits for a large canvas document and add a size budget to the spec (UNVERIFIED limit value, check Liveblocks docs via Context7 before spec).
- **React Flow fit:** server/storage concern.
- **Priority:** P2 (risk).
- **Risks:** Saves fail silently for the user unless surfaced (Excalidraw shows an error indicator).
- **Layer:** [hosted] + [Firebase].

---

## D. Concurrency and text editing

### D1. Local text editing wins over remote edits to the same element
- **Observed:** While a local user edits a text element (`editingTextElement`), remote updates to that element are discarded. The local text is committed on exit and then broadcast. Remote text edits made during that window are overwritten, not merged.
- **Evidence:** `packages/excalidraw/data/reconcile.ts` `shouldDiscardRemoteElement` ~27-31 (`local.id === localAppState.editingTextElement?.id`); `reconcileElements` ~80-93.
- **drawArc mapping:** upgrade **F08** (node editing): label editing is a soft lock. Add a presence field `editingNodeId` and show "X is editing" on the node (F11 extension). Make the conflict explicit in the spec.
- **React Flow fit:** custom node (label input) + presence (extra interaction logic).
- **Priority:** P1 (node label editing is core).
- **Risks:** A soft lock is advisory: two users can still edit the same label; last commit wins. Say so in acceptance criteria.
- **Layer:** [package].

### D2. Local resize and creation are protected; drag is not explicitly protected
- **Observed:** The guard also covers `resizingElement` and `newElement`, so an in-progress resize or new-element creation is not overwritten by remote updates. The explicit guard list does not include plain dragging of a selected element; a remote update to a dragged element during the gesture is applied by the normal version rule (it wins if its version is higher), so the drag can be interrupted. Not traced further.
- **Evidence:** `packages/excalidraw/data/reconcile.ts` lines 27-31 (`resizingElement`, `newElement`); no `draggingElement` in the guard (checked by grep of reconcile.ts).
- **drawArc mapping:** upgrade **F06**/**F08**: specify the drag rule explicitly (React Flow's `dragging` flag). Do not assume Excalidraw's drag protection; it is only partial.
- **React Flow fit:** native `onNodeDrag` / `dragging` flag plus app logic to skip remote position updates for that node.
- **Priority:** P1.
- **Risks:** Dragging a node that a remote user is also moving produces a jump on release. Acceptable LWW behaviour; define it.
- **Layer:** [package].

### D3. Element-level, not property-level, conflict resolution
- **Observed:** The reconcile step replaces the whole element object (remote wins, or local wins by version rule). Two users changing different properties of the same element (e.g. colour and position) lose one of the changes. Undo does apply per-property latest values (see F2), but sync does not.
- **Evidence:** `packages/excalidraw/data/reconcile.ts` `reconcileElements` (pushes `remoteElement` object whole, lines ~84-101).
- **drawArc mapping:** Liveblocks `LiveObject` per-field LWW is finer than Excalidraw's element-level rule. Keep drawArc's per-field storage design (F06) and note this as an advantage over the editor's model.
- **React Flow fit:** native (`LiveObject` for node data).
- **Priority:** P2.
- **Risks:** Storing whole node objects in one `LiveMap` value would reproduce Excalidraw's element-level loss. Use per-field `LiveObject` or split fields.
- **Layer:** [package] (model) + drawArc storage design.

---

## E. Reconnection, offline and failure UX

### E1. Socket reconnect and "connection lost" UX
- **Observed:** The socket is created with `transports: ["websocket", "polling"]`. The app registers no `disconnect` or `reconnect` handler. The only offline UI is a banner when `navigator.onLine` is false while collaborating ("No internet connection available. Your changes will not be saved!"); the share action is hidden when offline. There is no visible "reconnecting" state. Save failures show an error indicator.
- **Evidence:** `excalidraw-app/collab/Collab.tsx` `socketIOClient(...)` ~529-550; `grep` for `disconnect|reconnect` in `excalidraw-app` returns none (outside tests); `Collab.tsx` `onOfflineStatusChange` ~269-281 (debounced); `excalidraw-app/App.tsx` ~824-830 (`isCollabAvailable`) and ~1073-1076 (offline banner); `en.json` `collabOfflineWarning`.
- **drawArc mapping:** upgrade **F05** (realtime infra) and **F13**: show a connection-status indicator (Liveblocks `useStatus` gives connecting/connected/reconnecting) and an offline banner. Liveblocks handles reconnection natively, so drawArc gets more than Excalidraw here.
- **React Flow fit:** native (Liveblocks status) + app UI.
- **Priority:** P1 (the owner requires a clear connection-lost UX per F05; it is a daily-use concern).
- **Risks:** Reconnect and rejoin semantics of the socket server are UNVERIFIED (server code not in repo).
- **Layer:** [hosted] + [socket server].

### E2. Local edits made while disconnected may not be re-sent
- **Observed:** `broadcastScene` records each element's version in `broadcastedElementVersions` before it calls `_broadcastSocketData`. That function returns early when `isOpen()` is false, so the send is dropped without an error. Because the version is already recorded, the incremental path will not resend that element. Recovery therefore depends on the next full-scene sync (`syncAll` after a `new-user` event, or `queueBroadcastAllElements` which only runs after a successful broadcast). Local data is still saved to browser storage and Firebase on other paths (`queueSaveToFirebase` runs even when offline in some branches — not fully traced).
- **Evidence:** `excalidraw-app/collab/Portal.tsx` `broadcastScene` ~136-168 (version recorded before send), `_broadcastSocketData` ~84-100 (`if (this.isOpen())`), `isOpen` ~76-82; `Collab.tsx` `broadcastElements` ~968-978, `syncElements` ~980-983.
- **drawArc mapping:** upgrade **F13** (persistence and recovery) with an explicit requirement: offline edits are queued and replayed on reconnect. Liveblocks already queues local ops on the client, so drawArc should verify this with a test (AC), not assume it.
- **React Flow fit:** native (Liveblocks) if verified; custom otherwise.
- **Priority:** P1 (the offline-edit guarantee is an F13 acceptance criterion candidate).
- **Risks:** Excalidraw's own behaviour here looks lossy (a bug class, not verified in a live run). Do not copy the version-first bookkeeping.
- **Layer:** [hosted].

---

## F. Undo and redo in collaboration

### F1. Remote changes are not undoable and do not clear redo
- **Observed:** Remote updates are applied with `CaptureUpdateAction.NEVER`, so they never enter the local undo stack. Local undo entries are inverse deltas recorded only for local changes. A remote change does not clear the redo stack; only a local non-empty element change does (`record` empties redo only when the element part of the delta is non-empty). Each user therefore undoes only their own work.
- **Evidence:** `packages/element/src/store.ts` `CaptureUpdateAction` doc lines 38-70 ("Never undoable… remote updates"); `excalidraw-app/collab/Collab.tsx` `handleRemoteSceneUpdate` ~821-829 (`captureUpdate: NEVER`); `packages/excalidraw/history.ts` `record` ~122-145 (redo cleared only for non-empty element changes).
- **drawArc mapping:** confirm in **F10** (canvas ergonomics) / F08 that undo is per-user and remote-safe. Liveblocks `useUndo` is also per-client, so the same behaviour is the default; add it as an acceptance criterion rather than a new feature.
- **React Flow fit:** native (Liveblocks `useUndo`/`useRedo`); if drawArc keeps local undo, use React Flow's own store with remote updates excluded.
- **Priority:** P1 (confirm in spec).
- **Risks:** None found; it is a known-good pattern.
- **Layer:** [package].

### F2. Undo applies "latest" values per property (no clobbering remote edits)
- **Observed:** On undo or redo, the stored inverse delta is re-based onto the current elements with `applyLatestChanges`: for keys the local action did not touch, the current (remote) values are kept; for touched keys, the old value is restored. `version` and `versionNonce` are excluded from the inverse and then bumped, so an undo counts as a new collaborative change.
- **Evidence:** `packages/excalidraw/history.ts` `HistoryDelta.applyTo` ~22-50 (`excludedProperties: version, versionNonce`), `HistoryDelta.applyLatestChanges` ~65-85 and call site ~215-220; `packages/element/src/store.ts` `StoreDelta.applyLatestChanges` ~605-630; `packages/element/src/delta.ts` `ElementsDelta.applyLatestChanges` ~1309-1395.
- **drawArc mapping:** note in **F10**/**F08** acceptance: undo restores only the properties the user changed. Liveblocks per-field storage gives a similar effect.
- **React Flow fit:** native if undo records per-field patches; custom otherwise.
- **Priority:** P2.
- **Risks:** Undo of an element deleted by a remote user falls back to the local snapshot (comment in `HistoryDelta.applyTo` says "missing (force deleted) elements"). Behaviour not run; mark UNVERIFIED.
- **Layer:** [package].

### F3. Undo after remote delete (edge case)
- **Observed:** `HistoryDelta.applyTo` falls back to the local snapshot when an element referenced by the delta is missing from the scene. Whether the user sees a restored element or a no-op is not verified.
- **Evidence:** `packages/excalidraw/history.ts` `applyTo` comment ~30-40.
- **drawArc mapping:** add an acceptance test in **F10** (undo after remote delete). Low priority.
- **React Flow fit:** app logic.
- **Priority:** P3.
- **Risks:** UNVERIFIED runtime behaviour.
- **Layer:** [package].

---

## G. Permissions, ownership, revocation, paid features

### G1. No roles in open-source collaboration
- **Observed:** Anyone with the room link has full edit rights. There is no owner, editor, or viewer role in collab, socket or Firebase code. The only view-only control is `viewModeEnabled`, which is an editor prop or local state for the whole canvas, not per user; the host can set it for an embed. No per-user read-only exists in the hosted app.
- **Evidence:** grep for `owner|permission|role` over `excalidraw-app/collab`, `share`, `data` returns no access-control hits; `packages/excalidraw/types.ts` (`viewModeEnabled`); `dev-docs/docs/@excalidraw/excalidraw/api/props/props.mdx` line 205 (prop controls view mode for the whole app); `faq.mdx` (collaboration is host-specific).
- **drawArc mapping:** skip (nothing to copy). This confirms that **F12** role checks must be designed in drawArc, server-side, as already specified (`getProjectRole`, Liveblocks `*:read` vs `*:write`).
- **React Flow fit:** server (drawArc's Liveblocks auth route).
- **Priority:** P4 (copy nothing) — but a useful contrast for F12 review.
- **Risks:** None for drawArc. Do not treat the excalidraw model as a reference for permissions.
- **Layer:** [hosted].

### G2. No revocation or kick
- **Observed:** No removal of a participant, no role change, and no token invalidation exist in the open-source code. "Stop session" only disconnects the local client. Anyone who has the link can rejoin until the room is abandoned.
- **Evidence:** grep for `kick|remove|ban|revoke` in `excalidraw-app/collab` returns none; `en.json` `roomDialog.desc_exitSession` ("Note that this won't affect other people").
- **drawArc mapping:** confirms the need for drawArc's KICK / ROLE_CHANGED design (security-model "Collaboration room access", F12 D-032). No upgrade needed; keep F12 as specified.
- **React Flow fit:** server (Liveblocks auth + broadcast events).
- **Priority:** P1 (existing F12 requirement; contrast only).
- **Risks:** Liveblocks does not disconnect a live user on access change (security-model says UNVERIFIED): the planned KICK broadcast addresses this. Verify in F12 build.
- **Layer:** [hosted].

### G3. Excalidraw+ (hosted, paid) features
- **Observed:** The hosted app links to Excalidraw+ in several places: an export-to-Plus flow (`ExportToExcalidrawPlus.tsx`, uploads files up to the same 4 MiB limit) and promo banners on the welcome screen, footer and main menu. Pricing and plan limits are not in the repo.
- **Evidence:** `excalidraw-app/components/ExportToExcalidrawPlus.tsx` (imports `FILE_UPLOAD_MAX_BYTES`, line 27); `ExcalidrawPlusPromoBanner.tsx`, `AppFooter.tsx`, `AppWelcomeScreen.tsx`, `AppMainMenu.tsx` (names only).
- **drawArc mapping:** skip. Paid hosted product; not a feature to copy.
- **React Flow fit:** not applicable.
- **Priority:** P4.
- **Risks:** Pricing and plan limits UNVERIFIED (not in repo; not checked on the live site).
- **Layer:** [hosted] (paid).

### G4. Editor package has no built-in collaboration (integration surface)
- **Observed:** The editor package is collaboration-agnostic. The host supplies transport and sync. It exposes `isCollaborating`, `onPointerUpdate`, `updateScene({ collaborators })` (a Map keyed by socket or user id), `captureUpdate` (`IMMEDIATELY` / `NEVER` / `EVENTUALLY`), `onUserFollow`/`userToFollow`, and a `LiveCollaborationTrigger` button. The FAQ says so explicitly.
- **Evidence:** `dev-docs/docs/@excalidraw/excalidraw/faq.mdx` line 5 ("doesn't come with collaboration built in"); `dev-docs/docs/@excalidraw/excalidraw/api/props/props.mdx` (`isCollaborating` line 52, `onPointerUpdate` line 72, `viewModeEnabled` line 205); `live-collaboration-trigger.mdx`; `packages/excalidraw/components/App.tsx` (`captureUpdate` doc ~4980-4985).
- **drawArc mapping:** skip (drawArc uses Liveblocks, not this transport). Useful: the `captureUpdate` contract is the clean way to separate remote and local undo (F1), and the `collaborators` Map shape is a good reference for F11 presence.
- **React Flow fit:** native; the same separation exists in React Flow via `applyNodeChanges` with `type: 'position'` vs `'select'`.
- **Priority:** P4 (reference).
- **Risks:** None.
- **Layer:** [package].

---

## Could not verify

1. **Socket server behaviour** (`VITE_APP_WS_SERVER_URL`): not in this repo. Unverified: reconnect semantics, whether a reconnecting client receives `new-user` / `first-in-room`, room cleanup, rate limits, message size limits.
2. **socket.io-client default reconnection** settings (none overridden in `Collab.tsx`): assumed library defaults, not checked against the installed version.
3. **Live app behaviour**: no live session was run; cursor colours, idle timing, follow `contain` fit, and offline edit loss (E2) are from code reading only.
4. **Offline edit loss (E2)**: traced in code; not reproduced. Also not checked whether `queueSaveToFirebase` covers the offline path.
5. **Tombstone GC (C4)**: a client offline for more than 24 h may resurrect deleted elements; not reproduced.
6. **Undo after remote delete (F3)**: fallback path noted, not run.
7. **Excalidraw+ pricing and plan limits**: not in repo; not fetched.
8. **Images**: only `public/screenshots/collaboration.png` was relevant; it is a marketing mock, not a live capture.
9. **Liveblocks limits** (C6 document size, reconnect queueing in E2): must be checked in Liveblocks docs (Context7) before the F05/F13 spec, not in this research.
10. **Excalidraw issue tracker** (known collab bugs): not searched; no WebFetch was used.

## Top 10 recommendations for drawArc

1. **E1 (P1)**: Add a connection-status indicator and offline banner to F05/F13 (Liveblocks `useStatus`); excalidraw's version is minimal.
2. **E2 (P1)**: Write an F13 acceptance test that edits made while disconnected are queued and replayed on reconnect. Do not assume it.
3. **C2 + D2 (P1)**: Decide and record the node conflict policy: per-field LWW (Liveblocks), plus an explicit "local drag wins while dragging" guard for the active node (Excalidraw's own guard covers resize and creation, not drag; see D2). Record it in `context/decision-log.md` when approved.
4. **D1 (P1)**: Soft lock for node label editing via presence (`editingNodeId`), with an "X is editing" badge (F08 + F11).
5. **F1 (P1)**: Make per-user undo and "remote changes never undoable, do not clear redo" an explicit F08/F10 acceptance criterion (matches Liveblocks `useUndo`).
6. **G2 (P1)**: Keep the F12 KICK / ROLE_CHANGED design; the editor shows the same gap (no revocation). Verify in F12 test plan.
7. **B2 + B3 (P2)**: Extend F11 presence with `status` (active / away / idle) and `selectedNodeIds`; add the user-list search at 8+ collaborators and "go to collaborator".
8. **B6 (P2)**: Propose follow mode as a new numbered feature after F11 (presenter walkthroughs). Include cross-follow prevention and the `contain`-fit behaviour in the spec.
9. **C4 (P2)**: Soft delete with a recovery window (F13) instead of hard delete, with an explicitly chosen GC window.
10. **C6 (P2) and F20 (P3)**: Add a size budget to the canvas document (check Liveblocks limits first); consider a snapshot-style read-only share (encrypted-free, Blob-backed) as the first F20 option instead of a live public room.

Not recommended for drawArc: E2EE (A2, conflicts with server-side authorization and AI), bearer room links (A1), laser pointer (B5), and copying the editor's permission model (G1 contrast only).
