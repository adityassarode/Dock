import * as path from 'path';
import * as vscode from 'vscode';
import { DockProject, ProjectManager } from './projectManager';
import { getWorkspaceName } from './utils';

export type DockTreeNode = ProjectNode | FsNode;

export class DockTreeProvider implements vscode.TreeDataProvider<DockTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<DockTreeNode | undefined>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private treeView?: vscode.TreeView<DockTreeNode>;

  constructor(private readonly projectManager: ProjectManager) {}

  public bindTreeView(treeView: vscode.TreeView<DockTreeNode>): void {
    this.treeView = treeView;
    this.updateHeaderDescription();
  }

  public refresh(): void {
    this.updateHeaderDescription();
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public async expandProject(node: ProjectNode): Promise<void> {
    if (!this.treeView) {
      return;
    }

    await this.treeView.reveal(node, { expand: true, focus: true, select: true });
  }

  public async getTreeItem(element: DockTreeNode): Promise<vscode.TreeItem> {
    return element;
  }

  public async getChildren(element?: DockTreeNode): Promise<DockTreeNode[]> {
    if (!element) {
      const projects = await this.projectManager.getProjects();
      return projects.map((project) => new ProjectNode(project));
    }

    if (element instanceof ProjectNode || element instanceof FsNode) {
      if (!element.isDirectory) {
        return [];
      }

      try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(element.resourcePath));
        return entries
          .filter(([name]) => name !== '.dock')
          .sort((a, b) => Number(b[1] === vscode.FileType.Directory) - Number(a[1] === vscode.FileType.Directory) || a[0].localeCompare(b[0]))
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

  private updateHeaderDescription(): void {
    const showAuthorHeader = vscode.workspace.getConfiguration('dock').get<boolean>('showAuthorHeader', true);
    if (!this.treeView) {
      return;
    }

    this.treeView.description = showAuthorHeader
      ? `Workspace: ${getWorkspaceName()} • User: Aditya Sarode`
      : `Workspace: ${getWorkspaceName()}`;
  }
}

class ProjectNode extends vscode.TreeItem {
  constructor(public readonly project: DockProject) {
    super(project.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'dockProject';
    this.resourcePath = project.path;
    this.tooltip = project.path;
    this.command = {
      command: 'dock.handleProjectClick',
      title: 'Handle Project Click',
      arguments: [this]
    };
  }

  public readonly isDirectory = true;
  public readonly resourcePath: string;
}

class FsNode extends vscode.TreeItem {
  constructor(public readonly resourcePath: string, public readonly isDirectory: boolean) {
    super(path.basename(resourcePath), isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    this.contextValue = isDirectory ? 'dockFolder' : 'dockFile';
    this.tooltip = resourcePath;

    if (!isDirectory) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(resourcePath)]
      };
    }
  }
}

export const isProjectNode = (node: DockTreeNode): node is ProjectNode => node instanceof ProjectNode;
