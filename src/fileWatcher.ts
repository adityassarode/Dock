import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { DockTreeProvider } from './treeProvider';

export const registerFileTracking = (
  context: vscode.ExtensionContext,
  projectManager: ProjectManager,
  treeProvider: DockTreeProvider
): void => {
  const updateFromUris = async (uris: readonly vscode.Uri[]): Promise<void> => {
    let changed = false;
    for (const uri of uris) {
      const updated = await projectManager.updateProjectMetadataForUri(uri);
      changed = changed || updated;
    }

    if (changed) {
      treeProvider.refresh();
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(async (event) => {
      await updateFromUris(event.files);
      
    }),
    vscode.workspace.onDidDeleteFiles(async (event) => {
      await updateFromUris(event.files);
      
    }),
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      await updateFromUris([document.uri]);
      
    })
  );
};
