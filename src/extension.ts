import * as vscode from 'vscode';
import * as path from 'path';
import { registerFileTracking } from './fileWatcher';
import { ProjectManager } from './projectManager';
import { DockTreeProvider, DockTreeNode, isProjectNode } from './treeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const projectManager = new ProjectManager();
  const treeProvider = new DockTreeProvider(projectManager);

  const treeView = vscode.window.createTreeView<DockTreeNode>('dock.projectsView', {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });

  treeProvider.bindTreeView(treeView);

  const clickState = new Map<string, number>();
  const doubleClickThresholdMs = 350;

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand('dock.registerExistingFolder', async () => {
      await projectManager.registerProject();
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('dock.registerResource', async (uri?: vscode.Uri) => {
      await projectManager.registerProject(uri);
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('dock.createNewProject', async () => {
      await projectManager.createNewProject();
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('dock.searchProject', async () => {
      await projectManager.searchProjects(async (project) => {
        await openProject(project.path, await projectManager.resolveOpenMode());
      });
    }),
    vscode.commands.registerCommand('dock.handleProjectClick', async (node: DockTreeNode) => {
      if (!isProjectNode(node)) {
        return;
      }

      const now = Date.now();
      const previousClick = clickState.get(node.project.path) ?? 0;
      clickState.set(node.project.path, now);

      if (now - previousClick <= doubleClickThresholdMs) {
        clickState.delete(node.project.path);
        const mode = await projectManager.resolveOpenMode();
        await openProject(node.project.path, mode);
        return;
      }

      await treeProvider.expandProject(node);
    }),
    vscode.commands.registerCommand('dock.openProject', async (projectPath: string) => {
      await openProject(projectPath, await projectManager.resolveOpenMode());
    })
  );

  registerFileTracking(context, projectManager, treeProvider);
}

export function deactivate(): void {
  // no-op
}

const openProject = async (
  projectPath: string,
  mode: 'newWindow' | 'currentWindow' | 'addToWorkspace'
): Promise<void> => {
  const uri = vscode.Uri.file(projectPath);

  switch (mode) {
    case 'newWindow':
      await vscode.commands.executeCommand('vscode.openFolder', uri, true);
      break;
    case 'currentWindow':
      await vscode.commands.executeCommand('vscode.openFolder', uri, false);
      break;
    case 'addToWorkspace': {
      const current = vscode.workspace.workspaceFolders?.length ?? 0;
      vscode.workspace.updateWorkspaceFolders(current, 0, { uri, name: path.basename(uri.fsPath) || 'Dock Project' });
      break;
    }
  }
};
