'use client';

import { useState } from 'react';

import { ImportTemplateControl } from '@/components/editor/import-template-dialog';
import { useOptionalProjectDialogs } from '@/components/editor/project-dialogs-context';
import { ProjectRoom } from '@/components/editor/project-room';
import { RoomLoading } from '@/components/editor/room-fallbacks';
import type { EditorIslandProps } from '@/lib/editor/island-props';

import { CanvasPersistence } from './canvas-persistence';
import { CanvasReplacedToast } from './canvas-replaced-toast';
import { FlowCanvas } from './flow-canvas';
import { LiveCursors } from './live-cursors';
import { NodeColorToolbar } from './node-color-toolbar';
import { PresenceOthers } from './presence-stack';
import { SelectionToolbar } from './selection-toolbar';

/**
 * The workspace's canvas island (F04 slot contract D-028, FR-015): the project's Liveblocks room around the
 * collaborative canvas. The wrapper renders on the server (data attributes for tests) while the room connects.
 */
export function CanvasEditor({ projectId, role }: EditorIslandProps) {
  // Deleting the open project (F04 dialog) kicks every bound user including the owner (F03 FR-011), and the
  // KICK handler force-reloads onto AccessDenied before the dialog can navigate to /editor. The deleting tab
  // therefore leaves the room as soon as its delete is submitted and stays out until it navigates; a failed
  // delete (the dialog stays open with its error) rejoins. Other tabs and members still receive the KICK.
  const dialogs = useOptionalProjectDialogs();
  const deletingThis = Boolean(dialogs?.pending && dialogs.dialog?.kind === 'delete' && dialogs.dialog.project.id === projectId);
  const deleteFailed = Boolean(dialogs && !dialogs.pending && dialogs.dialog !== null);
  const [leftRoom, setLeftRoom] = useState(false);
  if (deletingThis && !leftRoom) setLeftRoom(true);
  else if (leftRoom && deleteFailed) setLeftRoom(false);

  return (
    <div data-slot="canvas" data-project-id={projectId} data-role={role} className="h-full w-full">
      {leftRoom ? (
        <RoomLoading />
      ) : (
        <ProjectRoom projectId={projectId} role={role}>
          <FlowCanvas role={role}>
            <LiveCursors />
            <NodeColorToolbar />
            <SelectionToolbar />
            <CanvasPersistence projectId={projectId} />
            {/* F14: the navbar Import button (portalled into the import slot) and the others' replace toast. */}
            <ImportTemplateControl />
            <CanvasReplacedToast />
          </FlowCanvas>
          <PresenceOthers />
        </ProjectRoom>
      )}
    </div>
  );
}
