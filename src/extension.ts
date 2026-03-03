import * as vscode from "vscode";
import * as path from "path";
import { registerFileTracking } from "./fileWatcher";
import { ProjectManager } from "./projectManager";
import { DockTreeProvider, DockTreeNode, isProjectNode } from "./treeProvider";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Dock Activated");
  vscode.window.showInformationMessage("Dock Activated");
  console.log("Dock extension activated");
  const projectManager = new ProjectManager(context);
  const treeProvider = new DockTreeProvider(projectManager);

  const treeView = vscode.window.createTreeView<DockTreeNode>(
    "dock.projectsView",
    {
      treeDataProvider: treeProvider,
      showCollapseAll: false,
    },
  );

  treeProvider.bindTreeView(treeView);

  const clickState = new Map<string, number>();
  const doubleClickThresholdMs = 350;

  context.subscriptions.push(
    treeView,

    vscode.commands.registerCommand("dock.registerExistingFolder", async () => {
      await projectManager.registerProject();
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.copyPath", async (node) => {
      if (!node?.resourcePath) return;

      await vscode.env.clipboard.writeText(node.resourcePath);
      vscode.window.showInformationMessage("Path copied to clipboard");
    }),
    vscode.commands.registerCommand("dock.copyPath", async (node) => {
      if (!node?.resourcePath) return;

      await vscode.env.clipboard.writeText(node.resourcePath);
      vscode.window.showInformationMessage("Path copied to clipboard");
    }),
    
    vscode.commands.registerCommand("dock.openProject", async (node) => {
      if (!node?.resourcePath) return;

      const mode = await projectManager.resolveOpenMode();
      await openProject(node.resourcePath, mode);
    }),
    vscode.commands.registerCommand("dock.openFolder", async (node) => {
      if (!node?.resourcePath) return;

      const mode = await projectManager.resolveOpenMode();
      await openProject(node.resourcePath, mode);
    }),
    vscode.commands.registerCommand(
  "dock.registerResource",
  async (uri?: vscode.Uri) => {
    console.log("REGISTER TRIGGERED", uri);
    vscode.window.showInformationMessage("Register triggered");
    await projectManager.registerProject(uri);
    treeProvider.refresh();
  }
),
    vscode.commands.registerCommand("dock.copyPath", async (node) => {
      if (!node?.resourcePath) return;

      await vscode.env.clipboard.writeText(node.resourcePath);
      vscode.window.showInformationMessage("Path copied");
    }),
    vscode.commands.registerCommand("dock.rename", async (node) => {
      if (!node?.resourcePath) return;

      const newName = await vscode.window.showInputBox({
        prompt: "Enter new name",
        value: path.basename(node.resourcePath),
      });

      if (!newName) return;

      const newPath = path.join(path.dirname(node.resourcePath), newName);

      await vscode.workspace.fs.rename(
        vscode.Uri.file(node.resourcePath),
        vscode.Uri.file(newPath),
      );

      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.move", async (node) => {
      if (!node?.resourcePath) return;

      const target = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Select destination folder",
      });

      if (!target) return;

      const newPath = path.join(
        target[0].fsPath,
        path.basename(node.resourcePath),
      );

      await vscode.workspace.fs.rename(
        vscode.Uri.file(node.resourcePath),
        vscode.Uri.file(newPath),
      );

      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.revealInExplorer", async (node) => {
      if (!node?.resourcePath) return;

      await vscode.commands.executeCommand(
        "revealFileInOS",
        vscode.Uri.file(node.resourcePath),
      );
    }),
    vscode.commands.registerCommand("dock.delete", async (node) => {
      if (!node?.resourcePath) return;

      const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to delete this?",
        { modal: true },
        "Delete",
      );

      if (confirm !== "Delete") return;

      await vscode.workspace.fs.delete(vscode.Uri.file(node.resourcePath), {
        recursive: true,
      });

      treeProvider.refresh();
    }),
    vscode.commands.registerCommand(
  "dock.openNode",
  async (resourcePath: string, isDirectory: boolean) => {
    if (!resourcePath) return;

    const uri = vscode.Uri.file(resourcePath);

    if (isDirectory) {
      const mode = await projectManager.resolveOpenMode();
      await openProject(resourcePath, mode);
    } else {
      await vscode.window.showTextDocument(uri);
    }
  }
),
    vscode.commands.registerCommand("dock.removeProject", async (node) => {
      if (!node?.project) return;

      const confirm = await vscode.window.showWarningMessage(
        "Remove this project from Dock?",
        { modal: true },
        "Remove",
      );

      if (confirm !== "Remove") return;

      const projects = await projectManager.getProjects();
      const filtered = projects.filter((p) => p.path !== node.project.path);

      await projectManager.saveProjects(filtered);
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.deleteFromDisk", async (node) => {
      if (!node?.resourcePath) return;

      const confirm = await vscode.window.showWarningMessage(
        "This will permanently delete from disk. Continue?",
        { modal: true },
        "Delete",
      );

      if (confirm !== "Delete") return;

      await vscode.workspace.fs.delete(vscode.Uri.file(node.resourcePath), {
        recursive: true,
      });

      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.rename", async (node) => {
      if (!node?.resourcePath) return;

      const newName = await vscode.window.showInputBox({
        prompt: "Enter new name",
        value: path.basename(node.resourcePath),
      });

      if (!newName) return;

      const newPath = path.join(path.dirname(node.resourcePath), newName);

      await vscode.workspace.fs.rename(
        vscode.Uri.file(node.resourcePath),
        vscode.Uri.file(newPath),
      );

      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.delete", async (node) => {
      if (!node?.resourcePath) return;

      const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to delete this?",
        { modal: true },
        "Delete",
      );

      if (confirm !== "Delete") return;

      await vscode.workspace.fs.delete(vscode.Uri.file(node.resourcePath), {
        recursive: true,
      });

      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.move", async (node) => {
      if (!node?.resourcePath) return;

      const target = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Select destination folder",
      });

      if (!target) return;

      const newPath = path.join(
        target[0].fsPath,
        path.basename(node.resourcePath),
      );

      await vscode.workspace.fs.rename(
        vscode.Uri.file(node.resourcePath),
        vscode.Uri.file(newPath),
      );

      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("dock.revealInExplorer", async (node) => {
      if (!node?.resourcePath) return;

      await vscode.commands.executeCommand(
        "revealFileInOS",
        vscode.Uri.file(node.resourcePath),
      );
    }),

    vscode.commands.registerCommand("dock.createNewProject", async () => {
      await projectManager.createNewProject();
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand("dock.searchProject", async () => {
      await projectManager.searchProjects(async (project) => {
        const mode = await projectManager.resolveOpenMode();
        await openProject(project.path, mode);
      });
    }),

    vscode.commands.registerCommand(
      "dock.handleProjectClick",
      async (node: DockTreeNode) => {
        if (!isProjectNode(node)) return;

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
      },
    ),

    vscode.commands.registerCommand(
      "dock.openProject",
      async (projectPath: string) => {
        const mode = await projectManager.resolveOpenMode();
        await openProject(projectPath, mode);
      },
    ),
  );

  registerFileTracking(context, projectManager, treeProvider);
}

export function deactivate(): void {
  // no-op
}

const openProject = async (
  projectPath: string,
  mode: "newWindow" | "currentWindow" | "addToWorkspace",
): Promise<void> => {
  const uri = vscode.Uri.file(projectPath);

  switch (mode) {
    case "newWindow":
      await vscode.commands.executeCommand("vscode.openFolder", uri, true);
      break;

    case "currentWindow":
      await vscode.commands.executeCommand("vscode.openFolder", uri, false);
      break;

    case "addToWorkspace": {
      const current = vscode.workspace.workspaceFolders?.length ?? 0;
      vscode.workspace.updateWorkspaceFolders(current, 0, {
        uri,
        name: path.basename(uri.fsPath) || "Dock Project",
      });
      break;
    }
  }
};
