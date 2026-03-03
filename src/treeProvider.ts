import * as path from "path";
import * as vscode from "vscode";
import { DockProject, ProjectManager } from "./projectManager";
import { getWorkspaceName } from "./utils";

export type DockTreeNode = ProjectNode | FsNode;

export class DockTreeProvider implements vscode.TreeDataProvider<DockTreeNode> {
  private readonly emitter = new vscode.EventEmitter<
    DockTreeNode | undefined
  >();

  public readonly onDidChangeTreeData = this.emitter.event;

  private treeView?: vscode.TreeView<DockTreeNode>;

  constructor(private readonly projectManager: ProjectManager) {}

  // ----------------------------------
  // Bind TreeView
  // ----------------------------------

  public bindTreeView(treeView: vscode.TreeView<DockTreeNode>): void {
    this.treeView = treeView;
    this.updateHeaderDescription();
  }

  public refresh(): void {
    this.updateHeaderDescription();
    this.emitter.fire(undefined);
  }

  public async expandProject(node: ProjectNode): Promise<void> {
    if (!this.treeView) return;

    await this.treeView.reveal(node, {
      expand: true,
      focus: true,
      select: true,
    });
  }

  // ----------------------------------
  // Tree Rendering
  // ----------------------------------

  public getTreeItem(element: DockTreeNode): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: DockTreeNode): Promise<DockTreeNode[]> {
    // Root → show projects
    if (!element) {
      const projects = await this.projectManager.getProjects();

      return projects.map((project) => new ProjectNode(project));
    }

    // Expand project or folder
    if (element.isDirectory) {
      try {
        const entries = await vscode.workspace.fs.readDirectory(
          vscode.Uri.file(element.resourcePath),
        );

        return entries
          .sort((a, b) => {
            // Folders first
            if (
              a[1] === vscode.FileType.Directory &&
              b[1] !== vscode.FileType.Directory
            )
              return -1;

            if (
              b[1] === vscode.FileType.Directory &&
              a[1] !== vscode.FileType.Directory
            )
              return 1;

            return a[0].localeCompare(b[0]);
          })
          .map(([name, type]) => {
            const fullPath = path.join(element.resourcePath, name);

            return new FsNode(fullPath, type === vscode.FileType.Directory);
          });
      } catch {
        return [];
      }
    }

    return [];
  }

  // ----------------------------------
  // Header Branding
  // ----------------------------------

  private updateHeaderDescription(): void {
    if (!this.treeView) return;

    const showAuthorHeader = vscode.workspace
      .getConfiguration("dock")
      .get<boolean>("showAuthorHeader", true);

    this.treeView.description = showAuthorHeader
      ? `Workspace: ${getWorkspaceName()} • Aditya Sarode`
      : `Workspace: ${getWorkspaceName()}`;
  }
}

// =====================================
// PROJECT NODE
// =====================================

class ProjectNode extends vscode.TreeItem {
  public readonly isDirectory = true;
  public readonly resourcePath: string;

  constructor(public readonly project: DockProject) {
    super(project.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = "dockProject";
    this.resourcePath = project.path;
    this.tooltip = project.path;

    this.command = {
      command: "dock.openNode",
      title: "Open",
      arguments: [this.resourcePath, true],
    };
  }
}

// =====================================
// FILE / FOLDER NODE
// =====================================

class FsNode extends vscode.TreeItem {
  constructor(
    public readonly resourcePath: string,
    public readonly isDirectory: boolean,
  ) {
    super(
      path.basename(resourcePath),
      isDirectory
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );

    this.contextValue = isDirectory ? "dockFolder" : "dockFile";

    this.tooltip = resourcePath;

    this.command = {
      command: "dock.openNode",
      title: "Open",
      arguments: [this.resourcePath, this.isDirectory],
    };
  }
}

// =====================================
// Type Guard
// =====================================

export const isProjectNode = (node: DockTreeNode): node is ProjectNode =>
  node instanceof ProjectNode;
